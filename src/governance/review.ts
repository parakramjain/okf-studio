import type { KnowledgeRecord, Proposal, Repository } from "../domain/types";
import { Store } from "../persistence/store";
import { hash, safePath, uid, assertNotAborted } from "../domain/security";
import { generateConcept, parseOKF, serializeOKF } from "../ingestion/okf";
export interface ReviewIO {
  read(root: string, path: string): Promise<string | null>;
  write(root: string, path: string, text: string): Promise<void>;
  delete(root: string, path: string): Promise<void>;
}
export async function propose(
  store: Store,
  io: ReviewIO,
  repo: Repository,
  path: string,
  after: string,
  reason: string,
  sourceHashes: Record<string, string> = {},
  root = repo.roots[0],
): Promise<Proposal> {
  safePath(path);
  if (!repo.roots.includes(root) || !repo.permissions.write)
    throw new Error("Repository does not allow this write target");
  const value: Proposal = {
    id: uid(),
    repoId: repo.id,
    root,
    path,
    before: await io.read(root, path),
    after,
    reason,
    createdAt: new Date().toISOString(),
    status: "pending",
    sourceHashes,
  };
  store.putProposal(value);
  store.audit("review.propose", value.id);
  await store.flush();
  return value;
}
const reviewLocks = new WeakMap<Store, Set<string>>();
/** Preflight the entire batch, confirm once, then keep the normal live checks per write. */
export async function applyBatch(
  store: Store,
  io: ReviewIO,
  ids: string[],
  action: "approve" | "reject",
  confirm: (proposals: Proposal[]) => Promise<boolean>,
  signal?: AbortSignal,
): Promise<number> {
  const proposals = [...new Set(ids)].map((id) => {
    const p = store.proposals().find((p) => p.id === id);
    if (!p || p.status !== "pending")
      throw new Error(
        "Selection includes a change that is no longer pending. Refresh the selection.",
      );
    return p;
  });
  if (!proposals.length) return 0;
  const targets = new Set<string>();
  const validate = async () => {
    for (const p of proposals) {
      assertNotAborted(signal);
      const repo = store.repositories().find((r) => r.id === p.repoId);
      if (
        !repo?.permissions.write ||
        !repo.roots.includes(p.root) ||
        store.proposals().find((v) => v.id === p.id)?.status !== "pending"
      )
        throw new Error(`Review permission or status changed: ${p.path}`);
      if (action === "reject") continue;
      safePath(p.path);
      if ((await io.read(p.root, p.path)) !== p.before)
        throw new Error(
          `Source changed since preview: ${p.path}. Regenerate before approving.`,
        );
      for (const [id, expected] of Object.entries(p.sourceHashes)) {
        const source = store.record(id);
        const text = source ? await io.read(source.root, source.path) : null;
        if (text === null || hash(text) !== expected)
          throw new Error(
            `Source changed since generation: ${p.path}. Synchronize and regenerate.`,
          );
      }
    }
  };
  for (const p of proposals) {
    const key = JSON.stringify([p.root, p.path]);
    if (action === "approve" && targets.has(key))
      throw new Error(
        `Multiple proposals target ${p.path}. Choose one version per file.`,
      );
    targets.add(key);
  }
  await validate();
  if (!(await confirm(proposals))) return 0;
  await validate();
  let completed = 0;
  try {
    for (const p of proposals) {
      assertNotAborted(signal);
      await applyProposal(store, io, p.id, action, async () => {
        assertNotAborted(signal);
        return true;
      });
      completed++;
    }
  } catch (error) {
    throw new Error(
      `${completed} of ${proposals.length} changes completed; remaining changes are pending. ${error instanceof Error ? error.message : "Write failed"}`,
    );
  }
  return completed;
}
export async function applyProposal(
  store: Store,
  io: ReviewIO,
  id: string,
  action: "approve" | "reject" | "undo",
  approve: () => Promise<boolean>,
): Promise<void> {
  const locks = reviewLocks.get(store) ?? new Set<string>();
  reviewLocks.set(store, locks);
  const proposal = store.proposals().find((p) => p.id === id);
  const key = proposal ? JSON.stringify([proposal.root, proposal.path]) : id;
  if (locks.has(key))
    throw new Error("This proposal target is already being reviewed");
  locks.add(key);
  try {
    await applyUnlocked(store, io, id, action, approve);
  } finally {
    locks.delete(key);
  }
}
async function applyUnlocked(
  store: Store,
  io: ReviewIO,
  id: string,
  action: "approve" | "reject" | "undo",
  approve: () => Promise<boolean>,
): Promise<void> {
  const p = store.proposals().find((p) => p.id === id);
  if (!p) throw new Error("Proposal no longer exists");
  const repo = store.repositories().find((r) => r.id === p.repoId);
  if (!repo?.permissions.write || !repo.roots.includes(p.root))
    throw new Error("Repository write permission missing");
  safePath(p.path);
  if (action === "reject") {
    if (p.status !== "pending")
      throw new Error("Only pending proposals may be rejected");
    p.status = "rejected";
  } else {
    if (
      (action === "approve" && p.status !== "pending") ||
      (action === "undo" && p.status !== "approved")
    )
      throw new Error("Invalid review state");
    const expected = action === "undo" ? p.after : p.before;
    const actual = await io.read(p.root, p.path);
    if (actual !== expected)
      throw new Error(
        "Source changed since preview. Create a new proposal to avoid overwriting edits.",
      );
    if (action === "approve")
      for (const [id, expectedHash] of Object.entries(p.sourceHashes)) {
        const record = store.record(id);
        if (!record) throw new Error("Source removed since generation");
        const current = await io.read(record.root, record.path);
        if (current === null || hash(current) !== expectedHash)
          throw new Error(
            "Source changed since generation; synchronize and regenerate.",
          );
      }
    if (!(await approve())) return;
    // A modal can remain open while another editor/process changes the file.
    const currentRepo = store.repositories().find((r) => r.id === p.repoId);
    const currentProposal = store.proposals().find((item) => item.id === p.id);
    if (
      !currentRepo?.permissions.write ||
      !currentRepo.roots.includes(p.root) ||
      currentProposal?.status !== p.status
    )
      throw new Error(
        "Proposal or repository permissions changed during review",
      );
    if ((await io.read(p.root, p.path)) !== expected)
      throw new Error(
        "Source changed during review. Create a new proposal to preserve your edits.",
      );
    if (action === "approve")
      for (const [sourceId, expectedHash] of Object.entries(p.sourceHashes)) {
        const record = store.record(sourceId);
        if (!record) throw new Error("Source removed during review");
        const current = await io.read(record.root, record.path);
        if (current === null || hash(current) !== expectedHash)
          throw new Error(
            "Source changed during review; synchronize and regenerate.",
          );
      }
    const next = action === "undo" ? p.before : p.after;
    if (next === null) await io.delete(p.root, p.path);
    else await io.write(p.root, p.path, next);
    p.status = action === "undo" ? "undone" : "approved";
    p.appliedAt = new Date().toISOString();
  }
  store.putProposal(p);
  store.audit(`review.${action}`, p.id);
  await store.flush();
}
export async function proposeBundle(
  store: Store,
  io: ReviewIO,
  repo: Repository,
): Promise<Proposal[]> {
  const results: Proposal[] = [];
  const records = store
    .records(repo.id)
    .filter((r) => !r.path.startsWith(".okf/"));
  for (const record of records) {
    const name = `.okf/concepts/${hash(record.root).slice(0, 8)}/${record.path}.md`;
    const existing = store
      .proposals()
      .find(
        (p) =>
          p.path === name && p.repoId === repo.id && p.status === "pending",
      );
    if (existing) continue;
    results.push(
      await propose(
        store,
        io,
        repo,
        name,
        generateConcept(record),
        "Deterministic observed facts; no inferred business requirements.",
        { [record.id]: record.contentHash },
      ),
    );
  }
  const listing = records
    .map(
      (r) =>
        `- [${r.title}](concepts/${hash(r.root).slice(0, 8)}/${r.path}.md)`,
    )
    .join("\n");
  results.push(
    await propose(
      store,
      io,
      repo,
      ".okf/index.md",
      `---\nokf_version: "0.2"\n---\n# Knowledge bundle\n\n${listing}\n`,
      "Portable OKF v0.2 bundle listing.",
    ),
  );
  return results;
}
export function editFrontmatter(
  record: KnowledgeRecord,
  metadata: Record<string, unknown>,
): string {
  return serializeOKF(parseOKF(record.content), metadata);
}
export function templateContent(
  kind: "ADR" | "Requirement" | "Glossary",
  title: string,
): string {
  return `---\ntype: ${kind === "ADR" ? "Decision" : kind}\ntitle: ${JSON.stringify(title)}\nstatus: draft\n---\n# ${title}\n\n${kind === "ADR" ? "## Context\n\n## Decision\n\n## Consequences" : kind === "Requirement" ? "## REQ-001\n\n## Acceptance criteria\n\n## Code and tests" : "## Terms\n\n| Term | Definition |\n| --- | --- |"}\n`;
}
export const escapeHTML = (text: string): string =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function exportHTML(records: KnowledgeRecord[]): string {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>OKF Knowledge Export</title><style>body{font:16px system-ui;max-width:900px;margin:3em auto;padding:1em}pre{white-space:pre-wrap}</style><h1>Knowledge export</h1>${records.map((r) => `<article><h2>${escapeHTML(r.title)}</h2><p>${escapeHTML(r.path)}</p><pre>${escapeHTML(r.content)}</pre></article>`).join("")}</html>`;
}

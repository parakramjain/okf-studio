import { z } from "zod";
import type { KnowledgeRecord, Progress, Repository } from "../domain/types";
import { assertNotAborted, hash, safePath, uid } from "../domain/security";
import { Store } from "../persistence/store";
import { generateConcept } from "../ingestion/okf";
import type { ReviewIO } from "./review";

export interface BundleFile {
  path: string;
  content: string;
  sourceHashes: Record<string, string>;
}
export interface BundleIO extends ReviewIO {
  exists(root: string): Promise<boolean>;
  /** Publish a complete new directory, failing if destination already exists. */
  publish(
    root: string,
    files: BundleFile[],
    signal?: AbortSignal,
  ): Promise<void>;
}
const markerPath = ".okf-studio.json";
const markerSchema = z.object({
  version: z.literal(1),
  sourceRepoId: z.string(),
});
export function bundleSources(
  records: KnowledgeRecord[],
  repoId: string,
  outputRoots: string[] = [],
): KnowledgeRecord[] {
  return records
    .filter(
      (r) =>
        r.repoId === repoId &&
        !r.path.startsWith(".okf/") &&
        !outputRoots.some((root) =>
          r.sourceUri.startsWith(root.replace(/\/$/, "") + "/"),
        ) &&
        !(
          r.metadata.generated &&
          typeof r.metadata.generated === "object" &&
          String(
            (r.metadata.generated as Record<string, unknown>).by,
          ).startsWith("okf-knowledge-studio/")
        ),
    )
    .sort(
      (a, b) => a.root.localeCompare(b.root) || a.path.localeCompare(b.path),
    );
}
export function planBundle(records: KnowledgeRecord[]): BundleFile[] {
  const files = records.map((record) => ({
    path: safePath(
      `concepts/${hash(record.root).slice(0, 8)}/${record.path}.md`,
    ),
    // Stable provenance makes unchanged generations a no-op.
    content: generateConcept(record, record.indexedAt),
    sourceHashes: { [record.id]: record.contentHash },
  }));
  const listing = records
    .map(
      (r, i) =>
        `- [${r.title.replace(/[\r\n]/g, " ").replace(/[\\[\]]/g, "\\$&")}](${files[i].path.split("/").map(encodeURIComponent).join("/")})`,
    )
    .join("\n");
  files.push({
    path: "index.md",
    content: `---\nokf_version: "0.2"\n---\n# ${records.length ? "Knowledge bundle" : "Empty bundle"}\n\n${listing}\n`,
    sourceHashes: Object.fromEntries(records.map((r) => [r.id, r.contentHash])),
  });
  return files;
}
export async function createOrUpdateBundle(
  store: Store,
  io: BundleIO,
  source: Repository,
  destination: string,
  progress: (p: Progress) => void = () => undefined,
  signal?: AbortSignal,
): Promise<{
  kind: "created" | "review" | "unchanged";
  files: number;
  repository: Repository;
}> {
  if (!source.permissions.read || source.bundleSourceId)
    throw new Error(
      "Choose a readable source repository, not a generated bundle.",
    );
  const records = bundleSources(store.records(source.id), source.id, [
    destination,
    ...store
      .repositories()
      .filter((r) => r.bundleSourceId)
      .flatMap((r) => r.roots),
  ]);
  if (!records.length)
    throw new Error(
      "No indexed sources for this repository. Synchronize it before creating OKF.",
    );
  const output: Repository = {
    id: `bundle-${hash(destination).slice(0, 24)}`,
    name: `${source.name} · OKF`,
    kind: "document",
    roots: [destination],
    permissions: { read: true, write: true },
    bundleSourceId: source.id,
  };
  const exists = await io.exists(destination);
  if (exists) {
    const raw = await io.read(destination, markerPath);
    let marker: z.infer<typeof markerSchema> | undefined;
    try {
      if (raw && raw.length < 10000)
        marker = markerSchema.parse(JSON.parse(raw));
    } catch {
      /* Not an owned bundle. */
    }
    if (marker?.sourceRepoId !== source.id)
      throw new Error(
        "This folder already exists and is not this repository's OKF bundle. Choose a new folder name; existing files were preserved.",
      );
    if (
      store
        .proposals()
        .some((p) => p.root === destination && p.status === "pending")
    )
      throw new Error(
        "This bundle has pending changes in Quality & Governance. Review or reject them before generating again.",
      );
  }
  for (const [index, record] of records.entries()) {
    assertNotAborted(signal);
    const text = await io.read(record.root, record.path);
    if (text === null || hash(text) !== record.contentHash)
      throw new Error(
        `Source changed since indexing: ${record.path}. Synchronize the repository and try again.`,
      );
    progress({
      stage: "Preparing OKF bundle",
      completed: index + 1,
      total: records.length,
      detail: record.path,
    });
  }
  const files = planBundle(records);
  assertNotAborted(signal);
  if (!exists) {
    await io.publish(
      destination,
      [
        ...files,
        {
          path: markerPath,
          content:
            JSON.stringify({ version: 1, sourceRepoId: source.id }, null, 2) +
            "\n",
          sourceHashes: {},
        },
      ],
      signal,
    );
    store.putRepository(output);
    store.setMeta(`bundleDestination:${source.id}`, destination);
    store.audit(
      "bundle.create",
      output.id,
      `${files.length} files; source=${source.id}`,
    );
    await store.flush();
    return { kind: "created", files: files.length, repository: output };
  }
  const changes: (BundleFile & { before: string | null })[] = [];
  for (const file of files) {
    assertNotAborted(signal);
    const before = await io.read(destination, file.path);
    if (before !== file.content) changes.push({ ...file, before });
  }
  assertNotAborted(signal);
  store.transaction(() => {
    store.putRepository(output);
    store.setMeta(`bundleDestination:${source.id}`, destination);
    for (const file of changes) {
      const id = uid();
      store.putProposal({
        id,
        repoId: output.id,
        root: destination,
        path: file.path,
        before: file.before,
        after: file.content,
        reason: `Update OKF bundle from ${source.name}; preserve existing files until approved.`,
        createdAt: new Date().toISOString(),
        status: "pending",
        sourceHashes: file.sourceHashes,
      });
      store.audit("review.propose", id);
    }
  });
  await store.flush();
  return {
    kind: changes.length ? "review" : "unchanged",
    files: changes.length,
    repository: output,
  };
}

import { parseDocument, stringify, type Document } from "yaml";
import path from "node:path";
import type { Issue, KnowledgeRecord } from "../domain/types";
import { resolveLink } from "../domain/security";
export interface OKFDocument {
  metadata: Record<string, unknown>;
  body: string;
  yaml?: Document;
  original: string;
  bodyStart: number;
  errors: string[];
}
export function parseOKF(text: string): OKFDocument {
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match)
    return {
      metadata: {},
      body: text,
      original: text,
      bodyStart: 1,
      errors: ["Missing YAML frontmatter"],
    };
  const yaml = parseDocument(match[1], { uniqueKeys: true });
  try {
    const value: unknown = yaml.toJS({ maxAliasCount: 50 });
    const object =
      value !== null && typeof value === "object" && !Array.isArray(value);
    return {
      metadata: object ? (value as Record<string, unknown>) : {},
      body: text.slice(match[0].length),
      yaml,
      original: text,
      bodyStart: match[0].split("\n").length,
      errors: [
        ...yaml.errors.map((e) => e.message),
        ...(!object ? ["Frontmatter must be a mapping"] : []),
      ],
    };
  } catch (error) {
    return {
      metadata: {},
      body: text.slice(match[0].length),
      original: text,
      bodyStart: match[0].split("\n").length,
      errors: [String(error)],
    };
  }
}
export function serializeOKF(
  doc: OKFDocument,
  updates: Record<string, unknown> = {},
): string {
  if (doc.yaml) {
    for (const [key, value] of Object.entries(updates))
      doc.yaml.set(key, value);
    return `---\n${doc.yaml.toString()}---\n${doc.body}`;
  }
  return `---\n${stringify({ ...doc.metadata, ...updates })}---\n${doc.body}`;
}
export function trustTier(metadata: Record<string, unknown>): string {
  const entries = Array.isArray(metadata.verified)
    ? metadata.verified
    : metadata.verified
      ? [metadata.verified]
      : [];
  const actors = entries
    .filter((v) => v && typeof v === "object")
    .map((v) => String((v as Record<string, unknown>).by ?? ""));
  return actors.some((a) => a.startsWith("human:"))
    ? "human-reviewed"
    : actors.length
      ? "machine-confirmed"
      : "unverified";
}
export function validateOKF(
  file: string,
  text: string,
  existing: Set<string> = new Set(),
): Issue[] {
  const doc = parseOKF(text);
  const issues: Issue[] = [];
  const add = (
    code: string,
    message: string,
    severity: Issue["severity"] = "error",
  ) => issues.push({ recordId: file, code, message, severity });
  const basename = path.posix.basename(file);
  if (basename === "index.md") {
    if (
      Object.keys(doc.metadata).length &&
      (file !== "index.md" ||
        Object.keys(doc.metadata).some((k) => k !== "okf_version"))
    )
      add(
        "okf.index",
        "Only bundle-root index.md may contain frontmatter, and only okf_version.",
      );
    if (doc.errors.length && !doc.errors.includes("Missing YAML frontmatter"))
      doc.errors.forEach((e) => add("okf.yaml", e));
    if (!/^#\s+/m.test(doc.body))
      add(
        "okf.index.heading",
        "Index should group entries under headings.",
        "warning",
      );
  } else if (basename === "log.md") {
    if (!doc.errors.includes("Missing YAML frontmatter"))
      add("okf.log.frontmatter", "log.md must not contain frontmatter.");
    for (const date of [...text.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1]))
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date
      )
        add("okf.log.date", `Invalid ISO date heading: ${date}`);
  } else {
    doc.errors.forEach((e) => add("okf.yaml", e));
    if (typeof doc.metadata.type !== "string" || !doc.metadata.type.trim())
      add("okf.type", "Concept requires a non-empty string type.");
  }
  if (
    doc.metadata.status &&
    !["draft", "stable", "deprecated"].includes(String(doc.metadata.status))
  )
    add("okf.status", "Unrecognized lifecycle status.", "warning");
  if (
    doc.metadata.generated &&
    !(doc.metadata.generated as Record<string, unknown>).by
  )
    add("okf.generated", "generated should include an actor in by.", "warning");
  if (
    doc.metadata.stale_after &&
    Date.now() >= Date.parse(String(doc.metadata.stale_after))
  )
    add("okf.stale", "Concept has passed stale_after.", "warning");
  const verified = Array.isArray(doc.metadata.verified)
    ? doc.metadata.verified
    : doc.metadata.verified
      ? [doc.metadata.verified]
      : [];
  for (const entry of verified)
    if (
      !entry ||
      typeof entry !== "object" ||
      !entry.by ||
      Number.isNaN(Date.parse(String(entry.at)))
    )
      add(
        "okf.verified",
        "Verification events should include by and an ISO timestamp.",
        "warning",
      );
  if (doc.metadata.type === "Attested Computation" && !doc.metadata.runtime)
    add(
      "okf.runtime",
      "Attested Computation should declare runtime. It is never executed by this extension.",
      "warning",
    );
  for (const match of doc.body.matchAll(
    /\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g,
  )) {
    try {
      const target = resolveLink(file, match[1]);
      if (target && !existing.has(target))
        add("link.broken", `Unresolved link: ${match[1]}`, "warning");
    } catch {
      add("link.unsafe", `Link escapes bundle: ${match[1]}`, "warning");
    }
  }
  return issues;
}
export function generateConcept(
  record: KnowledgeRecord,
  generatedAt = new Date().toISOString(),
): string {
  const metadata = {
    type: record.kind === "code" ? "Code Reference" : "Reference",
    title: record.title,
    status: "draft",
    resource: record.sourceUri,
    sources: [
      {
        id: "source",
        resource: record.sourceUri,
        last_modified: record.indexedAt,
      },
    ],
    generated: {
      by: "okf-knowledge-studio/0.4.1",
      at: generatedAt,
    },
    "x-okf-studio": {
      source_hash: record.contentHash,
      commit: record.commit,
      span: record.span,
      confidence: 1,
      evidence: "observed",
    },
  };
  const facts =
    record.kind === "code"
      ? record.symbols
          .map(
            (s) =>
              `- ${s.kind} \`${s.name}\` (lines ${s.span.start}–${s.span.end}): \`${s.signature.replace(/`/g, "\\`")}\``,
          )
          .join("\n") || "No top-level symbols were extracted."
      : record.content;
  return `---\n${stringify(metadata)}---\n# ${record.title}\n\n## Observed facts\n\n${facts}\n\n## Provenance\n\nObserved in [source](${record.sourceUri}), lines ${record.span.start}–${record.span.end}.[^source]\n\n[^source]: ${record.sourceUri} (SHA-256 ${record.contentHash})\n\n## Inferences\n\nNo business requirements inferred. Human review required.\n`;
}

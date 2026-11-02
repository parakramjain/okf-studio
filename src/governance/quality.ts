import type { Graph, Issue, KnowledgeRecord } from "../domain/types";
import { injectionWarnings, redact } from "../domain/security";
import { validateOKF } from "../ingestion/okf";
export function quality(
  records: KnowledgeRecord[],
  graph: Graph,
): { issues: Issue[]; score: number; requirementCoverage: number } {
  const issues: Issue[] = [];
  const pathsByRoot = new Map<string, Set<string>>();
  const byURI = new Map(records.map((r) => [r.sourceUri, r]));
  const tested = new Set(
    graph.edges.filter((e) => e.kind === "tests").map((e) => e.to),
  );
  const referenced = new Set(
    graph.edges.filter((e) => e.kind === "references").map((e) => e.to),
  );
  const requirementNames = new Set(
    graph.nodes
      .filter((node) => node.kind === "requirement")
      .map((node) => node.label),
  );
  for (const r of records) {
    const key = `${r.repoId}:${r.root}`;
    const paths = pathsByRoot.get(key) ?? new Set<string>();
    paths.add(r.path);
    if (r.path.startsWith(".okf/")) paths.add(r.path.slice(5));
    pathsByRoot.set(key, paths);
  }
  for (const r of records) {
    if (r.kind === "code")
      for (const match of r.content.matchAll(/\bREQ[-_]\d+\b/g))
        if (!requirementNames.has(match[0]))
          issues.push({
            recordId: r.id,
            severity: "warning",
            code: "trace.unresolved_requirement",
            message: `Code references ${match[0]} but no requirement document was indexed.`,
          });
    if (r.kind === "document" && /\.md$/i.test(r.path)) {
      const paths = pathsByRoot.get(`${r.repoId}:${r.root}`)!;
      for (const issue of validateOKF(
        r.path.startsWith(".okf/") ? r.path.slice(5) : r.path,
        r.content,
        paths,
      ))
        issues.push({
          ...issue,
          recordId: r.id,
          severity:
            !r.content.startsWith("---") &&
            (issue.code === "okf.type" || issue.code === "okf.yaml")
              ? "info"
              : issue.severity,
        });
    }
    for (const message of injectionWarnings(r.content))
      issues.push({
        recordId: r.id,
        severity: "warning",
        code: "security.injection",
        message,
      });
    if (redact(r.content) !== r.content)
      issues.push({
        recordId: r.id,
        severity: "warning",
        code: "security.sensitive",
        message:
          "Potential sensitive content detected. Exported and AI context is redacted; inspect the original source locally. Detection is heuristic.",
      });
    const provenance = r.metadata["x-okf-studio"] as
      Record<string, unknown> | undefined;
    if (provenance) {
      const source = byURI.get(String(r.metadata.resource));
      if (!source || source.contentHash !== provenance.source_hash)
        issues.push({
          recordId: r.id,
          severity: "warning",
          code: "drift.source",
          message:
            "Source has changed or is unavailable since knowledge generation.",
        });
      else if (source.commit && source.commit !== provenance.commit)
        issues.push({
          recordId: r.id,
          severity: "info",
          code: "drift.commit",
          message: "Source commit changed; content hash still matches.",
        });
    }
    for (const symbol of r.symbols.filter((s) => s.kind === "function"))
      if (!tested.has(symbol.id))
        issues.push({
          recordId: r.id,
          severity: "info",
          code: "coverage.untested",
          line: symbol.span.start,
          message: `No extracted test relation for ${symbol.name}; this is a static heuristic.`,
        });
    if (!referenced.has(r.id) && r.kind === "document")
      issues.push({
        recordId: r.id,
        severity: "info",
        code: "graph.orphan",
        message: "No incoming document links in this catalog.",
      });
  }
  const groups = new Map<string, KnowledgeRecord[]>();
  for (const r of records)
    groups.set(r.contentHash, [...(groups.get(r.contentHash) ?? []), r]);
  for (const group of groups.values())
    if (group.length > 1)
      for (const r of group)
        issues.push({
          recordId: r.id,
          severity: "warning",
          code: "quality.duplicate",
          message: `Exact duplicate content: ${group
            .filter((t) => t.id !== r.id)
            .map((t) => t.path)
            .join(", ")}`,
        });
  const claims = new Map<
    string,
    { record: KnowledgeRecord; negative: boolean }[]
  >();
  for (const record of records.filter((r) => r.kind === "document"))
    for (const m of record.content.matchAll(
      /^(.+?)\s+(must|shall)\s+(not\s+)?(.+)$/gim,
    )) {
      const key = (m[1] + " " + m[4])
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .trim();
      claims.set(key, [
        ...(claims.get(key) ?? []),
        { record, negative: !!m[3] },
      ]);
    }
  for (const values of claims.values())
    if (values.some((v) => v.negative) && values.some((v) => !v.negative))
      for (const v of values)
        issues.push({
          recordId: v.record.id,
          severity: "warning",
          code: "quality.contradiction",
          message:
            "Potential opposing must/shall statements. Human interpretation required.",
        });
  const requirements = graph.nodes.filter((n) => n.kind === "requirement");
  const covered = requirements.filter((n) =>
    graph.edges.some((e) => e.to === n.id && e.kind === "implements"),
  );
  return {
    issues,
    score: Math.max(
      0,
      100 -
        Math.round(
          (100 * issues.filter((i) => i.severity !== "info").length) /
            Math.max(records.length, 1),
        ),
    ),
    requirementCoverage: requirements.length
      ? covered.length / requirements.length
      : 0,
  };
}

import path from "node:path";
import type { Graph, GraphEdge, KnowledgeRecord } from "../domain/types";
import { resolveLink } from "../domain/security";
export function buildGraph(records: KnowledgeRecord[]): Graph {
  const graph: Graph = { nodes: [], edges: [] };
  const byName = new Map<string, { id: string; record: KnowledgeRecord }[]>();
  const nodeIDs = new Set<string>();
  const edgeKeys = new Set<string>();
  const nodeLabels = new Map<string, string>();
  const byPath = new Map(
    records.map((r) => [`${r.repoId}:${r.root}:${r.path}`, r]),
  );
  const edge = (
    from: string,
    to: string,
    kind: GraphEdge["kind"],
    resolved: boolean,
  ) => {
    const key = `${from}:${to}:${kind}`;
    if (!edgeKeys.has(key)) {
      edgeKeys.add(key);
      graph.edges.push({ from, to, kind, resolved });
    }
  };
  for (const r of records) {
    if (!nodeIDs.has(r.repoId)) {
      graph.nodes.push({ id: r.repoId, label: r.repoId, kind: "repository" });
      nodeIDs.add(r.repoId);
    }
    graph.nodes.push({
      id: r.id,
      label: r.path,
      kind: r.kind === "code" ? "file" : "document",
      recordId: r.id,
    });
    nodeIDs.add(r.id);
    nodeLabels.set(r.path, r.id);
    edge(r.repoId, r.id, "defines", true);
    for (const symbol of r.symbols) {
      graph.nodes.push({
        id: symbol.id,
        label: symbol.name,
        kind: symbol.kind,
        recordId: r.id,
      });
      nodeIDs.add(symbol.id);
      nodeLabels.set(symbol.name, symbol.id);
      edge(r.id, symbol.id, "defines", true);
      const values = byName.get(symbol.name) ?? [];
      values.push({ id: symbol.id, record: r });
      byName.set(symbol.name, values);
    }
  }
  const resolveImport = (
    r: KnowledgeRecord,
    module: string,
  ): KnowledgeRecord | undefined => {
    if (!module.startsWith(".")) return undefined;
    const target = path.posix.normalize(
      path.posix.join(path.posix.dirname(r.path), module),
    );
    for (const file of [
      target,
      `${target}.ts`,
      `${target}.tsx`,
      `${target}.js`,
      `${target}.py`,
      `${target}/index.ts`,
      `${target}/index.js`,
    ]) {
      const match = byPath.get(`${r.repoId}:${r.root}:${file}`);
      if (match) return match;
    }
    return undefined;
  };
  for (const r of records) {
    for (const imported of r.imports) {
      const target = resolveImport(r, imported);
      if (target) edge(r.id, target.id, "imports", true);
      else {
        const id = `external:${r.repoId}:${imported}`;
        if (!nodeIDs.has(id)) {
          graph.nodes.push({ id, label: imported, kind: "module" });
          nodeIDs.add(id);
        }
        edge(r.id, id, "imports", false);
      }
    }
    for (const link of r.links)
      try {
        let target = resolveLink(r.path, link);
        if (target && r.path.startsWith(".okf/") && link.startsWith("/"))
          target = ".okf/" + target;
        const record = target
          ? byPath.get(`${r.repoId}:${r.root}:${target}`)
          : undefined;
        if (record) edge(r.id, record.id, "references", true);
      } catch {
        /* unsafe link surfaced by diagnostics */
      }
    for (const symbol of r.symbols)
      for (const call of symbol.calls) {
        const local = (byName.get(call) ?? []).filter(
          (s) => s.record.id === r.id,
        );
        const candidates = local.length
          ? local
          : (byName.get(call.split(".").at(-1)!) ?? []).filter(
              (s) => s.record.repoId === r.repoId,
            );
        if (candidates.length === 1)
          edge(
            symbol.id,
            candidates[0].id,
            symbol.kind === "test" ? "tests" : "calls",
            local.length === 1 && !call.includes("."),
          );
      }
    for (const match of r.content.matchAll(/\bREQ[-_]\d+\b/g))
      for (const target of (byName.get(match[0]) ?? []).filter(
        (t) => t.record.id !== r.id,
      ))
        edge(
          r.id,
          target.id,
          r.kind === "code" ? "implements" : "references",
          false,
        );
    for (const field of ["implements", "tests", "depends_on"] as const) {
      const targets = r.metadata[field];
      if (Array.isArray(targets))
        for (const target of targets) {
          const id = nodeIDs.has(String(target))
            ? String(target)
            : nodeLabels.get(String(target));
          if (id) edge(r.id, id, field, true);
        }
    }
  }
  return graph;
}
export function changeImpact(
  graph: Graph,
  start: string,
  depth = 3,
  limit = 250,
): string[] {
  if (!graph.nodes.some((n) => n.id === start))
    throw new Error("Unknown graph node");
  const seen = new Set([start]);
  let frontier = [start];
  for (let d = 0; d < Math.min(Math.max(depth, 1), 8) && frontier.length; d++) {
    const next: string[] = [];
    for (const current of frontier)
      for (const e of graph.edges) {
        const id =
          e.to === current
            ? e.from
            : e.from === current && e.kind === "defines"
              ? e.to
              : undefined;
        if (
          id &&
          !seen.has(id) &&
          !graph.nodes.some((n) => n.id === id && n.kind === "repository")
        ) {
          seen.add(id);
          next.push(id);
          if (seen.size >= limit) return [...seen];
        }
      }
    frontier = next;
  }
  return [...seen];
}
export function traceRequirement(
  graph: Graph,
  id: string,
): { nodes: string[]; edges: GraphEdge[]; tested: boolean } {
  const target = graph.nodes.find((n) => n.id === id || n.label === id);
  if (!target)
    throw new Error("Requirement not found; search_knowledge discovers IDs.");
  const nodes = changeImpact(graph, target.id, 5);
  const set = new Set(nodes);
  const edges = graph.edges.filter((e) => set.has(e.from) && set.has(e.to));
  return { nodes, edges, tested: edges.some((e) => e.kind === "tests") };
}

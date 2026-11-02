import { z } from "zod";
import type { Graph, KnowledgeRecord, Scope } from "../src/domain/types";
import { inScope } from "../src/domain/scope";

export const tabs = [
  "Repositories",
  "Knowledge Explorer",
  "AI Assistant",
  "Vector Studio",
  "Agent Hub",
  "Quality & Governance",
] as const;
export type Tab = (typeof tabs)[number];
const filters = z.object({
  multiRepo: z.boolean().default(false),
  repoIds: z.array(z.string().max(500)).max(100).default([]),
  repo: z.string().max(500).default(""),
  folder: z.string().max(1000).default(""),
  selected: z.array(z.string().max(500)).max(2000).default([]),
  query: z.string().max(4000).default(""),
  sourceFilter: z.string().max(1000).default(""),
  kind: z.enum(["all", "code", "document"]).default("all"),
  sort: z.enum(["path", "recent", "title"]).default("path"),
  strategy: z.enum(["keyword", "semantic", "hybrid"]).default("keyword"),
  display: z.enum(["list", "tree", "graph"]).default("tree"),
});
const savedView = filters.extend({
  id: z.string().max(100),
  name: z.string().trim().min(1).max(60),
});
const preferences = filters.extend({
  edition: z.literal(4).default(4),
  tab: z.enum(tabs).default("Repositories"),
  saved: z.array(savedView).max(12).default([]),
});
export type Preferences = z.infer<typeof preferences>;
export type SavedView = z.infer<typeof savedView>;
export function workspaceScope(
  prefs: Pick<
    Preferences,
    "repo" | "repoIds" | "multiRepo" | "folder" | "selected"
  >,
): Scope {
  return {
    repoIds: prefs.multiRepo
      ? prefs.repoIds
      : prefs.repo
        ? [prefs.repo]
        : undefined,
    recordIds: prefs.selected.length ? prefs.selected : undefined,
    folder: prefs.folder || undefined,
  };
}
export function restorePreferences(value: unknown): Preferences {
  const aliases: Record<string, string> = {
    Overview: "Repositories",
    Explorer: "Knowledge Explorer",
    "Ask AI": "AI Assistant",
    Indexes: "Vector Studio",
    Insights: "Quality & Governance",
  };
  const migrated =
    value && typeof value === "object"
      ? {
          ...value,
          edition: 4,
          tab:
            "tab" in value && typeof value.tab === "string"
              ? (aliases[value.tab] ?? value.tab)
              : "Repositories",
        }
      : {};
  const parsed = preferences.safeParse(migrated);
  if (
    parsed.success &&
    value &&
    typeof value === "object" &&
    !("edition" in value) &&
    parsed.data.display === "list"
  )
    parsed.data.display = "tree";
  return parsed.success ? parsed.data : preferences.parse({});
}
export function filterSources(
  records: KnowledgeRecord[],
  prefs: Preferences,
): KnowledgeRecord[] {
  const term = prefs.sourceFilter.trim().toLowerCase();
  return records
    .filter(
      (r) =>
        inScope(r, {
          repoIds: prefs.multiRepo
            ? prefs.repoIds
            : prefs.repo
              ? [prefs.repo]
              : undefined,
          folder: prefs.folder,
        }) &&
        (prefs.kind === "all" || r.kind === prefs.kind) &&
        (!term || `${r.path} ${r.title}`.toLowerCase().includes(term)),
    )
    .sort(
      (a, b) =>
        (prefs.sort === "recent"
          ? (b.indexedAt ?? "").localeCompare(a.indexedAt ?? "")
          : prefs.sort === "title"
            ? (a.title ?? a.path).localeCompare(b.title ?? b.path)
            : 0) || a.path.localeCompare(b.path),
    );
}
/** Keep only in-scope owners and their direct external dependencies. */
export function scopeGraph(
  graph: Graph,
  records: KnowledgeRecord[],
  scope: Scope,
): Graph {
  const allowed = records.filter((r) => inScope(r, scope));
  const recordIds = new Set(allowed.map((r) => r.id));
  const repoIds = new Set(allowed.map((r) => r.repoId));
  const ids = new Set(
    graph.nodes
      .filter(
        (n) =>
          recordIds.has(n.recordId ?? n.id) ||
          (n.kind === "repository" && repoIds.has(n.id)),
      )
      .map((n) => n.id),
  );
  const external = new Set(
    graph.nodes
      .filter((n) => !n.recordId && n.kind !== "repository")
      .map((n) => n.id),
  );
  for (const edge of graph.edges)
    if (ids.has(edge.from) && external.has(edge.to)) ids.add(edge.to);
  return {
    nodes: graph.nodes.filter((n) => ids.has(n.id)),
    edges: graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
  };
}
export function savedViewAvailable(
  view: SavedView,
  repositories: { id: string }[],
  records: { id: string }[],
): boolean {
  return (
    (!view.repo || repositories.some((r) => r.id === view.repo)) &&
    (!view.multiRepo ||
      view.repoIds.every((id) => repositories.some((r) => r.id === id))) &&
    view.selected.every((id) => records.some((r) => r.id === id))
  );
}

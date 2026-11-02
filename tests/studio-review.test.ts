import { describe, it, expect } from "vitest";
import { synchronize } from "../src/ingestion/ingest";
import { parseSource } from "../src/ingestion/parser";
import { chunkRecord } from "../src/ingestion/chunks";
import { Store } from "../src/persistence/store";
import { buildGraph } from "../src/graph/graph";
import { inScope } from "../src/domain/scope";
import {
  filterSources,
  restorePreferences,
  savedViewAvailable,
  scopeGraph,
} from "../webview/model";
import type { Repository, SourceFS } from "../src/domain/types";

const repo: Repository = {
  id: "r",
  name: "Repo",
  kind: "hybrid",
  roots: ["file:///r"],
  permissions: { read: true, write: true },
  commit: "commit-a",
};
const options = { maxFileBytes: 10000, ignore: [], chunkLines: 20, overlap: 2 };
function filesystem(files: Map<string, string>): SourceFS {
  return {
    join: (r, p) => `${r}/${p}`,
    read: async (uri) => {
      const text = files.get(uri.slice("file:///r/".length));
      if (text === undefined) throw new Error("Not found");
      return new TextEncoder().encode(text);
    },
    size: async () => 100,
    list: async (uri) => {
      const prefix =
        uri === "file:///r" ? "" : uri.slice("file:///r/".length) + "/";
      const entries = new Map<string, "file" | "directory">();
      for (const path of files.keys())
        if (path.startsWith(prefix)) {
          const tail = path.slice(prefix.length);
          entries.set(
            tail.split("/")[0],
            tail.includes("/") ? "directory" : "file",
          );
        }
      return [...entries].map(([name, kind]) => ({ name, kind }));
    },
  };
}
const open = () =>
  Store.open({ read: async () => undefined, write: async () => undefined });

describe("end-to-end review regressions", () => {
  it("indexes generated bundle roots separately without duplicate source records", async () => {
    const files = new Map([
      ["source.md", "# Source"],
      ["custom-okf/index.md", "# Bundle"],
      ["custom-okf/concepts/a.md", "# Generated"],
    ]);
    const store = await open();
    await synchronize(repo, filesystem(files), store, options);
    expect(store.records()).toHaveLength(3);
    await synchronize(repo, filesystem(files), store, {
      ...options,
      excludedRoots: ["file:///r/custom-okf"],
    });
    expect(store.records().map((r) => r.path)).toEqual(["source.md"]);
    await store.close();
  });
  it("applies nested ignores relative to their own directory at any depth, including anchoring and negation", async () => {
    const files = new Map([
      [".gitignore", "*.md\n"],
      ["docs/.gitignore", "!keep.md\n*.ts\n/only.md\n"],
      ["docs/a.ts", "export const a = 1;"],
      ["docs/deep/a.ts", "export const a = 2;"],
      ["docs/deep/keep.md", "# Kept"],
      ["docs/only.md", "# Ignored"],
      ["docs/deep/.gitignore", "!only.md\n"],
      ["docs/deep/only.md", "# Kept too"],
      ["outside.ts", "export const b = 1;"],
    ]);
    const store = await open();
    await synchronize(repo, filesystem(files), store, options);
    expect(
      store
        .records()
        .map((r) => r.path)
        .sort(),
    ).toEqual(["docs/deep/keep.md", "docs/deep/only.md", "outside.ts"]);
    await store.close();
  });
  it("refreshes unchanged source provenance while retaining embeddings and reports durable sync status", async () => {
    const fs = filesystem(new Map([["a.ts", "export const x = 1;"]]));
    const store = await open();
    await synchronize(repo, fs, store, options);
    const chunk = store.chunks()[0];
    store.putChunk({ ...chunk, vector: [1, 2], namespace: "saved" });
    const result = await synchronize(
      { ...repo, commit: "commit-b" },
      fs,
      store,
      options,
    );
    expect(result.changed).toBe(0);
    expect(store.records()[0].commit).toBe("commit-b");
    expect(store.chunks()[0].vector).toEqual([1, 2]);
    expect(JSON.parse(store.getMeta("sync:r:file:///r")!)).toMatchObject({
      scanned: 1,
      errorCount: 0,
      cancelled: false,
    });
    await store.close();
  });
  it("retries a changed chunk policy after a partial read failure", async () => {
    const files = new Map([
      ["a.md", Array.from({ length: 55 }, (_, i) => `Line ${i}`).join("\n")],
    ]);
    const fs = filesystem(files);
    const store = await open();
    await synchronize(repo, fs, store, options);
    const changed = { ...options, chunkLines: 8, overlap: 1 };
    await synchronize(
      repo,
      {
        ...fs,
        read: async () => {
          throw new Error("Temporary read failure");
        },
      },
      store,
      changed,
    );
    await synchronize(repo, fs, store, changed);
    expect(store.chunks().length).toBeGreaterThan(5);
    await store.close();
  });
  it("normalizes Windows folder scope without matching sibling prefixes", () => {
    expect(
      inScope(
        { id: "a", repoId: "r", path: "docs/api/guide.md" },
        { folder: " ./docs\\api\\ " },
      ),
    ).toBe(true);
    expect(
      inScope(
        { id: "a", repoId: "r", path: "docs/api2/guide.md" },
        { folder: "docs/api" },
      ),
    ).toBe(false);
    expect(
      inScope({ id: "a", repoId: "r", path: "a.md" }, { recordIds: [] }),
    ).toBe(false);
  });
  it("keeps graph owners, selected sources and external dependencies within the selected catalog scope", () => {
    const a = parseSource(
      repo,
      repo.roots[0],
      "src/a.ts",
      "file:///r/src/a.ts",
      'import fs from "node:fs"; export function a() {}',
    );
    const b = parseSource(
      repo,
      repo.roots[0],
      "src/b.ts",
      "file:///r/src/b.ts",
      "export function b() {}",
    );
    const graph = scopeGraph(buildGraph([a, b]), [a, b], { recordIds: [a.id] });
    expect(graph.nodes.some((n) => n.recordId === b.id)).toBe(false);
    expect(graph.nodes.some((n) => n.label === "node:fs")).toBe(true);
    const ids = new Set(graph.nodes.map((n) => n.id));
    expect(graph.edges.every((e) => ids.has(e.from) && ids.has(e.to))).toBe(
      true,
    );
  });
  it("restores bounded, source-free preferences and refuses to broaden stale saved scopes", () => {
    const a = parseSource(
      repo,
      repo.roots[0],
      "docs/a.md",
      "file:///r/docs/a.md",
      "# First",
    );
    const b = parseSource(
      repo,
      repo.roots[0],
      "src/b.ts",
      "file:///r/src/b.ts",
      "export const b = 2;",
    );
    const prefs = restorePreferences({
      kind: "document",
      sourceFilter: "first",
      tab: "Explorer",
      answer: "private output",
      content: "private source",
    });
    expect(filterSources([b, a], prefs).map((r) => r.id)).toEqual([a.id]);
    expect(prefs).not.toHaveProperty("answer");
    expect(prefs).not.toHaveProperty("content");
    const view = {
      ...prefs,
      id: "v",
      name: "View",
      repo: "r",
      selected: [a.id],
    };
    expect(savedViewAvailable(view, [repo], [a])).toBe(true);
    expect(savedViewAvailable(view, [repo], [b])).toBe(false);
    expect(savedViewAvailable(view, [], [a])).toBe(false);
    expect(
      restorePreferences({ saved: Array(13).fill(view) }).saved,
    ).toHaveLength(0);
    // UI filters do not silently alter the explicitly selected retrieval scope.
    expect(prefs.selected).toEqual([]);
    expect(chunkRecord(a)).toHaveLength(1);
  });
});

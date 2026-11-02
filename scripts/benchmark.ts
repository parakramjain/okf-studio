import { performance } from "node:perf_hooks";
import { writeFileSync, mkdirSync } from "node:fs";
import { parseSource } from "../src/ingestion/parser";
import { chunkRecord } from "../src/ingestion/chunks";
import { buildGraph } from "../src/graph/graph";
import { search } from "../src/retrieval/search";
import type { KnowledgeRecord, Chunk } from "../src/domain/types";
const repo = {
  id: "benchmark",
  name: "Synthetic",
  kind: "hybrid" as const,
  roots: ["file:///synthetic"],
  permissions: { read: true, write: false },
};
const results = [];
for (const count of [1000, 10000, 100000]) {
  const records: KnowledgeRecord[] = [];
  const chunks: Chunk[] = [];
  const start = performance.now();
  for (let i = 0; i < count; i++) {
    const code = i % 2 === 0;
    const path = code ? `src/module-${i}.ts` : `docs/guide-${i}.md`;
    const content = code
      ? `export function process${i}(input: string) { return input.trim(); }`
      : `---\ntype: Reference\ntitle: Guide ${i}\n---\n# Guide ${i}\n\nKnowledge indexing uses bounded evidence and authentication ${i}.`;
    const record = parseSource(
      repo,
      repo.roots[0],
      path,
      repo.roots[0] + "/" + path,
      content,
    );
    records.push(record);
    chunks.push(...chunkRecord(record));
  }
  const parsed = performance.now();
  const graph = buildGraph(records);
  const graphed = performance.now();
  const hits = search(records, chunks, "bounded evidence authentication", {
    topK: 8,
  });
  const searched = performance.now();
  const result = {
    files: count,
    parseAndChunkMs: Math.round(parsed - start),
    graphMs: Math.round(graphed - parsed),
    searchMs: Math.round(searched - graphed),
    chunks: chunks.length,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    hits: hits.length,
    heapMB: Math.round(process.memoryUsage().heapUsed / 1048576),
  };
  results.push(result);
  console.log(JSON.stringify(result));
}
mkdirSync("dist", { recursive: true });
writeFileSync(
  "dist/benchmarks.json",
  JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      method:
        "In-memory synthetic source files; actual parser, chunker, graph and lexical retrieval. Excludes filesystem I/O, worker IPC, SQLite persistence and network/model calls. Single run; no performance guarantee.",
      results,
    },
    null,
    2,
  ),
);

import { mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { parseSource } from "../src/ingestion/parser";
import { chunkRecord } from "../src/ingestion/chunks";
import { search } from "../src/retrieval/search";
import { contextPack } from "../src/assistant/assistant";
const repo = {
  id: "evaluation",
  name: "Evaluation",
  kind: "hybrid" as const,
  roots: ["file:///evaluation"],
  permissions: { read: true, write: false },
};
const sources = [
  [
    "authentication.md",
    "# Authentication\nSigned tokens authenticate users. Expired tokens are rejected.\nREQ-001 authentication.",
  ],
  [
    "billing.md",
    "# Billing\nInvoices are generated monthly. Payment retries use exponential backoff.",
  ],
  [
    "deployment.md",
    "# Deployment\nContainers deploy after the health check. Rollback restores the previous image.",
  ],
  [
    "cache.md",
    "# Cache\nCache entries expire after sixty seconds. Cache invalidation removes outdated entries.",
  ],
];
const records = sources.map(([path, content]) =>
  parseSource(repo, repo.roots[0], path, `${repo.roots[0]}/${path}`, content),
);
const chunks = records.flatMap((r) => chunkRecord(r));
const cases = [
  { query: "authentication signed tokens", expected: ["authentication.md"] },
  { query: "billing invoices payment", expected: ["billing.md"] },
  { query: "deployment rollback containers", expected: ["deployment.md"] },
  { query: "cache invalidation entries", expected: ["cache.md"] },
  { query: "xylophonic nonexistentxyz", expected: [] },
];
const results = cases.map((c) => {
  const timings: number[] = [];
  let hits: ReturnType<typeof search> = [];
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    hits = search(records, chunks, c.query, { topK: 3 });
    timings.push(performance.now() - start);
  }
  timings.sort((a, b) => a - b);
  const paths = [
    ...new Set(hits.map((h) => records.find((r) => r.id === h.recordId)!.path)),
  ];
  const relevant = paths.filter((p) => c.expected.includes(p)).length;
  const pack = contextPack(c.query, hits, 1000);
  const citationsValid = hits.every((h) =>
    chunks.some(
      (ch) =>
        ch.id === h.citation.chunkId &&
        ch.recordId === h.recordId &&
        ch.span.start === h.citation.span.start &&
        ch.span.end === h.citation.span.end,
    ),
  );
  return {
    ...c,
    retrieved: paths,
    precision: paths.length ? relevant / paths.length : null,
    recall: c.expected.length ? relevant / c.expected.length : null,
    p95Ms: Number(timings[94].toFixed(3)),
    citationsValid,
    packWithinBudget: pack.estimatedTokens <= pack.tokenBudget,
  };
});
const report = {
  version: "0.4.0",
  at: new Date().toISOString(),
  method:
    "Four deliberately separable synthetic documents; four lexical positive queries plus one no-match query; 100 in-process repetitions. No network, model, filesystem or persistence latency. Not a general relevance benchmark.",
  results,
  modelGroundedness: {
    status: "Not Verified",
    reason:
      "No live model account supplied. Citation integrity and context bounds are checked separately; neither establishes generated-answer correctness.",
  },
};
mkdirSync("dist", { recursive: true });
writeFileSync(
  "dist/retrieval-evaluation.json",
  JSON.stringify(report, null, 2),
);
if (
  results.some(
    (r) =>
      !r.citationsValid ||
      !r.packWithinBudget ||
      (r.recall !== null && r.recall < 1),
  )
)
  throw new Error("Fixture retrieval/citation regression");
console.log(JSON.stringify(report, null, 2));

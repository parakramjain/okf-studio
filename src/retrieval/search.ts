import type {
  Chunk,
  KnowledgeRecord,
  Scope,
  SearchHit,
  Graph,
} from "../domain/types";
import { tokenize } from "../persistence/store";
import { redact } from "../domain/security";
import { inScope } from "../domain/scope";
export { inScope } from "../domain/scope";
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length)
    throw new Error("Embedding dimension mismatch: rebuild the index");
  let dot = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] ** 2;
    bb += b[i] ** 2;
  }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}
export function search(
  records: KnowledgeRecord[],
  chunks: Chunk[],
  query: string,
  options: {
    scope?: Scope;
    topK?: number;
    strategy?: "keyword" | "semantic" | "hybrid";
    vector?: number[];
    namespace?: string;
    tokenBudget?: number;
    graph?: Graph;
    vectorScores?: Map<string, number>;
  } = {},
): SearchHit[] {
  const strategy = options.strategy ?? "keyword";
  if (strategy === "semantic" && !options.vector)
    throw new Error(
      "Semantic search needs an embedding provider and a built index. Keyword retrieval works offline.",
    );
  const byId = new Map(
    records
      .filter((r) => inScope(r, options.scope ?? {}))
      .map((r) => [r.id, r]),
  );
  const candidates = chunks.filter((c) => byId.has(c.recordId));
  const queryTerms = [...new Set(tokenize(query))];
  const frequencies = new Map<string, number>();
  const tokens = candidates.map((c) => tokenize(c.text));
  const average =
    tokens.reduce((n, t) => n + t.length, 0) / Math.max(tokens.length, 1);
  for (const terms of tokens)
    for (const term of new Set(terms))
      frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
  const scored = candidates.map((chunk, i) => {
    const terms = tokens[i];
    let lexical = 0;
    for (const term of queryTerms) {
      const tf = terms.filter((t) => t === term).length;
      if (!tf) continue;
      const df = frequencies.get(term) ?? 0;
      const idf = Math.log(1 + (candidates.length - df + 0.5) / (df + 0.5));
      lexical +=
        (idf * (tf * 2.2)) /
        (tf + 1.2 * (0.25 + (0.75 * terms.length) / Math.max(average, 1)));
    }
    const vector = options.vectorScores
      ? (options.vectorScores.get(chunk.id) ?? 0)
      : options.vector && chunk.vector && chunk.namespace === options.namespace
        ? cosine(options.vector, chunk.vector)
        : 0;
    const record = byId.get(chunk.recordId)!;
    return {
      recordId: record.id,
      text: redact(chunk.text),
      lexical,
      vector,
      citation: {
        uri: record.sourceUri,
        span: chunk.span,
        commit: record.commit,
        chunkId: chunk.id,
        title: record.title,
        score: strategy === "semantic" ? vector : lexical,
      },
    };
  });
  if (strategy === "hybrid" && options.vector) {
    const lex = [...scored].sort((a, b) => b.lexical - a.lexical);
    const vec = [...scored].sort((a, b) => b.vector - a.vector);
    const lexRanks = new Map(
      lex.map((hit, index) => [hit.citation.chunkId, index]),
    );
    const vecRanks = new Map(
      vec.map((hit, index) => [hit.citation.chunkId, index]),
    );
    for (const hit of scored)
      hit.citation.score =
        (hit.lexical > 0 ? 1 / (61 + lexRanks.get(hit.citation.chunkId)!) : 0) +
        (hit.vector > 0 ? 1 / (61 + vecRanks.get(hit.citation.chunkId)!) : 0);
  }
  if (strategy === "hybrid" && options.graph) {
    const anchors = new Set(
      [...scored]
        .sort((a, b) => b.citation.score - a.citation.score)
        .filter((h) => h.citation.score > 0)
        .slice(0, 5)
        .map((h) => h.recordId),
    );
    const graph = options.graph;
    const owners = new Map(graph.nodes.map((n) => [n.id, n.recordId ?? n.id]));
    const boosted = new Map<string, number>();
    for (const edge of graph.edges) {
      if (edge.kind === "defines") continue;
      const a = owners.get(edge.from)!;
      const b = owners.get(edge.to)!;
      if (anchors.has(a))
        boosted.set(
          b,
          Math.max(boosted.get(b) ?? 0, edge.resolved ? 0.005 : 0.002),
        );
      if (anchors.has(b))
        boosted.set(
          a,
          Math.max(boosted.get(a) ?? 0, edge.resolved ? 0.005 : 0.002),
        );
    }
    for (const hit of scored)
      hit.citation.score += boosted.get(hit.recordId) ?? 0;
  }
  let budget = (options.tokenBudget ?? 6000) * 4;
  const result: SearchHit[] = [];
  for (const hit of scored
    .filter((h) => h.citation.score > 0)
    .sort((a, b) => b.citation.score - a.citation.score)) {
    if (result.length >= Math.min(options.topK ?? 8, 50)) break;
    const overhead = 200;
    if (budget < overhead + 40) break;
    const text = hit.text.slice(0, budget - overhead);
    result.push({ ...hit, text });
    budget -= text.length + overhead;
  }
  return result;
}

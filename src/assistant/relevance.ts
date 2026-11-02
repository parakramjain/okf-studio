import type { Chunk, KnowledgeRecord, Scope, SearchHit } from "../domain/types";
import { inScope } from "../domain/scope";
import { redact } from "../domain/security";

const stop = new Set(
  "a an the and or to of in on for with from by as is are was were be been being do does did has have had it its this that these those what which who where when why how can could would should will please explain describe summarize summary compare tell me about give show create generate write list key main workspace repository project sources source files file code concepts answer established use using".split(
    " ",
  ),
);
export const queryTerms = (text: string): string[] => [
  ...new Set(
    text
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length > 1 && !stop.has(t)),
  ),
];

/** Local relevance selection: never falls back to arbitrary workspace chunks. */
export function relevantEvidence(
  records: KnowledgeRecord[],
  chunks: Chunk[],
  question: string,
  scope: Scope,
  task: string,
  maxChunks = 6,
): SearchHit[] {
  const terms = queryTerms(question);
  const explicitSummary =
    !!scope.recordIds?.length &&
    ["summarize", "compare"].includes(task) &&
    !terms.length;
  if (!terms.length && !explicitSummary) return [];
  const byId = new Map(
    records.filter((r) => inScope(r, scope)).map((r) => [r.id, r]),
  );
  const candidates = chunks
    .filter((c) => byId.has(c.recordId))
    .map((chunk) => {
      const record = byId.get(chunk.recordId)!;
      const words = new Set(queryTerms(chunk.text));
      const names = new Set(queryTerms(record.path + " " + record.title));
      const matches = terms.filter((t) => words.has(t) || names.has(t));
      const score = explicitSummary
        ? 1
        : matches.length / terms.length +
          terms.filter((t) => names.has(t)).length / terms.length;
      return { chunk, record, score, matches };
    })
    .filter(
      (c) =>
        c.score > 0 &&
        (explicitSummary || c.matches.length >= Math.min(2, terms.length)),
    )
    .sort(
      (a, b) => b.score - a.score || a.chunk.span.start - b.chunk.span.start,
    );
  const best = candidates[0]?.score ?? 0;
  const result: SearchHit[] = [],
    seen = new Set<string>(),
    counts = new Map<string, number>();
  for (const { chunk, record, score, matches } of candidates) {
    if (result.length >= Math.max(1, Math.min(maxChunks, 12))) break;
    if (score < best * 0.6 || (counts.get(record.id) ?? 0) >= 2) continue;
    const lines = chunk.text.split("\n");
    // Pick the densest relevant line window, retaining original line coordinates.
    let start = 0,
      density = -1;
    for (let i = 0; i < lines.length; i++) {
      const words = new Set(queryTerms(lines.slice(i, i + 32).join("\n")));
      const n = matches.filter((t) => words.has(t)).length;
      if (n > density) {
        density = n;
        start = Math.max(0, i - 4);
      }
    }
    const text = redact(lines.slice(start, start + 40).join("\n"));
    const key = text.replace(/\s+/g, " ").trim();
    const span = {
      start: chunk.span.start + start,
      end: Math.min(chunk.span.end, chunk.span.start + start + 39),
    };
    if (
      !key ||
      seen.has(key) ||
      result.some(
        (h) =>
          h.recordId === record.id &&
          h.citation.span.end >= span.start &&
          h.citation.span.start <= span.end,
      )
    )
      continue;
    seen.add(key);
    counts.set(record.id, (counts.get(record.id) ?? 0) + 1);
    result.push({
      recordId: record.id,
      text,
      lexical: score,
      vector: 0,
      citation: {
        uri: record.sourceUri,
        title: record.title,
        span,
        chunkId: chunk.id,
        commit: record.commit,
        score,
      },
    });
  }
  return result;
}

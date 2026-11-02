import type { Chunk, KnowledgeRecord } from "../domain/types";
import { hash } from "../domain/security";
export function chunkRecord(
  record: KnowledgeRecord,
  maxLines = 60,
  overlap = 6,
): Chunk[] {
  if (maxLines < 2 || overlap < 0 || overlap >= maxLines)
    throw new Error("Chunk overlap must be less than chunk size");
  const lines = record.content.split("\n");
  const boundaries = new Set([
    0,
    ...record.headings.map((h) => h.line - 1),
    ...record.symbols.map((s) => s.span.start - 1),
  ]);
  const chunks: Chunk[] = [];
  for (let start = 0; start < lines.length;) {
    let end = Math.min(start + maxLines, lines.length);
    const boundary = [...boundaries]
      .filter((b) => b > start + Math.floor(maxLines / 2) && b < end)
      .sort((a, b) => b - a)[0];
    if (boundary !== undefined) end = boundary;
    const text = lines.slice(start, end).join("\n");
    if (text.trim())
      chunks.push({
        id: hash(`${record.id}:${start}:${hash(text)}`),
        recordId: record.id,
        repoId: record.repoId,
        text,
        span: { start: start + 1, end },
        section: record.headings.filter((h) => h.line <= start + 1).at(-1)
          ?.title,
        hash: hash(text),
      });
    if (end === lines.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

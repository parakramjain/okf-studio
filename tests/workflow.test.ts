import { describe, it, expect, vi } from "vitest";
import { relevantEvidence } from "../src/assistant/relevance";
import { contextPack, groundedPrompt } from "../src/assistant/assistant";
import { parseSource } from "../src/ingestion/parser";
import { chunkRecord } from "../src/ingestion/chunks";
import { Store } from "../src/persistence/store";
import { applyBatch, propose, type ReviewIO } from "../src/governance/review";
import { ClientMessage } from "../src/domain/types";
const repo = {
  id: "r",
  name: "Repo",
  kind: "hybrid" as const,
  roots: ["file:///r"],
  permissions: { read: true, write: true },
};
const record = (path: string, text: string) =>
  parseSource(repo, repo.roots[0], path, `${repo.roots[0]}/${path}`, text);
describe("question-specific context", () => {
  it("excludes unrelated workspace chunks, deduplicates evidence, and honors scope", () => {
    const auth = record(
        "api_router.py",
        "# authentication uses a signed bearer token\ndef authenticate():\n    return validate_token()",
      ),
      duplicate = record("copy.md", auth.content);
    const others = Array.from({ length: 200 }, (_, i) =>
      record(
        `docs/${i}.md`,
        "# Build\nThis project uses a compiler and a stylesheet.",
      ),
    );
    const records = [auth, duplicate, ...others],
      chunks = records.flatMap((r) => chunkRecord(r));
    const hits = relevantEvidence(
      records,
      chunks,
      "How does api_router handle authentication?",
      {},
      "answer",
    );
    expect(hits.map((h) => h.recordId)).toEqual([auth.id]);
    expect(
      relevantEvidence(
        records,
        chunks,
        "authentication",
        { folder: "docs" },
        "answer",
      ),
    ).toEqual([]);
    expect(
      relevantEvidence(
        records,
        chunks,
        "What is the project about?",
        {},
        "summarize",
      ),
    ).toEqual([]);
    expect(
      relevantEvidence(
        records,
        chunks,
        "unobtainium flux capacitor",
        {},
        "answer",
      ),
    ).toEqual([]);
  });
  it("permits generic summaries only for explicitly selected files and enforces context caps", () => {
    const records = Array.from({ length: 20 }, (_, i) =>
      record(
        `guide${i}.md`,
        `# Document ${i}\n` +
          Array.from(
            { length: 120 },
            (_, n) => `Authentication token logic ${i} ${n}`,
          ).join("\n"),
      ),
    );
    const chunks = records.flatMap((r) => chunkRecord(r, 60, 10));
    const selected = relevantEvidence(
      records,
      chunks,
      "Summarize these files",
      { recordIds: [records[5].id] },
      "summarize",
    );
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.every((h) => h.recordId === records[5].id)).toBe(true);
    const hits = relevantEvidence(
      records,
      chunks,
      "Authentication token",
      {},
      "answer",
    );
    expect(hits.length).toBeLessThanOrEqual(6);
    expect(hits.every((h) => h.text.split("\n").length <= 40)).toBe(true);
    const pack = contextPack("Authentication token", hits, 800);
    expect(groundedPrompt(pack).length).toBeLessThanOrEqual(3200);
    expect(pack.estimatedTokens).toBeLessThanOrEqual(800);
  });
  it("retains source line coordinates when trimming a long chunk", () => {
    const r = record(
      "long.md",
      Array.from({ length: 120 }, (_, i) =>
        i === 100 ? "criticalneedle authentication" : "filler",
      ).join("\n"),
    );
    const chunks = [
      {
        id: "c",
        recordId: r.id,
        repoId: r.repoId,
        hash: "x",
        text: r.content,
        span: { start: 1, end: 120 },
      },
    ];
    const hits = relevantEvidence(
      [r],
      chunks,
      "criticalneedle authentication",
      {},
      "answer",
    );
    expect(hits[0].text).toContain("criticalneedle");
    expect(hits[0].citation.span.start).toBeGreaterThan(1);
    expect(hits[0].citation.span.end).toBeGreaterThanOrEqual(101);
  });
});
async function batchFixture() {
  const store = await Store.open({
    read: async () => undefined,
    write: async () => undefined,
  });
  store.putRepository(repo);
  const files = new Map<string, string>();
  const io: ReviewIO = {
    read: async (_r, p) => files.get(p) ?? null,
    write: async (_r, p, text) => {
      files.set(p, text);
    },
    delete: async (_r, p) => {
      files.delete(p);
    },
  };
  const a = await propose(store, io, repo, "a.md", "A", "test"),
    b = await propose(store, io, repo, "b.md", "B", "test");
  return { store, files, io, ids: [a.id, b.id] };
}
describe("combined batch review", () => {
  it("confirms once for all selected changes", async () => {
    const { store, io, files, ids } = await batchFixture();
    const confirm = vi.fn(async () => true);
    expect(await applyBatch(store, io, ids, "approve", confirm)).toBe(2);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect([...files.values()]).toEqual(["A", "B"]);
    expect(store.proposals().every((p) => p.status === "approved")).toBe(true);
    await store.close();
  });
  it("writes nothing on cancellation or when any file changes during review", async () => {
    const { store, io, files, ids } = await batchFixture();
    expect(await applyBatch(store, io, ids, "approve", async () => false)).toBe(
      0,
    );
    expect(files.size).toBe(0);
    await expect(
      applyBatch(store, io, ids, "approve", async () => {
        files.set("b.md", "user edit");
        return true;
      }),
    ).rejects.toThrow("Source changed");
    expect(files.has("a.md")).toBe(false);
    expect(files.get("b.md")).toBe("user edit");
    await store.close();
  });
  it("rejects duplicate targets and reports partial I/O failures accurately", async () => {
    const { store, io, files, ids } = await batchFixture();
    const duplicate = await propose(store, io, repo, "a.md", "other", "test");
    await expect(
      applyBatch(
        store,
        io,
        [...ids, duplicate.id],
        "approve",
        async () => true,
      ),
    ).rejects.toThrow("Multiple proposals");
    await expect(
      applyBatch(
        store,
        {
          ...io,
          write: async (r, p, text) => {
            if (p === "b.md") throw new Error("Disk full");
            await io.write(r, p, text);
          },
        },
        ids,
        "approve",
        async () => true,
      ),
    ).rejects.toThrow("1 of 2 changes completed");
    expect(files.get("a.md")).toBe("A");
    expect(store.proposals().find((p) => p.id === ids[1])?.status).toBe(
      "pending",
    );
    await store.close();
  });
  it("accepts all-pending and large selected batches without the old 100-file truncation", () => {
    expect(
      ClientMessage.parse({
        type: "batchReview",
        ids: [],
        all: true,
        action: "approve",
      }),
    ).toMatchObject({ all: true });
    expect(
      ClientMessage.parse({
        type: "batchReview",
        ids: Array.from({ length: 250 }, (_, i) => String(i)),
        action: "approve",
      }).type,
    ).toBe("batchReview");
  });
});

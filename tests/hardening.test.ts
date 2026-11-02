import { describe, it, expect, vi } from "vitest";
import { OutputRedactor } from "../src/domain/security";
import { contextPack, groundedPrompt } from "../src/assistant/assistant";
import { parseSource } from "../src/ingestion/parser";
import { chunkRecord } from "../src/ingestion/chunks";
import { Store } from "../src/persistence/store";
import { LocalVectors, PgVectors } from "../src/providers/vectors";
import { buildVectorIndex } from "../src/retrieval/indexer";
import { SafeHTTP } from "../src/providers/http";
import { synchronize } from "../src/ingestion/ingest";
import { quality } from "../src/governance/quality";
import { buildGraph } from "../src/graph/graph";
import type { SearchHit, SourceFS } from "../src/domain/types";
import type { Pool } from "pg";
const repo = {
  id: "r",
  name: "R",
  kind: "hybrid" as const,
  roots: ["file:///r", "file:///second"],
  permissions: { read: true, write: true },
};
const open = () =>
  Store.open({ read: async () => undefined, write: async () => undefined });
describe("release hardening", () => {
  it("preserves source line numbering while extracting HTML text", () => {
    const text =
      "<script>\nunsafe()\n</script>\n<h1>Title</h1>\n<p>Evidence</p>";
    const record = parseSource(
      repo,
      repo.roots[0],
      "a.html",
      "file:///r/a.html",
      text,
    );
    expect(record.content).not.toContain("unsafe");
    expect(record.content.split("\n")[4]).toContain("Evidence");
    expect(record.span.end).toBe(5);
  });
  it("redacts credentials and private key blocks split across streaming deltas", () => {
    let output = "";
    const redactor = new OutputRedactor((t) => {
      output += t;
    });
    for (const text of [
      "api_",
      "key=super",
      "secret\n",
      "person@",
      "example.com\n",
      "-----BEGIN PRIVATE KEY-----\n",
      "private material\n",
      "-----END PRIVATE KEY-----\n",
    ])
      redactor.push(text);
    redactor.push("", true);
    expect(output).not.toContain("supersecret");
    expect(output).not.toContain("person@");
    expect(output).not.toContain("private material");
  });
  it("caps actual serialized prompt estimate and rejects an oversized task", () => {
    const hit: SearchHit = {
      recordId: "r",
      text: 'line\\\n"'.repeat(1000),
      lexical: 1,
      vector: 0,
      citation: {
        uri: "file:///a",
        span: { start: 1, end: 20 },
        chunkId: "c",
        title: "T",
        score: 1,
      },
    };
    const pack = contextPack("explain", [hit], 600);
    expect(groundedPrompt(pack).length).toBeLessThanOrEqual(2400);
    expect(pack.estimatedTokens).toBeLessThanOrEqual(600);
    expect(() => contextPack("x".repeat(8000), [], 256)).toThrow("budget");
  });
  it("reuses unchanged embeddings without a model request and detects forced reindex", async () => {
    const store = await open();
    const r = parseSource(
      repo,
      repo.roots[0],
      "a.md",
      "file:///r/a.md",
      "source",
    );
    store.putRecord(r, chunkRecord(r));
    const embed = vi.fn(async (texts: string[]) => texts.map(() => [1, 2]));
    const provider = {
      config: {
        provider: "ollama" as const,
        model: "m",
        endpoint: "http://localhost:11434",
      },
      embed,
    };
    const adapter = new LocalVectors(store);
    const ns = await buildVectorIndex(store, provider, adapter);
    embed.mockClear();
    expect(await buildVectorIndex(store, provider, adapter)).toBe(ns);
    expect(embed).not.toHaveBeenCalled();
    expect(
      await buildVectorIndex(
        store,
        provider,
        adapter,
        undefined,
        undefined,
        true,
      ),
    ).not.toBe(ns);
    expect(embed).toHaveBeenCalled();
    await store.close();
  });
  it("rolls back vectors while preserving newly changed source chunks", async () => {
    const store = await open();
    const r = parseSource(
      repo,
      repo.roots[0],
      "a.md",
      "file:///r/a.md",
      "before",
    );
    store.putRecord(r, chunkRecord(r));
    const provider = {
      config: {
        provider: "ollama" as const,
        model: "m",
        endpoint: "http://localhost:11434",
      },
      embed: async (texts: string[]) => texts.map(() => [1, 2]),
    };
    await buildVectorIndex(store, provider, new LocalVectors(store));
    const changed = parseSource(
      repo,
      repo.roots[0],
      "a.md",
      "file:///r/a.md",
      "after",
    );
    store.putRecord(changed, chunkRecord(changed));
    store.rollback();
    expect(store.chunks()[0].text).toBe("after");
    expect(store.chunks()[0].vector).toBeUndefined();
    await store.close();
  });
  it("does not delete other roots when synchronizing one root", async () => {
    const store = await open();
    for (const root of repo.roots) {
      const r = parseSource(repo, root, "a.md", root + "/a.md", "# A");
      store.putRecord(r, chunkRecord(r));
    }
    const fs: SourceFS = {
      join: (r, p) => r + "/" + p,
      list: async () => [{ name: "a.md", kind: "file" }],
      read: async (uri) => {
        if (uri.endsWith(".gitignore")) throw new Error("missing");
        return new TextEncoder().encode("# A");
      },
      size: async () => 3,
    };
    await synchronize({ ...repo, roots: [repo.roots[0]] }, fs, store, {
      maxFileBytes: 1000,
      ignore: [],
      chunkLines: 20,
      overlap: 2,
    });
    expect(store.records()).toHaveLength(2);
    await store.close();
  });
  it("validates pgvector parameterized transactional contracts and connection security", async () => {
    const query = vi.fn(async (_sql: string, _values?: unknown[]) => ({
      rows: [{ id: "c", score: 1 }],
    }));
    const release = vi.fn();
    const pool = {
      query,
      connect: async () => ({ query, release }),
      end: async () => undefined,
    } as unknown as Pool;
    const consent = vi.fn(async () => undefined);
    const pg = new PgVectors(
      "postgresql://user:pass@db.example.com/knowledge",
      consent,
      pool,
    );
    const r = parseSource(
      repo,
      repo.roots[0],
      "a.md",
      "file:///r/a.md",
      "text",
    );
    await pg.upsert(
      "n",
      chunkRecord(r).map((c) => ({ ...c, vector: [1, 0] })),
    );
    expect(await pg.search("n", [1, 0], 4)).toEqual([{ id: "c", score: 1 }]);
    await pg.remove("n", ["c"]);
    expect(query.mock.calls.map((c) => c[0])).toContain("BEGIN");
    expect(query.mock.calls.map((c) => c[0])).toContain("COMMIT");
    expect(release).toHaveBeenCalled();
    expect(consent).toHaveBeenCalled();
    expect(
      () => new PgVectors("postgres://u:p@127.0.0.1/db", consent, pool),
    ).toThrow();
    await pg.close();
  });
  it("retries transient status but propagates cancellation without uploading", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(new Response("{}"));
    const http = new SafeHTTP(async () => undefined, fetcher, false);
    await http.json("https://example.com", {}, {}, "embedding");
    expect(fetcher).toHaveBeenCalledTimes(2);
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(
      http.json("https://example.com", {}, {}, "embedding", cancelled.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("surfaces malformed OKF as errors while allowing ordinary Markdown and unknown optional fields", () => {
    const a = parseSource(
      repo,
      repo.roots[0],
      "a.md",
      "file:///r/a.md",
      "---\ntitle: Missing type\n---\n# A",
    );
    const b = parseSource(
      repo,
      repo.roots[0],
      "b.md",
      "file:///r/b.md",
      "# Plain Markdown",
    );
    const report = quality([a, b], buildGraph([a, b]));
    expect(
      report.issues.find((i) => i.recordId === a.id && i.code === "okf.type")
        ?.severity,
    ).toBe("error");
    expect(
      report.issues.find((i) => i.recordId === b.id && i.code === "okf.type")
        ?.severity,
    ).toBe("info");
  });
});

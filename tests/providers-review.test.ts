import { describe, it, expect, vi } from "vitest";
import { SafeHTTP } from "../src/providers/http";
import {
  RemoteEmbeddings,
  providerRoute,
  streamChat,
} from "../src/providers/models";
import { LocalVectors, QdrantVectors } from "../src/providers/vectors";
import { buildVectorIndex } from "../src/retrieval/indexer";
import { Store } from "../src/persistence/store";
import { parseSource } from "../src/ingestion/parser";
import { chunkRecord } from "../src/ingestion/chunks";
import {
  propose,
  proposeBundle,
  applyProposal,
  exportHTML,
  type ReviewIO,
} from "../src/governance/review";
import { hash } from "../src/domain/security";
const repo = {
  id: "r",
  name: "R",
  kind: "hybrid" as const,
  roots: ["file:///r"],
  permissions: { read: true, write: true },
};
const open = () =>
  Store.open({ read: async () => undefined, write: async () => undefined });
describe("provider and review boundaries", () => {
  it("keeps generated bundle destinations distinct for sources with the same filename stem", async () => {
    const store = await open();
    store.putRepository(repo);
    for (const path of ["auth.ts", "auth.md"]) {
      const record = parseSource(
        repo,
        repo.roots[0],
        path,
        `file:///r/${path}`,
        path.endsWith("ts") ? "export const auth = 1;" : "# Auth",
      );
      store.putRecord(record, chunkRecord(record));
    }
    const io: ReviewIO = {
      read: async () => null,
      write: async () => undefined,
      delete: async () => undefined,
    };
    const proposals = await proposeBundle(store, io, repo);
    expect(proposals.filter((p) => p.path.endsWith("auth.ts.md"))).toHaveLength(
      1,
    );
    expect(proposals.filter((p) => p.path.endsWith("auth.md.md"))).toHaveLength(
      1,
    );
    expect(new Set(proposals.map((p) => p.path)).size).toBe(proposals.length);
    await store.close();
  });
  it("rechecks writes after human approval and prevents concurrent review of the same proposal", async () => {
    const store = await open();
    store.putRepository(repo);
    let text = "before";
    const io: ReviewIO = {
      read: async () => text,
      write: async (_root, _path, next) => {
        text = next;
      },
      delete: async () => undefined,
    };
    const p = await propose(store, io, repo, "a.md", "after", "review");
    await expect(
      applyProposal(store, io, p.id, "approve", async () => {
        await expect(
          applyProposal(store, io, p.id, "reject", async () => true),
        ).rejects.toThrow("already being reviewed");
        text = "edited while dialog open";
        return true;
      }),
    ).rejects.toThrow("Source changed during review");
    expect(text).toBe("edited while dialog open");
    expect(store.proposals()[0].status).toBe("pending");
    // The lock is released on failure, so a user may still reject the proposal.
    await applyProposal(store, io, p.id, "reject", async () => true);
    expect(store.proposals()[0].status).toBe("rejected");
    await store.close();
  });
  it("does not delete committed remote vectors when persistence fails", async () => {
    let fail = false;
    const store = await Store.open({
      read: async () => undefined,
      write: async () => {
        if (fail) throw new Error("Disk full");
      },
    });
    const record = parseSource(
      repo,
      repo.roots[0],
      "a.md",
      "file:///r/a.md",
      "Evidence",
    );
    store.putRecord(record, chunkRecord(record));
    const remove = vi.fn(async () => undefined);
    const adapter = {
      upsert: async () => undefined,
      search: async () => [],
      remove,
    };
    fail = true;
    await expect(
      buildVectorIndex(
        store,
        {
          config: {
            provider: "ollama",
            model: "m",
            endpoint: "http://localhost:11434",
          },
          embed: async (texts) => texts.map(() => [1, 2]),
        },
        adapter,
      ),
    ).rejects.toThrow("Disk full");
    expect(store.getMeta("namespace")).toBeTruthy();
    expect(remove).not.toHaveBeenCalled();
    fail = false;
    await store.close();
  });
  it("does not make a request without consent", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const http = new SafeHTTP(
      async () => {
        throw new Error("declined");
      },
      fetcher,
      false,
    );
    await expect(
      http.json("https://example.com", {}, {}, "chat"),
    ).rejects.toThrow("declined");
    expect(fetcher).not.toHaveBeenCalled();
  });
  for (const provider of ["openai", "azure", "ollama", "compatible"] as const)
    it(`sends real ${provider} embedding contract and validates dimension`, async () => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockImplementation(
          async () =>
            new Response(
              JSON.stringify(
                provider === "ollama"
                  ? { embeddings: [[1, 2]] }
                  : { data: [{ index: 0, embedding: [1, 2] }] },
              ),
            ),
        );
      const config = {
        provider,
        model: "embed-model",
        endpoint:
          provider === "ollama"
            ? "http://localhost:11434"
            : "https://example.com",
        dimension: 2,
      };
      const model = new RemoteEmbeddings(
        config,
        new SafeHTTP(async () => undefined, fetcher, false),
        "key",
      );
      expect(await model.embed(["token=private"])).toEqual([[1, 2]]);
      expect(String(fetcher.mock.calls[0][1]?.body)).not.toContain("private");
      config.dimension = 3;
      await expect(model.embed(["x"])).rejects.toThrow("dimension");
      expect(
        providerRoute(
          {
            ...config,
            provider: "azure",
            endpoint: "https://azure.example.com",
          },
          "embeddings",
        ),
      ).toContain("/deployments/embed-model/embeddings?api-version=");
    });
  it("streams SSE across arbitrary network boundaries and reports usage", async () => {
    const bytes = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          bytes.encode('data: {"choices":[{"delta":{"content":"Hel'),
        );
        controller.enqueue(
          bytes.encode(
            'lo"}}]}\n\ndata: {"usage":{"prompt_tokens":12,"completion_tokens":3},"choices":[]}\n\ndata: [DONE]\n',
          ),
        );
        controller.close();
      },
    });
    const http = new SafeHTTP(
      async () => undefined,
      vi.fn<typeof fetch>().mockResolvedValue(new Response(stream)),
      false,
    );
    let text = "";
    const usage = await streamChat(
      { provider: "openai", model: "chat", endpoint: "https://example.com" },
      http,
      "key",
      "evidence",
      (t) => {
        text += t;
      },
    );
    expect(text).toBe("Hello");
    expect(usage.inputTokens).toBe(12);
  });
  it("preserves the old index on failed vector generation and rolls back a completed migration", async () => {
    const store = await open();
    const record = parseSource(
      repo,
      repo.roots[0],
      "a.md",
      "file:///r/a.md",
      "# A\nOriginal text",
    );
    store.putRecord(record, chunkRecord(record));
    const adapter = new LocalVectors(store);
    const provider = {
      config: {
        provider: "ollama" as const,
        model: "local",
        endpoint: "http://localhost:11434",
      },
      embed: async (texts: string[]) => texts.map(() => [1, 2]),
    };
    const first = await buildVectorIndex(store, provider, adapter);
    expect(store.getMeta("namespace")).toBe(first);
    const second = await buildVectorIndex(
      store,
      { ...provider, config: { ...provider.config, model: "next" } },
      adapter,
    );
    expect(second).not.toBe(first);
    store.rollback();
    expect(store.getMeta("namespace")).toBe(first);
    const before = store.chunks();
    let calls = 0;
    await expect(
      buildVectorIndex(
        store,
        {
          ...provider,
          config: { ...provider.config, model: "fail" },
          embed: async (texts: string[]) => {
            if (calls++) throw new Error("offline");
            return texts.map(() => [1, 2]);
          },
        },
        adapter,
      ),
    ).rejects.toThrow("offline");
    expect(store.chunks()).toEqual(before);
    await store.close();
  });
  it("implements Qdrant creation, upsert, query and delete HTTP contracts", async () => {
    const calls: string[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push(`${init?.method} ${url}`);
      if (init?.method === "GET") return new Response("{}", { status: 404 });
      if (url.endsWith("/points/query"))
        return new Response(
          JSON.stringify({
            result: { points: [{ payload: { chunkId: "chunk" }, score: 0.9 }] },
          }),
        );
      return new Response("{}");
    };
    const adapter = new QdrantVectors(
      "https://vectors.example.com",
      new SafeHTTP(async () => undefined, fetcher, false),
    );
    await adapter.upsert("n", [
      {
        id: "chunk",
        recordId: "r",
        repoId: "repo",
        text: "",
        span: { start: 1, end: 1 },
        hash: "h",
        vector: [1, 0],
      },
    ]);
    expect(await adapter.search("n", [1, 0], 2)).toEqual([
      { id: "chunk", score: 0.9 },
    ]);
    await adapter.remove("n");
    expect(calls.some((c) => c.startsWith("DELETE"))).toBe(true);
  });
  it("requires human approval, detects concurrent edits and supports undo", async () => {
    const store = await open();
    store.putRepository(repo);
    const files = new Map([["a.md", "before"]]);
    const io: ReviewIO = {
      read: async (_root, path) => files.get(path) ?? null,
      write: async (_root, path, text) => {
        files.set(path, text);
      },
      delete: async (_root, path) => {
        files.delete(path);
      },
    };
    const p = await propose(store, io, repo, "a.md", "after", "review");
    await applyProposal(store, io, p.id, "approve", async () => false);
    expect(files.get("a.md")).toBe("before");
    files.set("a.md", "concurrent");
    await expect(
      applyProposal(store, io, p.id, "approve", async () => true),
    ).rejects.toThrow("Source changed");
    files.set("a.md", "before");
    await applyProposal(store, io, p.id, "approve", async () => true);
    expect(files.get("a.md")).toBe("after");
    await applyProposal(store, io, p.id, "undo", async () => true);
    expect(files.get("a.md")).toBe("before");
    expect(store.proposals()[0].status).toBe("undone");
    await store.close();
  });
  it("checks live source hashes before approving generated content and escapes HTML", async () => {
    const store = await open();
    store.putRepository(repo);
    const r = parseSource(
      repo,
      repo.roots[0],
      "a.md",
      "file:///r/a.md",
      "source",
    );
    store.putRecord(r, chunkRecord(r));
    const io: ReviewIO = {
      read: async (_root, p) => (p === "a.md" ? "changed" : null),
      write: async () => undefined,
      delete: async () => undefined,
    };
    const p = await propose(store, io, repo, "new.md", "after", "generated", {
      [r.id]: hash("source"),
    });
    await expect(
      applyProposal(store, io, p.id, "approve", async () => true),
    ).rejects.toThrow("Source changed since generation");
    expect(
      exportHTML([{ ...r, content: "<script>alert(1)</script>" }]),
    ).not.toContain("<script>");
    await store.close();
  });
});

import { describe, it, expect, vi } from "vitest";
import { indexReadiness } from "../src/domain/readiness";
import { hash } from "../src/domain/security";
import { parseSource } from "../src/ingestion/parser";
import { chunkRecord } from "../src/ingestion/chunks";
import {
  restorePreferences,
  workspaceScope,
  filterSources,
} from "../webview/model";
import { testEmbedding, testVector } from "../src/providers/diagnostics";
import { QdrantVectors, LocalVectors } from "../src/providers/vectors";
import { SafeHTTP } from "../src/providers/http";
import { Store } from "../src/persistence/store";
import { ClientMessage } from "../src/domain/types";
const config = {
  provider: "ollama" as const,
  model: "test-model",
  endpoint: "http://localhost:11434",
};
const repo = {
  id: "r",
  name: "R",
  kind: "document" as const,
  roots: ["file:///r"],
  permissions: { read: true, write: true },
};
const record = parseSource(
  repo,
  "file:///r",
  "guide.md",
  "file:///r/guide.md",
  "# Authentication\nToken expiry is tested.",
);
const chunks = chunkRecord(record).map((c) => ({
  ...c,
  namespace: "n",
  vector: [1, 2],
}));
const signature = hash(`${config.provider}:${config.endpoint}:${config.model}`);
describe("development review workflows", () => {
  it("distinguishes six readiness states and detects model, source and backend drift", () => {
    const status = (
      opts: {
        provider?: typeof config;
        backend?: string;
        ns?: string;
        sig?: string;
        active?: boolean;
        error?: string;
        chunks?: typeof chunks;
      } = {},
    ) =>
      indexReadiness(
        opts.chunks ?? chunks,
        opts.provider ?? config,
        opts.backend ?? "local",
        opts.ns ?? "n",
        opts.sig ?? signature,
        "local",
        opts.active ?? false,
        opts.error,
      ).status;
    expect(status()).toBe("Ready");
    expect(status({ provider: { ...config, model: "" } })).toBe(
      "Not configured",
    );
    expect(status({ active: true })).toBe("Indexing");
    expect(status({ error: "Network failed" })).toBe("Failed");
    expect(status({ sig: "old" })).toBe("Stale");
    expect(
      status({
        chunks: [...chunks, { ...chunks[0], id: "new", namespace: "old" }],
      }),
    ).toBe("Stale");
    expect(status({ backend: "qdrant:https://example.test" })).toBe("Stale");
    expect(status({ backend: "unknown" })).toBe("Unsupported");
  });
  it("migrates saved navigation and never widens an empty multiple-repository scope", () => {
    const prefs = restorePreferences({
      edition: 3,
      tab: "Ask AI",
      repo: "r",
      selected: [record.id],
      saved: [],
    });
    expect(prefs.tab).toBe("AI Assistant");
    expect(prefs.selected).toEqual([record.id]);
    const multi = { ...prefs, multiRepo: true, repoIds: [] };
    expect(workspaceScope(multi).repoIds).toEqual([]);
    expect(filterSources([record], multi)).toEqual([]);
    expect(filterSources([record], { ...multi, repoIds: ["r"] })).toEqual([
      record,
    ]);
  });
  it("uses synthetic embedding input and rejects malformed probe results", async () => {
    const embed = vi.fn(async () => [[1, 2]]);
    expect((await testEmbedding({ config, embed })).dimension).toBe(2);
    expect(embed.mock.calls[0]).toEqual([
      ["OKF Studio connection test. No repository content is included."],
      undefined,
    ]);
    for (const value of [[], [[]], [[0, 0]], [[NaN]], [[Infinity]], [[1], [2]]])
      await expect(
        testEmbedding({ config, embed: async () => value }),
      ).rejects.toThrow("invalid test vector");
  });
  it("tests local and Qdrant storage without creating or deleting indexes", async () => {
    const store = await Store.open({
      read: async () => undefined,
      write: async () => undefined,
    });
    const adapter = new LocalVectors(store);
    const upsert = vi.spyOn(adapter, "upsert");
    expect((await testVector(adapter)).status).toBe("Ready");
    expect(upsert).not.toHaveBeenCalled();
    const request = vi.fn<SafeHTTP["request"]>(
      async () => new Response(JSON.stringify({ result: { collections: [] } })),
    );
    const remote = new QdrantVectors("https://vectors.example", {
      request,
    } as unknown as SafeHTTP);
    await testVector(remote);
    expect(request.mock.calls[0][0]).toBe(
      "https://vectors.example/collections",
    );
    expect(request.mock.calls[0][1]).toMatchObject({
      method: "GET",
      body: undefined,
    });
    await store.close();
  });
  it("validates chunk settings and keeps the tool playground read only", () => {
    expect(
      ClientMessage.safeParse({
        type: "agentTool",
        name: "propose_knowledge_update",
        args: {},
      }).success,
    ).toBe(false);
    const settings = {
      embeddingProvider: "none",
      embeddingModel: "",
      embeddingEndpoint: "",
      vectorBackend: "local",
      vectorEndpoint: "",
      chunkLines: 8,
      chunkOverlap: 8,
    };
    expect(
      ClientMessage.safeParse({ type: "saveSettings", settings }).success,
    ).toBe(false);
    expect(
      ClientMessage.safeParse({
        type: "saveSettings",
        settings: { ...settings, chunkOverlap: 2 },
      }).success,
    ).toBe(true);
  });
});

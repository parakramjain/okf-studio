import { Pool, type PoolConfig } from "pg";
import { lookup } from "node:dns/promises";
import type { Chunk, VectorAdapter } from "../domain/types";
import { hash, assertNotAborted, endpointURL } from "../domain/security";
import { Store } from "../persistence/store";
import { cosine } from "../retrieval/search";
import { SafeHTTP, type Consent } from "./http";
export class LocalVectors implements VectorAdapter {
  constructor(private readonly store: Store) {}
  async testConnection(): Promise<string> {
    return `Local SQLite/vector store is readable (${this.store.chunks().length} chunks). No network connection required.`;
  }
  async upsert(namespace: string, chunks: Chunk[]): Promise<void> {
    this.store.transaction(() => {
      for (const c of chunks) this.store.putChunk({ ...c, namespace });
    });
  }
  async search(
    namespace: string,
    vector: number[],
    topK: number,
  ): Promise<{ id: string; score: number }[]> {
    return this.store
      .chunks()
      .filter((c) => c.namespace === namespace && c.vector)
      .map((c) => ({ id: c.id, score: cosine(vector, c.vector!) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
  async remove(namespace: string, ids?: string[]): Promise<void> {
    for (const c of this.store
      .chunks()
      .filter((c) => c.namespace === namespace && (!ids || ids.includes(c.id))))
      this.store.putChunk({ ...c, vector: undefined, namespace: undefined });
  }
}
const collection = (namespace: string) => "okf_" + hash(namespace).slice(0, 24);
const pointID = (id: string) => {
  const h = hash(id);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};
export class QdrantVectors implements VectorAdapter {
  private readonly base: string;
  constructor(
    endpoint: string,
    private readonly http: SafeHTTP,
    private readonly key?: string,
  ) {
    this.base = endpointURL(endpoint).toString().replace(/\/$/, "");
  }
  private async call(
    path: string,
    body: unknown,
    signal?: AbortSignal,
    method = "POST",
  ): Promise<Response> {
    return this.http.request(
      this.base + path,
      {
        method,
        headers: {
          "content-type": "application/json",
          ...(this.key ? { "api-key": this.key } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      "vector",
      signal,
    );
  }
  async testConnection(signal?: AbortSignal): Promise<string> {
    const response = await this.call("/collections", undefined, signal, "GET");
    const data = (await response.json()) as {
      result?: { collections?: unknown[] };
    };
    if (!Array.isArray(data.result?.collections))
      throw new Error("Qdrant returned an unexpected collections response.");
    return `Qdrant is reachable; ${data.result.collections.length} collections visible. No collections changed.`;
  }
  async upsert(
    namespace: string,
    chunks: Chunk[],
    signal?: AbortSignal,
  ): Promise<void> {
    if (!chunks.length) return;
    const name = collection(namespace);
    const dimension = chunks[0].vector?.length;
    if (!dimension) throw new Error("Vectors required");
    const existing = await this.call(
      `/collections/${name}`,
      undefined,
      signal,
      "GET",
    ).catch((e) => {
      if (String(e).includes("HTTP 404")) return undefined;
      throw e;
    });
    if (!existing)
      await this.call(
        `/collections/${name}`,
        { vectors: { size: dimension, distance: "Cosine" } },
        signal,
        "PUT",
      );
    else {
      const data = (await existing.json()) as {
        result?: { config?: { params?: { vectors?: { size?: number } } } };
      };
      if (data.result?.config?.params?.vectors?.size !== dimension)
        throw new Error("Qdrant dimension mismatch; use a new namespace");
    }
    await this.call(
      `/collections/${name}/points?wait=true`,
      {
        points: chunks.map((c) => ({
          id: pointID(c.id),
          vector: c.vector,
          payload: { chunkId: c.id, recordId: c.recordId },
        })),
      },
      signal,
      "PUT",
    );
  }
  async search(
    namespace: string,
    vector: number[],
    topK: number,
    signal?: AbortSignal,
  ): Promise<{ id: string; score: number }[]> {
    const r = await this.call(
      `/collections/${collection(namespace)}/points/query`,
      { query: vector, limit: Math.min(topK, 50), with_payload: true },
      signal,
    );
    const data = (await r.json()) as {
      result: { points: { payload: { chunkId: string }; score: number }[] };
    };
    return data.result.points.map((p) => ({
      id: p.payload.chunkId,
      score: p.score,
    }));
  }
  async remove(
    namespace: string,
    ids?: string[],
    signal?: AbortSignal,
  ): Promise<void> {
    if (ids)
      await this.call(
        `/collections/${collection(namespace)}/points/delete?wait=true`,
        { points: ids.map(pointID) },
        signal,
      );
    else
      await this.call(
        `/collections/${collection(namespace)}`,
        undefined,
        signal,
        "DELETE",
      );
  }
}
export class PgVectors implements VectorAdapter {
  private pool!: Pool;
  private config: PoolConfig;
  private hostname: string;
  private destination: string;
  constructor(
    connection: string,
    private readonly consent: Consent,
    pool?: Pool,
  ) {
    const url = new URL(connection);
    if (!["postgres:", "postgresql:"].includes(url.protocol))
      throw new Error("PostgreSQL connection URL required");
    endpointURL("https://" + url.hostname);
    this.hostname = url.hostname;
    this.destination = `postgresql://${url.hostname}:${url.port || 5432}`;
    this.config = {
      host: url.hostname,
      port: Number(url.port) || 5432,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)),
      ssl: { rejectUnauthorized: true, servername: url.hostname },
      max: 2,
      connectionTimeoutMillis: 10000,
      statement_timeout: 30000,
    };
    if (pool) this.pool = pool;
  }
  private async ready(initialize = true): Promise<void> {
    await this.consent(this.destination, "vector", 0);
    if (!this.pool) {
      const addresses = await lookup(this.hostname, { all: true });
      for (const address of addresses)
        endpointURL(
          `https://${address.family === 6 ? "[" + address.address + "]" : address.address}`,
        );
      if (!addresses[0]) throw new Error("No PostgreSQL server address");
      this.pool = new Pool({ ...this.config, host: addresses[0].address });
    }
    if (!initialize) return;
    await this.pool.query("CREATE EXTENSION IF NOT EXISTS vector");
    await this.pool.query(
      "CREATE TABLE IF NOT EXISTS okf_vectors(namespace text NOT NULL,id text NOT NULL,embedding vector NOT NULL,PRIMARY KEY(namespace,id))",
    );
  }
  async testConnection(signal?: AbortSignal): Promise<string> {
    assertNotAborted(signal);
    await this.ready(false);
    const result = await this.pool.query(
      "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') AS installed",
    );
    assertNotAborted(signal);
    if (!result.rows[0]?.installed)
      throw new Error(
        "PostgreSQL is reachable, but pgvector is not installed. Ask the database administrator to enable it.",
      );
    return "PostgreSQL and pgvector are reachable. No tables or extensions changed.";
  }
  async upsert(
    namespace: string,
    chunks: Chunk[],
    signal?: AbortSignal,
  ): Promise<void> {
    await this.ready();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const c of chunks) {
        assertNotAborted(signal);
        if (!c.vector?.length || c.vector.some((n) => !Number.isFinite(n)))
          throw new Error("Invalid vector");
        await client.query(
          "INSERT INTO okf_vectors VALUES($1,$2,$3::vector) ON CONFLICT(namespace,id) DO UPDATE SET embedding=excluded.embedding",
          [namespace, c.id, JSON.stringify(c.vector)],
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  async search(
    namespace: string,
    vector: number[],
    topK: number,
    signal?: AbortSignal,
  ): Promise<{ id: string; score: number }[]> {
    assertNotAborted(signal);
    await this.ready();
    const r = await this.pool.query(
      "SELECT id,1-(embedding <=> $2::vector) AS score FROM okf_vectors WHERE namespace=$1 ORDER BY embedding <=> $2::vector LIMIT $3",
      [namespace, JSON.stringify(vector), Math.min(topK, 50)],
    );
    return r.rows;
  }
  async remove(
    namespace: string,
    ids?: string[],
    signal?: AbortSignal,
  ): Promise<void> {
    assertNotAborted(signal);
    await this.ready();
    await this.pool.query(
      "DELETE FROM okf_vectors WHERE namespace=$1" +
        (ids ? " AND id=ANY($2::text[])" : ""),
      ids ? [namespace, ids] : [namespace],
    );
  }
  async close(): Promise<void> {
    await this.pool?.end();
  }
}

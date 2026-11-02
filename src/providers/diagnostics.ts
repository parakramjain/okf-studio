import type { EmbeddingProvider, VectorAdapter } from "../domain/types";
export interface ConnectionResult {
  status: "Ready" | "Failed";
  detail: string;
  at: string;
  latencyMs: number;
  dimension?: number;
}
export async function testEmbedding(
  provider: EmbeddingProvider,
  signal?: AbortSignal,
): Promise<ConnectionResult> {
  const start = performance.now();
  const vectors = await provider.embed(
    ["OKF Studio connection test. No repository content is included."],
    signal,
  );
  if (
    vectors.length !== 1 ||
    !vectors[0]?.length ||
    vectors[0].some((v) => !Number.isFinite(v)) ||
    vectors[0].every((v) => v === 0)
  )
    throw new Error("The embedding provider returned an invalid test vector.");
  return {
    status: "Ready",
    detail:
      "Synthetic test embedded successfully. No repository content was sent.",
    at: new Date().toISOString(),
    latencyMs: Math.round(performance.now() - start),
    dimension: vectors[0].length,
  };
}
export async function testVector(
  adapter: VectorAdapter,
  signal?: AbortSignal,
): Promise<ConnectionResult> {
  const start = performance.now();
  if (!adapter.testConnection)
    throw new Error("Connection testing is unsupported by this adapter.");
  const detail = await adapter.testConnection(signal);
  return {
    status: "Ready",
    detail,
    at: new Date().toISOString(),
    latencyMs: Math.round(performance.now() - start),
  };
}

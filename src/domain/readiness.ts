import type { Chunk, ProviderConfig } from "./types";
import { hash } from "./security";
export type Readiness =
  "Not configured" | "Indexing" | "Ready" | "Stale" | "Failed" | "Unsupported";
export function indexReadiness(
  chunks: Chunk[],
  config: ProviderConfig,
  backend: string,
  namespace: string | undefined,
  signature: string | undefined,
  storedBackend: string | undefined,
  active: boolean,
  error?: string,
): { status: Readiness; detail: string; indexed: number } {
  const indexed = chunks.filter(
    (c) => c.namespace === namespace && c.vector?.length,
  ).length;
  const result = (status: Readiness, detail: string) => ({
    status,
    detail,
    indexed,
  });
  if (!["local", "qdrant", "pgvector"].includes(backend.split(":")[0]))
    return result("Unsupported", "Choose local, Qdrant, or pgvector storage.");
  if (active)
    return result(
      "Indexing",
      "Building a new index; the previous completed index is preserved.",
    );
  if (error) return result("Failed", error);
  if (config.provider === "none" || !config.model)
    return result(
      "Not configured",
      "Choose an embedding provider and model. Keyword search is available after source sync.",
    );
  if (!namespace)
    return result(
      "Not configured",
      "Provider selected. Preview chunks, test the connection, then build the index.",
    );
  if (
    signature !==
      hash(`${config.provider}:${config.endpoint}:${config.model}`) ||
    storedBackend !== backend ||
    indexed !== chunks.length ||
    !chunks.length
  )
    return result(
      "Stale",
      "Sources or embedding settings changed. Rebuild before relying on semantic results.",
    );
  return result(
    "Ready",
    `${indexed} chunks match the active embedding model and storage configuration.`,
  );
}

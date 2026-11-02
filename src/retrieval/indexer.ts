import type {
  Chunk,
  EmbeddingProvider,
  Progress,
  VectorAdapter,
} from "../domain/types";
import { assertNotAborted, hash, redact, uid } from "../domain/security";
import { Store } from "../persistence/store";
import { LocalVectors } from "../providers/vectors";
export async function buildVectorIndex(
  store: Store,
  provider: EmbeddingProvider,
  adapter: VectorAdapter,
  progress: (p: Progress) => void = () => undefined,
  signal?: AbortSignal,
  force = false,
  backend = "local",
): Promise<string> {
  const chunks = store.chunks();
  if (!chunks.length)
    throw new Error("Import and synchronize a repository first");
  const config = provider.config;
  const signature = hash(
    `${config.provider}:${config.endpoint}:${config.model}`,
  );
  const previous = store.getMeta("namespace");
  const previousSignature = store.getMeta("embeddingSignature");
  if (
    !force &&
    previous &&
    previousSignature === signature &&
    store.getMeta("vectorBackend") === backend &&
    chunks.every((c) => c.vector && c.namespace === previous)
  ) {
    progress({
      stage: "Index already current",
      completed: chunks.length,
      total: chunks.length,
    });
    return previous;
  }
  const cachedDimension =
    previousSignature === signature && !force
      ? Number(store.getMeta("embeddingDimension"))
      : 0;
  const dimension =
    cachedDimension ||
    (await provider.embed([redact(chunks[0].text)], signal))[0].length;
  const namespace = `${hash([...new Set(chunks.map((c) => c.repoId))].sort().join("|")).slice(0, 12)}:${signature.slice(0, 16)}:${dimension}:${uid()}`;
  const staged: Chunk[] = [];
  let committed = false;
  try {
    for (let i = 0; i < chunks.length; i += 16) {
      assertNotAborted(signal);
      const batch = chunks.slice(i, i + 16);
      const need = batch.filter(
        (c) =>
          force ||
          !c.vector ||
          c.vector.length !== dimension ||
          previousSignature !== signature ||
          c.namespace !== previous,
      );
      const vectors = need.length
        ? await provider.embed(
            need.map((c) => redact(c.text)),
            signal,
          )
        : [];
      let v = 0;
      const result = batch.map((c) => ({
        ...c,
        namespace,
        vector: need.includes(c) ? vectors[v++] : c.vector,
      }));
      if (result.some((c) => c.vector?.length !== dimension))
        throw new Error(
          "Embedding dimensions changed mid-job; previous index preserved",
        );
      if (!(adapter instanceof LocalVectors))
        await adapter.upsert(namespace, result, signal);
      staged.push(...result);
      progress({
        stage: "Embedding chunks",
        completed: Math.min(i + 16, chunks.length),
        total: chunks.length,
      });
    }
    assertNotAborted(signal);
    store.transaction(() => {
      store.snapshot();
      for (const c of staged) store.putChunk(c);
      store.setMeta("namespace", namespace);
      store.setMeta("embeddingSignature", signature);
      store.setMeta("embeddingDimension", String(dimension));
      store.setMeta("vectorBackend", backend);
      const history = JSON.parse(store.getMeta("namespaceHistory") ?? "[]") as {
        namespace: string;
        backend: string;
        at: string;
      }[];
      history.push({ namespace, backend, at: new Date().toISOString() });
      store.setMeta("namespaceHistory", JSON.stringify(history));
    });
    committed = true;
    store.audit("index.build", namespace);
    await store.flush();
    return namespace;
  } catch (error) {
    // A persistence failure must not delete vectors referenced by the live store.
    if (!committed) await adapter.remove(namespace).catch(() => undefined);
    throw error;
  }
}

import ignore from "ignore";
import { minimatch } from "minimatch";
import type {
  Repository,
  SourceFS,
  Progress,
  SyncStats,
} from "../domain/types";
import { Store } from "../persistence/store";
import {
  assertNotAborted,
  errorMessage,
  hash,
  isCancelled,
  safePath,
} from "../domain/security";
import { parseSource, isCode, supported } from "./parser";
import { chunkRecord } from "./chunks";
export interface IngestOptions {
  excludedRoots?: string[];
  maxFileBytes: number;
  ignore: string[];
  chunkLines: number;
  overlap: number;
  parse?:
    | typeof parseSource
    | ((
        ...args: Parameters<typeof parseSource>
      ) => Promise<ReturnType<typeof parseSource>>);
}
const alwaysIgnored =
  /(?:^|\/)(?:\.git|node_modules|\.venv|\.cache|\.env[^/]*|\.aws|\.ssh|\.codex|\.agents)(?:\/|$)|\.(?:pem|key|p12|pfx)$/i;
export async function synchronize(
  repo: Repository,
  fs: SourceFS,
  store: Store,
  options: IngestOptions,
  progress: (p: Progress) => void = () => undefined,
  signal?: AbortSignal,
): Promise<SyncStats> {
  if (!repo.permissions.read)
    throw new Error("Repository read permission is required");
  const stats: SyncStats = {
    scanned: 0,
    changed: 0,
    removed: 0,
    skipped: 0,
    errors: [],
    cancelled: false,
  };
  const seen = new Set<string>();
  let enumerationFailed = false;
  let checkpointAt = Date.now();
  const policyKey = `ingest-policy:${repo.id}:${repo.roots.join("|")}`;
  const policy = hash(JSON.stringify([options.chunkLines, options.overlap]));
  const rechunk = store.getMeta(policyKey) !== policy;
  store.setMeta(
    `job:${repo.id}`,
    JSON.stringify({ state: "running", started: new Date().toISOString() }),
  );
  await store.flush();
  const existing = new Map(
    store
      .records(repo.id)
      .filter((r) => repo.roots.includes(r.root))
      .map((r) => [`${r.root}:${r.path}`, r]),
  );
  try {
    for (const root of repo.roots) {
      const rootIgnore = ignore();
      try {
        rootIgnore.add(
          new TextDecoder().decode(await fs.read(fs.join(root, ".gitignore"))),
        );
      } catch {
        /* absent gitignore */
      }
      const walk = async (
        relative: string,
        inherited: { base: string; rules: ReturnType<typeof ignore> }[],
      ): Promise<void> => {
        assertNotAborted(signal);
        const uri = relative ? fs.join(root, relative) : root;
        if (
          options.excludedRoots?.some(
            (excluded) =>
              uri.replace(/\/$/, "") === excluded.replace(/\/$/, ""),
          )
        )
          return;
        let entries;
        try {
          entries = await fs.list(uri);
        } catch (e) {
          stats.errors.push(`${relative}: ${errorMessage(e)}`);
          enumerationFailed = true;
          return;
        }
        const layers = [...inherited];
        if (relative)
          try {
            const text = new TextDecoder().decode(
              await fs.read(fs.join(uri, ".gitignore")),
            );
            layers.push({ base: relative + "/", rules: ignore().add(text) });
          } catch {
            /* absent nested ignore */
          }
        for (const entry of entries) {
          assertNotAborted(signal);
          const file = relative ? `${relative}/${entry.name}` : entry.name;
          try {
            safePath(file);
          } catch {
            stats.skipped++;
            continue;
          }
          const matchPath = entry.kind === "directory" ? file + "/" : file;
          let ignored = false;
          for (const layer of layers) {
            const match = layer.rules.test(matchPath.slice(layer.base.length));
            if (match.ignored) ignored = true;
            else if (match.unignored) ignored = false;
          }
          if (
            entry.kind === "symlink" ||
            alwaysIgnored.test(file) ||
            ignored ||
            options.ignore.some(
              (p) =>
                minimatch(file, p, { dot: true }) ||
                minimatch(matchPath, p, { dot: true }),
            )
          ) {
            stats.skipped++;
            continue;
          }
          if (entry.kind === "directory") {
            await walk(file, layers);
            continue;
          }
          if (
            !supported(file) ||
            (repo.kind === "document" && isCode(file)) ||
            (repo.kind === "code" && !isCode(file) && !file.startsWith(".okf/"))
          )
            continue;
          const sourceUri = fs.join(root, file);
          const previous = existing.get(`${root}:${file}`);
          if (previous) seen.add(previous.id);
          try {
            stats.scanned++;
            if ((await fs.size(sourceUri)) > options.maxFileBytes) {
              if (previous) {
                store.deleteRecord(previous.id);
                stats.removed++;
              }
              stats.skipped++;
              continue;
            }
            const bytes = await fs.read(sourceUri);
            if (
              bytes.length > options.maxFileBytes ||
              bytes.slice(0, 8192).includes(0)
            ) {
              if (previous) {
                store.deleteRecord(previous.id);
                stats.removed++;
              }
              stats.skipped++;
              continue;
            }
            const source = new TextDecoder("utf-8", { fatal: true }).decode(
              bytes,
            );
            if (previous?.contentHash === hash(source)) {
              const refreshed = { ...previous, commit: repo.commit };
              if (rechunk) {
                store.putRecord(
                  refreshed,
                  chunkRecord(refreshed, options.chunkLines, options.overlap),
                );
                stats.changed++;
              } else {
                if (previous.commit !== repo.commit)
                  store.putRecord(refreshed, store.chunks(previous.id));
                stats.skipped++;
              }
              continue;
            }
            const record = await (options.parse ?? parseSource)(
              repo,
              root,
              file,
              sourceUri,
              source,
            );
            assertNotAborted(signal);
            if (previous && record.kind === "code") {
              const before = previous.symbols
                .map((s) => `${s.kind} ${s.name} ${s.signature}`)
                .sort();
              const after = record.symbols
                .map((s) => `${s.kind} ${s.name} ${s.signature}`)
                .sort();
              if (JSON.stringify(before) !== JSON.stringify(after)) {
                const changes = {
                  beforeCommit: previous.commit,
                  afterCommit: record.commit,
                  removed: before.filter((s) => !after.includes(s)),
                  added: after.filter((s) => !before.includes(s)),
                  at: new Date().toISOString(),
                };
                store.setMeta(`drift:${record.id}`, JSON.stringify(changes));
                store.audit(
                  "code.signature_change",
                  record.id,
                  JSON.stringify(changes),
                );
              }
            }
            const oldChunks = new Map(
              previous
                ? store.chunks(previous.id).map((chunk) => [chunk.hash, chunk])
                : [],
            );
            store.putRecord(
              record,
              chunkRecord(record, options.chunkLines, options.overlap).map(
                (chunk) => {
                  const old = oldChunks.get(chunk.hash);
                  return old
                    ? { ...chunk, vector: old.vector, namespace: old.namespace }
                    : chunk;
                },
              ),
            );
            seen.add(record.id);
            stats.changed++;
            if (Date.now() - checkpointAt >= 5000) {
              await store.flush();
              checkpointAt = Date.now();
            }
          } catch (e) {
            if (isCancelled(e)) throw e;
            stats.errors.push(`${file}: ${errorMessage(e)}`);
          }
          progress({
            stage: "Indexing sources",
            completed: stats.scanned,
            detail: file,
          });
        }
      };
      await walk("", [{ base: "", rules: rootIgnore }]);
    }
    if (!enumerationFailed && !stats.errors.length) {
      store.setMeta(policyKey, policy);
    }
    if (!enumerationFailed)
      for (const record of existing.values())
        if (!seen.has(record.id)) {
          store.deleteRecord(record.id);
          stats.removed++;
        }
  } catch (e) {
    if (isCancelled(e)) stats.cancelled = true;
    else throw e;
  } finally {
    for (const root of repo.roots)
      store.setMeta(
        `sync:${repo.id}:${root}`,
        JSON.stringify({
          ...stats,
          errors: stats.errors.slice(0, 20),
          errorCount: stats.errors.length,
          at: new Date().toISOString(),
        }),
      );
    store.setMeta(
      `job:${repo.id}`,
      JSON.stringify({
        state: stats.cancelled ? "interrupted" : "complete",
        ...stats,
      }),
    );
    store.audit("repository.sync", repo.id, JSON.stringify(stats));
    await store.flush();
  }
  return stats;
}

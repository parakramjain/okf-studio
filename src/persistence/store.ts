import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import type {
  AuditEvent,
  Chunk,
  KnowledgeRecord,
  Proposal,
  Repository,
} from "../domain/types";
import { hash, redact, uid } from "../domain/security";
export interface StoreIO {
  read(): Promise<Uint8Array | undefined>;
  write(data: Uint8Array): Promise<void>;
}
export class Store {
  private constructor(
    readonly db: Database,
    private readonly io: StoreIO,
  ) {}
  private pending: Promise<void> = Promise.resolve();
  static async open(io: StoreIO, wasmPath?: string): Promise<Store> {
    const sql: SqlJsStatic = await initSqlJs(
      wasmPath ? { locateFile: () => wasmPath } : undefined,
    );
    const bytes = await io.read();
    const store = new Store(
      bytes?.length ? new sql.Database(bytes) : new sql.Database(),
      io,
    );
    store.db.run(`PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON;
      CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS repositories(id TEXT PRIMARY KEY,json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,repo TEXT NOT NULL,path TEXT NOT NULL,hash TEXT NOT NULL,json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS records_repo ON records(repo);
      CREATE TABLE IF NOT EXISTS chunks(id TEXT PRIMARY KEY,record TEXT NOT NULL,json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS chunks_record ON chunks(record);
      CREATE TABLE IF NOT EXISTS terms(term TEXT NOT NULL,chunk TEXT NOT NULL,frequency INTEGER NOT NULL,PRIMARY KEY(term,chunk));
      CREATE INDEX IF NOT EXISTS terms_chunk ON terms(chunk);
      CREATE TABLE IF NOT EXISTS proposals(id TEXT PRIMARY KEY,json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit(seq INTEGER PRIMARY KEY AUTOINCREMENT,json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS snapshots(id TEXT PRIMARY KEY,created TEXT NOT NULL,json TEXT NOT NULL);`);
    const version = store.getMeta("schemaVersion");
    if (version && version !== "1") {
      store.db.close();
      throw new Error(
        `Unsupported knowledge database schema ${version}; use a compatible extension or rebuild the derived index.`,
      );
    }
    store.setMeta("schemaVersion", "1");
    return store;
  }
  private all<T>(sql: string, args: string[] = []): T[] {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(args);
      const rows: T[] = [];
      while (stmt.step()) rows.push(JSON.parse(String(stmt.get()[0])) as T);
      return rows;
    } finally {
      stmt.free();
    }
  }
  getMeta(key: string): string | undefined {
    const stmt = this.db.prepare("SELECT value FROM meta WHERE key=?");
    try {
      stmt.bind([key]);
      return stmt.step() ? String(stmt.get()[0]) : undefined;
    } finally {
      stmt.free();
    }
  }
  setMeta(key: string, value: string): void {
    this.db.run("INSERT OR REPLACE INTO meta VALUES(?,?)", [key, value]);
  }
  repositories(): Repository[] {
    return this.all("SELECT json FROM repositories");
  }
  putRepository(repo: Repository): void {
    this.db.run("INSERT OR REPLACE INTO repositories VALUES(?,?)", [
      repo.id,
      JSON.stringify(repo),
    ]);
  }
  records(repoId?: string): KnowledgeRecord[] {
    return this.all(
      "SELECT json FROM records" + (repoId ? " WHERE repo=?" : ""),
      repoId ? [repoId] : [],
    );
  }
  record(id: string): KnowledgeRecord | undefined {
    return this.all<KnowledgeRecord>("SELECT json FROM records WHERE id=?", [
      id,
    ])[0];
  }
  chunks(recordId?: string): Chunk[] {
    return this.all(
      "SELECT json FROM chunks" + (recordId ? " WHERE record=?" : ""),
      recordId ? [recordId] : [],
    );
  }
  putRecord(record: KnowledgeRecord, chunks: Chunk[]): void {
    this.transaction(() => {
      this.deleteRecord(record.id);
      this.db.run("INSERT INTO records VALUES(?,?,?,?,?)", [
        record.id,
        record.repoId,
        record.path,
        record.contentHash,
        JSON.stringify(record),
      ]);
      for (const chunk of chunks) this.putChunk(chunk);
    });
  }
  putChunk(chunk: Chunk): void {
    this.db.run("INSERT OR REPLACE INTO chunks VALUES(?,?,?)", [
      chunk.id,
      chunk.recordId,
      JSON.stringify(chunk),
    ]);
    this.db.run("DELETE FROM terms WHERE chunk=?", [chunk.id]);
    const counts = new Map<string, number>();
    for (const term of tokenize(chunk.text))
      counts.set(term, (counts.get(term) ?? 0) + 1);
    for (const [term, count] of counts)
      this.db.run("INSERT INTO terms VALUES(?,?,?)", [term, chunk.id, count]);
  }
  deleteRecord(id: string): void {
    this.db.run(
      "DELETE FROM terms WHERE chunk IN (SELECT id FROM chunks WHERE record=?)",
      [id],
    );
    this.db.run("DELETE FROM chunks WHERE record=?", [id]);
    this.db.run("DELETE FROM records WHERE id=?", [id]);
  }
  removeRepository(id: string): void {
    this.transaction(() => {
      for (const record of this.records(id)) this.deleteRecord(record.id);
      this.db.run("DELETE FROM repositories WHERE id=?", [id]);
      for (const proposal of this.proposals().filter((p) => p.repoId === id))
        this.db.run("DELETE FROM proposals WHERE id=?", [proposal.id]);
      this.db.run("DELETE FROM snapshots");
    });
  }
  putProposal(value: Proposal): void {
    this.db.run("INSERT OR REPLACE INTO proposals VALUES(?,?)", [
      value.id,
      JSON.stringify(value),
    ]);
  }
  proposals(): Proposal[] {
    return this.all("SELECT json FROM proposals");
  }
  audit(action: string, subject: string, detail?: string): void {
    const event: AuditEvent = {
      at: new Date().toISOString(),
      action,
      subject,
      detail: detail ? redact(detail) : undefined,
      traceId: uid(),
    };
    this.db.run("INSERT INTO audit(json) VALUES(?)", [JSON.stringify(event)]);
  }
  events(): AuditEvent[] {
    return this.all("SELECT json FROM audit ORDER BY seq DESC LIMIT 500");
  }
  prune(days: number): void {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    this.db.run("DELETE FROM audit WHERE json_extract(json,'$.at') < ?", [
      cutoff,
    ]);
    this.db.run("DELETE FROM snapshots WHERE created < ?", [cutoff]);
    for (const p of this.proposals().filter(
      (p) => p.status !== "pending" && p.createdAt < cutoff,
    ))
      this.db.run("DELETE FROM proposals WHERE id=?", [p.id]);
  }
  snapshot(): string {
    const id = uid();
    this.db.run("INSERT INTO snapshots VALUES(?,?,?)", [
      id,
      new Date().toISOString(),
      JSON.stringify({
        chunks: this.chunks(),
        metadata: Object.fromEntries(
          [
            "namespace",
            "embeddingSignature",
            "embeddingDimension",
            "vectorBackend",
          ].map((k) => [k, this.getMeta(k) ?? ""]),
        ),
      }),
    ]);
    this.db.run(
      "DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY created DESC LIMIT 2)",
    );
    return id;
  }
  rollback(): void {
    const data = this.all<{
      chunks: Chunk[];
      metadata: Record<string, string>;
    }>("SELECT json FROM snapshots ORDER BY created DESC LIMIT 1")[0];
    if (!data) throw new Error("No index snapshot available");
    this.transaction(() => {
      const current = this.chunks();
      const hashes = new Map(current.map((c) => [c.id, c.hash]));
      this.db.run("DELETE FROM chunks; DELETE FROM terms;");
      const restored = new Set<string>();
      for (const chunk of data.chunks)
        if (hashes.get(chunk.id) === chunk.hash) {
          this.putChunk(chunk);
          restored.add(chunk.id);
        }
      for (const chunk of current)
        if (!restored.has(chunk.id))
          this.putChunk({ ...chunk, vector: undefined, namespace: undefined });
      for (const [key, value] of Object.entries(data.metadata))
        this.setMeta(key, value);
    });
  }
  transaction<T>(fn: () => T): T {
    this.db.run("SAVEPOINT operation");
    try {
      const result = fn();
      this.db.run("RELEASE operation");
      return result;
    } catch (error) {
      this.db.run("ROLLBACK TO operation; RELEASE operation");
      throw error;
    }
  }
  async flush(): Promise<void> {
    const data = this.db.export();
    const run = this.pending
      .catch(() => undefined)
      .then(() => this.io.write(data));
    this.pending = run;
    await run;
  }
  async close(): Promise<void> {
    await this.flush();
    this.db.close();
  }
  fingerprint(): string {
    return hash(
      JSON.stringify(this.records().map((r) => [r.id, r.contentHash])),
    );
  }
}
export function tokenize(text: string): string[] {
  return (
    text
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .match(/[\p{L}\p{N}_]{2,}/gu) ?? []
  );
}

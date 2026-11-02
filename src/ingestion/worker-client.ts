import { Worker } from "node:worker_threads";
import type { parseSource } from "./parser";
import type { KnowledgeRecord } from "../domain/types";
export class ParserWorker {
  private readonly worker: Worker;
  private next = 0;
  private pending = new Map<
    number,
    { resolve: (r: KnowledgeRecord) => void; reject: (e: Error) => void }
  >();
  constructor(file: string) {
    this.worker = new Worker(file);
    this.worker.on("message", (m) => {
      const p = this.pending.get(m.id);
      this.pending.delete(m.id);
      if (m.error) p?.reject(new Error(m.error));
      else p?.resolve(m.record);
    });
    this.worker.on("error", (error) => {
      for (const p of this.pending.values()) p.reject(error);
      this.pending.clear();
    });
  }
  parse(...args: Parameters<typeof parseSource>): Promise<KnowledgeRecord> {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, args });
    });
  }
  async close(): Promise<void> {
    for (const p of this.pending.values())
      p.reject(new Error("Parser stopped"));
    this.pending.clear();
    await this.worker.terminate();
  }
}

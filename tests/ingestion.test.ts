import { describe, it, expect } from "vitest";
import { parseSource } from "../src/ingestion/parser";
import {
  parseOKF,
  serializeOKF,
  trustTier,
  validateOKF,
  generateConcept,
} from "../src/ingestion/okf";
import { chunkRecord } from "../src/ingestion/chunks";
import { synchronize } from "../src/ingestion/ingest";
import { Store } from "../src/persistence/store";
import type { Repository, SourceFS } from "../src/domain/types";
export const repo: Repository = {
  id: "repo",
  name: "Fixture",
  kind: "hybrid",
  roots: ["file:///fixture"],
  permissions: { read: true, write: true },
};
describe("ingestion and OKF", () => {
  it("extracts TS AST symbols, imports, API routes and tests", () => {
    const r = parseSource(
      repo,
      repo.roots[0],
      "app.ts",
      "file:///fixture/app.ts",
      `import { user } from './user';\nexport class App { run(x: string) { return user(x); } }\napp.get('/users', handler);\ntest('route',()=>handler());`,
    );
    expect(r.symbols.map((s) => s.kind)).toEqual(
      expect.arrayContaining(["class", "function", "API", "test"]),
    );
    expect(r.imports).toContain("./user");
    expect(r.symbols.find((s) => s.name === "run")?.calls).toContain("user");
  });
  it("extracts Python syntax without executing it", () => {
    const r = parseSource(
      repo,
      repo.roots[0],
      "app.py",
      "file:///fixture/app.py",
      "import os\nclass Service:\n  def run(self):\n    return lookup()\n",
    );
    expect(r.symbols.map((s) => s.name)).toEqual(["Service", "run"]);
    expect(r.imports).toContain("os");
  });
  it('extracts Python API decorators, schema bases and multiline signatures',()=>{const r=parseSource(repo,repo.roots[0],'api.py','file:///fixture/api.py','class User(BaseModel):\n  name: str\n\n@app.get("/users")\ndef users(\n  limit: int = 5\n):\n  return []\n');expect(r.symbols.some(s=>s.kind==='API'&&s.name.includes('/users'))).toBe(true);expect(r.symbols.some(s=>s.kind==='schema')).toBe(true);expect(r.symbols.find(s=>s.name==='users')?.signature).toContain('limit');});
  it("round trips unknown YAML and comments, accepts minimal and unknown types", () => {
    const text =
      '---\n# preserved\ntype: Future Type\nx-vendor:\n  enabled: true\nverified: {by: "human:a", at: "2026-01-01T00:00:00Z"}\n---\n# body\n';
    const parsed = parseOKF(text);
    expect(serializeOKF(parsed)).toContain("# preserved");
    expect(
      parseOKF(serializeOKF(parsed, { title: "New" })).metadata["x-vendor"],
    ).toEqual({ enabled: true });
    expect(trustTier(parsed.metadata)).toBe("human-reviewed");
    expect(
      validateOKF("a.md", "---\ntype: X\n---\n").filter(
        (i) => i.severity === "error",
      ),
    ).toHaveLength(0);
  });
  it("enforces reserved files without rejecting broken links or optional metadata", () => {
    expect(
      validateOKF("a.md", "---\ntype: X\n---\n[missing](/other.md)").find(
        (i) => i.code === "link.broken",
      )?.severity,
    ).toBe("warning");
    expect(
      validateOKF("nested/index.md", '---\nokf_version: "0.2"\n---\n# Index')[0]
        .severity,
    ).toBe("error");
    expect(
      validateOKF("log.md", "# Log\n## 2026-02-31").some(
        (i) => i.code === "okf.log.date",
      ),
    ).toBe(true);
    expect(parseOKF("---\nx: [\n---\n").errors.length).toBeGreaterThan(0);
  });
  it("generates conformant evidence-only concepts and line-aware overlapping chunks", () => {
    const r = parseSource(
      repo,
      repo.roots[0],
      "x.ts",
      "file:///fixture/x.ts",
      "export function lookup() { return 1; }",
    );
    expect(
      validateOKF("x.md", generateConcept(r)).filter(
        (i) => i.severity === "error",
      ),
    ).toHaveLength(0);
    const chunks = chunkRecord(
      {
        ...r,
        content: Array.from({ length: 100 }, (_, i) => "line " + i).join("\n"),
      },
      20,
      3,
    );
    expect(chunks[1].span.start).toBe(18);
    expect(chunks.at(-1)?.span.end).toBe(100);
    expect(() => chunkRecord(r, 10, 10)).toThrow();
  });
  for (const mode of ["document", "code", "hybrid"] as const)
    it(`synchronizes ${mode} incrementally, honors ignores and deletes`, async () => {
      const files = new Map([
        ["guide.md", "# Guide\nEvidence"],
        ["app.ts", "export function run() {}"],
        [".env", "secret"],
        ["ignored.md", "excluded"],
      ]);
      const fs: SourceFS = {
        join: (r, p) => r + "/" + p,
        list: async () =>
          [...files.keys()].map((name) => ({ name, kind: "file" as const })),
        read: async (uri) => {
          const name = uri.split("/").at(-1)!;
          if (!files.has(name)) throw new Error("missing");
          return new TextEncoder().encode(files.get(name));
        },
        size: async () => 100,
      };
      const store = await Store.open({
        read: async () => undefined,
        write: async () => undefined,
      });
      const options = {
        maxFileBytes: 1000,
        ignore: ["ignored.md"],
        chunkLines: 20,
        overlap: 2,
      };
      const r = { ...repo, kind: mode };
      const first = await synchronize(r, fs, store, options);
      expect(first.changed).toBe(mode === "hybrid" ? 2 : 1);
      expect((await synchronize(r, fs, store, options)).changed).toBe(0);
      files.delete(mode === "code" ? "app.ts" : "guide.md");
      expect((await synchronize(r, fs, store, options)).removed).toBe(1);
      await store.close();
    });
  it("keeps indexed data on cancellation and failed enumeration", async () => {
    const store = await Store.open({
      read: async () => undefined,
      write: async () => undefined,
    });
    const r = parseSource(
      repo,
      repo.roots[0],
      "a.md",
      "file:///fixture/a.md",
      "# A",
    );
    store.putRecord(r, chunkRecord(r));
    const fs: SourceFS = {
      join: (r, p) => r + "/" + p,
      list: async () => {
        throw new Error("denied");
      },
      read: async () => {
        throw new Error("missing");
      },
      size: async () => 0,
    };
    const result = await synchronize(repo, fs, store, {
      maxFileBytes: 1000,
      ignore: [],
      chunkLines: 20,
      overlap: 2,
    });
    expect(result.removed).toBe(0);
    const c = new AbortController();
    c.abort();
    expect(
      (
        await synchronize(
          repo,
          fs,
          store,
          { maxFileBytes: 1000, ignore: [], chunkLines: 20, overlap: 2 },
          undefined,
          c.signal,
        )
      ).cancelled,
    ).toBe(true);
    expect(store.records()).toHaveLength(1);
    await store.close();
  });
});

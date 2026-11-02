import { describe, it, expect, vi } from "vitest";
import {
  createOrUpdateBundle,
  bundleSources,
  planBundle,
  type BundleIO,
} from "../src/governance/bundle";
import { applyProposal } from "../src/governance/review";
import { Store } from "../src/persistence/store";
import { parseSource } from "../src/ingestion/parser";
import { chunkRecord } from "../src/ingestion/chunks";
import { validateOKF } from "../src/ingestion/okf";
import type { Repository } from "../src/domain/types";

const source: Repository = {
  id: "source",
  name: "Source",
  kind: "hybrid",
  roots: ["file:///source"],
  permissions: { read: true, write: false },
};
const destination = "file:///chosen/place/project-okf";
async function fixture() {
  const store = await Store.open({
    read: async () => undefined,
    write: async () => undefined,
  });
  store.putRepository(source);
  const files = new Map<string, string>();
  const directories = new Set<string>();
  const setSource = (text: string, path = "auth.ts", repo = source) => {
    const record = parseSource(
      repo,
      repo.roots[0],
      path,
      `${repo.roots[0]}/${path}`,
      text,
    );
    files.set(record.sourceUri, text);
    store.putRecord(record, chunkRecord(record));
    return record;
  };
  const record = setSource("export function login() { return true; }");
  const io: BundleIO = {
    exists: async (root) => directories.has(root),
    read: async (root, path) => files.get(`${root}/${path}`) ?? null,
    write: async (root, path, text) => {
      files.set(`${root}/${path}`, text);
    },
    delete: async (root, path) => {
      files.delete(`${root}/${path}`);
    },
    publish: vi.fn(async (root, entries) => {
      if (directories.has(root)) throw new Error("Destination exists");
      directories.add(root);
      for (const entry of entries)
        files.set(`${root}/${entry.path}`, entry.content);
    }),
  };
  return { store, files, directories, setSource, record, io };
}

describe("repository-specific OKF creation", () => {
  it("creates a new bundle at the chosen destination immediately, without queuing initial files", async () => {
    const f = await fixture();
    const other = { ...source, id: "other", roots: ["file:///other"] };
    f.store.putRepository(other);
    f.setSource("OTHER REPOSITORY CONTENT", "other.md", other);
    const result = await createOrUpdateBundle(
      f.store,
      f.io,
      source,
      destination,
    );
    expect(result).toMatchObject({
      kind: "created",
      files: 2,
      repository: { roots: [destination], bundleSourceId: source.id },
    });
    expect(f.store.proposals()).toHaveLength(0);
    expect(f.files.has(`${destination}/index.md`)).toBe(true);
    expect(
      [...f.files.entries()]
        .filter(([path]) => path.startsWith(destination))
        .map(([, text]) => text)
        .join("\n"),
    ).not.toContain("OTHER REPOSITORY CONTENT");
    expect(f.store.getMeta(`bundleDestination:${source.id}`)).toBe(destination);
    const entries = planBundle([f.record]);
    for (const file of entries)
      expect(
        validateOKF(
          file.path,
          file.content,
          new Set(entries.map((e) => e.path)),
        ).filter((i) => i.severity === "error"),
      ).toEqual([]);
    await f.store.close();
  });
  it("leaves unchanged bundles alone and queues only changed files for subsequent approval", async () => {
    const f = await fixture();
    await createOrUpdateBundle(f.store, f.io, source, destination);
    expect(
      (await createOrUpdateBundle(f.store, f.io, source, destination)).kind,
    ).toBe("unchanged");
    expect(f.io.publish).toHaveBeenCalledTimes(1);
    expect(f.store.proposals()).toHaveLength(0);
    f.setSource("export function login(user: string) { return user; }");
    const result = await createOrUpdateBundle(
      f.store,
      f.io,
      source,
      destination,
    );
    expect(result).toMatchObject({ kind: "review", files: 1 });
    const proposal = f.store.proposals()[0];
    expect(proposal.root).toBe(destination);
    expect(f.files.get(`${destination}/${proposal.path}`)).toBe(
      proposal.before,
    );
    await applyProposal(
      f.store,
      f.io,
      proposal.id,
      "approve",
      async () => true,
    );
    expect(f.files.get(`${destination}/${proposal.path}`)).toBe(proposal.after);
    expect(
      (await createOrUpdateBundle(f.store, f.io, source, destination)).kind,
    ).toBe("unchanged");
    await f.store.close();
  });
  it("preserves unrelated existing folders and bundles belonging to another repository", async () => {
    const f = await fixture();
    f.directories.add(destination);
    f.files.set(`${destination}/index.md`, "User-owned content");
    await expect(
      createOrUpdateBundle(f.store, f.io, source, destination),
    ).rejects.toThrow("not this repository");
    f.files.set(
      `${destination}/.okf-studio.json`,
      JSON.stringify({ version: 1, sourceRepoId: "someone-else" }),
    );
    await expect(
      createOrUpdateBundle(f.store, f.io, source, destination),
    ).rejects.toThrow("not this repository");
    expect(f.files.get(`${destination}/index.md`)).toBe("User-owned content");
    expect(f.io.publish).not.toHaveBeenCalled();
    expect(f.store.proposals()).toHaveLength(0);
    await f.store.close();
  });
  it("does not create a destination or review records after cancellation or changed source detection", async () => {
    const f = await fixture();
    const controller = new AbortController();
    controller.abort();
    await expect(
      createOrUpdateBundle(
        f.store,
        f.io,
        source,
        destination,
        undefined,
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    f.files.set(f.record.sourceUri, "Unindexed edit");
    await expect(
      createOrUpdateBundle(f.store, f.io, source, destination),
    ).rejects.toThrow("Source changed since indexing");
    expect(f.io.publish).not.toHaveBeenCalled();
    expect(f.store.repositories()).toHaveLength(1);
    expect(f.store.proposals()).toHaveLength(0);
    await f.store.close();
  });
  it("does not register a failed publication or duplicate pending changes", async () => {
    const f = await fixture();
    await expect(
      createOrUpdateBundle(
        f.store,
        {
          ...f.io,
          publish: async () => {
            throw new Error("Disk full");
          },
        },
        source,
        destination,
      ),
    ).rejects.toThrow("Disk full");
    expect(f.store.repositories()).toHaveLength(1);
    await createOrUpdateBundle(f.store, f.io, source, destination);
    f.setSource("export const login = false;");
    await createOrUpdateBundle(f.store, f.io, source, destination);
    await expect(
      createOrUpdateBundle(f.store, f.io, source, destination),
    ).rejects.toThrow("pending changes");
    expect(f.store.proposals()).toHaveLength(1);
    await f.store.close();
  });
  it("avoids recursively generating known output folders or generated concepts", async () => {
    const f = await fixture();
    const generated = f.setSource(
      planBundle([f.record])[0].content,
      "custom/concept.md",
    );
    const index = f.setSource(
      '---\nokf_version: "0.2"\n---\n# Bundle',
      "custom/index.md",
    );
    expect(
      bundleSources([f.record, generated, index], source.id, [
        "file:///source/custom",
      ]),
    ).toEqual([f.record]);
    expect(bundleSources([f.record, generated], source.id)).toEqual([f.record]);
    await expect(
      createOrUpdateBundle(
        f.store,
        f.io,
        { ...source, bundleSourceId: "upstream" },
        destination,
      ),
    ).rejects.toThrow("not a generated bundle");
    await f.store.close();
  });
  it("keeps colliding source stems distinct and safely links filenames containing spaces", async () => {
    const f = await fixture();
    const doc = f.setSource("# [Auth] guide", "auth.md");
    const spaced = f.setSource("# API guide", "API guide.md");
    const files = planBundle([f.record, doc, spaced]);
    expect(new Set(files.map((file) => file.path)).size).toBe(4);
    expect(files.at(-1)?.content).toContain("API%20guide.md.md");
    expect(files.at(-1)?.content).toContain("\\[Auth\\]");
    await f.store.close();
  });
});

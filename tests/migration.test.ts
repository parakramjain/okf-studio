import { describe, expect, it, vi } from "vitest";
import { Store } from "../src/persistence/store";
import { importLegacyCatalog } from "../src/persistence/migrate";
const legacyId = "okf-studio-local.okf-knowledge-studio";
async function fixture() {
  let bytes: Uint8Array | undefined;
  const store = await Store.open({
    read: async () => undefined,
    write: async (b) => {
      bytes = b;
    },
  });
  store.putRepository({
    id: "old",
    name: "Preserved",
    kind: "document",
    roots: ["file:///repo"],
    permissions: { read: true, write: true },
  });
  await store.close();
  return bytes!;
}
describe("publisher identity migration", () => {
  it("copies the validated catalog and preserves the old bytes", async () => {
    const bytes = await fixture(),
      original = bytes.slice();
    let copied: Uint8Array | undefined;
    const store = await importLegacyCatalog(
      {
        read: async () => undefined,
        write: async (b) => {
          copied = b;
        },
      },
      legacyId,
      async (backup) => (backup ? undefined : bytes),
    );
    expect(store?.repositories()[0].id).toBe("old");
    expect(store?.getMeta("migratedFrom")).toBe(legacyId);
    expect(copied?.length).toBeGreaterThan(0);
    expect(bytes).toEqual(original);
    await store?.close();
  });
  it("never replaces an existing catalog or reads legacy data unnecessarily", async () => {
    const readLegacy = vi.fn(),
      write = vi.fn();
    expect(
      await importLegacyCatalog(
        { read: async () => new Uint8Array([1]), write },
        legacyId,
        readLegacy,
      ),
    ).toBeUndefined();
    expect(readLegacy).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });
  it("recovers a valid legacy backup and rejects corruption without writing", async () => {
    const bytes = await fixture(),
      write = vi.fn();
    const store = await importLegacyCatalog(
      { read: async () => undefined, write },
      legacyId,
      async (backup) => (backup ? bytes : new Uint8Array([1, 2, 3])),
    );
    expect(store?.repositories()[0].name).toBe("Preserved");
    await store?.close();
    write.mockClear();
    await expect(
      importLegacyCatalog(
        { read: async () => undefined, write },
        legacyId,
        async () => new Uint8Array([1, 2, 3]),
      ),
    ).rejects.toThrow("preserved");
    expect(write).not.toHaveBeenCalled();
  });
  it("propagates persistence failures and leaves first-time installations empty", async () => {
    const bytes = await fixture();
    await expect(
      importLegacyCatalog(
        {
          read: async () => undefined,
          write: async () => {
            throw new Error("Disk full");
          },
        },
        legacyId,
        async () => bytes,
      ),
    ).rejects.toThrow("Disk full");
    expect(
      await importLegacyCatalog(
        { read: async () => undefined, write: vi.fn() },
        legacyId,
        async () => undefined,
      ),
    ).toBeUndefined();
  });
});

import { Store, type StoreIO } from "./store";
/** Copy a validated legacy catalog once; never modify the legacy bytes or overwrite a current catalog. */
export async function importLegacyCatalog(
  io: StoreIO,
  legacyId: string,
  readLegacy: (backup: boolean) => Promise<Uint8Array | undefined>,
  wasmPath?: string,
): Promise<Store | undefined> {
  if ((await io.read()) !== undefined) return undefined;
  let invalid = false;
  for (const backup of [false, true]) {
    const bytes = await readLegacy(backup);
    if (bytes === undefined) continue;
    let store: Store;
    try {
      if (!bytes.length) throw new Error("Empty legacy catalog");
      store = await Store.open({ ...io, read: async () => bytes }, wasmPath);
    } catch {
      invalid = true;
      continue;
    }
    try {
      store.setMeta("migratedFrom", legacyId);
      await store.flush();
      return store;
    } catch (error) {
      store.db.close();
      throw error;
    }
  }
  if (invalid)
    throw new Error(
      "The previous OKF Studio catalog could not be read. Its files were preserved. Repair or export it using the previous installation before migrating.",
    );
  return undefined;
}

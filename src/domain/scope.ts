import type { KnowledgeRecord, Scope } from "./types";

/** Folder paths are relative to an imported root, regardless of host OS. */
export function normalizeFolder(folder = ""): string {
  return folder
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+|\/+$/g, "");
}

export function inScope(
  record: Pick<KnowledgeRecord, "id" | "repoId" | "path">,
  scope: Scope,
): boolean {
  const folder = normalizeFolder(scope.folder);
  return (
    (!scope.repoIds || scope.repoIds.includes(record.repoId)) &&
    (!scope.recordIds || scope.recordIds.includes(record.id)) &&
    (!folder || record.path.startsWith(folder + "/"))
  );
}

import * as vscode from "vscode";
import type { KnowledgeRecord, Repository } from "../domain/types";
import { checkPath } from "./files";

export function readableRoot(
  repositories: Repository[],
  repoId: string,
  root: string,
): Repository {
  const repo = repositories.find((r) => r.id === repoId);
  if (
    !vscode.workspace.isTrusted ||
    !repo?.permissions.read ||
    !repo.roots.includes(root)
  )
    throw new Error("Choose a readable, imported repository root.");
  return repo;
}
export async function listFiles(
  repositories: Repository[],
  records: KnowledgeRecord[],
  repoId: string,
  root: string,
  path: string,
  offset = 0,
) {
  readableRoot(repositories, repoId, root);
  const uri = path ? await checkPath(root, path) : vscode.Uri.parse(root);
  const entries = (await vscode.workspace.fs.readDirectory(uri)).map(
    ([name, type]) => ({
      name,
      path: path ? `${path}/${name}` : name,
      kind:
        type & vscode.FileType.SymbolicLink
          ? "symlink"
          : type & vscode.FileType.Directory
            ? "directory"
            : "file",
    }),
  );
  entries.sort(
    (a, b) =>
      Number(b.kind === "directory") - Number(a.kind === "directory") ||
      a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
  const indexed = new Map(
    records
      .filter((r) => r.repoId === repoId && r.root === root)
      .map((r) => [r.path, r.id]),
  );
  return {
    entries: entries
      .slice(offset, offset + 200)
      .map((e) => ({ ...e, recordId: indexed.get(e.path) })),
    total: entries.length,
    next: offset + 200 < entries.length ? offset + 200 : null,
  };
}

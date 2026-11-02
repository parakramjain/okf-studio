import * as vscode from "vscode";
import { realpath } from "node:fs/promises";
import path from "node:path";
import type { SourceFS, FileEntry } from "../domain/types";
import type { ReviewIO } from "../governance/review";
import { safePath } from "../domain/security";
export async function checkPath(
  root: string,
  relative: string,
  writing = false,
): Promise<vscode.Uri> {
  safePath(relative);
  const base = vscode.Uri.parse(root);
  const parts = relative.split("/");
  let current = base;
  for (let i = 0; i < parts.length; i++) {
    current = vscode.Uri.joinPath(current, parts[i]);
    try {
      const stat = await vscode.workspace.fs.stat(current);
      if (stat.type & vscode.FileType.SymbolicLink)
        throw new Error("Symbolic links are not allowed in repository paths");
    } catch (error) {
      if (
        error instanceof vscode.FileSystemError &&
        error.code === "FileNotFound" &&
        writing
      )
        break;
      throw error;
    }
  }
  if (base.scheme === "file") {
    const canonical = await realpath(base.fsPath);
    let candidate = current.fsPath;
    if (writing) {
      while (true) {
        try {
          candidate = await realpath(candidate);
          break;
        } catch {
          const parent = path.dirname(candidate);
          if (parent === candidate) throw new Error("No safe write parent");
          candidate = parent;
        }
      }
    } else candidate = await realpath(candidate);
    const relativePath = path.relative(canonical, candidate);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath))
      throw new Error("Resolved path escapes repository root");
  }
  return vscode.Uri.joinPath(base, ...parts);
}
export const sourceFS: SourceFS = {
  join: (root, relative) =>
    vscode.Uri.joinPath(
      vscode.Uri.parse(root),
      ...safePath(relative).split("/"),
    ).toString(),
  list: async (uri) => {
    const entries = await vscode.workspace.fs.readDirectory(
      vscode.Uri.parse(uri),
    );
    return entries.map(([name, type]): FileEntry => ({
      name,
      kind:
        type & vscode.FileType.SymbolicLink
          ? "symlink"
          : type & vscode.FileType.Directory
            ? "directory"
            : "file",
    }));
  },
  read: async (uri) => vscode.workspace.fs.readFile(vscode.Uri.parse(uri)),
  size: async (uri) =>
    (await vscode.workspace.fs.stat(vscode.Uri.parse(uri))).size,
};
export function safeSourceFS(root: string): SourceFS {
  return {
    ...sourceFS,
    read: async (uri) => {
      const base = vscode.Uri.parse(root);
      const target = vscode.Uri.parse(uri);
      const relative = target.path.slice(
        base.path.replace(/\/$/, "").length + 1,
      );
      await checkPath(root, relative);
      return sourceFS.read(uri);
    },
    size: async (uri) => {
      const base = vscode.Uri.parse(root);
      const target = vscode.Uri.parse(uri);
      await checkPath(
        root,
        target.path.slice(base.path.replace(/\/$/, "").length + 1),
      );
      return sourceFS.size(uri);
    },
  };
}
export const reviewIO: ReviewIO = {
  read: async (root, relative) => {
    try {
      return new TextDecoder().decode(
        await vscode.workspace.fs.readFile(await checkPath(root, relative)),
      );
    } catch (error) {
      if (
        error instanceof vscode.FileSystemError &&
        error.code === "FileNotFound"
      )
        return null;
      throw error;
    }
  },
  write: async (root, relative, text) => {
    const uri = await checkPath(root, relative, true);
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, ".."));
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(text));
  },
  delete: async (root, relative) =>
    vscode.workspace.fs.delete(await checkPath(root, relative), {
      recursive: false,
      useTrash: true,
    }),
};

import * as vscode from "vscode";
import { mkdir } from "node:fs/promises";
import { assertNotAborted, safePath, uid } from "../domain/security";
import { checkPath, reviewIO } from "./files";
import type { BundleIO } from "../governance/bundle";

export function bundleFolderName(value: string): string | undefined {
  try {
    safePath(value);
  } catch {
    return "Enter a safe folder name, without paths or traversal.";
  }
  if (
    !value.trim() ||
    value !== value.trim() ||
    /[/\\:*?"<>|]/.test(value) ||
    /[. ]$/.test(value) ||
    /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(value)
  )
    return "Enter one valid folder name, such as project-okf.";
  return undefined;
}
export const bundleIO: BundleIO = {
  ...reviewIO,
  exists: async (root) => {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.parse(root));
      return true;
    } catch (e) {
      if (e instanceof vscode.FileSystemError && e.code === "FileNotFound")
        return false;
      throw e;
    }
  },
  publish: async (root, files, signal) => {
    const destination = vscode.Uri.parse(root);
    const parent = vscode.Uri.joinPath(destination, "..");
    const name = destination.path.split("/").at(-1)!;
    const error = bundleFolderName(name);
    if (error) throw new Error(error);
    await checkPath(parent.toString(), name, true);
    const stagingName = `.okf-create-${uid()}`;
    const staging = vscode.Uri.joinPath(parent, stagingName);
    // The random staging tree is owned by this operation and never published partially.
    if (staging.scheme === "file") await mkdir(staging.fsPath);
    else await vscode.workspace.fs.createDirectory(staging);
    let published = false;
    try {
      for (const file of files) {
        assertNotAborted(signal);
        await reviewIO.write(staging.toString(), file.path, file.content);
      }
      assertNotAborted(signal);
      await checkPath(parent.toString(), name, true);
      await vscode.workspace.fs.rename(staging, destination, {
        overwrite: false,
      });
      published = true;
    } finally {
      if (!published)
        await vscode.workspace.fs
          .delete(staging, { recursive: true })
          .then(undefined, () => undefined);
    }
  },
};

import * as vscode from "vscode";
import type { Repository } from "../domain/types";
export const gitActions = [
  "status",
  "history",
  "branches",
  "fetch",
  "pull",
  "commit",
  "push",
  "clone",
] as const;
export type GitAction = (typeof gitActions)[number];
interface GitAPI {
  getRepository(uri: vscode.Uri): { rootUri: vscode.Uri } | null;
  openRepository(uri: vscode.Uri): Promise<{ rootUri: vscode.Uri } | null>;
}
export async function gitAction(
  action: GitAction,
  repositories: Repository[],
  repoId?: string,
): Promise<void> {
  if (!vscode.workspace.isTrusted)
    throw new Error("Trust this workspace to use Git.");
  const extension = vscode.extensions.getExtension<{
    getAPI(version: number): GitAPI;
  }>("vscode.git");
  if (!extension)
    throw new Error(
      "Enable the built-in VS Code Git extension to use Git commands.",
    );
  const api = (await extension.activate()).getAPI(1);
  if (action === "clone") {
    await vscode.commands.executeCommand("git.clone");
    return;
  }
  const choices = repositories
    .filter((r) => r.permissions.read && (!repoId || r.id === repoId))
    .flatMap((r) =>
      r.roots.map((root) => ({
        label: r.name,
        description: vscode.Uri.parse(root).fsPath,
        root,
        repo: r,
      })),
    );
  const chosen =
    choices.length === 1
      ? choices[0]
      : await vscode.window.showQuickPick(choices, {
          title: "Choose a repository for Git",
        });
  if (!chosen) {
    if (!choices.length) throw new Error("Import a repository first.");
    return;
  }
  if (!["status", "history"].includes(action) && !chosen.repo.permissions.write)
    throw new Error(
      "Repository write permission is required for this Git action.",
    );
  const uri = vscode.Uri.parse(chosen.root);
  const repository = api.getRepository(uri) ?? (await api.openRepository(uri));
  if (!repository)
    throw new Error(
      "This folder is not a Git repository. Import a Git checkout or use Clone.",
    );
  // Built-in commands accept a URI and resolve it to the exact Git repository.
  // Keep credential prompts, conflict resolution, commit review and push controls native.
  const commands: Record<GitAction, string> = {
    status: "workbench.view.scm",
    history: "workbench.scm.history",
    branches: "git.checkout",
    fetch: "git.fetch",
    pull: "git.pull",
    commit: "git.commit",
    push: "git.push",
    clone: "git.clone",
  };
  await vscode.commands.executeCommand("git.refresh", repository.rootUri);
  if (action === "status" || action === "history") {
    await vscode.commands.executeCommand("workbench.view.scm");
    if (action === "history")
      await vscode.commands.executeCommand("workbench.scm.history.focus");
    void vscode.window.showInformationMessage(
      `Git ${action}: ${chosen.label}. Select this repository in Source Control${action === "history" ? " Graph" : ""} if multiple repositories are open.`,
    );
  } else
    await vscode.commands.executeCommand(commands[action], repository.rootUri);
}

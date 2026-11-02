import * as vscode from "vscode";
import { uid } from "../domain/security";
let panel: vscode.WebviewPanel | undefined;
export async function showGuide(
  context: vscode.ExtensionContext,
): Promise<void> {
  if (panel) {
    panel.reveal(vscode.ViewColumn.One);
    return;
  }
  const docs = vscode.Uri.joinPath(context.extensionUri, "docs"),
    media = vscode.Uri.joinPath(context.extensionUri, "media");
  const html = new TextDecoder().decode(
    await vscode.workspace.fs.readFile(
      vscode.Uri.joinPath(docs, "USER_GUIDE.html"),
    ),
  );
  panel = vscode.window.createWebviewPanel(
    "okf.guide",
    "OKF Studio · User guide",
    vscode.ViewColumn.One,
    { enableScripts: true, localResourceRoots: [docs, media] },
  );
  const nonce = uid();
  panel.webview.html = html
    .replace(
      "<!-- CSP -->",
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${panel.webview.cspSource} data:;">`,
    )
    .replace(
      'src="../media/guide.js"',
      `nonce="${nonce}" src="${panel.webview.asWebviewUri(vscode.Uri.joinPath(media, "guide.js"))}"`,
    )
    .replace(
      'href="../media/guide.css"',
      `href="${panel.webview.asWebviewUri(vscode.Uri.joinPath(media, "guide.css"))}"`,
    )
    .replace(
      /src="\.\.\/media\/screenshots\/([a-z-]+\.png)"/g,
      (_match, filename: string) =>
        `src="${panel!.webview.asWebviewUri(vscode.Uri.joinPath(media, "screenshots", filename))}"`,
    );
  panel.onDidDispose(
    () => {
      panel = undefined;
    },
    undefined,
    context.subscriptions,
  );
  context.subscriptions.push(panel);
}

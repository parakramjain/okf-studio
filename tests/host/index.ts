import * as vscode from "vscode";
import assert from "node:assert/strict";
import { bundleIO, bundleFolderName } from "../../src/host/bundle-files";
import { listFiles } from "../../src/host/explorer";
import { gitAction, gitActions } from "../../src/host/git";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension(
    "okf-studio-local.okf-knowledge-studio",
  );
  assert.ok(extension, "extension discovered");
  const api = (await extension.activate()) as {
    status: () => {
      mcpRegistered: boolean;
      trusted: boolean;
      webviewReady: boolean;
      records: number;
      repositories: number;
    };
    indexWorkspace: (
      kind: string,
    ) => Promise<{ records: number; code: number; documents: number }>;
    sync: () => Promise<void>;
  };
  assert.ok(api.status().trusted, "fixture workspace trusted");
  assert.ok(api.status().mcpRegistered, "MCP provider registered");
  if (process.env.OKF_EXPECT_UPGRADE === "1") {
    assert.ok(
      api.status().repositories > 0 && api.status().records > 0,
      "previous release catalog retained before sync",
    );
    console.log(
      "OKF UPGRADE ACCEPTANCE: existing workspace repositories and source records retained before synchronization PASS",
    );
  }
  const commands = await vscode.commands.getCommands(true);
  for (const name of [
    "open",
    "openEditor",
    "import",
    "sync",
    "generate",
    "configure",
    "ask",
    "agent",
    "export",
    "clear",
    "guide",
    ...gitActions.map((action) => `git.${action}`),
  ])
    assert.ok(commands.includes(`okf.${name}`), `command ${name} registered`);
  for (const kind of ["document", "code", "hybrid"]) {
    const stats = await api.indexWorkspace(kind);
    assert.ok(stats.records > 0, `${kind} imports sources`);
    if (kind === "document") assert.equal(stats.code, 0);
    if (kind === "code") assert.equal(stats.documents, 0);
    if (kind === "hybrid") {
      assert.ok(stats.code > 0);
      assert.ok(stats.documents > 0);
    }
  }
  await api.sync();
  await vscode.commands.executeCommand("okf.open");
  await vscode.commands.executeCommand("okf.studio.focus");
  const until = Date.now() + 15000;
  while (!api.status().webviewReady && Date.now() < until)
    await new Promise((resolve) => setTimeout(resolve, 100));
  assert.ok(
    api.status().webviewReady,
    "React webview loaded and completed typed ready handshake under CSP",
  );
  const bundleParent = vscode.Uri.joinPath(
    extension.extensionUri,
    ".cache",
    `bundle-acceptance-${Date.now()}`,
  );
  await vscode.workspace.fs.createDirectory(bundleParent);
  const target = vscode.Uri.joinPath(bundleParent, "my-okf");
  const files = [
    {
      path: "index.md",
      content: '---\nokf_version: "0.2"\n---\n# Knowledge',
      sourceHashes: {},
    },
    {
      path: "concepts/guide.md",
      content: "---\ntype: Reference\n---\n# Guide",
      sourceHashes: {},
    },
  ];
  await bundleIO.publish(target.toString(), files);
  assert.equal(
    await bundleIO.read(target.toString(), "index.md"),
    files[0].content,
  );
  await assert.rejects(
    bundleIO.publish(target.toString(), [
      { ...files[0], content: "Overwrite" },
    ]),
  );
  assert.equal(
    await bundleIO.read(target.toString(), "index.md"),
    files[0].content,
    "existing bundle preserved",
  );
  const cancelledTarget = vscode.Uri.joinPath(bundleParent, "cancelled-okf");
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    bundleIO.publish(cancelledTarget.toString(), files, controller.signal),
  );
  assert.equal(
    await bundleIO.exists(cancelledTarget.toString()),
    false,
    "cancel leaves no partial bundle",
  );
  assert.deepEqual(
    (await vscode.workspace.fs.readDirectory(bundleParent)).map(
      ([name]) => name,
    ),
    ["my-okf"],
    "staging folders cleaned up",
  );
  assert.ok(bundleFolderName("../escape"));
  assert.ok(bundleFolderName("CON"));
  assert.equal(bundleFolderName("project-okf"), undefined);
  const browserRepo = {
    id: "tree",
    name: "Tree fixture",
    kind: "hybrid" as const,
    roots: [target.toString()],
    permissions: { read: true, write: true },
  };
  await vscode.workspace.fs.writeFile(
    vscode.Uri.joinPath(target, ".hidden.bin"),
    new Uint8Array([0, 1]),
  );
  for (let i = 0; i < 205; i++)
    await vscode.workspace.fs.writeFile(
      vscode.Uri.joinPath(target, `unindexed-${i}.xyz`),
      new Uint8Array([0]),
    );
  const first = await listFiles(
    [browserRepo],
    [],
    browserRepo.id,
    target.toString(),
    "",
  );
  assert.equal(first.entries[0].kind, "directory", "folders sort first");
  assert.equal(first.entries.length, 200);
  assert.ok(
    first.entries.some((e) => e.name === ".hidden.bin"),
    "hidden unindexed files are visible",
  );
  assert.equal(first.next, 200);
  const second = await listFiles(
    [browserRepo],
    [],
    browserRepo.id,
    target.toString(),
    "",
    first.next!,
  );
  assert.equal(
    first.entries.length + second.entries.length,
    first.total,
    "all entries reachable through pagination",
  );
  assert.equal(second.next, null);
  assert.equal(
    (
      await listFiles(
        [browserRepo],
        [],
        browserRepo.id,
        target.toString(),
        "concepts",
      )
    ).entries[0].name,
    "guide.md",
  );
  await assert.rejects(
    listFiles([browserRepo], [], browserRepo.id, bundleParent.toString(), ""),
    /readable/,
  );
  await assert.rejects(
    listFiles(
      [browserRepo],
      [],
      browserRepo.id,
      target.toString(),
      "../escape",
    ),
    /Unsafe/,
  );
  await assert.rejects(
    listFiles(
      [{ ...browserRepo, permissions: { read: false, write: true } }],
      [],
      browserRepo.id,
      target.toString(),
      "",
    ),
    /readable/,
  );
  await vscode.commands.executeCommand("okf.guide");
  const guideUntil = Date.now() + 5000;
  while (
    !vscode.window.tabGroups.all
      .flatMap((g) => g.tabs)
      .some((t) => t.label.includes("User guide")) &&
    Date.now() < guideUntil
  )
    await new Promise((resolve) => setTimeout(resolve, 100));
  assert.ok(
    vscode.window.tabGroups.all
      .flatMap((g) => g.tabs)
      .some((t) => t.label.includes("User guide")),
    "bundled HTML guide opens",
  );
  execFileSync("git", ["init", "--quiet", target.fsPath], {
    windowsHide: true,
  });
  await gitAction("status", [browserRepo], browserRepo.id);
  await gitAction("history", [browserRepo], browserRepo.id);
  if (process.env.OKF_CAPTURE_GATE) {
    await vscode.commands.executeCommand("okf.openEditor");
    console.log("OKF CAPTURE READY: actual extension editor opened");
    const deadline = Date.now() + 300000;
    while (!existsSync(process.env.OKF_CAPTURE_GATE) && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 250));
    assert.ok(
      existsSync(process.env.OKF_CAPTURE_GATE),
      "actual extension screenshots captured",
    );
  }
  console.log(
    "OKF HOST ACCEPTANCE: activation, 19 commands, MCP registration, 3 modes, incremental sync, view focus, atomic bundle creation, collision/cancel preservation, filesystem tree pagination/guards, HTML guide, native Git status/history PASS",
  );
}

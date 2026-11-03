import { runTests } from "@vscode/test-electron";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
const root = process.cwd();
const extensionPath = process.env.OKF_EXTENSION_PATH || root;
const manifest = JSON.parse(
  readFileSync(path.join(extensionPath, "package.json"), "utf8"),
);
const local =
  process.env.OKF_CODE_EXECUTABLE ||
  (process.platform === "win32"
    ? path.join(
        process.env.LOCALAPPDATA || "",
        "Programs",
        "Microsoft VS Code",
        "Code.exe",
      )
    : "");
delete process.env.ELECTRON_RUN_AS_NODE;
await runTests({
  extensionDevelopmentPath: extensionPath,
  extensionTestsPath: path.join(root, ".cache/test-build/host-test.cjs"),
  ...(local && existsSync(local) ? { vscodeExecutablePath: local } : {}),
  launchArgs: [
    ...(manifest.publisher.toLowerCase() !== "okf-studio-local"
      ? ["--disable-extension=okf-studio-local.okf-knowledge-studio"]
      : []),
    ...(process.env.OKF_DEBUG_PORT
      ? ["--remote-debugging-port=" + process.env.OKF_DEBUG_PORT]
      : []),
    path.join(root, "tests/fixtures/workspace"),
    "--user-data-dir=" +
      path.join(
        root,
        process.env.OKF_USER_DATA_DIR ||
          (process.env.OKF_EXTENSION_PATH
            ? ".cache/packaged-profile"
            : ".cache/host-profile"),
      ),
    "--extensions-dir=" +
      path.join(
        root,
        process.env.OKF_EXTENSIONS_DIR ||
          (process.env.OKF_EXTENSION_PATH
            ? ".cache/vsix-extensions"
            : ".cache/host-extensions"),
      ),
    "--disable-workspace-trust",
    "--skip-welcome",
    "--skip-release-notes",
    "--disable-telemetry",
    "--disable-gpu",
    "--no-sandbox",
  ],
  extensionTestsEnv: {
    OKF_TEST: "1",
    OKF_EXTENSION_ID: `${manifest.publisher}.${manifest.name}`,
    ...(process.env.OKF_EXPECT_LEGACY_MIGRATION
      ? { OKF_EXPECT_LEGACY_MIGRATION: process.env.OKF_EXPECT_LEGACY_MIGRATION }
      : {}),
    ...(process.env.OKF_EXPECT_UPGRADE
      ? { OKF_EXPECT_UPGRADE: process.env.OKF_EXPECT_UPGRADE }
      : {}),
    ...(process.env.OKF_CAPTURE_GATE
      ? { OKF_CAPTURE_GATE: process.env.OKF_CAPTURE_GATE }
      : {}),
  },
});

import { readFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
mkdirSync("dist", { recursive: true });
execFileSync(
  process.execPath,
  [
    "node_modules/@vscode/vsce/vsce",
    "package",
    "--no-dependencies",
    "--githubBranch",
    "main",
    "--out",
    `dist/okf-studio-${version}.vsix`,
  ],
  { stdio: "inherit", windowsHide: true },
);

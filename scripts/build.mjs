import { build } from "esbuild";
import { build as viteBuild } from "vite";
import { mkdir, copyFile } from "node:fs/promises";
import "./notices.mjs";
await mkdir("out", { recursive: true });
await mkdir("dist", { recursive: true });
await build({
  entryPoints: {
    extension: "src/extension.ts",
    worker: "src/ingestion/worker.ts",
    mcp: "src/mcp/server.ts",
  },
  outdir: "out",
  bundle: true,
  platform: "node",
  format: "cjs",
  outExtension: { ".js": ".cjs" },
  external: ["vscode", "pg-native"],
  sourcemap: false,
  target: "node22",
  logLevel: "info",
});
await build({
  entryPoints: ["tests/host/index.ts"],
  outfile: ".cache/test-build/host-test.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["vscode"],
  target: "node22",
});
await copyFile("node_modules/sql.js/dist/sql-wasm.wasm", "out/sql-wasm.wasm");
await viteBuild({
  root: "webview",
  base: "./",
  build: {
    outDir: "../out/webview",
    emptyOutDir: true,
    minify: true,
    rollupOptions: {
      output: { entryFileNames: "main.js", assetFileNames: "style.[ext]" },
    },
  },
});

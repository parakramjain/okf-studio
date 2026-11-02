import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/ui",
  timeout: 30000,
  workers: 1,
  use: { headless: true, channel: "msedge", baseURL: "http://127.0.0.1:4173" },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js webview --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
});

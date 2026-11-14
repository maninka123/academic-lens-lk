import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  outputDir: "../test-results",
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173/academic-lens-lk/",
    headless: true,
    viewport: { width: 1680, height: 1050 },
    launchOptions: { channel: "chrome" },
    trace: "retain-on-failure",
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://127.0.0.1:5173",
          localStorage: [{ name: "lanka-academia-last-visit-v2", value: String(Date.now()) }],
        },
      ],
    },
  },
  webServer: {
    command: "npm run dev -- --port 5173",
    cwd: "..",
    url: "http://127.0.0.1:5173/academic-lens-lk/",
    reuseExistingServer: true,
    timeout: 30000,
  },
});

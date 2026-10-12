import { defineConfig, devices } from "@playwright/test";
import { buildTestEnv } from "./globalSetup.js";

const env = buildTestEnv();

export default defineConfig({
  // Where to find test files
  testDir: ".",
  testMatch: ["api/**/*.spec.js", "e2e/**/*.spec.js"],

  // Each individual test gets up to 3 minutes — Lighthouse + Gemini is slow.
  timeout: 180_000,

  // One retry on flaky network conditions (Gemini, Lighthouse).
  retries: 1,

  // Run test files in parallel but keep tests within a file sequential,
  // since the audit pipeline is stateful (DB rows, queue jobs).
  fullyParallel: false,
  workers: 1,

  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],

  globalSetup: "./globalSetup.js",
  globalTeardown: "./globalTeardown.js",

  use: {
    baseURL: "http://localhost:5173",
    // Keep traces on failure for debugging slow CI runs.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  // ── webServer: auto-start the server and Vite client ──────────────────────
  //
  // Playwright starts these in order, waiting for each URL to respond before
  // launching tests. Both inherit the test env (test DB, test Redis, no SSL).

  webServer: [
    {
      // Express API server
      command: "node src/server.js",
      url: "http://localhost:3001/health",
      cwd: "../server",
      env,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      // Vite React client
      command: "npm run dev -- --port 5173",
      url: "http://localhost:5173",
      cwd: "../client",
      env,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

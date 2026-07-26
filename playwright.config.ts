import { defineConfig, devices } from "@playwright/test";

const e2eFrontendPort = 45173;

export default defineConfig({
  testDir: "./e2e",
  timeout: 120000,
  expect: {
    timeout: 15000,
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["html"],
    ["list"],
    ["json", { outputFile: "reports/playwright-report.json" }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${e2eFrontendPort}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  globalSetup: require.resolve("./e2e/global-setup.ts"),
  globalTeardown: require.resolve("./e2e/global-teardown.ts"),
  // Existing broad E2E commands retain their managed development servers.
  // The isolated KAVACH runner supplies PLAYWRIGHT_BASE_URL and owns its Vite
  // child process instead, avoiding the Windows teardown issue for that flow.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [
      {
        command: "npm run dev:backend",
        url: "http://localhost:3001/api/health",
        timeout: 120000,
        reuseExistingServer: true,
      },
      {
        command: "npm run dev:frontend",
        url: "http://localhost:5173",
        timeout: 120000,
        reuseExistingServer: true,
      },
    ],
  projects: [
    {
      name: "e2e-core",
      testMatch: ["e2e/*.spec.ts", "!e2e/extreme/**", "!e2e/a11y/**"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "e2e-extreme",
      testMatch: "e2e/extreme/*.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "e2e-a11y",
      testMatch: "e2e/a11y/*.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      testMatch: ["e2e/**/*.spec.ts", "!e2e/extreme/**", "!e2e/a11y/**"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  outputDir: "reports/playwright-artifacts",
});

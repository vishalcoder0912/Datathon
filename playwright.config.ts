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
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${e2eFrontendPort}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
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
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ],
  outputDir: "reports/playwright-artifacts"
});

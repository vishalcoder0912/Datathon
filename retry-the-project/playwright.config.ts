import { defineConfig, devices } from "@playwright/test";

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
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
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

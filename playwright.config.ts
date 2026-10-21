import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    actionTimeout: 10000,
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], timezoneId: "America/Los_Angeles" },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], timezoneId: "Asia/Tokyo" },
    },
  ],
  webServer: {
    command: process.env.E2E_SERVER_COMMAND ?? "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});

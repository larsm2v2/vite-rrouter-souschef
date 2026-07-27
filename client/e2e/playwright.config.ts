import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const deployedBase = process.env.PLAYWRIGHT_BASE_URL;
const BASE_URL = deployedBase ?? "http://127.0.0.1:5173";

export default defineConfig({
  testDir: path.join(__dirname, "tests"),
  use: {
    baseURL: BASE_URL,
    headless: true,
    ignoreHTTPSErrors: true,
    // Helpful artifacts for debugging failing tests in CI
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "Mobile Chrome", use: { ...devices["Pixel 5"] } },
    { name: "Mobile Safari", use: { ...devices["iPhone 12"] } },
  ],
  // Only start a local dev server when not targeting a deployed URL.
  // CI runs that set PLAYWRIGHT_BASE_URL should target the live URL directly.
  ...(!deployedBase
    ? {
        webServer: {
          command: "npm run dev --silent",
          url: BASE_URL,
          cwd: path.resolve(__dirname, ".."),
          reuseExistingServer: !process.env.CI,
        },
      }
    : {}),
});

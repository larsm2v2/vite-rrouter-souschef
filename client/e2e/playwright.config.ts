import { defineConfig, devices } from "@playwright/test";
import type { PlaywrightTestConfig } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const deployedBase = process.env.PLAYWRIGHT_BASE_URL;

const config: PlaywrightTestConfig = {
  testDir: path.join(__dirname, "tests"),
  use: {
    baseURL: deployedBase ?? "http://127.0.0.1:5173",
    headless: true,
    ignoreHTTPSErrors: true,
    // Helpful artifacts for debugging failing tests in CI: record traces
    // on first retry, and keep screenshots + video on failure.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
};

// Only include a local webServer when not testing against an externally
// deployed site. CI runs that set PLAYWRIGHT_BASE_URL should skip starting
// the dev server so Playwright targets the live URL.
if (!deployedBase) {
  config.webServer = {
    command: "npm run dev --silent",
    url: "http://127.0.0.1:5173",
    cwd: path.resolve(__dirname, ".."),
    reuseExistingServer: !process.env.CI,
  };
}

export default defineConfig(config);

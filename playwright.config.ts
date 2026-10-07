import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

// Di lingkungan tanpa unduhan browser (sandbox), pakai Chromium yang sudah terpasang
// dan emulasikan iPhone di Chromium. Di CI, iPhone memakai WebKit (DECISIONS.md D-011).
const executablePath = process.env.PW_CHROMIUM_PATH;
const chromiumLaunch = executablePath ? { launchOptions: { executablePath } } : {};
const iphone = executablePath
  ? { ...devices["iPhone 13"], browserName: "chromium" as const, defaultBrowserType: "chromium" as const, ...chromiumLaunch }
  : devices["iPhone 13"];

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
  },
  projects: [
    { name: "pixel-5", use: { ...devices["Pixel 5"], ...chromiumLaunch } },
    { name: "iphone-13", use: iphone },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, ...chromiumLaunch } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm build && pnpm start --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});

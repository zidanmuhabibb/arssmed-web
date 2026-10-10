import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

// Di lingkungan tanpa unduhan browser (sandbox), pakai Chromium yang sudah terpasang
// dan emulasikan iPhone di Chromium. Di CI, iPhone memakai WebKit (DECISIONS.md D-011).
const executablePath = process.env.PW_CHROMIUM_PATH;
// WebGL lewat SwiftShader agar Viewer 3D bisa dirender di mesin tanpa GPU (CI/sandbox).
const glArgs = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const chromiumLaunch = { launchOptions: { args: glArgs, ...(executablePath ? { executablePath } : {}) } };
const iphone = executablePath
  ? { ...devices["iPhone 13"], browserName: "chromium" as const, defaultBrowserType: "chromium" as const, ...chromiumLaunch }
  : devices["iPhone 13"];

// AR penanda (FR-15): kamera palsu Chromium yang "melihat" kartu Unit 2 di meja.
const fakeCamera = [
  "--use-fake-ui-for-media-stream",
  "--use-fake-device-for-media-stream",
  `--use-file-for-fake-video-capture=${resolve("tests/fixtures/fake-camera-marker-u2.mjpeg")}`,
];
const CAMERA_SPEC = /penanda-kamera\.spec\.ts/;

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
    { name: "pixel-5", testIgnore: CAMERA_SPEC, use: { ...devices["Pixel 5"], ...chromiumLaunch } },
    { name: "iphone-13", testIgnore: CAMERA_SPEC, use: iphone },
    { name: "desktop", testIgnore: CAMERA_SPEC, use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, ...chromiumLaunch } },
    {
      name: "ar-kamera",
      testMatch: CAMERA_SPEC,
      use: { ...devices["Pixel 5"], launchOptions: { args: [...glArgs, ...fakeCamera], ...(executablePath ? { executablePath } : {}) } },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm build && pnpm start --port ${PORT}`,
        // Uji e2e memakai backend memori (tanpa Supabase) — DECISIONS D-026.
        env: { ARSSMED_BACKEND: "memory", ARSSMED_ALLOW_MEMORY_BACKEND: "1", ARSSMED_RATE_LIMIT_SCALE: "10" },
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});

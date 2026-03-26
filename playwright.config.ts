import { defineConfig, devices } from "@playwright/test";
import fs from "fs";
import path from "path";

function loadEnvFile(envFilePath: string) {
  if (!fs.existsSync(envFilePath)) return;
  const raw = fs.readFileSync(envFilePath, "utf8");
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!key) continue;
    // eslint-disable-next-line no-process-env
    process.env[key] = value;
  }
}

loadEnvFile(path.resolve(__dirname, ".env.test"));

export default defineConfig({
  testDir: "tests",
  outputDir: "test-results",
  snapshotPathTemplate: "{testDir}/snapshots/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.04,
    },
  },
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ?? "https://chambers-valley-tracker.vercel.app",
    // Force a wide desktop viewport so responsive UI exposes job actions.
    viewport: { width: 1400, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], browserName: "chromium" },
    },
  ],
});


import { defineConfig, devices } from "@playwright/test";
import { loadEnvLocal } from "./qa/env";

loadEnvLocal();

/**
 * E2E runs against QA_BASE_URL when set (a Vercel preview deploy pointed at
 * the staging Supabase project), otherwise starts `next dev` locally, which
 * needs a filled-in .env.local. Never point this at production: the persona
 * specs sign in as seeded QA users and click real buttons.
 *
 * Phones first — nearly every friend opens That Friend from a text, so the
 * mobile projects are the ones that matter; desktop is the sanity check.
 */
const baseURL = process.env.QA_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "qa/reports/playwright" }]],
  outputDir: "qa/reports/test-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    // Vercel preview deploys sit behind Deployment Protection.
    extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET, "x-vercel-set-bypass-cookie": "true" }
      : undefined,
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "android", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.QA_BASE_URL
    ? undefined
    : { command: "npm run dev", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});

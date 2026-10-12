import { defineConfig, devices } from "@playwright/test";

// The specs share one database and build on each other's state (the tutor
// posts availability, then the student books it, and so on), so they run in
// file order on a single worker. Start the stack first with
// `scripts/start-stack.sh`; see README.md.
// Run the browsers and the test code in the tutor's own time zone, so date
// handling is checked the way families actually see it.
process.env.TZ ??= "America/New_York";

export default defineConfig({
  testDir: "./specs",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: "./lib/global-setup.ts",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["./lib/findings-reporter.ts", { outputFile: "reports/findings.md" }],
  ],
  use: {
    baseURL: process.env.E2E_WEB_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1280, height: 900 },
    timezoneId: process.env.TZ,
    ...(process.env.CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } } : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } }],
});

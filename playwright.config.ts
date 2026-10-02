import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    // Chromium-based phone profile keeps CI to one browser download; portrait by default.
    { name: "mobile-portrait", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // A placeholder key turns analytics on in the E2E build. Nothing listens on
    // this host: analytics.spec.ts intercepts it; other specs' requests just fail.
    env: {
      NEXT_PUBLIC_POSTHOG_KEY: "phc_e2e_placeholder",
      NEXT_PUBLIC_POSTHOG_HOST: "http://127.0.0.1:3999",
    },
  },
});

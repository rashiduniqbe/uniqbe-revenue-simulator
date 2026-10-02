import { defineConfig, devices } from "@playwright/test";
import { LOCAL_PORT, resolveE2ETarget } from "./e2e/target";

const target = resolveE2ETarget(process.env);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL: target.baseURL,
    extraHTTPHeaders: target.extraHTTPHeaders,
    trace: target.trace,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    // Chromium-based phone profile keeps CI to one browser download; portrait by default.
    { name: "mobile-portrait", use: { ...devices["Pixel 5"] } },
  ],
  webServer: target.startLocalServer
    ? {
        command: `pnpm build && pnpm start -p ${LOCAL_PORT}`,
        url: `http://localhost:${LOCAL_PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        // A placeholder key turns analytics on in the E2E build. Nothing listens on
        // this host: analytics.spec.ts intercepts it; other specs' requests just fail.
        env: {
          NEXT_PUBLIC_POSTHOG_KEY: "phc_e2e_placeholder",
          NEXT_PUBLIC_POSTHOG_HOST: "http://127.0.0.1:3999",
        },
      }
    : undefined,
});

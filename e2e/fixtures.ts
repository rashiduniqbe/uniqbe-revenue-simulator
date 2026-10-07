import { expect, test as base } from "@playwright/test";
import { headersForRequest, resolveE2ETarget } from "./target";

const target = resolveE2ETarget(process.env);

// Deployment runs: add the Vercel bypass/toolbar headers to requests for the
// target origin only. Playwright's global extraHTTPHeaders would send the
// bypass secret to every host the page contacts.
export const test = base.extend<{ targetHeaders: void }>({
  targetHeaders: [
    async ({ context }, use) => {
      if (!target.startLocalServer) {
        await context.route("**/*", async (route) => {
          const request = route.request();
          const extra = headersForRequest(request.url(), target);
          if (Object.keys(extra).length === 0) {
            await route.continue();
            return;
          }
          await route.continue({ headers: { ...request.headers(), ...extra } });
        });
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect };

import type { Route } from "@playwright/test";
import { describe, expect, it } from "vitest";
import { routeWithTargetHeaders } from "../../e2e/route-headers";
import { resolveE2ETarget } from "../../e2e/target";

const ORIGIN = "https://preview.example.test";
const target = resolveE2ETarget({
  PLAYWRIGHT_BASE_URL: ORIGIN,
  VERCEL_AUTOMATION_BYPASS_SECRET: "s3cret",
});

// Only the parts of Route the helper touches: request, fetch, fulfill.
function fakeRoute(opts: { fetchError?: Error; fulfillError?: Error }): Route {
  return {
    request: () => ({ url: () => `${ORIGIN}/`, headers: () => ({}) }),
    fetch: async () => {
      if (opts.fetchError) throw opts.fetchError;
      return {};
    },
    fulfill: async () => {
      if (opts.fulfillError) throw opts.fulfillError;
    },
  } as unknown as Route;
}

// The browser cancels in-flight requests on navigation and teardown, so the
// route is gone by the time the response arrives. That is not a test failure.
describe("routeWithTargetHeaders when the browser has already given up on the request", () => {
  it.each([
    "route.fulfill: Route is already handled!",
    "route.fulfill: Fetch response has been disposed",
    "route.fetch: Test ended.",
    "route.fetch: Target page, context or browser has been closed",
  ])("resolves quietly on %s", async (message) => {
    await expect(
      routeWithTargetHeaders(fakeRoute({ fulfillError: new Error(message) }), target),
    ).resolves.toBeUndefined();
    await expect(
      routeWithTargetHeaders(fakeRoute({ fetchError: new Error(message) }), target),
    ).resolves.toBeUndefined();
  });

  it("still rejects on a genuine network failure", async () => {
    await expect(
      routeWithTargetHeaders(
        fakeRoute({ fetchError: new Error("route.fetch: getaddrinfo ENOTFOUND preview") }),
        target,
      ),
    ).rejects.toThrow("ENOTFOUND");
  });
});

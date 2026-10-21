import type { Route } from "@playwright/test";
import { headersForRequest, type E2ETarget } from "./target";

// Adds the target headers to one routed request when it is for the target origin.
// route.continue({ headers }) would re-send them on every redirect hop, including
// one to another origin. So fetch without following redirects and hand the
// response back: the browser follows any redirect as a new routed request,
// which headersForRequest classifies afresh.
export async function routeWithTargetHeaders(route: Route, target: E2ETarget): Promise<void> {
  const request = route.request();
  const extra = headersForRequest(request.url(), target);
  if (Object.keys(extra).length === 0) {
    await route.continue();
    return;
  }
  try {
    const response = await route.fetch({
      headers: { ...request.headers(), ...extra },
      maxRedirects: 0,
    });
    await route.fulfill({ response });
  } catch (error) {
    if (isRouteGone(error)) return;
    throw error;
  }
}

// The browser cancels in-flight requests on navigation and at teardown, so the
// route can be gone before the target answers. Only that is ignored: a real
// network failure still surfaces.
const ROUTE_GONE = /already handled|has been disposed|Test ended|has been closed/i;

function isRouteGone(error: unknown): boolean {
  return error instanceof Error && ROUTE_GONE.test(error.message);
}

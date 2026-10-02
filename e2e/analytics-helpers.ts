import type { Page } from "@playwright/test";

export const E2E_INGEST_HOST = "http://127.0.0.1:3999";

// Records every request the page sends to the analytics host (URL + body).
// posthog-js drops events from automated browsers (navigator.webdriver is
// true under Playwright), so this page is made to look non-automated. Test
// only: production keeps PostHog's bot filter so bots never count as partners.
export async function captureAnalytics(page: Page): Promise<string[]> {
  const requests: string[] = [];
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    // Headless Chromium also reports a "HeadlessChrome" UA-CH brand.
    Object.defineProperty(navigator, "userAgentData", { get: () => undefined });
  });
  await page.route(`${E2E_INGEST_HOST}/**`, async (route) => {
    const request = route.request();
    requests.push(`${request.url()}\n${request.postData() ?? ""}`);
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  return requests;
}

export function countOccurrences(requests: string[], needle: string): number {
  return requests.join("\n").split(needle).length - 1;
}

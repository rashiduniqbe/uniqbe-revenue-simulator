import { expect, test } from "@playwright/test";
import { captureAnalytics } from "./analytics-helpers";
import { firstCatalogueItem } from "./helpers";

const FLUSH_TIMEOUT_MS = 15_000;

test("simulator_viewed is sent, with no pageview and no price anywhere", async ({ page }) => {
  const requests = await captureAnalytics(page);
  const item = firstCatalogueItem();
  await page.goto(`/?p=${item.code}&sp=9999.00`);
  await expect
    .poll(() => requests.join("\n"), { timeout: FLUSH_TIMEOUT_MS })
    .toContain("simulator_viewed");
  const all = requests.join("\n");
  // The payload is readable (disable_compression), so these negatives mean something.
  expect(all).not.toContain("9999");
  expect(all).not.toContain("sp=");
  expect(all).not.toContain("$pageview");
});

import { expect, test } from "@playwright/test";
import { captureAnalytics, countOccurrences } from "./analytics-helpers";
import { firstCatalogueItem, pickFirstProduct } from "./helpers";

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

test("typing a price sends exactly one calculation_run, with a band and no price", async ({
  page,
}) => {
  const requests = await captureAnalytics(page);
  await page.goto("/");
  await pickFirstProduct(page);
  await page
    .getByRole("textbox", { name: "Selling price" })
    .pressSequentially("9999.00", { delay: 60 });
  await expect(page.getByText(/PROFITABLE|MARGINAL|LOSS-MAKING/)).toBeVisible();
  await expect
    .poll(() => requests.join("\n"), { timeout: FLUSH_TIMEOUT_MS })
    .toContain("calculation_run");
  // Give any stray keystroke-level events time to arrive before counting.
  await page.waitForTimeout(4_000);
  const all = requests.join("\n");
  expect(countOccurrences(requests, "calculation_run")).toBe(1);
  expect(all).toContain("product_selected");
  expect(all).toContain("marginBand");
  expect(all).not.toContain("9999");
  expect(all).not.toContain("netProfit");
  expect(all).not.toContain("marginPct");
});

test("Suggest sends price_suggested with a banded target", async ({ page }) => {
  const requests = await captureAnalytics(page);
  await page.goto("/");
  await pickFirstProduct(page);
  await page.getByRole("button", { name: "Suggest" }).click();
  await expect
    .poll(() => requests.join("\n"), { timeout: FLUSH_TIMEOUT_MS })
    .toContain("price_suggested");
  expect(requests.join("\n")).toContain("20-30");
});

test("/compare sends comparison_viewed and no price", async ({ page }) => {
  const requests = await captureAnalytics(page);
  const item = firstCatalogueItem();
  await page.goto(`/compare?p=${item.code}&sp_uk=9999.00&sp_au=19999.00`);
  await expect
    .poll(() => requests.join("\n"), { timeout: FLUSH_TIMEOUT_MS })
    .toContain("comparison_viewed");
  const all = requests.join("\n");
  expect(all).toContain(item.code);
  expect(all).not.toContain("9999");
});

test("Copy link copies the scenario URL and sends scenario_shared", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const requests = await captureAnalytics(page);
  await page.goto("/");
  const item = await pickFirstProduct(page);
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByText("Link copied")).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain(`p=${item.code}`);
  await expect
    .poll(() => requests.join("\n"), { timeout: FLUSH_TIMEOUT_MS })
    .toContain("scenario_shared");
});

import { expect, test } from "./fixtures";
import { VERDICT } from "./a11y-helpers";
import { firstCatalogueItem } from "./helpers";

// The inputs column is taller than verdict + results; a spanning grid item must not stretch the
// verdict row and open a blank band under the card.
const MAX_VERDICT_TO_RESULTS_GAP_PX = 32;

test("no verdict slot until there is a result", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Select a product and enter a selling price")).toBeVisible();
  await expect(page.getByTestId("verdict-slot")).toHaveCount(0);
});

test("mobile: verdict card stays pinned to the top while the inputs scroll", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-portrait", "mobile-only check");
  const item = firstCatalogueItem();
  await page.goto(`/?p=${item.code}&sp=9999.00`);
  const slot = page.getByTestId("verdict-slot");
  await expect(slot.getByText(VERDICT)).toBeVisible();

  await page.evaluate(() => window.scrollBy(0, 400));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  const box = await slot.boundingBox();
  expect(box, "verdict slot has a box").not.toBeNull();
  expect(Math.abs(box!.y)).toBeLessThanOrEqual(1);
  await expect(slot.getByText(VERDICT)).toBeInViewport({ ratio: 1 });
});

test("desktop: verdict sits in the right column and is not sticky", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop-only check");
  const item = firstCatalogueItem();
  await page.goto(`/?p=${item.code}&sp=9999.00`);
  const slot = page.getByTestId("verdict-slot");
  await expect(slot.getByText(VERDICT)).toBeVisible();

  expect(await slot.evaluate((el) => getComputedStyle(el).position)).toBe("static");
  const slotBox = await slot.boundingBox();
  const inputBox = await page.getByRole("textbox", { name: "Selling price" }).boundingBox();
  expect(slotBox!.x).toBeGreaterThan(inputBox!.x + inputBox!.width);

  // The verdict is the first thing in the right column: above the waterfall and the
  // breakdown table, and left-aligned with them.
  const waterfallBox = await page.getByRole("img", { name: /Cost waterfall/ }).boundingBox();
  const tableBox = await page.getByRole("table").boundingBox();
  expect(slotBox!.y).toBeLessThan(waterfallBox!.y);
  expect(slotBox!.y).toBeLessThan(tableBox!.y);
  expect(Math.abs(slotBox!.x - waterfallBox!.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(slotBox!.x - tableBox!.x)).toBeLessThanOrEqual(2);

  // Measured from the card itself, not the slot wrapper (a stretched wrapper would hide the gap),
  // to the top of the results section (warnings are state-dependent, so the waterfall is not used).
  const cardBox = await slot.locator(":scope > *").first().boundingBox();
  const resultsBox = await page.locator("main > section").nth(1).boundingBox();
  expect(resultsBox!.y - (cardBox!.y + cardBox!.height)).toBeLessThanOrEqual(
    MAX_VERDICT_TO_RESULTS_GAP_PX,
  );
});

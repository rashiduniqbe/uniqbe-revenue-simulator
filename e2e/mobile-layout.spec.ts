import { expect, test } from "./fixtures";
import { VERDICT } from "./a11y-helpers";
import { firstCatalogueItem } from "./helpers";

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

test("desktop: verdict sits above the calculator card and is not sticky", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop-only check");
  const item = firstCatalogueItem();
  await page.goto(`/?p=${item.code}&sp=9999.00`);
  const slot = page.getByTestId("verdict-slot");
  await expect(slot.getByText(VERDICT)).toBeVisible();

  expect(await slot.evaluate((el) => getComputedStyle(el).position)).toBe("static");
  const slotBox = await slot.boundingBox();
  const inputBox = await page.getByRole("textbox", { name: "Selling price" }).boundingBox();
  expect(slotBox!.y).toBeLessThan(inputBox!.y);

  // The verdict is the first thing in the single column: above the waterfall and the
  // breakdown table, and left-aligned with them.
  const waterfallBox = await page.getByRole("img", { name: /Cost waterfall/ }).boundingBox();
  const tableBox = await page.getByRole("table").boundingBox();
  expect(slotBox!.y).toBeLessThan(waterfallBox!.y);
  expect(slotBox!.y).toBeLessThan(tableBox!.y);
  expect(Math.abs(slotBox!.x - waterfallBox!.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(slotBox!.x - tableBox!.x)).toBeLessThanOrEqual(2);
});

test("card grid has no horizontal scroll at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const item = firstCatalogueItem();
  await page.goto(`/?p=${item.code}&sp=9999.00`);
  await expect(page.getByTestId("calculator-card")).toBeVisible();
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth };
  });
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
});

test("inputs live inside the calculator card", async ({ page }) => {
  await page.goto("/");
  const card = page.getByTestId("calculator-card");
  await expect(card.locator("#selling-price")).toHaveCount(1);
  await expect(card.locator("#platform")).toHaveCount(1);
});

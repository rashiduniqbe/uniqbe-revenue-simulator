import { expect, test } from "./fixtures";
import { firstCatalogueItem } from "./helpers";

const VERDICT = /PROFITABLE|MARGINAL|LOSS-MAKING/;

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
});

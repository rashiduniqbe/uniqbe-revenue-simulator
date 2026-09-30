import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { firstCatalogueItem, pickFirstProduct } from "./helpers";

const VERDICT = /PROFITABLE|MARGINAL|LOSS-MAKING/;
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectNoViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}

async function tabUntil(
  page: Page,
  predicate: string,
  key = "Tab",
  maxPresses = 40,
): Promise<void> {
  for (let i = 0; i < maxPresses; i++) {
    await page.keyboard.press(key);
    if (await page.evaluate(predicate)) return;
  }
  throw new Error(`focus never reached: ${predicate}`);
}

test("axe: / with a UK result on screen", async ({ page }) => {
  await page.goto("/");
  await pickFirstProduct(page);
  await page.getByRole("textbox", { name: "Selling price" }).fill("9999.00");
  await expect(page.getByText(VERDICT)).toBeVisible();
  await expectNoViolations(page);
});

test("axe: AU market with the threshold banner", async ({ page }) => {
  const item = firstCatalogueItem();
  await page.goto(`/?m=AU&p=${item.code}&sp=19999.00`);
  await expect(page.getByText(VERDICT)).toBeVisible();
  await expect(page.getByRole("status")).toBeVisible();
  await expectNoViolations(page);
});

test("axe: /compare", async ({ page }) => {
  const item = firstCatalogueItem();
  await page.goto(`/compare?p=${item.code}&sp_uk=9999.00&sp_au=19999.00`);
  await expect(page.getByRole("region", { name: "UK" }).getByText(VERDICT)).toBeVisible();
  await expect(page.getByRole("region", { name: "Australia" }).getByText(VERDICT)).toBeVisible();
  await expectNoViolations(page);
});

test("keyboard only: pick -> price -> verdict -> switch market", async ({ page }) => {
  const item = firstCatalogueItem();
  await page.goto("/");
  await tabUntil(page, `document.activeElement?.id === "product-search"`);
  await page.keyboard.type(item.name);
  await tabUntil(
    page,
    `document.activeElement?.textContent?.includes(${JSON.stringify(item.name)}) ?? false`,
  );
  await page.keyboard.press("Enter");
  await tabUntil(page, `document.activeElement?.id === "selling-price"`);
  await page.keyboard.type("9999.00");
  await expect(page.getByText(VERDICT)).toBeVisible();
  // Market tabs sit before the picker in DOM order, so walk focus backwards to reach them.
  await tabUntil(
    page,
    `document.activeElement?.getAttribute("role") === "tab" && (document.activeElement?.textContent?.includes("Australia") ?? false)`,
    "Shift+Tab",
  );
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/m=AU/);
});

test("no horizontal scroll on / and /compare", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-portrait", "mobile-only check");
  for (const path of ["/", "/compare"]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(0);
  }
});

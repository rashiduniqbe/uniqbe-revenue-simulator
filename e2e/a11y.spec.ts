import { expect, test } from "./fixtures";
import { VERDICT, expectNoViolations, tabUntil } from "./a11y-helpers";
import { firstCatalogueItem, pickFirstProduct } from "./helpers";

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

const MIN_TARGET_PX = 44;

const TARGET_SCREENS = [
  { name: "UK", query: "" },
  { name: "AU eBay", query: "m=AU&pl=ebay" },
  { name: "AU Shopify", query: "m=AU&pl=shopify" },
];

for (const screen of TARGET_SCREENS) {
  test(`mobile: every control is at least 44px tall (${screen.name})`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-portrait", "mobile-only check");
    const item = firstCatalogueItem();
    await page.goto(`/?${screen.query}&p=${item.code}&sp=9999.00`);
    await expect(page.getByText(VERDICT)).toBeVisible();
    const small = await page.evaluate((min) => {
      const controls = document.querySelectorAll("button, a[href], select, input");
      return [...controls].flatMap((el) => {
        // A checkbox's hit area is its wrapping label, not the 13px box.
        const target =
          el instanceof HTMLInputElement && el.type === "checkbox" ? el.closest("label") : el;
        const rect = target?.getBoundingClientRect();
        if (!rect || rect.width === 0 || rect.height === 0) return [];
        const name = (target?.textContent ?? "").trim().slice(0, 30) || el.id;
        return rect.height < min ? [`${name}: ${Math.round(rect.height)}px`] : [];
      });
    }, MIN_TARGET_PX);
    expect(small).toEqual([]);
  });
}

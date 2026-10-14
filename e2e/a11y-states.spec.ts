import { expect, test } from "./fixtures";
import { VERDICT, expectNoViolations, reachMarginalVerdict } from "./a11y-helpers";
import { firstCatalogueItem, pickFirstProduct } from "./helpers";

const REFLOW_WIDTH = 320;
const REFLOW_HEIGHT = 568;

const STATES = [
  { name: "loss-making verdict", query: "sp=0.01" },
  { name: "UK VAT-registered", query: "reg=true&sp=9999.00" },
  { name: "AU eBay free-tier toggle", query: "m=AU&pl=ebay&et=true&sp=9999.00" },
  {
    name: "AU Shopify with ABN and ad spend",
    query: "m=AU&pl=shopify&abn=true&ad=5.00&sp=9999.00",
  },
];

for (const state of STATES) {
  test(`axe: ${state.name}`, async ({ page }) => {
    const item = firstCatalogueItem();
    await page.goto(`/?p=${item.code}&${state.query}`);
    await expect(page.getByText(VERDICT)).toBeVisible();
    await expectNoViolations(page);
  });
}

test("axe: marginal verdict", async ({ page }) => {
  await page.goto("/");
  await pickFirstProduct(page);
  await page.getByRole("textbox", { name: "Selling price" }).fill("9999.00");
  await reachMarginalVerdict(page);
  await expectNoViolations(page);
});

test("axe: product search open with results and with none", async ({ page }) => {
  const item = firstCatalogueItem();
  const search = page.locator("#product-search");
  await page.goto("/");
  await search.fill(item.name);
  await expect(
    page.getByRole("button", { name: `${item.brand} ${item.name}` }).first(),
  ).toBeVisible();
  await expectNoViolations(page);
  await search.fill("zzzzqqqq");
  // The sr-only status <p> also says "No products match"; scope to the visible list item.
  await expect(page.getByRole("listitem").filter({ hasText: /No products match/ })).toBeVisible();
  await expectNoViolations(page);
});

test("mobile: reflows at 320px with no horizontal scroll", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-portrait", "mobile-only check");
  await page.setViewportSize({ width: REFLOW_WIDTH, height: REFLOW_HEIGHT });
  const item = firstCatalogueItem();
  const urls = [
    `/?p=${item.code}&sp=9999.00`,
    `/?m=AU&pl=shopify&p=${item.code}&sp=9999.00`,
    `/compare?p=${item.code}&sp_uk=9999.00&sp_au=19999.00`,
  ];
  for (const url of urls) {
    await page.goto(url);
    await expect(page.getByText(VERDICT).first()).toBeVisible();
    const report = await page.evaluate((viewportWidth) => {
      const offenders = [...document.querySelectorAll("body *")]
        .map((el) => ({ el, right: el.getBoundingClientRect().right }))
        .filter(({ right }) => right > viewportWidth + 1)
        .sort((a, b) => b.right - a.right);
      const first = offenders[0];
      return {
        overflow: document.documentElement.scrollWidth - viewportWidth,
        offender: first ? `${first.el.tagName.toLowerCase()}.${first.el.className}` : null,
      };
    }, REFLOW_WIDTH);
    expect(report.offender, `${url}: widest element past the right edge`).toBeNull();
    expect(report.overflow, `${url} overflows horizontally`).toBeLessThanOrEqual(0);
  }
});

test("prefers-reduced-motion removes the waterfall transition", async ({ page }) => {
  const item = firstCatalogueItem();
  const transitionSeconds = async (): Promise<number> => {
    await page.goto(`/?p=${item.code}&sp=9999.00`);
    const segment = page
      .getByRole("img", { name: /Cost waterfall/ })
      .locator("div")
      .first();
    return segment.evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration));
  };

  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect(await transitionSeconds(), "motion is on by default").toBeGreaterThan(0.05);

  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await transitionSeconds()).toBeLessThan(0.001);
});

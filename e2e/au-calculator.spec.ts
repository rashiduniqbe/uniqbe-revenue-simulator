import { expect, test } from "./fixtures";

// Runs against live storeprice.uniqbe.com prices, so it never names a SKU or
// asserts a count (the list changes weekly) — it picks whatever matches first.
const currencyButton = (page: import("@playwright/test").Page, code: string) =>
  page.getByRole("group", { name: "Currency for all prices" }).getByRole("button", {
    name: code,
    exact: true,
  });

test("AU calculator: USD by default, every field and result follows the currency", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("proto-fx-badge")).toContainText(/1 USD = .* AUD/);
  await expect(page.getByRole("note")).toContainText("not by this tool");

  await page.getByLabel("Product").fill("iphone");
  await page.getByRole("button", { name: /US\$/ }).first().click();
  await expect(page.getByTestId("proto-selected-product")).toBeVisible();

  await page.getByLabel("Selling price (USD, incl. GST)").fill("1800");
  const profit = page.getByTestId("proto-tile-profit");
  await expect(profit).toHaveText(/^−?US\$[\d,]+\.\d{2}$/);
  await expect(page.getByRole("status")).toContainText(/^(Over|Under) A\$/);

  await currencyButton(page, "AUD").click();
  await expect(page.getByLabel("Selling price (AUD, incl. GST)")).not.toHaveValue("1800");
  await expect(profit).toHaveText(/^−?A\$[\d,]+\.\d{2}$/);

  const hkd = currencyButton(page, "HKD");
  if (await hkd.isEnabled()) {
    await hkd.click();
    await expect(profit).toHaveText(/^−?HK\$[\d,]+\.\d{2}$/);
  }

  await currencyButton(page, "USD").click();
  await expect(page.getByLabel("Selling price (USD, incl. GST)")).toHaveValue("1800.00");
});

test("AU calculator: custom price and declared value change the result", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Product").fill("iphone");
  await page.getByRole("button", { name: /US\$/ }).first().click();
  await page.getByLabel("Selling price (USD, incl. GST)").fill("1800");

  const goodsCost = page.getByTestId("proto-row-Goods cost");
  await page.getByLabel("Custom product price (USD)").fill("1000");
  await expect(goodsCost).toContainText("−US$1,000.00");

  // A declared value well under A$1,000 means no import GST, and since it is
  // below the product price the under-declaration warning shows.
  await page.getByLabel("Customs declared value (USD)").fill("100");
  await expect(page.getByRole("status")).toContainText(/^Under A\$/);
  await expect(page.getByTestId("proto-row-Import GST")).toContainText("US$0.00");
  await expect(page.getByTestId("proto-underdeclared-warning")).toContainText("illegal");

  await page.getByLabel("Customs declared value (USD)").fill("1000");
  await expect(page.getByTestId("proto-underdeclared-warning")).toHaveCount(0);
});

test("AU calculator: the market stays AU whatever the URL says", async ({ page }) => {
  await page.goto("/?m=UK");
  await page.getByLabel("Product").fill("iphone");
  await page.getByRole("button", { name: /US\$/ }).first().click();
  await expect(page).toHaveURL(/m=AU/);
});

test("AU calculator: the old /prototype/au link redirects to / with its scenario", async ({
  page,
}) => {
  await page.goto("/prototype/au?sp=123&cur=AUD");
  await expect(page).toHaveURL(/\/\?.*sp=123/);
  await expect(page.getByLabel("Selling price (AUD, incl. GST)")).toHaveValue("123");
});

test("AU calculator: HKD uses the fixed 7.845 rate", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("proto-fx-badge")).toContainText("7.8450 HKD (fixed)");
});

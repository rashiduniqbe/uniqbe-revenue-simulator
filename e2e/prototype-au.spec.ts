import { expect, test } from "./fixtures";

// Runs against live storeprice.uniqbe.com prices, so it never names a SKU or
// asserts a count (the list changes weekly) — it picks whatever matches first.
test("AU prototype: pick product -> price -> toggle AUD/USD/HKD", async ({ page }) => {
  await page.goto("/prototype/au");
  await expect(page.getByTestId("proto-fx-badge")).toContainText(/1 USD = .* AUD/);
  await expect(page.getByRole("note")).toContainText("not by this tool");

  await page.getByLabel("Product").fill("iphone");
  await page.getByRole("button", { name: /US\$/ }).first().click();
  await expect(page.getByTestId("proto-selected-product")).toBeVisible();

  await page.getByLabel(/Selling price/).fill("2499");
  const profit = page.getByTestId("proto-tile-profit");
  await expect(profit).toHaveText(/^−?A\$[\d,]+\.\d{2}$/);
  await expect(page.getByRole("status")).toContainText(/^(Over|Under) A\$/);

  await page.getByRole("button", { name: "USD", exact: true }).click();
  await expect(profit).toHaveText(/^−?US\$[\d,]+\.\d{2}$/);

  const hkd = page.getByRole("button", { name: "HKD", exact: true });
  if (await hkd.isEnabled()) {
    await hkd.click();
    await expect(profit).toHaveText(/^−?HK\$[\d,]+\.\d{2}$/);
  }

  await page.getByRole("button", { name: "AUD", exact: true }).click();
  await expect(profit).toHaveText(/^−?A\$/);
});

test("AU prototype: the market stays AU whatever the URL says", async ({ page }) => {
  await page.goto("/prototype/au?m=UK");
  await page.getByLabel("Product").fill("iphone");
  await page.getByRole("button", { name: /US\$/ }).first().click();
  await expect(page).toHaveURL(/m=AU/);
});

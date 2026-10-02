import { expect, test } from "@playwright/test";
import { expectFxAndDisclaimer, firstCatalogueItem } from "./helpers";
import { AGAINST_DEPLOYMENT } from "./target";

test("/compare renders both markets from one product", async ({ page }) => {
  const item = firstCatalogueItem();
  await page.goto(`/compare?p=${item.code}&sp_uk=9999.00&sp_au=19999.00`);
  await expect(page.getByTestId("compare-caveat")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "UK" }).getByText(/PROFITABLE|MARGINAL|LOSS-MAKING/),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Australia" }).getByRole("status")).toBeVisible();
  await expect(page.getByTestId("fx-badge")).toHaveCount(2);
  await expectFxAndDisclaimer(page);
});

test("/compare with an unknown product code shows the empty state, not a crash", async ({
  page,
}) => {
  await page.goto("/compare?p=DOES-NOT-EXIST&sp_uk=abc");
  await expect(page.getByText("Select a product to compare both markets.")).toBeVisible();
  await expectFxAndDisclaimer(page);
});

test("Back to simulator from /compare lands on a working simulator", async ({ page }) => {
  const item = firstCatalogueItem();
  await page.goto(`/compare?p=${item.code}`);
  await page.getByRole("link", { name: "Back to simulator" }).click();
  await expect(page).toHaveURL(new RegExp(`p=${item.code}`));
  // The page is server-rendered; retry the fill until React has hydrated and taken the input.
  await expect(async () => {
    await page.getByRole("textbox", { name: "Selling price" }).fill("9999.00");
    await expect(page.getByText(/PROFITABLE|MARGINAL|LOSS-MAKING/)).toBeVisible({ timeout: 1000 });
  }).toPass();
});

test("no Redis in CI: /compare shows the degraded FX warning", async ({ page }) => {
  test.skip(
    !process.env.CI || AGAINST_DEPLOYMENT,
    "needs the no-Redis local CI build; locally .env.local or a deployment has real Redis",
  );
  const item = firstCatalogueItem();
  await page.goto(`/compare?p=${item.code}&sp_uk=9999.00&sp_au=19999.00`);
  await expect(
    page
      .getByRole("region", { name: "UK" })
      .getByText("This exchange rate is more than a few days old."),
  ).toBeVisible();
});

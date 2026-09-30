import { expect, test } from "@playwright/test";
import { expectFxAndDisclaimer, firstCatalogueItem } from "./helpers";

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

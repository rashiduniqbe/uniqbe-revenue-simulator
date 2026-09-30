import { expect, test } from "@playwright/test";
import { expectFxAndDisclaimer, pickFirstProduct } from "./helpers";

const VERDICT = /PROFITABLE|MARGINAL|LOSS-MAKING/;

test("UK: pick product -> enter price -> see verdict", async ({ page }) => {
  await page.goto("/");
  await expectFxAndDisclaimer(page);
  await pickFirstProduct(page);
  await page.getByLabel("Selling price").fill("9999.00");
  await expect(page.getByText(VERDICT)).toBeVisible();
  await expect(page.getByText("This is an estimate, not tax advice.")).toBeVisible();
});

test("AU: switch market -> threshold banner -> eBay free-tier toggle", async ({ page }) => {
  await page.goto("/");
  await pickFirstProduct(page);
  await page.getByRole("tab", { name: /Australia/ }).click();
  await expect(page).toHaveURL(/m=AU/);
  await page.getByLabel("Selling price").fill("9999.00");
  await expect(page.getByRole("status")).toContainText(/^(Over|Under) A\$/);
  await page.getByLabel("Platform").selectOption("ebay");
  await expect(page.getByLabel(/eBay free tier/)).toBeVisible();
  await expectFxAndDisclaimer(page);
});

test("URL state: reload restores the scenario and back works", async ({ page }) => {
  await page.goto("/");
  const item = await pickFirstProduct(page);
  await page.getByLabel("Selling price").fill("9999.00");
  await expect(page).toHaveURL(new RegExp(`p=${item.code}`));
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Selling price" })).toHaveValue("9999.00");
  await expect(page.getByText(VERDICT)).toBeVisible();
  await page.goBack();
  await expect(page).not.toHaveURL(/sp=9999\.00/);
});

test("no Redis in CI: seed rates render with the degraded warning", async ({ page }) => {
  test.skip(!process.env.CI, "local runs may have real Redis credentials in .env.local");
  await page.goto("/");
  await pickFirstProduct(page);
  await page.getByLabel("Selling price").fill("9999.00");
  await expect(page.getByText("This exchange rate is more than a few days old.")).toBeVisible();
});

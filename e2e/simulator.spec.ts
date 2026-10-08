import { expect, test } from "./fixtures";
import { expectFxAndDisclaimer, pickFirstProduct } from "./helpers";
import { isAgainstDeployment } from "./target";

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
  // p= is already in the URL from picking the product; wait for the price too,
  // or a slow run reloads before nuqs has written sp= and the price is lost.
  await expect(page).toHaveURL(/sp=9999\.00/);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Selling price" })).toHaveValue("9999.00");
  await expect(page.getByText(VERDICT)).toBeVisible();
  await page.goBack();
  await expect(page).not.toHaveURL(/sp=9999\.00/);
});

test("no Redis in CI: seed rates render with the degraded warning", async ({ page }) => {
  test.skip(
    !process.env.CI || isAgainstDeployment(),
    "needs the no-Redis local CI build; locally .env.local or a deployment has real Redis",
  );
  await page.goto("/");
  await pickFirstProduct(page);
  await page.getByLabel("Selling price").fill("9999.00");
  await expect(page.getByText("This exchange rate is more than a few days old.")).toBeVisible();
});

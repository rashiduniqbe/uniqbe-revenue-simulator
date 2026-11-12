import { expect, test } from "./fixtures";
import { expectFxAndDisclaimer, pickFirstProduct } from "./helpers";
import { isAgainstDeployment } from "./target";

const VERDICT = /PROFITABLE|MARGINAL|LOSS-MAKING/;

test("UK: pick product -> enter price -> see verdict", async ({ page }) => {
  await page.goto("/uk");
  await expectFxAndDisclaimer(page);
  await pickFirstProduct(page);
  await page.getByLabel("Selling price").fill("9999.00");
  await expect(page.getByText(VERDICT)).toBeVisible();
  await expect(page.getByText("This is an estimate, not tax advice.")).toBeVisible();
});

test("AU: switch market -> threshold banner -> eBay free-tier toggle", async ({ page }) => {
  await page.goto("/uk");
  await pickFirstProduct(page);
  await page.getByRole("button", { name: /Australia/ }).click();
  await expect(page).toHaveURL(/m=AU/);
  await page.getByLabel("Selling price").fill("9999.00");
  await expect(page.getByRole("status")).toContainText(/^(Over|Under) A\$/);
  await page.getByLabel("Platform").selectOption("ebay");
  await expect(page.getByLabel(/eBay free tier/)).toBeVisible();
  await expectFxAndDisclaimer(page);
});

test("URL state: reload restores the scenario and back works", async ({ page }) => {
  await page.goto("/uk");
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
  await page.goto("/uk");
  await pickFirstProduct(page);
  await page.getByLabel("Selling price").fill("9999.00");
  await expect(page.getByText("This exchange rate is more than a few days old.")).toBeVisible();
});

test("header shows title, market tabs, compare link and price-list date", async ({ page }) => {
  await page.goto("/uk");
  await expect(
    page.getByRole("heading", { level: 1, name: "Uniqbe Price Simulator" }),
  ).toBeVisible();
  // MarketTabs is a labelled button group (aria-pressed), which existing a11y specs rely on.
  await expect(page.getByRole("group", { name: "Market" })).toBeVisible();
  await expect(page.locator('a[href^="/compare"]').first()).toBeVisible();
  await expect(page.getByText(/Up-to-date as of/)).toBeVisible();
});

test("empty price shows dashes not NaN", async ({ page }) => {
  await page.goto("/uk");
  await pickFirstProduct(page);
  const block = page.getByTestId("result-block");
  await expect(block).toContainText("—");
  await expect(block.getByRole("button", { name: "Reset calculator" })).toBeEnabled();
  expect(await page.locator("body").innerText()).not.toMatch(/NaN|Infinity/);
});

test("reset clears inputs and keeps market", async ({ page }) => {
  await page.goto("/uk");
  await pickFirstProduct(page);
  await page.getByRole("button", { name: /Australia/ }).click();
  await expect(page).toHaveURL(/m=AU/);
  await page.locator("#selling-price").fill("9999.00");
  await expect(page.getByText(VERDICT)).toBeVisible();
  await page.getByRole("button", { name: "Reset calculator" }).click();
  await expect(page.locator("#selling-price")).toHaveValue("");
  await expect(page.getByRole("button", { name: /Australia/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("result-block")).toContainText("In AUD.");
});

test("loss-making result shows negative profit with verdict text", async ({ page }) => {
  await page.goto("/uk");
  await pickFirstProduct(page);
  await page.locator("#selling-price").fill("0.01");
  const block = page.getByTestId("result-block");
  await expect(block.getByText("LOSS-MAKING")).toBeVisible();
  await expect(block.getByTestId("net-profit")).toContainText("-");
  expect(await page.locator("body").innerText()).not.toMatch(/NaN|Infinity/);
});

test("card ends with an invoice footnote that supplements the disclaimer bar", async ({ page }) => {
  await page.goto("/uk");
  await pickFirstProduct(page);
  await page.locator("#selling-price").fill("9999.00");
  const card = page.getByTestId("calculator-card");
  const footnote = card.getByText(/^Estimate only\. Final price confirmed on Uniqbe.s invoice\.$/);
  await expect(footnote).toBeVisible();
  // The footnote closes the card: below the Reset button on every viewport.
  const footnoteBox = await footnote.boundingBox();
  const resetBox = await card.getByRole("button", { name: "Reset calculator" }).boundingBox();
  expect(footnoteBox!.y).toBeGreaterThan(resetBox!.y);
  // It adds to the sticky disclaimer, never replaces it.
  await expectFxAndDisclaimer(page);
  await expect(page.getByRole("note")).toHaveCount(1);
});

test("price suggestion and breakdown sit beneath the card", async ({ page }) => {
  await page.goto("/uk");
  await pickFirstProduct(page);
  await page.locator("#selling-price").fill("9999.00");
  await expect(page.getByText(VERDICT).first()).toBeVisible();
  const card = page.getByTestId("calculator-card");
  const suggestion = page.getByLabel("Suggest a price for a target margin");
  const waterfall = page.getByRole("img", { name: /Cost waterfall/ });
  const table = page.getByRole("table");
  await expect(suggestion).toBeVisible();
  for (const locator of [suggestion, waterfall, table]) {
    await expect(card.locator(locator)).toHaveCount(0);
  }
  const cardBox = await card.boundingBox();
  const cardBottom = cardBox!.y + cardBox!.height;
  for (const locator of [suggestion, waterfall, table]) {
    expect((await locator.boundingBox())!.y).toBeGreaterThanOrEqual(cardBottom);
  }
});

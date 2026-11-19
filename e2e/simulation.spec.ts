import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { expectNoViolations } from "./a11y-helpers";

// Runs against live storeprice.uniqbe.com prices, so it never names a SKU or a
// price: it picks rows at run time and compares the simulation with the
// calculator. Cell test ids exist in both the table and the phone card list.

const ROWS_TIMEOUT = 30_000;
const firstCell = (page: Page, platform: string) =>
  page.locator(`[data-testid^="sim-cell-"][data-testid$="-${platform}"]`).first();

// "US$2,186.03" / "−A$12.30" -> 2186.03 / -12.3
function money(text: string): number {
  const negative = text.includes("−") || text.includes("-");
  const value = Number(text.replace(/[^\d.]/g, ""));
  return negative ? -value : value;
}

async function codeOf(cell: Locator): Promise<string> {
  const id = await cell.getAttribute("data-testid");
  const match = id?.match(/^sim-cell-([A-Z]{2}\d{5})-/);
  if (!match?.[1]) throw new Error(`unexpected cell id ${id}`);
  return match[1];
}

async function cellValues(cell: Locator): Promise<{ price: string; profit: string }> {
  return {
    price: (await cell.getByTestId("sim-cell-price").textContent()) ?? "",
    profit: ((await cell.getByTestId("sim-cell-profit").textContent()) ?? "").replace("keeps ", ""),
  };
}

async function openSimulation(page: Page, query = ""): Promise<void> {
  await page.goto(`/${query}`);
  await expect(firstCell(page, "amazon")).toBeVisible({ timeout: ROWS_TIMEOUT });
}

// On a phone the settings are folded behind a "Run settings" disclosure.
async function openRunSettings(page: Page): Promise<void> {
  const disclosure = page.getByRole("button", { name: /Run settings/ });
  if (
    (await disclosure.isVisible()) &&
    (await disclosure.getAttribute("aria-expanded")) === "false"
  ) {
    await disclosure.click();
  }
}

const marginButton = (page: Page, label: string) =>
  page.getByRole("group", { name: "Target net margin" }).getByRole("button", { name: label });

test("simulation: / opens the simulation at a 5% target, with FX badge and disclaimer", async ({
  page,
}) => {
  await openSimulation(page);
  const view = page.getByRole("group", { name: "View" });
  await expect(view.getByRole("button", { name: "Simulation" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await openRunSettings(page);
  await expect(marginButton(page, "5%")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("proto-fx-badge")).toContainText(/1 USD = .* AUD/);
  await expect(page.getByRole("note")).toContainText("not by this tool");
  await expectNoViolations(page);
});

test("simulation: a 10% target raises the price and keeps at least 10% of it", async ({ page }) => {
  await openSimulation(page);
  const cell = firstCell(page, "amazon");
  const code = await codeOf(cell);
  const before = await cellValues(cell);

  await openRunSettings(page);
  await marginButton(page, "10%").click();
  const same = page.getByTestId(`sim-cell-${code}-amazon`);
  await expect(same.getByTestId("sim-cell-price")).not.toHaveText(before.price, {
    timeout: ROWS_TIMEOUT,
  });
  const after = await cellValues(same);
  expect(money(after.price)).toBeGreaterThan(money(before.price));
  expect(money(after.profit) / money(after.price)).toBeGreaterThanOrEqual(0.0999);
});

test("simulation: registering for GST takes import GST out of the landed cost", async ({
  page,
}) => {
  await openSimulation(page, "?cur=AUD&gst=above");
  const code = await codeOf(firstCell(page, "amazon"));
  const container = page.locator(
    `[data-testid="sim-row-${code}"], [data-testid="sim-card-${code}"]`,
  );
  const text = (await container.innerText()).replace(/\s+/g, " ");
  const importGst = text.match(/incl\. import GST (A\$[\d,]+\.\d{2})/)?.[1];
  const landedBefore = text.match(/(A\$[\d,]+\.\d{2}) incl\. import GST/)?.[1];
  expect(importGst, "an above-threshold row shows its import GST").toBeTruthy();
  expect(landedBefore).toBeTruthy();

  await openRunSettings(page);
  await page
    .getByRole("group", { name: "GST registered" })
    .getByRole("button", { name: "Yes" })
    .click();
  await expect(container).not.toContainText("incl. import GST", { timeout: ROWS_TIMEOUT });
  const expected = (money(landedBefore!) - money(importGst!)).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  await expect(container).toContainText(`A$${expected}`);
});

test("simulation: a row opens in the calculator with the same price and profit, and Back returns", async ({
  page,
}) => {
  await openSimulation(page, "?pg=2");
  const cell = firstCell(page, "ebay");
  const code = await codeOf(cell);
  const sim = await cellValues(cell);
  await cell.click();
  await expect(cell).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Check this row in the calculator" }).click();
  await expect(page.getByLabel("Calculator inputs")).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Platform" }).getByRole("button", { name: "eBay" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("proto-selected-product")).toContainText(code);
  await expect(page.getByLabel("Selling price (USD, incl. GST)")).toHaveValue(
    sim.price.replace(/[^\d.]/g, ""),
  );
  await expect(page.getByTestId("proto-tile-profit")).toHaveText(sim.profit);

  await page.goBack();
  await expect(page.getByTestId(`sim-cell-${code}-ebay`)).toHaveAttribute("aria-pressed", "true", {
    timeout: ROWS_TIMEOUT,
  });
  await expect(page).toHaveURL(/pg=2/);
});

test("simulation: an old calculator link still opens the calculator", async ({ page }) => {
  await openSimulation(page);
  const code = await codeOf(firstCell(page, "amazon"));
  await page.goto(`/?m=AU&cur=AUD&p=${code}&sp=2500`);
  await expect(page.getByLabel("Calculator inputs")).toBeVisible();
  await expect(page.getByTestId("proto-selected-product")).toContainText(code);
  await expect(page.getByTestId("proto-tile-profit")).toHaveText(/^−?A\$[\d,]+\.\d{2}$/);
});

test("simulation: at 360px the card list renders and the drawer opens and closes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openSimulation(page);
  await expect(page.locator("table")).toHaveCount(0);
  const cell = firstCell(page, "shopify");
  const code = await codeOf(cell);
  const card = page.getByTestId(`sim-card-${code}`);
  await expect(card).toBeVisible();
  await cell.click();
  const drawer = card.getByRole("region", { name: "Selected product" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: "Close" }).click();
  await expect(drawer).toHaveCount(0);
});

test("simulation: searching by SKU finds the product in both views", async ({ page }) => {
  await openSimulation(page);
  const code = await codeOf(firstCell(page, "amazon"));

  await page.getByLabel("Search", { exact: true }).fill(code);
  await expect(page.locator('[data-testid^="sim-cell-"][data-testid$="-amazon"]')).toHaveCount(1);
  await expect(page.getByTestId(`sim-cell-${code}-amazon`)).toBeVisible();

  await page
    .getByRole("group", { name: "View" })
    .getByRole("button", { name: "Calculator" })
    .click();
  await page.getByLabel("Product").fill(code);
  await expect(page.getByRole("button", { name: new RegExp(code) }).first()).toBeVisible();
});

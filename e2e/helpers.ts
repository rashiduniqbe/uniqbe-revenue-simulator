import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

type Item = { code: string; brand: string; name: string };

export function firstCatalogueItem(): Item {
  const raw = JSON.parse(readFileSync("src/data/catalogue.json", "utf-8")) as { items: Item[] };
  const first = raw.items[0];
  if (!first) throw new Error("catalogue.json has no items");
  return first;
}

export async function pickFirstProduct(page: Page): Promise<Item> {
  const item = firstCatalogueItem();
  await page.getByLabel("Product").fill(item.name);
  await page
    .getByRole("button", { name: `${item.brand} ${item.name}` })
    .first()
    .click();
  return item;
}

export async function expectFxAndDisclaimer(page: Page): Promise<void> {
  await expect(page.getByTestId("fx-badge").first()).toBeVisible();
  await expect(page.getByRole("note")).toContainText("not by this tool");
}

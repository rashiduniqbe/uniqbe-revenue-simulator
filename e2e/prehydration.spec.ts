import type { Page, Route } from "@playwright/test";
import { expect, test } from "./fixtures";
import { firstCatalogueItem } from "./helpers";

const VERDICT = /PROFITABLE|MARGINAL|LOSS-MAKING/;
const CHUNKS = "**/_next/static/chunks/**";

// Holds every Next.js JS chunk so the server-rendered page stays un-hydrated
// while the test types, like a visitor on a slow phone. fallback() (not
// continue()) keeps the target-header fixture in the chain on preview runs.
async function holdHydration(page: Page): Promise<() => Promise<void>> {
  const held: Route[] = [];
  await page.route(CHUNKS, (route) => {
    held.push(route);
  });
  return async () => {
    await page.unroute(CHUNKS);
    await Promise.all(held.map((route) => route.fallback()));
  };
}

async function waitForHydration(page: Page, inputId: string): Promise<void> {
  await page.waitForFunction((id) => {
    const el = document.getElementById(id);
    return el !== null && Object.keys(el).some((key) => key.startsWith("__reactFiber"));
  }, inputId);
}

test("a price typed before hydration is used once the page hydrates", async ({ page }) => {
  const item = firstCatalogueItem();
  const release = await holdHydration(page);
  await page.goto(`/?p=${item.code}`, { waitUntil: "commit" });
  const price = page.getByRole("textbox", { name: "Selling price" });
  await price.fill("9999.00");
  await release();
  await waitForHydration(page, "selling-price");
  await expect(price).toHaveValue("9999.00");
  await expect(page.getByText(VERDICT)).toBeVisible();
  await expect(page).toHaveURL(/sp=9999\.00/);
});

test("keeps every field typed before hydration", async ({ page }) => {
  const item = firstCatalogueItem();
  const release = await holdHydration(page);
  await page.goto(`/?p=${item.code}`, { waitUntil: "commit" });
  await page.getByRole("textbox", { name: "Selling price" }).fill("9999.00");
  await page.getByRole("textbox", { name: "Shipping" }).fill("3.50");
  await release();
  await waitForHydration(page, "selling-price");
  await expect(page).toHaveURL(/sp=9999\.00/);
  await expect(page).toHaveURL(/sh=3\.50/);
  await expect(page.getByText(VERDICT)).toBeVisible();
});

test("a /compare price typed before hydration is used once the page hydrates", async ({ page }) => {
  const item = firstCatalogueItem();
  const release = await holdHydration(page);
  await page.goto(`/compare?p=${item.code}`, { waitUntil: "commit" });
  const uk = page.getByRole("region", { name: "UK" });
  await uk.getByRole("textbox", { name: /Selling price/ }).fill("9999.00");
  await release();
  await waitForHydration(page, "price-uk");
  await expect(uk.getByText(VERDICT)).toBeVisible();
});

test("a deep link is not rewritten on load", async ({ page }) => {
  const item = firstCatalogueItem();
  await page.goto(`/?p=${item.code}&sp=9999.00`);
  await waitForHydration(page, "selling-price");
  await expect(page.getByText(VERDICT)).toBeVisible();
  expect(new URL(page.url()).search).toBe(`?p=${item.code}&sp=9999.00`);
});

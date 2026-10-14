import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect } from "./fixtures";

export const VERDICT = /PROFITABLE|MARGINAL|LOSS-MAKING/;
export const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

export async function expectNoViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}

export async function tabUntil(
  page: Page,
  predicate: string,
  key = "Tab",
  maxPresses = 40,
): Promise<void> {
  for (let i = 0; i < maxPresses; i++) {
    await page.keyboard.press(key);
    if (await page.evaluate(predicate)) return;
  }
  throw new Error(`focus never reached: ${predicate}`);
}

// 5% is below the verdict's marginal threshold (VERDICT_MARGIN_THRESHOLD_PCT), so the applied
// price lands on a MARGINAL verdict for any product, with no price hardcoded in the test.
export async function reachMarginalVerdict(page: Page): Promise<void> {
  await page.getByLabel("Suggest a price for a target margin").fill("5");
  await page.getByRole("button", { name: "Suggest", exact: true }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByText("MARGINAL")).toBeVisible();
}

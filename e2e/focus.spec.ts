import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { reachMarginalVerdict } from "./a11y-helpers";
import { firstCatalogueItem, pickFirstProduct } from "./helpers";

const MIN_RING_PX = 2;
const MAX_TAB_STOPS = 80;

interface Stop {
  name: string;
  ringStyle: string;
  ringPx: number;
  overlapsSlot: boolean;
  overlapsNote: boolean;
}

// Presses Tab through the page and describes every focus stop until focus leaves the document.
async function tabStops(page: Page): Promise<Stop[]> {
  const stops: Stop[] = [];
  for (let i = 0; i < MAX_TAB_STOPS; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const overlaps = (selector: string): boolean => {
        const other = document.querySelector(selector)?.getBoundingClientRect();
        return !!other && rect.bottom > other.top && rect.top < other.bottom;
      };
      return {
        name: el.id || `${el.tagName.toLowerCase()}: ${(el.textContent ?? "").trim().slice(0, 24)}`,
        ringStyle: style.outlineStyle,
        ringPx: parseFloat(style.outlineWidth),
        overlapsSlot: overlaps('[data-testid="verdict-slot"]'),
        overlapsNote: overlaps('[role="note"]'),
      };
    });
    if (stop === null) break;
    stops.push(stop);
  }
  return stops;
}

test("every keyboard focus stop shows a ring of at least 2px", async ({ page }) => {
  const item = firstCatalogueItem();
  await page.goto(`/?p=${item.code}&sp=9999.00`);
  const stops = await tabStops(page);
  expect(stops.length, "the page has focusable controls").toBeGreaterThan(5);
  const weak = stops
    .filter((s) => s.ringStyle === "none" || s.ringPx < MIN_RING_PX)
    .map((s) => `${s.name} (${s.ringStyle} ${s.ringPx}px)`);
  expect(weak).toEqual([]);
});

test("mobile: a focused control is never hidden behind the sticky bars", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-portrait", "mobile-only check");
  await page.goto("/");
  await pickFirstProduct(page);
  await page.getByRole("textbox", { name: "Selling price" }).fill("9999.00");
  // The marginal card is the tallest sticky state (it has an extra explanatory line).
  await reachMarginalVerdict(page);
  await page.locator("#product-search").focus();

  const stops = await tabStops(page);
  expect(stops.length).toBeGreaterThan(5);
  const hidden = stops
    .filter((s) => s.overlapsSlot || s.overlapsNote)
    .map((s) => `${s.name} (verdict:${s.overlapsSlot} disclaimer:${s.overlapsNote})`);
  expect(hidden).toEqual([]);
});

import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { reachMarginalVerdict } from "./a11y-helpers";
import { firstCatalogueItem, pickFirstProduct } from "./helpers";

const MIN_RING_PX = 2;
const MAX_TAB_STOPS = 80;

interface Stop {
  index: number;
  name: string;
  ringStyle: string;
  ringPx: number;
  overlapsSlot: boolean;
  overlapsNote: boolean;
}

// Describes the focused element, or null once focus has left the document.
function describeFocus(): Stop | null {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const overlaps = (selector: string): boolean => {
    const other = document.querySelector(selector)?.getBoundingClientRect();
    return !!other && rect.bottom > other.top && rect.top < other.bottom;
  };
  return {
    index: Array.from(document.querySelectorAll("*")).indexOf(el),
    name: el.id || `${el.tagName.toLowerCase()}: ${(el.textContent ?? "").trim().slice(0, 24)}`,
    ringStyle: style.outlineStyle,
    ringPx: parseFloat(style.outlineWidth),
    overlapsSlot: overlaps('[data-testid="verdict-slot"]'),
    overlapsNote: overlaps('[role="note"]'),
  };
}

// Presses `key` repeatedly and describes every focus stop. It ends when focus leaves the document
// or comes back to a stop it already visited, and throws if neither happens within MAX_TAB_STOPS.
// With `startIndex` it first focuses that element (without scrolling) and records it as stop one.
async function walkFocus(
  page: Page,
  key: "Tab" | "Shift+Tab",
  startIndex?: number,
): Promise<Stop[]> {
  const stops: Stop[] = [];
  const seen = new Set<number>();
  if (startIndex !== undefined) {
    await page.evaluate(
      (i) => (document.querySelectorAll("*")[i] as HTMLElement).focus({ preventScroll: true }),
      startIndex,
    );
    const first = await page.evaluate(describeFocus);
    if (first) {
      stops.push(first);
      seen.add(first.index);
    }
  }
  for (let i = 0; i < MAX_TAB_STOPS; i++) {
    await page.keyboard.press(key);
    const stop = await page.evaluate(describeFocus);
    if (stop === null || seen.has(stop.index)) return stops;
    seen.add(stop.index);
    stops.push(stop);
  }
  throw new Error(`focus never left the page or looped back within ${MAX_TAB_STOPS} presses`);
}

function hiddenBehindBars(stops: Stop[]): string[] {
  return stops
    .filter((s) => s.overlapsSlot || s.overlapsNote)
    .map((s) => `${s.name} (verdict:${s.overlapsSlot} disclaimer:${s.overlapsNote})`);
}

test("every keyboard focus stop shows a ring of at least 2px", async ({ page }) => {
  const item = firstCatalogueItem();
  await page.goto(`/?p=${item.code}&sp=9999.00`);
  const stops = await walkFocus(page, "Tab");
  expect(stops.length, "the page has focusable controls").toBeGreaterThan(5);
  const weak = stops
    .filter((s) => s.ringStyle === "none" || s.ringPx < MIN_RING_PX)
    .map((s) => `${s.name} (${s.ringStyle} ${s.ringPx}px)`);
  expect(weak).toEqual([]);
});

// Walks the whole page forwards and backwards in the marginal state (the tallest sticky verdict
// card) and fails on any stop that sits under the sticky verdict card or the disclaimer bar.
async function expectFocusClearOfStickyBars(page: Page): Promise<void> {
  await page.goto("/");
  await pickFirstProduct(page);
  await page.getByRole("textbox", { name: "Selling price" }).fill("9999.00");
  await reachMarginalVerdict(page);
  // A renamed id must not silently disable the overlap checks below.
  await expect(page.getByTestId("verdict-slot")).toHaveCount(1);
  await expect(page.getByRole("note")).toHaveCount(1);
  await page.locator("#product-search").focus();

  // Forward Tab scrolls new targets in from the bottom edge, which exercises scroll-padding-bottom.
  const forward = await walkFocus(page, "Tab");
  expect(forward.length).toBeGreaterThan(5);
  expect(hiddenBehindBars(forward)).toEqual([]);

  // Shift+Tab from the end scrolls targets in from the top edge, which exercises
  // scroll-padding-top against the tallest sticky state (the marginal verdict card).
  const lastIndex = forward[forward.length - 1]!.index;
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const reverse = await walkFocus(page, "Shift+Tab", lastIndex);
  expect(reverse.length).toBeGreaterThan(5);
  expect(hiddenBehindBars(reverse)).toEqual([]);
}

test("mobile: a focused control is never hidden behind the sticky bars", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-portrait", "mobile-only check");
  await expectFocusClearOfStickyBars(page);
});

// At 320px the marginal card's explanatory line wraps and the card grows taller than at 393px.
test("mobile: focus stays clear of the taller verdict card at 320px", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-portrait", "mobile-only check");
  await page.setViewportSize({ width: 320, height: 568 });
  await expectFocusClearOfStickyBars(page);
});

// The result list scrolls (overflow-y: auto), so an outward ring on a full-width row is clipped at
// its edges. The row must draw its ring inside its own box, which sits inside the list box.
test("product result rows draw an inset focus ring that the list cannot clip", async ({ page }) => {
  const item = firstCatalogueItem();
  await page.goto("/");
  await page.locator("#product-search").fill(item.name);
  await page.locator("#product-search").press("Tab");
  const ring = await page.evaluate(() => {
    const row = document.activeElement as HTMLElement;
    const list = row.closest("ul")!.getBoundingClientRect();
    const box = row.getBoundingClientRect();
    const style = getComputedStyle(row);
    return {
      isRow: row.tagName === "BUTTON" && row.closest("ul") !== null,
      width: parseFloat(style.outlineWidth),
      offset: parseFloat(style.outlineOffset),
      insideList: box.left >= list.left && box.right <= list.right && box.top >= list.top,
    };
  });
  expect(ring.isRow, "Tab from the search box lands on the first result row").toBe(true);
  expect(ring.width).toBeGreaterThanOrEqual(MIN_RING_PX);
  expect(ring.offset, "an inset ring has a negative offset").toBeLessThan(0);
  expect(ring.insideList).toBe(true);
});

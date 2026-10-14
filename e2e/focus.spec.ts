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

test("mobile: a focused control is never hidden behind the sticky bars", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-portrait", "mobile-only check");
  await page.goto("/");
  await pickFirstProduct(page);
  await page.getByRole("textbox", { name: "Selling price" }).fill("9999.00");
  // The marginal card is the tallest sticky state (it has an extra explanatory line).
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
});

# T-30 PostHog Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send the six spec §13 pilot events to PostHog without leaking any partner price, margin or shipping cost. This covers T-30, plus the "Copy link" button that `scenario_shared` needs.

**Architecture:**
- **Pure layer.** All analytics logic lives in `src/lib/analytics/` and is unit-tested in Vitest's node environment. That covers band bucketing, typed event builders, the URL scrubber, the "settled" de-duplicating emitter, and the privacy-locked PostHog options.
- **Client wrapper.** One small module, `src/lib/analytics/client.ts`, wraps `posthog-js`. It starts lazily on the first `track()` call, and only when `NEXT_PUBLIC_POSTHOG_KEY` is set. With no key it is a silent no-op.
- **Components.** They call `track(builder(...))` and never touch `posthog` directly.
- **E2E privacy proof.** Playwright builds the app with a placeholder key and a local ingest host. It intercepts every analytics request to prove no price ever leaves the browser.

**Tech Stack:**
- Next.js 15 App Router, React 19, nuqs 2, decimal.js, Vitest 2 + fast-check, Playwright.
- New dependency: `posthog-js` (1.435.x at the time of writing). The option names used below were checked against `posthog-config.d.ts` in `@posthog/types`.

**Branch:** create `phase6b-posthog` from `main` (PR #1 merged as 496cce4).

**Spec:** `PROJECT_SPEC.md`:
- §13: the events table and the privacy rules.
- §14: ticket T-30.
- §4: the env table.
  - `NEXT_PUBLIC_POSTHOG_KEY` has a default of `""`.
  - `NEXT_PUBLIC_POSTHOG_HOST` has a default of `https://eu.i.posthog.com`.

`AGENTS.md` invariants 1–6 also apply.

**Decisions approved by the human on 2026-09-30.** These are binding. Don't re-litigate them.
1. `marginBand` edges are `"<0" | "0-10" | "10-20" | "20-30" | "30+"`. The lower edge of each band is inclusive.
2. `scenario_shared` fires from a new **"Copy link"** button. On success the button shows **"Link copied"**. Both strings are approved copy.
3. `price_suggested.targetMargin` is sent as a **band**, using the same edges, never as the typed number.
4. PostHog runs **cookieless**, with `persistence: "memory"`. There are no cookies and no localStorage, so no consent banner is needed.

## Global Constraints

- **Privacy (spec §13):** "**Never send** partner-entered selling prices, margins, or shipping costs to analytics. Send the *band* (`marginBand: "0-10"`), never the value." This holds for every event payload *and* for every property PostHog adds by itself, such as URLs and referrers.
- **PostHog mode (spec §13):** "PostHog EU cloud, `person_profiles: "identified_only"`, no session recording."
- **Env (spec §4):**
  - `NEXT_PUBLIC_POSTHOG_KEY` is client-scoped, not required, with a default of `""`.
  - `NEXT_PUBLIC_POSTHOG_HOST` is client-scoped, not required, with a default of `"https://eu.i.posthog.com"`.
- **No key, no calls:** with an empty key, the app behaves exactly as it does today. It makes zero requests and throws zero errors.
- **Analytics never breaks the simulator:** a PostHog failure must not throw into React.
- **Engine purity (AGENTS 1):** nothing in `src/engine/**` changes.
- **Money (AGENTS 2):** band bucketing uses `Decimal`. No money value is ever converted to `number` for analytics.
- **AGENTS 3a/3b:** never hardcode a catalogue product or count in code or tests. E2E uses `firstCatalogueItem()` from `e2e/helpers.ts`.
- **AGENTS 6:** the FX badge and disclaimer stay on every converted-price screen.
- **Copy:** the only new visible strings are "Copy link" and "Link copied". Any other new visible text needs human approval first.
- **Tooling:**
  - pnpm 10.33.2, with `engines.node` set to 22.x.
  - TypeScript is strict, with `noUncheckedIndexedAccess` and `verbatimModuleSyntax`. Type-only imports use `import type`, and imports are relative only.
  - Prettier settings are `semi: true`, `singleQuote: false`, `trailingComma: "all"` and `printWidth: 100`. Run `pnpm prettier --write <changed files>` before each commit.
- **Commits:** one task per commit, using Conventional Commits. End every message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Done means:** `pnpm verify`, `pnpm build` and `pnpm e2e` all pass.

## Review Focus

1. **The URL carries the partner's price** (`/?sp=599.99…`, `/compare?sp_uk=…`). PostHog attaches `$current_url`, `$referrer` and similar properties to every event, so the default setup would leak prices. Every URL-valued property must lose its query string and hash. This is pinned in Task 1 by the `scrubCapture` tests, and in Task 2 by an E2E that asserts no request contains `9999` or `sp=`.
2. **Typing a price recalculates on every keystroke.** A naive `calculation_run` would fire 7 times for "9999.00", inflating the core "loss-making verdicts shown" metric. It must fire once, after the result settles, and never twice for the same result. This is pinned in Task 1 by the `createSettledEmitter` tests, and in Task 3 by an E2E that counts exactly one `calculation_run` after typing.
3. **No PostHog key.** This happens in local dev, in CI before secrets exist, and in preview before the account exists. The app must behave exactly as it does today and make no analytics requests. This is pinned in Task 2 by the `analyticsConfigFromEnv` tests and the `track` no-op when unconfigured.
4. **Margin edge values** such as `-0.00`, exactly `0`, `10` or `30`, large negatives, and `99.99`. Each must land in exactly one band, with the lower edge inclusive. This is pinned in Task 1 by the `marginBand` tests.
5. **Clipboard unavailable or denied.** This happens in an insecure context, after a permission denial, or in an older browser. "Copy link" must not crash, must not show "Link copied", and must not fire `scenario_shared`. This is pinned in Task 4 by the `copyLink` tests.

---

### Task 1: feat(analytics): pure event layer — bands, events, URL scrub, settled emitter, privacy options

**Files:**
- Create: `src/lib/analytics/bands.ts`, `src/lib/analytics/events.ts`, `src/lib/analytics/scrub.ts`, `src/lib/analytics/settle.ts`, `src/lib/analytics/config.ts`
- Test: `tests/lib/analytics/bands.test.ts`, `tests/lib/analytics/events.test.ts`, `tests/lib/analytics/scrub.test.ts`, `tests/lib/analytics/settle.test.ts`, `tests/lib/analytics/config.test.ts`

**Interfaces:**
- Consumes:
  - `calculate` from `src/engine`.
  - `buildMarketInput` and `fxInputFor` from `src/lib/compare.ts`.
  - `SimulationResult`, `Market` and `Platform` from `src/engine/types.ts`.
  - `MarketRules` and `FxSnapshotType` from `src/lib/schemas.ts`.
- Produces:
  - `type MarginBand = "<0" | "0-10" | "10-20" | "20-30" | "30+"` and `marginBand(pct: string): MarginBand`.
  - `type AnalyticsEvent`, a discriminated union on `name`.
  - The builders `simulatorViewed(market, referrer)`, `productSelected(productCode, category, market)`, `calculationRun(result, market, platform)`, `priceSuggested(targetMarginPct: number, reachable: boolean)`, `comparisonViewed(productCode)` and `scenarioShared()`.
  - `referrerSource(referrer: string, ownHost: string): string`.
  - `stripUrl(value: string): string` and `scrubCapture<T extends CaptureLike>(cr: T | null): T | null`.
  - `createSettledEmitter<T>(delayMs, send, keyOf): SettledEmitter<T>`, where `SettledEmitter<T>` is `{ push(value: T | null): void; cancel(): void }`.
  - `DEFAULT_POSTHOG_HOST` and `POSTHOG_PRIVACY_OPTIONS`.
  - `analyticsConfigFromEnv(key, host): AnalyticsConfig | null`, where `AnalyticsConfig` is `{ key: string; host: string }`.

- [ ] **Step 1: Create the branch**

```bash
git checkout main && git pull && git checkout -b phase6b-posthog
```

- [ ] **Step 2: Write the failing band tests.** Create `tests/lib/analytics/bands.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { marginBand } from "../../../src/lib/analytics/bands";

describe("marginBand", () => {
  it.each([
    ["-250.00", "<0"],
    ["-0.01", "<0"],
    ["-0.00", "0-10"],
    ["0", "0-10"],
    ["9.99", "0-10"],
    ["10", "10-20"],
    ["19.99", "10-20"],
    ["20.00", "20-30"],
    ["29.999", "20-30"],
    ["30", "30+"],
    ["99.99", "30+"],
  ])("%s -> %s (lower edge inclusive)", (pct, band) => {
    expect(marginBand(pct)).toBe(band);
  });
});
```

- [ ] **Step 3: Write the failing event tests.** Create `tests/lib/analytics/events.test.ts`. The fast-check property is the privacy guard for the one event built from a result.

```ts
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import rulesRaw from "../../../src/data/market-rules.json";
import { MarketRules, type FxSnapshotType } from "../../../src/lib/schemas";
import { calculate } from "../../../src/engine";
import { buildMarketInput, fxInputFor, type CompareItem } from "../../../src/lib/compare";
import {
  calculationRun,
  comparisonViewed,
  priceSuggested,
  productSelected,
  referrerSource,
  scenarioShared,
  simulatorViewed,
} from "../../../src/lib/analytics/events";

const rules = MarketRules.parse(rulesRaw);
const item: CompareItem = { code: "TEST", usd: 400, category: "mobile-phone" };
const fx: FxSnapshotType = {
  base: "USD",
  rates: { GBP: 0.7424, AUD: 1.395 },
  asOf: "2026-08-25",
  fetchedAt: "2026-08-25T06:00:00.000Z",
  provider: "seed",
  ageDays: 0,
  degraded: true,
};

function resultAt(price: string, market: "UK" | "AU" = "UK") {
  return calculate(
    buildMarketInput(item, market, "amazon", price, rules),
    fxInputFor(fx, market),
    rules,
  );
}

describe("referrerSource", () => {
  it("empty referrer is direct", () => {
    expect(referrerSource("", "sim.uniqbe.com")).toBe("direct");
  });
  it("same host is internal, whatever the path or query", () => {
    expect(referrerSource("https://sim.uniqbe.com/?sp=599.99", "sim.uniqbe.com")).toBe("internal");
  });
  it("external referrer keeps the hostname only, never path or query", () => {
    expect(referrerSource("https://www.google.com/search?q=uniqbe+599", "sim.uniqbe.com")).toBe(
      "www.google.com",
    );
  });
  it("unparseable referrer is unknown", () => {
    expect(referrerSource("not a url", "sim.uniqbe.com")).toBe("unknown");
  });
});

describe("event builders", () => {
  it("calculationRun sends the spec §13 properties with a band, not the margin", () => {
    const result = resultAt("9999.00");
    expect(calculationRun(result, "UK", "amazon")).toEqual({
      name: "calculation_run",
      properties: {
        market: "UK",
        platform: "amazon",
        verdict: result.verdict,
        marginBand: expect.stringMatching(/^(<0|0-10|10-20|20-30|30\+)$/),
        auAboveThreshold: null,
      },
    });
  });

  it("calculationRun carries the AU threshold branch", () => {
    const event = calculationRun(resultAt("19999.00", "AU"), "AU", "amazon");
    expect(event.name).toBe("calculation_run");
    expect(typeof (event.properties as { auAboveThreshold: unknown }).auAboveThreshold).toBe(
      "boolean",
    );
  });

  it("priceSuggested bands the target margin", () => {
    expect(priceSuggested(25, true)).toEqual({
      name: "price_suggested",
      properties: { targetMargin: "20-30", reachable: true },
    });
  });

  it("the remaining builders match spec §13", () => {
    expect(simulatorViewed("AU", "direct")).toEqual({
      name: "simulator_viewed",
      properties: { market: "AU", referrer: "direct" },
    });
    expect(productSelected("TEST", "mobile-phone", "UK")).toEqual({
      name: "product_selected",
      properties: { productCode: "TEST", category: "mobile-phone", market: "UK" },
    });
    expect(comparisonViewed("TEST")).toEqual({
      name: "comparison_viewed",
      properties: { productCode: "TEST" },
    });
    expect(scenarioShared()).toEqual({ name: "scenario_shared", properties: {} });
  });

  it("property: no calculation_run payload ever contains a money value", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 9_999_999 }), fc.constantFrom("UK", "AU"), (cents, m) => {
        const market = m as "UK" | "AU";
        const price = (cents / 100).toFixed(2);
        const result = resultAt(price, market);
        const json = JSON.stringify(calculationRun(result, market, "amazon"));
        // No decimal number of any kind: prices, profit and margin are all decimal strings.
        expect(json).not.toMatch(/\d\.\d/);
        expect(json).not.toContain(result.netProfit);
        expect(json).not.toContain(result.marginPct);
      }),
      { numRuns: 200 },
    );
  });
});
```

- [ ] **Step 4: Write the failing scrub tests.** Create `tests/lib/analytics/scrub.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { scrubCapture, stripUrl } from "../../../src/lib/analytics/scrub";

describe("stripUrl", () => {
  it("drops the query and hash from http(s) URLs", () => {
    expect(stripUrl("https://sim.uniqbe.com/?p=AB12345&sp=599.99#x")).toBe(
      "https://sim.uniqbe.com/",
    );
    expect(stripUrl("http://localhost:3100/compare?sp_uk=1&sp_au=2")).toBe(
      "http://localhost:3100/compare",
    );
  });
  it("leaves non-URL strings untouched", () => {
    expect(stripUrl("UK")).toBe("UK");
    expect(stripUrl("0-10")).toBe("0-10");
    expect(stripUrl("")).toBe("");
  });
});

describe("scrubCapture", () => {
  it("strips every URL-valued property, including $set and $set_once", () => {
    const scrubbed = scrubCapture({
      event: "calculation_run",
      properties: {
        $current_url: "https://sim.uniqbe.com/?sp=599.99",
        $referrer: "https://sim.uniqbe.com/compare?sp_uk=599.99",
        market: "UK",
        count: 3,
      },
      $set: { $initial_current_url: "https://sim.uniqbe.com/?sp=1.00" },
      $set_once: { $initial_referrer: "https://x.com/?q=599.99" },
    });
    expect(JSON.stringify(scrubbed)).not.toContain("599.99");
    expect(JSON.stringify(scrubbed)).not.toContain("sp=");
    expect(scrubbed?.properties.market).toBe("UK");
    expect(scrubbed?.properties.count).toBe(3);
  });
  it("passes null through (an event PostHog already dropped)", () => {
    expect(scrubCapture(null)).toBeNull();
  });
});
```

- [ ] **Step 5: Write the failing settled-emitter tests.** Create `tests/lib/analytics/settle.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSettledEmitter } from "../../../src/lib/analytics/settle";

describe("createSettledEmitter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("a burst of pushes sends only the last value, once, after the delay", () => {
    const send = vi.fn();
    const emitter = createSettledEmitter<string>(1000, send, (v) => v);
    emitter.push("9");
    vi.advanceTimersByTime(300);
    emitter.push("99");
    vi.advanceTimersByTime(300);
    emitter.push("9999.00");
    vi.advanceTimersByTime(999);
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("9999.00");
  });

  it("never sends the same key twice in a row", () => {
    const send = vi.fn();
    const emitter = createSettledEmitter<string>(1000, send, (v) => v);
    emitter.push("a");
    vi.advanceTimersByTime(1000);
    emitter.push("a");
    vi.advanceTimersByTime(1000);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("null cancels a pending send", () => {
    const send = vi.fn();
    const emitter = createSettledEmitter<string>(1000, send, (v) => v);
    emitter.push("a");
    emitter.push(null);
    vi.advanceTimersByTime(5000);
    expect(send).not.toHaveBeenCalled();
  });

  it("cancel() drops a pending send", () => {
    const send = vi.fn();
    const emitter = createSettledEmitter<string>(1000, send, (v) => v);
    emitter.push("a");
    emitter.cancel();
    vi.advanceTimersByTime(5000);
    expect(send).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Write the failing config tests.** Create `tests/lib/analytics/config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_POSTHOG_HOST,
  POSTHOG_PRIVACY_OPTIONS,
  analyticsConfigFromEnv,
} from "../../../src/lib/analytics/config";
import { scrubCapture } from "../../../src/lib/analytics/scrub";

describe("analyticsConfigFromEnv", () => {
  it("returns null when the key is missing, empty or blank (analytics off)", () => {
    expect(analyticsConfigFromEnv(undefined, undefined)).toBeNull();
    expect(analyticsConfigFromEnv("", "https://eu.i.posthog.com")).toBeNull();
    expect(analyticsConfigFromEnv("   ", undefined)).toBeNull();
  });
  it("defaults the host to PostHog EU cloud", () => {
    expect(analyticsConfigFromEnv("phc_x", undefined)).toEqual({
      key: "phc_x",
      host: DEFAULT_POSTHOG_HOST,
    });
    expect(analyticsConfigFromEnv("phc_x", "")).toEqual({ key: "phc_x", host: DEFAULT_POSTHOG_HOST });
    expect(DEFAULT_POSTHOG_HOST).toBe("https://eu.i.posthog.com");
  });
  it("trims both values", () => {
    expect(analyticsConfigFromEnv(" phc_x ", " http://127.0.0.1:3999 ")).toEqual({
      key: "phc_x",
      host: "http://127.0.0.1:3999",
    });
  });
});

describe("POSTHOG_PRIVACY_OPTIONS (spec §13 + approved cookieless decision)", () => {
  it("locks the privacy-relevant options", () => {
    expect(POSTHOG_PRIVACY_OPTIONS).toMatchObject({
      person_profiles: "identified_only",
      persistence: "memory",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      disable_surveys: true,
    });
    expect(POSTHOG_PRIVACY_OPTIONS.before_send).toBe(scrubCapture);
  });
});
```

- [ ] **Step 7: Run the tests and confirm they fail**

Run: `pnpm vitest run tests/lib/analytics`
Expected: all five files FAIL with "Failed to resolve import".

- [ ] **Step 8: Implement `src/lib/analytics/bands.ts`**

```ts
import Decimal from "decimal.js";

export type MarginBand = "<0" | "0-10" | "10-20" | "20-30" | "30+";

// Band edges approved by Uniqbe on 2026-09-30. The lower edge is inclusive.
// Analytics only ever sees the band, never the margin (spec §13).
const BAND_FLOORS: readonly { floor: number; band: MarginBand }[] = [
  { floor: 30, band: "30+" },
  { floor: 20, band: "20-30" },
  { floor: 10, band: "10-20" },
  { floor: 0, band: "0-10" },
];

export function marginBand(pct: string): MarginBand {
  const value = new Decimal(pct);
  for (const { floor, band } of BAND_FLOORS) {
    if (value.gte(floor)) return band;
  }
  return "<0";
}
```

- [ ] **Step 9: Implement `src/lib/analytics/events.ts`**

```ts
import type { Market, Platform, SimulationResult } from "../../engine/types";
import { marginBand, type MarginBand } from "./bands";

// Spec §13. Every property is either a catalogue fact or a band. A
// partner-entered price, margin or shipping cost is never part of a payload.
export type AnalyticsEvent =
  | { name: "simulator_viewed"; properties: { market: Market; referrer: string } }
  | {
      name: "product_selected";
      properties: { productCode: string; category: string; market: Market };
    }
  | {
      name: "calculation_run";
      properties: {
        market: Market;
        platform: Platform;
        verdict: SimulationResult["verdict"];
        marginBand: MarginBand;
        auAboveThreshold: boolean | null;
      };
    }
  | { name: "price_suggested"; properties: { targetMargin: MarginBand; reachable: boolean } }
  | { name: "comparison_viewed"; properties: { productCode: string } }
  | { name: "scenario_shared"; properties: Record<string, never> };

// Only the referring site's hostname. Its path and query could carry anything.
export function referrerSource(referrer: string, ownHost: string): string {
  if (referrer === "") return "direct";
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return "unknown";
  }
  return url.host === ownHost ? "internal" : url.hostname;
}

export function simulatorViewed(market: Market, referrer: string): AnalyticsEvent {
  return { name: "simulator_viewed", properties: { market, referrer } };
}

export function productSelected(
  productCode: string,
  category: string,
  market: Market,
): AnalyticsEvent {
  return { name: "product_selected", properties: { productCode, category, market } };
}

export function calculationRun(
  result: SimulationResult,
  market: Market,
  platform: Platform,
): AnalyticsEvent {
  return {
    name: "calculation_run",
    properties: {
      market,
      platform,
      verdict: result.verdict,
      marginBand: marginBand(result.marginPct),
      auAboveThreshold: result.auAboveThreshold,
    },
  };
}

export function priceSuggested(targetMarginPct: number, reachable: boolean): AnalyticsEvent {
  return {
    name: "price_suggested",
    properties: { targetMargin: marginBand(String(targetMarginPct)), reachable },
  };
}

export function comparisonViewed(productCode: string): AnalyticsEvent {
  return { name: "comparison_viewed", properties: { productCode } };
}

export function scenarioShared(): AnalyticsEvent {
  return { name: "scenario_shared", properties: {} };
}
```

If `SimulationResult` has no field named exactly `auAboveThreshold`, STOP and report it. Never rename a field in `src/engine`.

- [ ] **Step 10: Implement `src/lib/analytics/scrub.ts`**

```ts
// The app keeps the whole scenario in the URL (spec §9.4), including the
// partner's selling price. PostHog adds URL-valued properties ($current_url,
// $referrer, $initial_*) to every event, so each one loses its query and hash here.
export interface CaptureLike {
  properties: Record<string, unknown>;
  $set?: Record<string, unknown>;
  $set_once?: Record<string, unknown>;
}

export function stripUrl(value: string): string {
  if (!/^https?:\/\//i.test(value)) return value;
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value;
  }
}

function scrubRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      typeof value === "string" ? stripUrl(value) : value,
    ]),
  );
}

export function scrubCapture<T extends CaptureLike>(cr: T | null): T | null {
  if (cr === null) return null;
  return {
    ...cr,
    properties: scrubRecord(cr.properties),
    ...(cr.$set ? { $set: scrubRecord(cr.$set) } : {}),
    ...(cr.$set_once ? { $set_once: scrubRecord(cr.$set_once) } : {}),
  };
}
```

- [ ] **Step 11: Implement `src/lib/analytics/settle.ts`**

```ts
// Sends a value only once it has stopped changing for `delayMs`, and never sends
// the same key twice in a row. This turns a keystroke-by-keystroke stream of
// results into one `calculation_run` per settled result (spec §13's core metric).
export interface SettledEmitter<T> {
  push(value: T | null): void;
  cancel(): void;
}

export function createSettledEmitter<T>(
  delayMs: number,
  send: (value: T) => void,
  keyOf: (value: T) => string,
): SettledEmitter<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSentKey: string | null = null;

  function cancel(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return {
    push(value) {
      cancel();
      if (value === null) return;
      const key = keyOf(value);
      if (key === lastSentKey) return;
      timer = setTimeout(() => {
        timer = null;
        lastSentKey = key;
        send(value);
      }, delayMs);
    },
    cancel,
  };
}
```

- [ ] **Step 12: Implement `src/lib/analytics/config.ts`**

```ts
import { scrubCapture } from "./scrub";

export const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";

export interface AnalyticsConfig {
  key: string;
  host: string;
}

// Spec §4: both env vars are optional. An empty key means analytics is off.
export function analyticsConfigFromEnv(
  key: string | undefined,
  host: string | undefined,
): AnalyticsConfig | null {
  const trimmedKey = key?.trim() ?? "";
  if (trimmedKey === "") return null;
  const trimmedHost = host?.trim() ?? "";
  return { key: trimmedKey, host: trimmedHost === "" ? DEFAULT_POSTHOG_HOST : trimmedHost };
}

// Spec §13: EU cloud, identified_only, no session recording. The human approved
// cookieless mode (memory persistence) on 2026-09-30. Nothing is captured
// automatically: every event goes through track() with a typed payload.
// disable_compression keeps payloads readable, so the E2E privacy check (and
// anyone at Uniqbe with devtools open) can see exactly what is sent.
export const POSTHOG_PRIVACY_OPTIONS = {
  person_profiles: "identified_only",
  persistence: "memory",
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  capture_dead_clicks: false,
  capture_heatmaps: false,
  capture_exceptions: false,
  rageclick: false,
  disable_session_recording: true,
  disable_surveys: true,
  advanced_disable_flags: true,
  save_referrer: false,
  disable_compression: true,
  before_send: scrubCapture,
} as const;
```

- [ ] **Step 13: Run the tests and confirm they pass**

Run: `pnpm vitest run tests/lib/analytics`
Expected: all five files PASS.

- [ ] **Step 14: Verify and commit**

Run: `pnpm prettier --write src/lib/analytics tests/lib/analytics && pnpm verify`
Expected: PASS.

```bash
git add src/lib/analytics tests/lib/analytics
git commit -m "feat(analytics): add privacy-safe event builders, URL scrub and settled emitter (T-30)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: feat(analytics): PostHog client, simulator_viewed, and the E2E privacy harness

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`, `playwright.config.ts`, `src/components/simulator/SimulatorShell.tsx`
- Create: `src/lib/analytics/client.ts`, `e2e/analytics.spec.ts`, `e2e/analytics-helpers.ts`

**Interfaces:**
- Consumes:
  - From Task 1: `analyticsConfigFromEnv`, `POSTHOG_PRIVACY_OPTIONS`, `AnalyticsEvent`, `simulatorViewed` and `referrerSource`.
  - From `e2e/helpers.ts`: `firstCatalogueItem` and `pickFirstProduct`.
- Produces:
  - `track(event: AnalyticsEvent): void`. It is a no-op without a key and never throws.
  - In `e2e/analytics-helpers.ts`: `E2E_INGEST_HOST` and `captureAnalytics(page): Promise<string[]>`.

- [ ] **Step 1: Install PostHog**

Run: `pnpm add posthog-js`

Then open `node_modules/@posthog/types/dist/posthog-config.d.ts`. If the types live elsewhere, use `node_modules/posthog-js/dist/module.d.ts`. Confirm that every key in `POSTHOG_PRIVACY_OPTIONS` exists with a compatible type. `pnpm typecheck` in Step 3 also enforces this. If a key doesn't exist in the installed version, remove only that key and report it.

- [ ] **Step 2: Implement `src/lib/analytics/client.ts`**

```ts
import posthog from "posthog-js";
import { POSTHOG_PRIVACY_OPTIONS, analyticsConfigFromEnv } from "./config";
import type { AnalyticsEvent } from "./events";

// Literal process.env access so Next inlines NEXT_PUBLIC_* into the client bundle.
const config = analyticsConfigFromEnv(
  process.env.NEXT_PUBLIC_POSTHOG_KEY,
  process.env.NEXT_PUBLIC_POSTHOG_HOST,
);

let state: "idle" | "started" | "failed" = "idle";

// Starts PostHog lazily on the first event. This avoids a mount-order race: a
// child's effect runs before a parent's, so an init at layout level would miss
// simulator_viewed.
function ensureStarted(): boolean {
  if (config === null || typeof window === "undefined" || state === "failed") return false;
  if (state === "started") return true;
  try {
    posthog.init(config.key, { api_host: config.host, ...POSTHOG_PRIVACY_OPTIONS });
    state = "started";
    return true;
  } catch (err) {
    state = "failed";
    console.warn("Analytics disabled: PostHog failed to start", err);
    return false;
  }
}

// Analytics must never break the simulator (spec §13 is measurement, not function).
export function track(event: AnalyticsEvent): void {
  if (!ensureStarted()) return;
  try {
    posthog.capture(event.name, event.properties);
  } catch (err) {
    console.warn(`Analytics event ${event.name} dropped`, err);
  }
}
```

- [ ] **Step 3: Fire `simulator_viewed` from `SimulatorShell.tsx`**
- Change the React import to `import { useEffect, useState } from "react";`.
- Add these imports:
  - `import { track } from "../../lib/analytics/client";`
  - `import { referrerSource, simulatorViewed } from "../../lib/analytics/events";`
- Directly after `const selectedItem = …`, add:

```tsx
  // Once per page load, with the market the URL opened with.
  useEffect(() => {
    track(simulatorViewed(market, referrerSource(document.referrer, window.location.host)));
  }, []);
```

The repo's ESLint config has no react-hooks plugin, so the empty dependency array is deliberate: the effect fires once per page view.

Run: `pnpm typecheck && pnpm vitest run tests/lib/analytics`
Expected: PASS.

- [ ] **Step 4: Point the E2E build at a local fake ingest host.** In `playwright.config.ts`, add `env` to `webServer`. Next inlines `NEXT_PUBLIC_*` at build time, and the process env takes precedence over `.env.local`, so this overrides any real key a developer has locally:

```ts
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // A placeholder key turns analytics on in the E2E build. Nothing listens on
    // this host: analytics.spec.ts intercepts it, and other specs' requests just fail.
    env: {
      NEXT_PUBLIC_POSTHOG_KEY: "phc_e2e_placeholder",
      NEXT_PUBLIC_POSTHOG_HOST: "http://127.0.0.1:3999",
    },
  },
```

Check the installed Playwright's `webServer.env` type in `node_modules/playwright/types/test.d.ts`. If it *replaces* `process.env` instead of merging with it, spread `...process.env` first. Filter out undefined values so the type still checks.

Local-run note: `reuseExistingServer` is true outside CI. If a `pnpm start` without these vars is already running on port 3100, stop it first.

- [ ] **Step 5: Create `e2e/analytics-helpers.ts`**

```ts
import type { Page } from "@playwright/test";

export const E2E_INGEST_HOST = "http://127.0.0.1:3999";

// Records every request the page sends to the analytics host (URL + body).
export async function captureAnalytics(page: Page): Promise<string[]> {
  const requests: string[] = [];
  await page.route(`${E2E_INGEST_HOST}/**`, async (route) => {
    const request = route.request();
    requests.push(`${request.url()}\n${request.postData() ?? ""}`);
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  return requests;
}

export function countOccurrences(requests: string[], needle: string): number {
  return requests.join("\n").split(needle).length - 1;
}
```

- [ ] **Step 6: Write `e2e/analytics.spec.ts`**

```ts
import { expect, test } from "@playwright/test";
import { captureAnalytics } from "./analytics-helpers";
import { firstCatalogueItem } from "./helpers";

const FLUSH_TIMEOUT_MS = 15_000;

test("simulator_viewed is sent, with no pageview and no price anywhere", async ({ page }) => {
  const requests = await captureAnalytics(page);
  const item = firstCatalogueItem();
  await page.goto(`/?p=${item.code}&sp=9999.00`);
  await expect
    .poll(() => requests.join("\n"), { timeout: FLUSH_TIMEOUT_MS })
    .toContain("simulator_viewed");
  const all = requests.join("\n");
  // The payload is readable (disable_compression), so these negatives mean something.
  expect(all).not.toContain("9999");
  expect(all).not.toContain("sp=");
  expect(all).not.toContain("$pageview");
});
```

- [ ] **Step 7: Run it**

Run: `pnpm build && pnpm e2e e2e/analytics.spec.ts`
Expected: PASS in both projects.

If the poll times out, check whether PostHog is sending at all. Look in the trace for a `console.warn` from `client.ts`, or for a request to a different path. If the body is unreadable despite `disable_compression`, STOP and report it, because the privacy assertions would be vacuous.

- [ ] **Step 8: Verify and commit**

Run: `pnpm prettier --write src/lib/analytics src/components/simulator/SimulatorShell.tsx e2e playwright.config.ts && pnpm verify && pnpm build && pnpm e2e`
Expected: PASS, with all existing specs still green.

```bash
git add package.json pnpm-lock.yaml playwright.config.ts src/lib/analytics/client.ts src/components/simulator/SimulatorShell.tsx e2e/analytics.spec.ts e2e/analytics-helpers.ts
git commit -m "feat(analytics): start PostHog lazily, send simulator_viewed, add E2E privacy harness (T-30)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: feat(analytics): product_selected, calculation_run, price_suggested, comparison_viewed

**Files:**
- Create: `src/components/analytics/useSettledTrack.ts`
- Modify: `src/components/simulator/SimulatorShell.tsx`, `src/components/simulator/PriceSuggestion.tsx`, `src/components/compare/CompareShell.tsx`, `e2e/analytics.spec.ts`

**Interfaces:**
- Consumes:
  - From Task 1: `createSettledEmitter`, `productSelected`, `calculationRun`, `priceSuggested` and `comparisonViewed`.
  - From Task 2: `track`, `captureAnalytics` and `countOccurrences`.
  - From `e2e/helpers.ts`: `pickFirstProduct` and `firstCatalogueItem`.
- Produces:
  - `useSettledTrack(event: AnalyticsEvent | null, delayMs: number): void`
  - `CALCULATION_SETTLE_MS = 1000`

- [ ] **Step 1: Write the failing E2E cases.** Append these to `e2e/analytics.spec.ts`, and add the imports they need (`countOccurrences` and `pickFirstProduct`):

```ts
test("typing a price sends exactly one calculation_run, with a band and no price", async ({
  page,
}) => {
  const requests = await captureAnalytics(page);
  await page.goto("/");
  await pickFirstProduct(page);
  await page
    .getByRole("textbox", { name: "Selling price" })
    .pressSequentially("9999.00", { delay: 60 });
  await expect(page.getByText(/PROFITABLE|MARGINAL|LOSS-MAKING/)).toBeVisible();
  await expect
    .poll(() => requests.join("\n"), { timeout: FLUSH_TIMEOUT_MS })
    .toContain("calculation_run");
  // Give any stray keystroke-level events time to arrive before counting.
  await page.waitForTimeout(4_000);
  const all = requests.join("\n");
  expect(countOccurrences(requests, "calculation_run")).toBe(1);
  expect(all).toContain("product_selected");
  expect(all).toContain("marginBand");
  expect(all).not.toContain("9999");
  expect(all).not.toContain("netProfit");
  expect(all).not.toContain("marginPct");
});

test("Suggest sends price_suggested with a banded target", async ({ page }) => {
  const requests = await captureAnalytics(page);
  await page.goto("/");
  await pickFirstProduct(page);
  await page.getByRole("button", { name: "Suggest" }).click();
  await expect
    .poll(() => requests.join("\n"), { timeout: FLUSH_TIMEOUT_MS })
    .toContain("price_suggested");
  expect(requests.join("\n")).toContain("20-30");
});

test("/compare sends comparison_viewed and no price", async ({ page }) => {
  const requests = await captureAnalytics(page);
  const item = firstCatalogueItem();
  await page.goto(`/compare?p=${item.code}&sp_uk=9999.00&sp_au=19999.00`);
  await expect
    .poll(() => requests.join("\n"), { timeout: FLUSH_TIMEOUT_MS })
    .toContain("comparison_viewed");
  const all = requests.join("\n");
  expect(all).toContain(item.code);
  expect(all).not.toContain("9999");
});
```

The default target is 20, so the expected band is `"20-30"`. The Suggest click needs no price.

Run: `pnpm build && pnpm e2e e2e/analytics.spec.ts`
Expected: the three new tests FAIL at their `expect.poll`, because the events aren't wired yet.

- [ ] **Step 2: Create `src/components/analytics/useSettledTrack.ts`**

```ts
import { useEffect, useRef } from "react";
import { track } from "../../lib/analytics/client";
import type { AnalyticsEvent } from "../../lib/analytics/events";
import { createSettledEmitter, type SettledEmitter } from "../../lib/analytics/settle";

// A result must stay on screen this long to count as "shown" (spec §13 core metric).
export const CALCULATION_SETTLE_MS = 1000;

// Tracks `event` once it has stopped changing for `delayMs`. Pass null when
// there's nothing to track (no result yet); that also cancels any pending send.
export function useSettledTrack(event: AnalyticsEvent | null, delayMs: number): void {
  const emitterRef = useRef<SettledEmitter<AnalyticsEvent> | null>(null);
  if (emitterRef.current === null) {
    emitterRef.current = createSettledEmitter(delayMs, track, (e) => JSON.stringify(e));
  }
  const latest = useRef(event);
  latest.current = event;
  const key = event === null ? null : JSON.stringify(event);

  useEffect(() => {
    emitterRef.current?.push(latest.current);
  }, [key]);

  useEffect(() => () => emitterRef.current?.cancel(), []);
}
```

- [ ] **Step 3: Wire `SimulatorShell.tsx`**
- Add `calculationRun` and `productSelected` to the existing events import.
- Add `import { CALCULATION_SETTLE_MS, useSettledTrack } from "../analytics/useSettledTrack";`.
- In `selectProduct`, after `setScenario({ … })`, add:

```tsx
    track(productSelected(item.code, item.category, market));
```

- Directly after `const result = resolved ? calculate(resolved, fxInput, rules) : null;`, add:

```tsx
  useSettledTrack(
    result ? calculationRun(result, market, scenario.platform) : null,
    CALCULATION_SETTLE_MS,
  );
```

- [ ] **Step 4: Wire `PriceSuggestion.tsx`**
- Add these imports:
  - `import { track } from "../../lib/analytics/client";`
  - `import { priceSuggested } from "../../lib/analytics/events";`
- Replace the body of `handleSuggest` with:

```tsx
  function handleSuggest() {
    if (!isSuggestionInputValid(input)) return;
    const suggestion = suggestPrice(input, fx, rules, targetMarginPct);
    setResult(suggestion);
    setHasSuggested(true);
    suggestedForInputRef.current = input;
    track(priceSuggested(targetMarginPct, suggestion !== null));
  }
```

- [ ] **Step 5: Wire `CompareShell.tsx`**
- Add these imports:
  - `import { useEffect } from "react";`
  - `import { track } from "../../lib/analytics/client";`
  - `import { comparisonViewed } from "../../lib/analytics/events";`
- After `const item = …`, add:

```tsx
  const itemCode = item?.code ?? null;
  // Once per product compared. An unknown or empty code sends nothing.
  useEffect(() => {
    if (itemCode !== null) track(comparisonViewed(itemCode));
  }, [itemCode]);
```

- [ ] **Step 6: Run the analytics E2E**

Run: `pnpm build && pnpm e2e e2e/analytics.spec.ts`
Expected: PASS in both projects.

If `calculation_run` is counted twice, check whether a re-render is creating a new but equal event before you change the test. The key is `JSON.stringify` of a plain object, so it should be stable. Never raise the expected count.

- [ ] **Step 7: Verify and commit**

Run: `pnpm prettier --write src/components e2e && pnpm verify && pnpm build && pnpm e2e`
Expected: PASS, with the a11y and keyboard specs still green.

```bash
git add src/components/analytics src/components/simulator/SimulatorShell.tsx src/components/simulator/PriceSuggestion.tsx src/components/compare/CompareShell.tsx e2e/analytics.spec.ts
git commit -m "feat(analytics): track product_selected, settled calculation_run, price_suggested, comparison_viewed (T-30)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: feat: "Copy link" button and scenario_shared

**Files:**
- Create: `src/lib/copy-link.ts`, `tests/lib/copy-link.test.ts`, `src/components/simulator/CopyLinkButton.tsx`
- Modify: `src/components/simulator/SimulatorShell.tsx`, `e2e/analytics.spec.ts`

**Interfaces:**
- Consumes:
  - From Task 1: `scenarioShared`.
  - From Task 2: `track` and `captureAnalytics`.
  - From `e2e/helpers.ts`: `pickFirstProduct`.
- Produces:
  - `interface ClipboardLike { writeText(text: string): Promise<void> }`
  - `copyLink(clipboard: ClipboardLike | undefined, href: string): Promise<boolean>`
  - `CopyLinkButton()`

- [ ] **Step 1: Write the failing unit test** in `tests/lib/copy-link.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { copyLink } from "../../src/lib/copy-link";

describe("copyLink", () => {
  it("writes the href and reports success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(copyLink({ writeText }, "https://sim.uniqbe.com/?p=AB12345")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://sim.uniqbe.com/?p=AB12345");
  });

  it("reports failure when the clipboard API is missing (insecure context, old browser)", async () => {
    await expect(copyLink(undefined, "https://x")).resolves.toBe(false);
  });

  it("reports failure, without throwing, when the write is denied", async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    await expect(copyLink({ writeText }, "https://x")).resolves.toBe(false);
  });
});
```

Run: `pnpm vitest run tests/lib/copy-link.test.ts`
Expected: FAIL with "Failed to resolve import".

- [ ] **Step 2: Implement `src/lib/copy-link.ts`**

```ts
export interface ClipboardLike {
  writeText(text: string): Promise<void>;
}

// Returns true only when the link really is on the clipboard. Callers show
// "Link copied" and record scenario_shared only on true.
export async function copyLink(clipboard: ClipboardLike | undefined, href: string): Promise<boolean> {
  if (clipboard === undefined) return false;
  try {
    await clipboard.writeText(href);
    return true;
  } catch {
    return false;
  }
}
```

Run: `pnpm vitest run tests/lib/copy-link.test.ts`
Expected: PASS.

- [ ] **Step 3: Create `src/components/simulator/CopyLinkButton.tsx`.** The confirmation text uses `aria-live` *without* `role="status"`. Existing specs locate the threshold banner by `getByRole("status")`, and a second status element would break them.

```tsx
"use client";

import { useEffect, useState } from "react";
import { copyLink, type ClipboardLike } from "../../lib/copy-link";
import { track } from "../../lib/analytics/client";
import { scenarioShared } from "../../lib/analytics/events";

const COPIED_MESSAGE_MS = 2000;

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleClick() {
    const clipboard = navigator.clipboard as ClipboardLike | undefined;
    const ok = await copyLink(clipboard, window.location.href);
    if (!ok) return;
    setCopied(true);
    track(scenarioShared());
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" className="text-sm underline" onClick={handleClick}>
        Copy link
      </button>
      <span aria-live="polite" className="text-sm text-neutral-700">
        {copied ? "Link copied" : ""}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Render it in `SimulatorShell.tsx`.** Add `import { CopyLinkButton } from "./CopyLinkButton";`. Then replace the `{selectedItem && ( <a …>Compare UK vs Australia</a> )}` block with:

```tsx
          {selectedItem && (
            <div className="flex flex-col gap-1">
              <a
                href={`/compare?p=${encodeURIComponent(selectedItem.code)}&pl=${scenario.platform}`}
                className="text-sm underline"
              >
                Compare UK vs Australia
              </a>
              <CopyLinkButton />
            </div>
          )}
```

- [ ] **Step 5: Add the E2E case** to `e2e/analytics.spec.ts`:

```ts
test("Copy link copies the scenario URL and sends scenario_shared", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const requests = await captureAnalytics(page);
  await page.goto("/");
  const item = await pickFirstProduct(page);
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByText("Link copied")).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain(`p=${item.code}`);
  await expect
    .poll(() => requests.join("\n"), { timeout: FLUSH_TIMEOUT_MS })
    .toContain("scenario_shared");
});
```

Run: `pnpm build && pnpm e2e e2e/analytics.spec.ts`
Expected: PASS in both projects. Both projects run Chromium, which supports `grantPermissions` for the clipboard.

- [ ] **Step 6: Verify and commit**

Run: `pnpm prettier --write src/lib/copy-link.ts tests/lib/copy-link.test.ts src/components/simulator e2e && pnpm verify && pnpm build && pnpm e2e`
Expected: PASS.
- `e2e/a11y.spec.ts` must still report 0 axe violations.
- The keyboard-only test's `tabUntil` loop should tolerate the extra tab stop. If it doesn't, raise its `maxPresses` in the test. Never remove the button.

Then check it by hand in `pnpm dev`:
1. Pick a product and click "Copy link".
2. Confirm "Link copied" appears, then disappears after about 2 s.
3. Paste, and confirm you get the full scenario URL.
4. Confirm the FX badge and the disclaimer are unchanged (AGENTS 6).

```bash
git add src/lib/copy-link.ts tests/lib/copy-link.test.ts src/components/simulator/CopyLinkButton.tsx src/components/simulator/SimulatorShell.tsx e2e/analytics.spec.ts
git commit -m "feat: add Copy link button that records scenario_shared (T-30)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Final whole-branch review

- [ ] **Step 1:** Run superpowers:requesting-code-review over the branch, from `git merge-base main HEAD` to HEAD. Resolve every Critical and Important finding.
- [ ] **Step 2:** Run `pnpm verify && pnpm build && pnpm e2e && pnpm catalogue:check`. Expected: all PASS.
- [ ] **Step 3:** Confirm `git diff <branch base>..HEAD -- data/golden-fixtures.json src/engine` is empty.
- [ ] **Step 4:** Ask the human before pushing `phase6b-posthog` and opening its PR.

## Out of scope

- Creating the PostHog project, and setting `NEXT_PUBLIC_POSTHOG_KEY` in Vercel. That is T-32 or ops work. Until it's done, production sends nothing, by design.
- PostHog dashboards and insights for the plan §12 metrics.
- Tracking copies of the URL from the address bar. Analytics can't see them. "Copy link" is the measured path.

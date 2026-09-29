# Phase 6 (Hardening + Ship, code tickets) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gaps found in the 2026-09-28 progress review, then deliver the code-only Phase 6 tickets.

The review gaps:
- the AGENTS.md 5a violation
- the stale catalogue
- line-ending noise
- the slow no-Redis FX path

The Phase 6 tickets:
- `/compare` (T-29)
- Playwright E2E and CI (T-31)
- the full-catalogue sweep (T-34)
- the adaptability drill (T-35)
- the accessibility pass (T-33)

**Architecture:**
- **Engine:** one targeted change. `MarketModule.isAboveThreshold` and `emitWarnings` read the AU de-minimis threshold and comparand from the `MarketRules` block, which `calculate()` and `suggestPrice()` already hold. This replaces the inlined constants.
- **FX store:** `src/fx/store.ts` gets a fast path that skips Redis entirely when it isn't configured.
- **`/compare`:** a new server route plus a thin client shell over the existing engine and components. Its logic lives in a new pure module, `src/lib/compare.ts`.
- **Tests:** E2E and a11y specs go in a new `e2e/` directory (Playwright). The sweep and the drill are Vitest tests under `tests/scripts/`.
- **CI:** a single GitHub Actions workflow.

**Tech Stack:**
- Next.js 15 App Router, React 19, nuqs 2, Tailwind 4, decimal.js, Zod 3, Vitest 2 + fast-check, exceljs.
- New dev dependencies: `@playwright/test` and `@axe-core/playwright`.
- pnpm 10.33.2, Node 22.x.

**Spec:** `PROJECT_SPEC.md` (repo root):
- §2.6 #1 and §2.8: the AU comparand is config-driven. "The engine reads it at runtime and never inlines the rule."
- §2.7 and §5.2: the catalogue adaptability contract and the R5 message
- §6.3: FX display rules
- §9.4: the `/compare` URL shape
- §11.1 and §11.4: test layers and manual QA
- §12.1: the CI pipeline
- §14: Phase 6 tickets T-29, T-31, T-33, T-34 and T-35

Also `AGENTS.md`, invariants 1–6.

## Global Constraints

- **Tooling:** pnpm 10.33.2; `engines.node` is `22.x`.
- **TypeScript:** strict, with `noUncheckedIndexedAccess: true` and `verbatimModuleSyntax: true`. Type-only imports use `import type`. Imports are relative throughout; there are no path aliases.
- **Formatting:** Prettier with `semi: true`, `singleQuote: false`, `trailingComma: "all"`, `printWidth: 100`. Run `pnpm prettier --write <new files>` before each commit.
- **Engine purity (AGENTS 1):** `src/engine/**` stays pure. No React, no Next, no I/O, no `Date.now()`, no `Math.random()`.
- **Money (AGENTS 2):** `Decimal` internally, and a decimal string at every boundary.
- **Catalogue (AGENTS 3):** never hand-edit `src/data/catalogue.json`. Regenerate it with `pnpm catalogue:build`.
- **No catalogue facts in code or tests (AGENTS 3a/3b):** never hardcode a catalogue-derived fact, and never assert a row, product or category count in any test. Tests iterate whatever the loaded catalogue contains.
- **Golden fixtures (AGENTS 4):** never change an expected value in `data/golden-fixtures.json`. All 16 fixtures must stay green, untouched, through every task.
- **Tax modules (AGENTS 5/5a):** UK and AU tax logic stay in separate modules. The AU A$1,000 test reads `deMinimisComparand` from `market-rules.json`; Task 1 makes this true.
- **FX badge and disclaimer (AGENTS 6):** both render on every screen that shows a converted price, **including `/compare`**.
- **Commits:** one ticket per commit, Conventional Commits. End every message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Done means:** run `pnpm verify` and `pnpm build` before calling a task done. From Task 4 on, run `pnpm e2e` as well. Phase 4 showed that `verify` alone misses production-build failures.
- **Browser check:** use the feature through `pnpm dev` before calling any UI task done (Tasks 1, 3 and 7).
- **Unanswered spec questions:** if a question comes up that this plan doesn't answer, especially a tax rule or partner-facing copy, stop and ask the human. Don't invent an answer.

## Review Focus

1. **Missing or malformed AU de-minimis config.** If `market-rules.json` loses AU's `deMinimisComparand` or sets `deMinimisLocal: null`, the engine must fail loudly. It must never silently treat every price as below the threshold. Pinned in Task 1 Step 1 (the "throws" tests).
2. **Redis unreachable or unconfigured, even with credentials present locally.** The page must render quickly from seed rates and show the degraded warning. It must never hang or crash. Pinned in Task 4 (the `redisFromEnv` tests and the CI-only degraded E2E assertion).
3. **A `/compare` deep link with an unknown product code, an empty price or a non-numeric price.** The page must show its empty state, with no crash and no `NaN`. Pinned in Task 3 (`compareMarket` returns `null`) and Task 4 (the E2E unknown-code case).
4. **A product whose `suggestPrice` returns `null` because the target is unreachable.** It must still be sweepable, which exercises the fallback-price path. Pinned in Task 5.
5. **A keyboard-only partner.** They must be able to complete pick → price → verdict → switch market. Pinned in Task 7.

---

### Task 0: chore: normalise line endings and ignore tool directories

**Files:**
- Create: `.gitattributes`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: a working tree where `git status` shows only real changes, and a `pnpm lint` (Prettier `--check`) that passes on Windows.

- [ ] **Step 1: Prove the 15 "modified" files differ only in line endings.** This check is what makes Step 4 safe.

Run: `git diff --ignore-cr-at-eol --quiet; echo $?`
Expected: `0`. **If it prints `1`, STOP.** A real content change exists, and Step 4 would overwrite it. Report to the human.

- [ ] **Step 2: Create `.gitattributes`**

```gitattributes
* text=auto eol=lf
*.xlsx binary
*.png binary
*.ico binary
```

- [ ] **Step 3: Append `.playwright-mcp/` to `.gitignore`**, under the `# testing` section.

- [ ] **Step 4: Renormalise the index and rewrite the working tree as LF**

```bash
git add --renormalize .
git checkout-index --force --all
git status --short
```

Expected: `git status --short` lists only three entries:
- `.gitattributes`
- `.gitignore`
- the untracked `pricelists/Uniqbe Reseller Quotation 20260922.xlsx`

None of the 15 source files appear.

- [ ] **Step 5: Verify**

Run: `pnpm verify`
Expected: PASS, and the Prettier step reports no files.

Don't run `pnpm build` yet. It fails until Task 2, because `catalogue:check` picks up the newest xlsx, which is the untracked 22 Sep list.

- [ ] **Step 6: Commit**

```bash
git add .gitattributes .gitignore
git commit -m "chore: enforce LF line endings via .gitattributes and ignore .playwright-mcp

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: fix(engine): read AU de-minimis threshold and comparand from market-rules (AGENTS 5a)

**Files:**
- Modify: `src/engine/markets/registry.ts`
- Modify: `src/engine/markets/au.ts:1-41`
- Modify: `src/engine/warnings.ts:1-17`
- Modify: `src/engine/index.ts:41,129-140,190`
- Create: `src/lib/threshold-copy.ts`
- Modify: `src/components/simulator/ThresholdBanner.tsx`, `src/components/simulator/SimulatorShell.tsx`
- Modify: `src/data/market-rules.json` (the text of `AU.deMinimisComparandNote`, and nothing else)
- Test: `tests/engine/markets/au.test.ts`, `tests/engine/warnings.test.ts`, `tests/engine/properties.test.ts`, `tests/lib/threshold-copy.test.ts`

**Interfaces:**
- Consumes: `MarketRulesType`. Each market block in it has `deMinimisLocal: number | null` and `deMinimisComparand?: "goods" | "goods+freight"`.
- Produces:
  - `registry.ts` exports `type DeMinimisComparand` and `type DeMinimisRule = { deMinimisLocal: number | null; deMinimisComparand?: DeMinimisComparand }`.
  - `MarketModule.isAboveThreshold(goods: Decimal, freight: Decimal, rule: DeMinimisRule): boolean`
  - `EngineContext.deMinimis: DeMinimisRule`
  - `thresholdBannerText(aboveThreshold: boolean, thresholdLocal: number): string`
  - `ThresholdBanner` takes props `{ aboveThreshold; thresholdLocal }`.

- [ ] **Step 1: Write the failing engine tests**

**`tests/engine/markets/au.test.ts`.** Add a constant below the imports:

```ts
const AU_RULE = { deMinimisLocal: 1000, deMinimisComparand: "goods" } as const;
```

Pass `AU_RULE` as the third argument to each of the four existing `auModule.isAboveThreshold(a, b)` calls (GF-06a, GF-06b, GF-06c, GF-05). Then append:

```ts
describe("auModule.isAboveThreshold reads its rule from config (AGENTS.md 5a)", () => {
  it("goods+freight comparand: freight pushes goods A$999.99 over the line", () => {
    expect(
      auModule.isAboveThreshold(new Money("999.99"), new Money("20.00"), {
        deMinimisLocal: 1000,
        deMinimisComparand: "goods+freight",
      }),
    ).toBe(true);
  });

  it("threshold value is read, not inlined: A$600 goods is above a A$500 threshold", () => {
    expect(
      auModule.isAboveThreshold(new Money("600.00"), new Money("0.00"), {
        deMinimisLocal: 500,
        deMinimisComparand: "goods",
      }),
    ).toBe(true);
  });

  it("throws when deMinimisLocal is null", () => {
    expect(() =>
      auModule.isAboveThreshold(new Money("1"), new Money("0"), {
        deMinimisLocal: null,
        deMinimisComparand: "goods",
      }),
    ).toThrow(/deMinimisLocal/);
  });

  it("throws when deMinimisComparand is missing", () => {
    expect(() =>
      auModule.isAboveThreshold(new Money("1"), new Money("0"), { deMinimisLocal: 1000 }),
    ).toThrow(/deMinimisComparand/);
  });
});
```

**`tests/engine/warnings.test.ts`.** Add `deMinimis: { deMinimisLocal: 1000, deMinimisComparand: "goods" },` to the object that `baseCtx` returns, after `shopifyHasAbn: false,`. Then append:

```ts
describe("AU near-threshold band reads the configured rule", () => {
  it("band follows deMinimisLocal: goods 480 is near a 500 threshold", () => {
    const codes = emitWarnings(
      baseCtx({
        market: "AU",
        above: false,
        goods: new Money("480.00"),
        deMinimis: { deMinimisLocal: 500, deMinimisComparand: "goods" },
      }),
    ).map((w) => w.code);
    expect(codes).toContain("AU_NEAR_THRESHOLD");
  });

  it("band uses the comparand: goods 900 + freight 60 is near under goods+freight", () => {
    const codes = emitWarnings(
      baseCtx({
        market: "AU",
        above: false,
        goods: new Money("900.00"),
        shipping: new Money("60.00"),
        deMinimis: { deMinimisLocal: 1000, deMinimisComparand: "goods+freight" },
      }),
    ).map((w) => w.code);
    expect(codes).toContain("AU_NEAR_THRESHOLD");
  });
});
```

**`tests/engine/properties.test.ts`.** Inside `describe("property: threshold is a step, invariant to freight (invariant 4)", …)`, add these after the existing `"goods = 999.99 -> below; goods = 1000.00 -> above"` test. They cover spec §11.3 #4, which requires that the invariant "must fail if the comparand config is ignored":

```ts
  it("comparand config is live: flipping it to goods+freight makes freight matter", () => {
    const input: SimulationInput = {
      market: "AU",
      productCode: "TEST",
      usd: 716.84, // x 1.395 = A$999.99 goods
      category: "mobile-phone",
      platform: "amazon",
      taxRegistered: false,
      sellingPriceLocal: "1400.00",
      inboundShippingLocal: "20.00",
      packagingLocal: "0",
      adSpendLocal: "0",
      dutyPct: "0",
      referralFeePct: "8",
      amazonPlan: "individual",
      shopifyPlan: "basic",
      shopifyHasAbn: false,
      ebayFreeTier: false,
    };
    const flipped = { ...rules, AU: { ...rules.AU, deMinimisComparand: "goods+freight" as const } };
    expect(calculate(input, auFx, rules).auAboveThreshold).toBe(false);
    expect(calculate(input, auFx, flipped).auAboveThreshold).toBe(true);
  });

  it("threshold config is live: lowering deMinimisLocal moves the step", () => {
    const input: SimulationInput = {
      market: "AU",
      productCode: "TEST",
      usd: 500, // x 1.395 = A$697.50 goods
      category: "mobile-phone",
      platform: "amazon",
      taxRegistered: false,
      sellingPriceLocal: "1400.00",
      inboundShippingLocal: "0.00",
      packagingLocal: "0",
      adSpendLocal: "0",
      dutyPct: "0",
      referralFeePct: "8",
      amazonPlan: "individual",
      shopifyPlan: "basic",
      shopifyHasAbn: false,
      ebayFreeTier: false,
    };
    const lowered = { ...rules, AU: { ...rules.AU, deMinimisLocal: 600 } };
    expect(calculate(input, auFx, rules).auAboveThreshold).toBe(false);
    expect(calculate(input, auFx, lowered).auAboveThreshold).toBe(true);
  });
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm vitest run tests/engine/markets/au.test.ts tests/engine/warnings.test.ts tests/engine/properties.test.ts`
Expected: the new tests fail, as follows. All existing tests still pass.
- The goods+freight case and the A$500 case return `false`.
- The two null/missing-config cases don't throw.
- The warnings don't include `AU_NEAR_THRESHOLD`.
- Both new property tests get `false` where they expect `true`.

- [ ] **Step 3: Implement**

**`src/engine/markets/registry.ts`.** Replace the whole file:

```ts
import type { Decimal } from "decimal.js";
import type { Market, Platform } from "../types";

export type DeMinimisComparand = "goods" | "goods+freight";

// The de-minimis slice of a market's rules block. Passed in from
// market-rules.json at call time so the engine never inlines the rule (AGENTS.md 5a).
export type DeMinimisRule = {
  deMinimisLocal: number | null;
  deMinimisComparand?: DeMinimisComparand;
};

export type EngineContext = {
  market: Market;
  goods: Decimal;
  shipping: Decimal;
  duty: Decimal;
  above: boolean | null;
  importTax: Decimal;
  registered: boolean;
  platform: Platform;
  adSpend: Decimal;
  shopifyHasAbn: boolean;
  deMinimis: DeMinimisRule;
};

export interface MarketModule {
  readonly id: Market;
  readonly currency: "GBP" | "AUD";
  readonly taxName: "VAT" | "GST";
  readonly taxRatePct: number;
  isAboveThreshold(goods: Decimal, freight: Decimal, rule: DeMinimisRule): boolean;
  computeDuty(goods: Decimal, dutyPct: Decimal): Decimal;
  computeImportTax(goods: Decimal, shipping: Decimal, duty: Decimal, above: boolean): Decimal;
  computeOutputTax(gross: Decimal, registered: boolean): Decimal;
}
```

**`src/engine/markets/au.ts`.** Replace lines 1–41, which run from the imports to the end of `isAboveThreshold`. This removes `DE_MINIMIS_LOCAL` and its stale comment block. Leave `computeDuty` onward unchanged.

```ts
import Decimal from "decimal.js";
import { r2 } from "../money";
import type { DeMinimisComparand, DeMinimisRule, MarketModule } from "./registry";

export type { DeMinimisComparand } from "./registry";

export function comparand(kind: DeMinimisComparand, goods: Decimal, freight: Decimal): Decimal {
  switch (kind) {
    case "goods":
      return goods;
    case "goods+freight":
      return goods.plus(freight);
    default:
      throw new Error(`unknown deMinimisComparand: ${kind as string}`);
  }
}

export const auModule: MarketModule = {
  id: "AU",
  currency: "AUD",
  taxName: "GST",
  taxRatePct: 10,

  isAboveThreshold(goods: Decimal, freight: Decimal, rule: DeMinimisRule): boolean {
    if (rule.deMinimisLocal === null) {
      throw new Error("AU market rules must define deMinimisLocal (market-rules.json)");
    }
    if (rule.deMinimisComparand === undefined) {
      throw new Error("AU market rules must define deMinimisComparand (market-rules.json)");
    }
    return comparand(rule.deMinimisComparand, goods, freight).gte(rule.deMinimisLocal);
  },
```

**`src/engine/warnings.ts`.** Replace lines 1–17, from the imports to the end of the AU block. This removes `AU_DE_MINIMIS`. Leave everything from `if (ctx.registered && …` onward unchanged.

```ts
import Decimal from "decimal.js";
import { comparand } from "./markets/au";
import type { EngineContext } from "./markets/registry";
import type { EngineWarning } from "./types";

// Width of the "near the line" warning band, as a % of the configured
// threshold. A UI nudge, not a tax rule, so it lives here rather than in
// market-rules.json.
const AU_NEAR_THRESHOLD_BAND_PCT = 5;

export function emitWarnings(ctx: EngineContext): EngineWarning[] {
  const warnings: EngineWarning[] = [];

  if (ctx.market === "AU" && ctx.above === false) {
    warnings.push({ code: "AU_BELOW_THRESHOLD" });
    const { deMinimisLocal, deMinimisComparand } = ctx.deMinimis;
    if (deMinimisLocal !== null && deMinimisComparand !== undefined) {
      const threshold = new Decimal(deMinimisLocal);
      const band = threshold.times(AU_NEAR_THRESHOLD_BAND_PCT).div(100);
      if (comparand(deMinimisComparand, ctx.goods, ctx.shipping).gte(threshold.minus(band))) {
        warnings.push({ code: "AU_NEAR_THRESHOLD" });
      }
    }
  }
```

**`src/engine/index.ts`.** Make three edits:
- Lines 41 and 190: change both calls to `market.isAboveThreshold(goods, shipping, marketRules)`.
- The `emitWarnings({ … })` call: add `deMinimis: marketRules,` after `shopifyHasAbn: input.shopifyHasAbn,`.

`uk.ts` needs no change. Its zero-argument `isAboveThreshold()` still satisfies the three-parameter signature.

- [ ] **Step 4: Run the engine tests and confirm they pass**

Run: `pnpm vitest run tests/engine && git diff --quiet data/golden-fixtures.json; echo $?`
Expected: all tests PASS, including the 16 goldens, and the command prints `0` (fixtures untouched).

- [ ] **Step 5: Write the failing banner-copy test** in `tests/lib/threshold-copy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { thresholdBannerText } from "../../src/lib/threshold-copy";

describe("thresholdBannerText", () => {
  it("reproduces the §9.3 above-threshold copy at A$1,000", () => {
    expect(thresholdBannerText(true, 1000)).toBe(
      "Over A$1,000 — GST of 10% applies at the border and is included below.",
    );
  });

  it("reproduces the §9.3 below-threshold copy at A$1,000", () => {
    expect(thresholdBannerText(false, 1000)).toBe(
      "Under A$1,000 — no GST charged today. This reflects Uniqbe's current policy, not a permanent rule.",
    );
  });

  it("follows the configured threshold instead of a hardcoded one", () => {
    expect(thresholdBannerText(true, 1500)).toMatch(/^Over A\$1,500 /);
  });
});
```

Run: `pnpm vitest run tests/lib/threshold-copy.test.ts`
Expected: FAIL with "Failed to resolve import".

- [ ] **Step 6: Implement the banner copy and wire it in**

**`src/lib/threshold-copy.ts`:**

```ts
const AUD_WHOLE = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });

export function thresholdBannerText(aboveThreshold: boolean, thresholdLocal: number): string {
  const amount = `A$${AUD_WHOLE.format(thresholdLocal)}`;
  return aboveThreshold
    ? `Over ${amount} — GST of 10% applies at the border and is included below.`
    : `Under ${amount} — no GST charged today. This reflects Uniqbe's current policy, not a permanent rule.`;
}
```

**`src/components/simulator/ThresholdBanner.tsx`** (replace the file):

```tsx
import { thresholdBannerText } from "../../lib/threshold-copy";

interface ThresholdBannerProps {
  aboveThreshold: boolean;
  thresholdLocal: number;
}

export function ThresholdBanner({ aboveThreshold, thresholdLocal }: ThresholdBannerProps) {
  return (
    <div
      className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
      role="status"
    >
      {thresholdBannerText(aboveThreshold, thresholdLocal)}
    </div>
  );
}
```

**`SimulatorShell.tsx`.** Update the banner render:

```tsx
              {result.auAboveThreshold !== null && rules.AU.deMinimisLocal !== null && (
                <ThresholdBanner
                  aboveThreshold={result.auAboveThreshold}
                  thresholdLocal={rules.AU.deMinimisLocal}
                />
              )}
```

- [ ] **Step 7: Correct the stale config note.** In `src/data/market-rules.json`, change only the value of `AU.deMinimisComparandNote` to:

```json
"Set to goods-only by Uniqbe instruction, 26 Aug 2026, described as provisional. Accepts \"goods\" or \"goods+freight\". Read at runtime by src/engine/markets/au.ts and src/engine/warnings.ts together with deMinimisLocal; changing either value here changes engine behaviour (and fixtures GF-06a/b/c would then need human-approved regeneration)."
```

- [ ] **Step 8: Verify**

Run: `pnpm verify`
Expected: PASS.

The build stays blocked until Task 2. Instead:
1. Run `pnpm dev`.
2. Open `/?m=AU`, pick any product and enter a price.
3. Confirm the banner still reads "Over A$1,000 …" or "Under A$1,000 …".

- [ ] **Step 9: Commit**

```bash
git add src/engine tests/engine src/lib/threshold-copy.ts tests/lib/threshold-copy.test.ts src/components/simulator/ThresholdBanner.tsx src/components/simulator/SimulatorShell.tsx src/data/market-rules.json
git commit -m "fix(engine): read AU de-minimis threshold and comparand from market-rules

AGENTS.md 5a and spec §2.6 #1 require the engine to read the rule at
runtime. isAboveThreshold now takes the market's DeMinimisRule, warnings
read the same rule, and the banner copy follows the configured amount.
Golden fixtures unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: chore(catalogue): regenerate from the 22 Sep 2026 price list

**Files:**
- Add: `pricelists/Uniqbe Reseller Quotation 20260922.xlsx`
- Regenerate: `src/data/catalogue.json`
- Possibly modify: `CATEGORY_MAP` in `scripts/build-catalogue.ts` and `src/data/market-rules.json`, **only with values the human supplies**

**Interfaces:**
- Produces: a `catalogue.json` sourced from the 22 Sep list, which makes `pnpm build` pass again.

- [ ] **Step 1: Snapshot the current catalogue**

```bash
OLD="$(mktemp -d)/catalogue-20260826.json"; cp src/data/catalogue.json "$OLD"; echo "$OLD"
```

- [ ] **Step 2: Regenerate the catalogue**

Run: `pnpm catalogue:build`
Expected: `Wrote <n> products to src/data/catalogue.json (checksum …)`.

- [ ] **Step 3: If the build prints `Unmapped category "…"`, STOP.**
- Report the exact message to the human.
- Ask them for the slug and label to map the category to.
- If they give a **new** slug, also ask for its duty % and referral-fee % in both markets. Never pick a mapping yourself.
- Apply the answer, then re-run Step 2.

- [ ] **Step 4: Review the diff**

Run: `pnpm catalogue:diff "$OLD" src/data/catalogue.json`
Expected: a line of the form `N added, N removed, N repriced`, followed by one line per changed item. Keep this output for the commit body.

- [ ] **Step 5: Verify**

Run: `pnpm catalogue:check && pnpm verify && pnpm build`
Expected: PASS.

- [ ] **Step 6: Commit**, putting the Step 4 output in the body:

```bash
git add "pricelists/Uniqbe Reseller Quotation 20260922.xlsx" src/data/catalogue.json
git commit -m "chore(catalogue): regenerate from the 22 Sep 2026 price list

<catalogue:diff output from Step 4>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: feat: `/compare` UK vs AU (T-29)

**Files:**
- Create: `src/lib/compare.ts`, `src/components/compare/CompareShell.tsx`, `src/app/compare/page.tsx`
- Modify: `src/components/simulator/SimulatorShell.tsx`
- Test: `tests/lib/compare.test.ts`

**Interfaces:**
- Consumes:
  - `calculate`
  - `DEFAULT_SCENARIO` (`src/lib/url-state.ts`)
  - `deriveDutyPctDefault` and `deriveReferralFeeDefault` (`src/lib/scenario-defaults.ts`)
  - `isValidDecimalString` (`src/lib/decimal-validation.ts`)
  - `ThresholdBanner` (Task 1)
  - `FxBadge`, `DisclaimerBar`, `ProductPicker`, `VerdictCard`, `BreakdownTable`
- Produces (in `src/lib/compare.ts`):
  - `compareParsers` (`p`, `pl`, `sp_uk`, `sp_au`)
  - `fxInputFor(fx: FxSnapshotType, market: Market): FxInput`
  - `buildMarketInput(item: CompareItem, market, platform, sellingPriceLocal, rules): SimulationInput`
  - `compareMarket(item, market, platform, sellingPriceLocal, rules, fx: FxSnapshotType): SimulationResult | null`
  - `COMPARE_CAVEAT`
  - `type CompareItem = Pick<CatalogueItemType, "code" | "usd" | "category">`

- [ ] **Step 1: STOP and get the caveat copy approved.** The spec requires the §7 "not always cheaper" caveat but never gives its wording. Show the human this draft and wait for their approval or edit:

> "Neither market is always cheaper for the same product. Import tax, the A$1,000 GST threshold and each platform's fees change the result, so compare the profit, not the selling price."

- [ ] **Step 2: Write the failing test** in `tests/lib/compare.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MarketRules, type FxSnapshotType } from "../../src/lib/schemas";
import rulesRaw from "../../src/data/market-rules.json";
import {
  buildMarketInput,
  compareMarket,
  fxInputFor,
  type CompareItem,
} from "../../src/lib/compare";
import { deriveDutyPctDefault, deriveReferralFeeDefault } from "../../src/lib/scenario-defaults";

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

describe("fxInputFor", () => {
  it("picks the market's rate and carries asOf/degraded through", () => {
    expect(fxInputFor(fx, "UK")).toEqual({ rate: "0.7424", asOf: "2026-08-25", degraded: true });
    expect(fxInputFor(fx, "AU").rate).toBe("1.395");
  });
});

describe("buildMarketInput", () => {
  it("derives duty and referral defaults per market, not shared across them", () => {
    const uk = buildMarketInput(item, "UK", "amazon", "500.00", rules);
    const au = buildMarketInput(item, "AU", "amazon", "900.00", rules);
    expect(uk.dutyPct).toBe(deriveDutyPctDefault(rules, "UK", "mobile-phone"));
    expect(au.referralFeePct).toBe(deriveReferralFeeDefault(rules, "AU", "amazon", "mobile-phone"));
    expect(uk.market).toBe("UK");
    expect(au.market).toBe("AU");
    expect(uk.usd).toBe(400);
    expect(au.sellingPriceLocal).toBe("900.00");
  });
});

describe("compareMarket", () => {
  it("returns a result in the market's currency for a valid price", () => {
    const uk = compareMarket(item, "UK", "amazon", "500.00", rules, fx);
    const au = compareMarket(item, "AU", "amazon", "900.00", rules, fx);
    expect(uk?.currency).toBe("GBP");
    expect(uk?.auAboveThreshold).toBeNull();
    expect(au?.currency).toBe("AUD");
    expect(typeof au?.auAboveThreshold).toBe("boolean");
  });

  it.each(["", "0", "-5", "abc", "1,000"])("returns null for price %j", (price) => {
    expect(compareMarket(item, "UK", "amazon", price, rules, fx)).toBeNull();
  });
});
```

Run: `pnpm vitest run tests/lib/compare.test.ts`
Expected: FAIL with "Failed to resolve import".

- [ ] **Step 3: Implement `src/lib/compare.ts`.** Set `COMPARE_CAVEAT` to the exact text approved in Step 1. Never commit the placeholder below.

```ts
import { parseAsString, parseAsStringEnum } from "nuqs";
import { calculate } from "../engine";
import type { FxInput, Market, Platform, SimulationInput, SimulationResult } from "../engine/types";
import type { CatalogueItemType, FxSnapshotType, MarketRulesType } from "./schemas";
import { DEFAULT_SCENARIO } from "./url-state";
import { deriveDutyPctDefault, deriveReferralFeeDefault } from "./scenario-defaults";
import { isValidDecimalString } from "./decimal-validation";

export type CompareItem = Pick<CatalogueItemType, "code" | "usd" | "category">;

// Spec §9.4: /compare?p=OP00573&sp_uk=599.99&sp_au=999.99
export const compareParsers = {
  p: parseAsString.withDefault(""),
  pl: parseAsStringEnum(["amazon", "ebay", "shopify", "other"] as const).withDefault("amazon"),
  sp_uk: parseAsString.withDefault(""),
  sp_au: parseAsString.withDefault(""),
};

export const COMPARE_CAVEAT = "<human-approved text from Step 1>";

export function fxInputFor(fx: FxSnapshotType, market: Market): FxInput {
  const rate = market === "UK" ? fx.rates.GBP : fx.rates.AUD;
  return { rate: String(rate), asOf: fx.asOf, degraded: fx.degraded };
}

export function buildMarketInput(
  item: CompareItem,
  market: Market,
  platform: Platform,
  sellingPriceLocal: string,
  rules: MarketRulesType,
): SimulationInput {
  return {
    ...DEFAULT_SCENARIO,
    market,
    platform,
    productCode: item.code,
    usd: item.usd,
    category: item.category,
    sellingPriceLocal,
    dutyPct: deriveDutyPctDefault(rules, market, item.category),
    referralFeePct: deriveReferralFeeDefault(rules, market, platform, item.category),
  };
}

export function compareMarket(
  item: CompareItem,
  market: Market,
  platform: Platform,
  sellingPriceLocal: string,
  rules: MarketRulesType,
  fx: FxSnapshotType,
): SimulationResult | null {
  if (!isValidDecimalString(sellingPriceLocal) || !(Number(sellingPriceLocal) > 0)) return null;
  return calculate(
    buildMarketInput(item, market, platform, sellingPriceLocal, rules),
    fxInputFor(fx, market),
    rules,
  );
}
```

Run: `pnpm vitest run tests/lib/compare.test.ts`
Expected: PASS.

- [ ] **Step 4: Create `src/components/compare/CompareShell.tsx`**

```tsx
"use client";

import { useQueryStates } from "nuqs";
import type { CatalogueType, FxSnapshotType, MarketRulesType } from "../../lib/schemas";
import type { Market } from "../../engine/types";
import { COMPARE_CAVEAT, compareMarket, compareParsers } from "../../lib/compare";
import { FxBadge } from "../simulator/FxBadge";
import { DisclaimerBar } from "../simulator/DisclaimerBar";
import { ProductPicker } from "../simulator/ProductPicker";
import { VerdictCard } from "../simulator/VerdictCard";
import { BreakdownTable } from "../simulator/BreakdownTable";
import { ThresholdBanner } from "../simulator/ThresholdBanner";

interface CompareShellProps {
  catalogue: CatalogueType;
  rules: MarketRulesType;
  fx: FxSnapshotType;
}

const COLUMNS: {
  market: Market;
  label: string;
  priceKey: "sp_uk" | "sp_au";
  currency: "GBP" | "AUD";
}[] = [
  { market: "UK", label: "UK", priceKey: "sp_uk", currency: "GBP" },
  { market: "AU", label: "Australia", priceKey: "sp_au", currency: "AUD" },
];

export function CompareShell({ catalogue, rules, fx }: CompareShellProps) {
  const [params, setParams] = useQueryStates(compareParsers);
  const item = catalogue.items.find((i) => i.code === params.p) ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAF9]">
      <header className="border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Compare UK vs Australia</h1>
          <a href={`/?p=${encodeURIComponent(params.p)}`} className="text-sm underline">
            Back to simulator
          </a>
        </div>
        <FxBadge rate={fx.rates.GBP} currency="GBP" asOf={fx.asOf} />
        <FxBadge rate={fx.rates.AUD} currency="AUD" asOf={fx.asOf} />
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 py-6">
        <ProductPicker
          items={catalogue.items}
          selectedCode={params.p}
          onSelect={(code) => setParams({ p: code })}
        />
        <p className="text-sm text-neutral-700" data-testid="compare-caveat">
          {COMPARE_CAVEAT}
        </p>
        {item === null ? (
          <p className="text-neutral-500">Select a product to compare both markets.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {COLUMNS.map((col) => {
              const price = params[col.priceKey];
              const result = compareMarket(item, col.market, params.pl, price, rules, fx);
              const inputId = `price-${col.market.toLowerCase()}`;
              return (
                <section key={col.market} className="flex flex-col gap-3" aria-label={col.label}>
                  <h2 className="font-semibold">{col.label}</h2>
                  <label htmlFor={inputId} className="text-sm font-medium">
                    Selling price ({col.currency})
                  </label>
                  <input
                    id={inputId}
                    type="text"
                    inputMode="decimal"
                    className="block rounded border border-neutral-300 px-3 py-2 font-mono text-sm"
                    value={price}
                    onChange={(e) => setParams({ [col.priceKey]: e.target.value })}
                  />
                  {result === null ? (
                    <p className="text-neutral-500">Enter a selling price.</p>
                  ) : (
                    <>
                      {result.auAboveThreshold !== null && rules.AU.deMinimisLocal !== null && (
                        <ThresholdBanner
                          aboveThreshold={result.auAboveThreshold}
                          thresholdLocal={rules.AU.deMinimisLocal}
                        />
                      )}
                      <VerdictCard
                        verdict={result.verdict}
                        netProfit={result.netProfit}
                        marginPct={result.marginPct}
                        currency={result.currency}
                      />
                      <BreakdownTable
                        lines={result.breakdown}
                        netProfit={result.netProfit}
                        currency={result.currency}
                        hoveredLabel={null}
                        onHoverLabel={() => {}}
                      />
                    </>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>

      <DisclaimerBar />
    </div>
  );
}
```

- [ ] **Step 5: Create `src/app/compare/page.tsx`**

```tsx
import { Catalogue, MarketRules } from "../../lib/schemas";
import catalogueData from "../../data/catalogue.json";
import marketRulesData from "../../data/market-rules.json";
import { readFxSnapshot } from "../../fx/store";
import { CompareShell } from "../../components/compare/CompareShell";

// Live FX (Redis-backed) — must never be statically prerendered. See src/app/page.tsx.
export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const catalogue = Catalogue.parse(catalogueData);
  const rules = MarketRules.parse(marketRulesData);
  const fx = await readFxSnapshot();

  return <CompareShell catalogue={catalogue} rules={rules} fx={fx} />;
}
```

- [ ] **Step 6: Reuse `fxInputFor` and add the compare link in `SimulatorShell.tsx`**
- Import `fxInputFor` from `../../lib/compare`.
- Replace the inline `const fxInput: FxInput = { … }` with `const fxInput = fxInputFor(fx, market);`.
- Remove the `FxInput` type import if it's now unused.
- After `<ProductPicker … />`, add:

```tsx
          {selectedItem && (
            <a
              href={`/compare?p=${encodeURIComponent(selectedItem.code)}&pl=${scenario.platform}`}
              className="text-sm underline"
            >
              Compare UK vs Australia
            </a>
          )}
```

- [ ] **Step 7: Verify**

Run: `pnpm verify && pnpm build`
Expected: PASS.

Then check in `pnpm dev`:
1. Clicking the link goes from `/` to `/compare?p=…`.
2. With both prices entered, both verdicts render and the AU column shows the threshold banner.
3. Both FX badges, the caveat and the disclaimer are all visible.
4. `/compare?p=NOPE` shows the empty state.
5. Reloading keeps both prices.

- [ ] **Step 8: Commit**

```bash
git add src/lib/compare.ts tests/lib/compare.test.ts src/components/compare src/app/compare src/components/simulator/SimulatorShell.tsx
git commit -m "feat: add /compare UK vs AU side-by-side view (T-29)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: test: Playwright E2E + GitHub Actions CI, with a no-Redis fast path (T-31)

**Why the store changes:** with no env vars set, `Redis.fromEnv()` from `@upstash/redis` doesn't throw. It builds a client with an empty URL, and every `get` then goes through the library's retry backoff before `readFxSnapshot` falls back to the seed. On a CI runner with no secrets, that would stall every page render.

**Files:**
- Modify: `src/fx/store.ts`, `tests/fx/store.test.ts`, `package.json`
- Create: `playwright.config.ts`, `e2e/helpers.ts`, `e2e/simulator.spec.ts`, `e2e/compare.spec.ts`, `.github/workflows/ci.yml`

**Interfaces:**
- Consumes these UI names:
  - labels `Product`, `Platform`, `Selling price`, `Selling price (GBP)`, `Selling price (AUD)`
  - the tab `🇦🇺 Australia`
  - `data-testid` values `fx-badge` and `compare-caveat`
  - the disclaimer `role="note"` and the banner `role="status"`
  - the warning text "This exchange rate is more than a few days old."
- Produces:
  - `redisFromEnv(env?): RedisLike | null`
  - `readFxSnapshot(redis: RedisLike | null = redisFromEnv(), now?)`
  - `writeFxSnapshot(raw, redis: RedisLike | null = redisFromEnv())`, which throws on `null`
  - the `pnpm e2e` and `pnpm e2e:install` scripts
  - `firstCatalogueItem()`, `pickFirstProduct(page)` and `expectFxAndDisclaimer(page)` in `e2e/helpers.ts`

- [ ] **Step 1: Write the failing store tests.** Add `redisFromEnv` to the import in `tests/fx/store.test.ts`, then append:

```ts
describe("redisFromEnv", () => {
  it("returns null when URL or token is missing, so reads never wait on retries", () => {
    expect(redisFromEnv({})).toBeNull();
    expect(redisFromEnv({ UPSTASH_REDIS_REST_URL: "https://x.upstash.io" })).toBeNull();
    expect(redisFromEnv({ UPSTASH_REDIS_REST_TOKEN: "t" })).toBeNull();
    expect(redisFromEnv({ UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "" })).toBeNull();
  });

  it("returns a client when both are set (either naming convention)", () => {
    expect(
      redisFromEnv({ UPSTASH_REDIS_REST_URL: "https://x.upstash.io", UPSTASH_REDIS_REST_TOKEN: "t" }),
    ).not.toBeNull();
    expect(
      redisFromEnv({ KV_REST_API_URL: "https://x.upstash.io", KV_REST_API_TOKEN: "t" }),
    ).not.toBeNull();
  });
});

describe("readFxSnapshot / writeFxSnapshot with no Redis configured", () => {
  it("read serves the degraded seed immediately", async () => {
    const snapshot = await readFxSnapshot(null, new Date("2026-08-25T12:00:00.000Z"));
    expect(snapshot.provider).toBe("seed");
    expect(snapshot.degraded).toBe(true);
  });

  it("write throws so the cron route reports the failure", async () => {
    await expect(writeFxSnapshot(rawFrankfurter, null)).rejects.toThrow(/not configured/);
  });
});
```

Run: `pnpm vitest run tests/fx/store.test.ts`
Expected: FAIL, because `redisFromEnv` isn't exported and the write test fails.

- [ ] **Step 2: Implement.** In `src/fx/store.ts`, replace `defaultRedisClient`, `readFxSnapshot` and `writeFxSnapshot`:

```ts
// Returns null when Redis isn't configured, so reads fall straight to the seed
// instead of waiting out @upstash/redis's retry backoff on an empty URL
// (spec §11.4: "Kill Redis → app serves seed rates … no crash").
export function redisFromEnv(
  env: Record<string, string | undefined> = process.env,
): RedisLike | null {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function readFxSnapshot(
  redis: RedisLike | null = redisFromEnv(),
  now: Date = new Date(),
): Promise<FxSnapshotType> {
  if (redis === null) return seedSnapshot(now);
  try {
    const stored = await redis.get(FX_REDIS_KEY);
    if (stored === null || stored === undefined) {
      return seedSnapshot(now);
    }
    return toFxSnapshot(FxRawSnapshot.parse(stored), now);
  } catch {
    return seedSnapshot(now);
  }
}

export async function writeFxSnapshot(
  raw: FxRawSnapshotType,
  redis: RedisLike | null = redisFromEnv(),
): Promise<void> {
  if (redis === null) throw new Error("Redis is not configured (UPSTASH_REDIS_REST_URL/TOKEN)");
  await redis.set(FX_REDIS_KEY, raw);
}
```

Run: `pnpm vitest run tests/fx tests/app`
Expected: PASS. The route tests mock the store, so they're unaffected.

- [ ] **Step 3: Install Playwright**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

Add two scripts to `package.json`: `"e2e": "playwright test"` and `"e2e:install": "playwright install --with-deps chromium"`.

- [ ] **Step 4: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    // Chromium-based phone profile keeps CI to one browser download; portrait by default.
    { name: "mobile-portrait", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
```

- [ ] **Step 5: Create `e2e/helpers.ts`.** It reads the catalogue at runtime and never hardcodes a product (AGENTS 3a).

```ts
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
  await page.getByRole("button", { name: `${item.brand} ${item.name}` }).first().click();
  return item;
}

export async function expectFxAndDisclaimer(page: Page): Promise<void> {
  await expect(page.getByTestId("fx-badge").first()).toBeVisible();
  await expect(page.getByRole("note")).toContainText("not by this tool");
}
```

- [ ] **Step 6: Create `e2e/simulator.spec.ts`**

```ts
import { expect, test } from "@playwright/test";
import { expectFxAndDisclaimer, pickFirstProduct } from "./helpers";

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
  await page.reload();
  await expect(page.getByLabel("Selling price")).toHaveValue("9999.00");
  await expect(page.getByText(VERDICT)).toBeVisible();
  await page.goBack();
  await expect(page).not.toHaveURL(/sp=9999\.00/);
});

test("no Redis in CI: seed rates render with the degraded warning", async ({ page }) => {
  test.skip(!process.env.CI, "local runs may have real Redis credentials in .env.local");
  await page.goto("/");
  await pickFirstProduct(page);
  await page.getByLabel("Selling price").fill("9999.00");
  await expect(page.getByText("This exchange rate is more than a few days old.")).toBeVisible();
});
```

- [ ] **Step 7: Create `e2e/compare.spec.ts`.** Each `<section aria-label>` from Task 3 is a `region` landmark, so tests can target it by role.

```ts
import { expect, test } from "@playwright/test";
import { expectFxAndDisclaimer, firstCatalogueItem } from "./helpers";

test("/compare renders both markets from one product", async ({ page }) => {
  const item = firstCatalogueItem();
  await page.goto(`/compare?p=${item.code}&sp_uk=9999.00&sp_au=19999.00`);
  await expect(page.getByTestId("compare-caveat")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "UK" }).getByText(/PROFITABLE|MARGINAL|LOSS-MAKING/),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Australia" }).getByRole("status")).toBeVisible();
  await expect(page.getByTestId("fx-badge")).toHaveCount(2);
  await expectFxAndDisclaimer(page);
});

test("/compare with an unknown product code shows the empty state, not a crash", async ({ page }) => {
  await page.goto("/compare?p=DOES-NOT-EXIST&sp_uk=abc");
  await expect(page.getByText("Select a product to compare both markets.")).toBeVisible();
  await expectFxAndDisclaimer(page);
});
```

- [ ] **Step 8: Run the suite locally**

Run: `pnpm e2e`
Expected: everything passes in both projects. The degraded-warning test is skipped locally, which is correct.

If a locator misses, fix the locator to match the real accessible name. Never change UI copy to fit a test.

- [ ] **Step 9: Create `.github/workflows/ci.yml`.** Two notes on this workflow:
- `pnpm e2e` builds through Playwright's `webServer`.
- No Redis secrets are configured, so CI deliberately exercises the seed/degraded path.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.33.2
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm catalogue:check
      - run: pnpm e2e:install
      - run: pnpm e2e
        env:
          CI: "true"
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 10: Verify**

Run: `pnpm prettier --write playwright.config.ts e2e .github && pnpm verify && pnpm build && pnpm e2e`
Expected: PASS. The `pnpm test` output lists no `e2e/` file, because Vitest's `include` is `tests/**/*.test.ts`.

- [ ] **Step 11: Commit**

```bash
git add src/fx/store.ts tests/fx/store.test.ts playwright.config.ts e2e .github package.json pnpm-lock.yaml
git commit -m "test: add Playwright E2E, GitHub Actions CI, and a no-Redis FX fast path (T-31)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 12: Ask the human before pushing.** Run `git remote -v` and report the result. Push a branch only after the human approves, then confirm that CI goes green.

---

### Task 5: test: full-catalogue sweep (T-34 + the T-27 sweep clause)

**Files:**
- Create: `tests/scripts/catalogue-sweep.test.ts`

**Interfaces:**
- Consumes:
  - `calculate` and `suggestPrice`
  - `buildMarketInput` and `fxInputFor` (Task 3)
  - the `Catalogue`, `MarketRules` and `FxRawSnapshot` schemas
  - `toFxSnapshot`
  - `src/data/fx-seed.json`

- [ ] **Step 1: Write the sweep.** `calculate()` runs `assertBreakdownSums` internally and throws on a mismatch, so the `try` block covers the "breakdown sums" check.

```ts
import { describe, expect, it } from "vitest";
import catalogueRaw from "../../src/data/catalogue.json";
import rulesRaw from "../../src/data/market-rules.json";
import fxSeedRaw from "../../src/data/fx-seed.json";
import { Catalogue, FxRawSnapshot, MarketRules } from "../../src/lib/schemas";
import { toFxSnapshot } from "../../src/fx/store";
import { calculate, suggestPrice } from "../../src/engine";
import { buildMarketInput, fxInputFor } from "../../src/lib/compare";
import type { Market, Platform, SimulationInput } from "../../src/engine/types";

const catalogue = Catalogue.parse(catalogueRaw);
const rules = MarketRules.parse(rulesRaw);
const fx = toFxSnapshot(FxRawSnapshot.parse(fxSeedRaw), new Date("2026-08-25T12:00:00.000Z"));

const MARKETS: Market[] = ["UK", "AU"];
const PLATFORMS: Platform[] = ["amazon", "ebay", "shopify", "other"];
const FREIGHTS = ["0.00", "20.00", "50.00"];
const REGISTERED = [false, true];
const TARGET_MARGIN_PCT = 20;
const FALLBACK_PRICE_MULTIPLE = 3;
const BAD_VALUE = /NaN|Infinity|"-0\.00"/;

function withoutPrice(input: SimulationInput): Omit<SimulationInput, "sellingPriceLocal"> {
  const { sellingPriceLocal: _omit, ...rest } = input;
  return rest;
}

// Iterates whatever the current catalogue contains — never asserts a count (AGENTS 3b).
describe("full-catalogue sweep (T-34)", () => {
  it(
    "every product x market x platform x freight x registration calculates cleanly",
    () => {
      const failures: string[] = [];
      for (const item of catalogue.items) {
        for (const market of MARKETS) {
          const fxInput = fxInputFor(fx, market);
          for (const platform of PLATFORMS) {
            for (const freight of FREIGHTS) {
              for (const taxRegistered of REGISTERED) {
                const where = `${item.code}/${market}/${platform}/freight=${freight}/reg=${taxRegistered}`;
                try {
                  const base: SimulationInput = {
                    ...buildMarketInput(item, market, platform, "1.00", rules),
                    inboundShippingLocal: freight,
                    taxRegistered,
                  };
                  const suggested = suggestPrice(withoutPrice(base), fxInput, rules, TARGET_MARGIN_PCT);
                  const price =
                    suggested?.price ??
                    (item.usd * Number(fxInput.rate) * FALLBACK_PRICE_MULTIPLE).toFixed(2);
                  const result = calculate({ ...base, sellingPriceLocal: price }, fxInput, rules);

                  if (BAD_VALUE.test(JSON.stringify(result))) failures.push(`${where}: bad value`);
                  if (market === "AU") {
                    if (result.auAboveThreshold === null) {
                      failures.push(`${where}: AU result has no threshold branch`);
                    }
                    const below = result.warnings.some((w) => w.code === "AU_BELOW_THRESHOLD");
                    if (below !== (result.auAboveThreshold === false)) {
                      failures.push(`${where}: threshold warning disagrees with branch`);
                    }
                  } else if (result.auAboveThreshold !== null) {
                    failures.push(`${where}: UK result carries an AU threshold branch`);
                  }
                } catch (err) {
                  failures.push(`${where}: threw ${(err as Error).message}`);
                }
              }
            }
          }
        }
      }
      expect(failures).toEqual([]);
    },
    180_000,
  );
});
```

- [ ] **Step 2: Run it**

Run: `pnpm vitest run tests/scripts/catalogue-sweep.test.ts`
Expected: PASS, with `failures` equal to `[]`.

If it fails, that's a real engine bug:
- Debug the first listed failure with superpowers:systematic-debugging.
- Never weaken the assertions and never touch the goldens.

If ESLint rejects `_omit`, check `eslint.config.js` for a `varsIgnorePattern`. If there isn't one, rewrite `withoutPrice` as an explicit object literal.

- [ ] **Step 3: Verify and commit**

Run: `pnpm verify && pnpm build`
Expected: PASS.

```bash
git add tests/scripts/catalogue-sweep.test.ts
git commit -m "test: sweep the full catalogue across markets, platforms, freight, registration (T-34)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: test: adaptability drill (T-35)

**Files:**
- Modify: `scripts/build-catalogue.ts`
- Create: `tests/scripts/adaptability-drill.test.ts`

**Interfaces:**
- Consumes: `diffCatalogues` (`scripts/catalogue-diff.ts`) and `exceljs`.
- Produces, from `scripts/build-catalogue.ts`:
  - `export type CategoryMap`
  - `export const CATEGORY_MAP`
  - `mapCategory(raw, categoryMap = CATEGORY_MAP)`
  - `buildCatalogue(rows, sourceFile, categoryMap = CATEGORY_MAP)`
  - `export async function readWorkbook(path)`

The CLI's behaviour doesn't change.

- [ ] **Step 1: Write the failing drill** in `tests/scripts/adaptability-drill.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import {
  CATEGORY_MAP,
  buildCatalogue,
  readWorkbook,
  type RawRow,
} from "../../scripts/build-catalogue";
import { diffCatalogues } from "../../scripts/catalogue-diff";

const NEW_CATEGORY_RAW = "Drones";
const REPRICE_DELTA_USD = 10;

async function writePriceList(path: string, rows: RawRow[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Pricelist");
  sheet.addRow(["ProductCode", "Brand", "Product Name", "Category", "USD", "HKD"]);
  for (const r of rows) sheet.addRow([r.productCode, r.brand, r.name, r.categoryRaw, r.usd, r.hkd]);
  await wb.xlsx.writeFile(path);
}

function latestPriceList(): string {
  const newest = readdirSync("pricelists").filter((f) => f.endsWith(".xlsx")).sort().at(-1);
  if (!newest) throw new Error("no price list in ./pricelists");
  return join("pricelists", newest);
}

describe("adaptability drill (T-35)", () => {
  it("fails on a new category with the R5 message, then diffs exactly the seeded changes", async () => {
    const { rows, sourceFile } = await readWorkbook(latestPriceList());
    const baseline = buildCatalogue(rows, sourceFile);

    // Seed: 2 removed, 5 repriced, 3 added (one in a brand-new category).
    const removed = rows.slice(0, 2).map((r) => r.productCode);
    const repriced = rows.slice(2, 7).map((r) => r.productCode);
    const template = rows[7];
    if (!template) throw new Error("price list too small for the drill");
    const added: RawRow[] = [
      { ...template, productCode: "DRILL0001", name: "Drill Product One" },
      { ...template, productCode: "DRILL0002", name: "Drill Product Two" },
      { ...template, productCode: "DRILL0003", name: "Drill Drone", categoryRaw: NEW_CATEGORY_RAW },
    ];
    const mutatedRows: RawRow[] = [
      ...rows
        .filter((r) => !removed.includes(r.productCode))
        .map((r) =>
          repriced.includes(r.productCode) ? { ...r, usd: r.usd + REPRICE_DELTA_USD } : r,
        ),
      ...added,
    ];

    const dir = mkdtempSync(join(tmpdir(), "drill-"));
    const mutatedPath = join(dir, "Uniqbe Reseller Quotation 20991231.xlsx");
    await writePriceList(mutatedPath, mutatedRows);
    const reread = await readWorkbook(mutatedPath);

    // 1. The build refuses the unmapped category with the R5 fix instruction.
    expect(() => buildCatalogue(reread.rows, reread.sourceFile)).toThrow(
      /Unmapped category "Drones"[\s\S]*Add to CATEGORY_MAP/,
    );

    // 2. After mapping it, the diff reports exactly the seeded changes.
    const mapped = { ...CATEGORY_MAP, drones: { slug: "camera" as const, label: "Camera" } };
    const next = buildCatalogue(reread.rows, reread.sourceFile, mapped);
    const diff = diffCatalogues(baseline.items, next.items);

    expect(diff.added.map((i) => i.code).sort()).toEqual(["DRILL0001", "DRILL0002", "DRILL0003"]);
    expect(diff.removed.map((i) => i.code).sort()).toEqual([...removed].sort());
    expect(diff.repriced.map((r) => r.code).sort()).toEqual([...repriced].sort());
    for (const r of diff.repriced) expect(r.newUsd - r.oldUsd).toBe(REPRICE_DELTA_USD);
  }, 60_000);
});
```

Run: `pnpm vitest run tests/scripts/adaptability-drill.test.ts`
Expected: FAIL, because nothing is exported yet and the third argument is ignored.

- [ ] **Step 2: Make the builder testable.** In `scripts/build-catalogue.ts`:
- Add `export type CategoryMap = Record<string, { slug: CategorySlugType; label: string }>;`.
- Change `const CATEGORY_MAP: Record<…> = {` to `export const CATEGORY_MAP: CategoryMap = {`, keeping the same entries.
- Change the signature to `mapCategory(raw: string, categoryMap: CategoryMap = CATEGORY_MAP)` and look up `categoryMap[key]` inside it. The throw message stays the same.
- Change `normalizeRow(raw: RawRow)` to `normalizeRow(raw: RawRow, categoryMap: CategoryMap)`, and have it call `mapCategory(raw.categoryRaw, categoryMap)`.
- Change to `buildCatalogue(rows: RawRow[], sourceFile: string, categoryMap: CategoryMap = CATEGORY_MAP)`, and have it call `normalizeRow(raw, categoryMap)`.
- Change `async function readWorkbook` to `export async function readWorkbook`.

- [ ] **Step 3: Guard the CLI entry point.** Today the file ends with an unconditional `main().catch(…)`. If the drill imported the file as-is, it would:
- run a real build
- **write `src/data/catalogue.json`**
- call `process.exit` inside Vitest

Replace that tail with the same guard `scripts/catalogue-diff.ts` uses, and add `import { pathToFileURL } from "node:url";`:

```ts
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run the script tests**

Run: `pnpm vitest run tests/scripts && git status --short src/data/catalogue.json`
Expected: PASS, and `git status` prints nothing (the catalogue wasn't rewritten). The existing CLI tests pass, which proves `pnpm catalogue:build` and `pnpm catalogue:check` still run through `tsx`.

- [ ] **Step 5: Verify and commit**

Run: `pnpm verify && pnpm build && pnpm catalogue:check`
Expected: PASS.

```bash
git add scripts/build-catalogue.ts tests/scripts/adaptability-drill.test.ts
git commit -m "test: add the catalogue adaptability drill (T-35)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: fix: accessibility + mobile pass (T-33)

**Files:**
- Create: `e2e/a11y.spec.ts`
- Modify: whichever `src/components/**` files the checks flag
- Modify: `package.json`

**Interfaces:**
- Consumes: `firstCatalogueItem` and `pickFirstProduct` (Task 4).

- [ ] **Step 1: Install axe**

Run: `pnpm add -D @axe-core/playwright`

- [ ] **Step 2: Write `e2e/a11y.spec.ts`**

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { firstCatalogueItem, pickFirstProduct } from "./helpers";

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectNoViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}

async function tabUntil(page: Page, predicate: string, key = "Tab", maxPresses = 40): Promise<void> {
  for (let i = 0; i < maxPresses; i++) {
    await page.keyboard.press(key);
    if (await page.evaluate(predicate)) return;
  }
  throw new Error(`focus never reached: ${predicate}`);
}

test("axe: / with a UK result on screen", async ({ page }) => {
  await page.goto("/");
  await pickFirstProduct(page);
  await page.getByLabel("Selling price").fill("9999.00");
  await expectNoViolations(page);
});

test("axe: AU market with the threshold banner", async ({ page }) => {
  const item = firstCatalogueItem();
  await page.goto(`/?m=AU&p=${item.code}&sp=19999.00`);
  await expect(page.getByRole("status")).toBeVisible();
  await expectNoViolations(page);
});

test("axe: /compare", async ({ page }) => {
  const item = firstCatalogueItem();
  await page.goto(`/compare?p=${item.code}&sp_uk=9999.00&sp_au=19999.00`);
  await expectNoViolations(page);
});

test("keyboard only: pick -> price -> verdict -> switch market", async ({ page }) => {
  const item = firstCatalogueItem();
  await page.goto("/");
  await tabUntil(page, `document.activeElement?.id === "product-search"`);
  await page.keyboard.type(item.name);
  await tabUntil(
    page,
    `document.activeElement?.textContent?.includes(${JSON.stringify(item.name)}) ?? false`,
  );
  await page.keyboard.press("Enter");
  await tabUntil(page, `document.activeElement?.id === "selling-price"`);
  await page.keyboard.type("9999.00");
  await expect(page.getByText(/PROFITABLE|MARGINAL|LOSS-MAKING/)).toBeVisible();
  // Market tabs sit before the picker in DOM order, so walk focus backwards to reach them.
  await tabUntil(
    page,
    `document.activeElement?.getAttribute("role") === "tab" && (document.activeElement?.textContent?.includes("Australia") ?? false)`,
    "Shift+Tab",
  );
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/m=AU/);
});
```

- [ ] **Step 3: Run it and collect the violations**

Run: `pnpm e2e e2e/a11y.spec.ts`
Expected: it may FAIL. If so, the reported violations are the fix list for Step 4. Likely candidates:
- `text-neutral-500` on `#FAFAF9` (contrast)
- a `tablist` with no `tabpanel` or `aria-controls`
- emoji flags in the tab labels
- the picker results not being announced

- [ ] **Step 4: Fix each violation in its source component.** Make the smallest change that fixes it: a darker token, an ARIA attribute or a visible label. Ask before changing any partner-facing copy. Re-run until green.

- [ ] **Step 5: Mobile check**
- `pnpm e2e` already runs every spec under `mobile-portrait`.
- Also open `pnpm dev` with the device toolbar at 375×667 and confirm:
  - there's no horizontal scroll on `/` or `/compare`
  - the sticky disclaimer never covers the last input

- [ ] **Step 6: Verify and commit**

Run: `pnpm verify && pnpm build && pnpm e2e`
Expected: PASS.

```bash
git add e2e/a11y.spec.ts src/components package.json pnpm-lock.yaml
git commit -m "fix: resolve WCAG AA violations and add axe + keyboard-only E2E (T-33)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

If the fixes are large and unrelated to each other, split them into one `fix:` commit per component.

---

### Task 8: Final whole-branch review

- [ ] **Step 1:** Run superpowers:requesting-code-review over the commits from Task 0 to Task 7. Resolve every Critical and Important finding.
- [ ] **Step 2:** Run `pnpm verify && pnpm build && pnpm e2e && pnpm catalogue:check`. Expected: all PASS.
- [ ] **Step 3:** Confirm that `git diff <commit before Task 0>..HEAD -- data/golden-fixtures.json` is empty.
- [ ] **Step 4:** Browser smoke test in `pnpm dev`:
  - `/` UK flow: pick, price, verdict and waterfall hover.
  - AU: raise freight on a near-threshold product. The banner must **not** flip, because the comparand is goods-only.
  - `/compare?p=<code>&sp_uk=…&sp_au=…`
  - The FX badge and the disclaimer appear everywhere.

---

## Out of scope: Phase 6b (a separate plan, once accounts exist)

- **T-30 PostHog:**
  - EU cloud
  - `person_profiles: "identified_only"`
  - no session recording
  - events per §13, sending bands only and never partner prices or margins
- **T-32 Vercel production:**
  - region `lhr1`
  - Upstash through the Vercel Marketplace
  - `CRON_SECRET` set
  - preview password on
  - the cron verified over 3 consecutive days
  - revisit the Node version: Vercel defaults to 24 LTS, but the spec pins 22.x
- **Launch checks:** run E2E against the preview URL, and check on a real iPhone SE and on a mid-range Android.
- **Phase 0 launch blockers (non-code, still open):**
  - T-00: customs declared value
  - T-02: live fee rates (`_meta.lastVerified` is still `null`)
  - T-03: tax review
  - T-04: verdict threshold
  - customs-broker confirmation of the goods-only comparand (§15 #2)

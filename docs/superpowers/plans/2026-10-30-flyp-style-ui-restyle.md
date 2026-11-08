# Flyp-Style Calculator UI Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Uniqbe Price Simulator (`src/app/page.tsx`, skipping any marketing home) into a Flyp "Seller Fees Calculator"-style single-card layout, per the user's screenshot.

**Architecture:** Presentation-only change in `src/components/simulator/`. `SimulatorShell` keeps its state (`useScenario`) and engine call; the layout becomes header, subtitle, one white card (product picker, input grid, result block, reset button, footnote), then the existing breakdown beneath. No engine, data, or URL-state-key changes.

**Tech Stack:** Next.js 15.5, React 19, Tailwind 4 (utilities only, no config), nuqs, Vitest (node only, no jsdom), Playwright + axe, pnpm.

**Spec:** user screenshot (Flyp AU eBay Fee Calculator) + https://www.ebayfeescalculator.com/ (home skipped). No written spec exists; this plan is the spec.

## Global Constraints

- AGENTS.md invariants 1-6 apply. `src/engine/**` untouched. Money stays decimal strings; no `number` math on money in new code.
- FX badge (`FxBadge`) and `DisclaimerBar` stay rendered on every screen showing converted prices (invariant 6).
- No hardcoded catalogue facts (3a): the subtitle date comes from `catalogue.priceListDate`; never assert counts in tests (3b).
- Keep existing DOM ids (`#platform`, `#selling-price`, `#shipping`, `#packaging`, `#ad-spend`, `#duty-pct`, `#referral-fee-pct`) and `data-testid`s (`fx-badge`, `verdict-slot`) unless a task says otherwise and updates the e2e specs in the same commit.
- Controls keep a 44px minimum target (`control-classes.ts`); keep the sticky/scroll-padding offsets in `globals.css`.
- No new dependencies (font via `next/font/google`, already part of Next).
- Prettier: double quotes, semicolons, trailing commas, printWidth 100. One task per commit, Conventional Commits, Co-Authored-By trailer. Stop and ask before push/PR/merge.
- Done = `pnpm verify` + `pnpm build` + `pnpm e2e --workers=1` all green.

## Out of Scope (needs a human spec decision first)

Flyp's "No. of orders", "Oversea sales", "Promoted ad rate %", and "Item category" select have no engine counterpart (ad spend is absolute and Shopify-only; category derives from the selected product). Not added. Flyp "Store?" maps to the existing `taxRegistered` checkbox.

## Review Focus

- Empty/zero price: result block shows "—", never `NaN%` or `-Infinity%` (the reference site's bug).
- Market switch (UK↔AU) and Reset: inputs clear to `DEFAULT_SCENARIO`, no stale result.
- Pre-hydration typed input survives (`useAdoptTypedValues`, `e2e/prehydration.spec.ts`).
- 320px-wide viewport: the 4-column grid collapses to one column with no horizontal scroll, sticky disclaimer not covering the Reset button.
- Loss-making result: net profit shows a negative value and remains legible (not colour-only; keep verdict text).

---

### Task 0: Save plan into repo

**Files:** Create `docs/superpowers/plans/2026-10-30-flyp-style-ui-restyle.md` (copy of this plan).

- [ ] **Step 1:** Copy the plan, `git add` it, commit `docs: plan flyp-style calculator UI restyle`.

### Task 1: Page frame, font, header and subtitle

**Files:**
- Modify: `src/app/layout.tsx` (Poppins via `next/font/google`, applied to `<body>`), `src/components/simulator/SimulatorShell.tsx` (header block only)
- Create: `src/components/simulator/PageHeader.tsx`
- Test: `e2e/simulator.spec.ts`

**Interfaces:**
- Produces: `PageHeader({ market, onMarketChange, priceListDate, fxBadge }: { market: Market; onMarketChange: (m: Market) => void; priceListDate: string; fxBadge: ReactNode })`. Renders centered `<h1>` "Uniqbe Price Simulator", `MarketTabs` row, and subtitle "Up-to-date as of {formatted priceListDate}". Compare link lives in this header.

- [ ] **Step 1:** Add e2e test `header shows title, market tabs, compare link and price-list date` asserting the h1, `role=tablist`, a link to `/compare`, and `getByText(/Up-to-date as of/)` visible. Run `pnpm e2e --workers=1 -g "header shows"`; expect FAIL.
- [ ] **Step 2:** Implement `PageHeader` and the font; replace the old header in `SimulatorShell`. Format the date with the existing date helper in `src/lib/fx-format.ts` if it exposes one, otherwise `Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" })`.
- [ ] **Step 3:** Run the test, expect PASS. Run `pnpm e2e --workers=1 e2e/a11y.spec.ts`, expect PASS.
- [ ] **Step 4:** Commit `feat(ui): flyp-style page header`.

### Task 2: Single-card input grid

**Files:**
- Modify: `src/components/simulator/InputPanel.tsx`, `src/components/simulator/control-classes.ts`, `src/components/simulator/SimulatorShell.tsx`
- Create: `src/components/simulator/CalculatorCard.tsx`
- Test: `e2e/mobile-layout.spec.ts`, `e2e/simulator.spec.ts`

**Interfaces:**
- Produces: `CalculatorCard({ children }: { children: ReactNode })`, a white rounded `shadow-sm` card with `data-testid="calculator-card"`, `max-w-3xl mx-auto`, padding matching the screenshot.
- `InputPanel` props unchanged. Layout becomes a `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` grid with centered labels above each input; platform select and tax-registered checkbox take the second row; AU-only toggles stay conditional. `ProductPicker` renders at the top of the card, full width.

- [ ] **Step 1:** Add e2e tests in `mobile-layout.spec.ts`: `card grid has no horizontal scroll at 320px` (`scrollWidth <= clientWidth`) and `inputs live inside the calculator card` (`#selling-price` and `#platform` inside `[data-testid="calculator-card"]`). Expect FAIL until the card exists.
- [ ] **Step 2:** Implement `CalculatorCard` and re-grid `InputPanel`, keeping all ids and labels.
- [ ] **Step 3:** Run `pnpm e2e --workers=1 e2e/simulator.spec.ts e2e/mobile-layout.spec.ts e2e/prehydration.spec.ts e2e/focus.spec.ts`; fix selectors broken by layout only.
- [ ] **Step 4:** Commit `feat(ui): single-card input grid`.

### Task 3: Result block and Reset button

**Files:**
- Create: `src/lib/result-headline.ts`, `src/components/simulator/ResultBlock.tsx`, `tests/lib/result-headline.test.ts`
- Modify: `src/components/simulator/SimulatorShell.tsx` (replace `VerdictCard` slot with `ResultBlock` inside the card; keep `data-testid="verdict-slot"`)
- Test: `e2e/simulator.spec.ts`

**Interfaces:**
- Produces: `toResultHeadline(result: SimulationResult | null): ResultHeadline | null` where `ResultHeadline = { platformFees: string; feeBreakdownLine: string; netProfit: string; marginPct: string; verdict: SimulationResult["verdict"] }`. Money fields are decimal strings passed through from `platformFeeSubtotal`, `netProfit`, `marginPct`; `feeBreakdownLine` joins `platformFees` entries as "Label amount + Label amount" using the existing money formatter in `src/lib/`. Returns null for a null result.
- `ResultBlock({ headline, currency, onReset }: { headline: ResultHeadline | null; currency: "GBP" | "AUD"; onReset: () => void })`: platform fees in red, "Net profit" (green if ≥ 0, red otherwise, with verdict text), "Profit margin", black "Reset calculator" button (`bg-black text-white`, `BUTTON_TARGET_CLASS`), and line "In GBP." / "In AUD.". Null headline renders "—" for each value; the button stays enabled.
- `onReset` sets the scenario to `DEFAULT_SCENARIO` via `useScenario`'s setter, preserving `market`.

- [ ] **Step 1:** Write vitest tests in `tests/lib/result-headline.test.ts`: `returns null for a null result`; `passes platformFeeSubtotal netProfit and marginPct through as decimal strings` (result from `calculate` on a fixture input; assert equality with result fields, not specific amounts); `feeBreakdownLine lists every platformFees key`.
- [ ] **Step 2:** Run `pnpm vitest run tests/lib/result-headline.test.ts`; expect FAIL (module missing).
- [ ] **Step 3:** Implement `toResultHeadline` (pure, no `number` money math). Run vitest; expect PASS.
- [ ] **Step 4:** Add e2e tests: `empty price shows dashes not NaN` (page text never matches `/NaN|Infinity/`), `reset clears inputs and keeps market` (fill `#selling-price`, switch to AU, click "Reset calculator", expect `#selling-price` empty and AU tab selected), `loss-making result shows negative profit with verdict text`. Expect FAIL.
- [ ] **Step 5:** Implement `ResultBlock`, wire into `SimulatorShell` (verdict-slot test id and mobile sticky behaviour retained). Run e2e; expect PASS.
- [ ] **Step 6:** Commit `feat(ui): flyp-style result block with reset`.

### Task 4: Below-card details, footnote, and disclaimers

**Files:** Modify `src/components/simulator/SimulatorShell.tsx`; Test `e2e/a11y.spec.ts`, `e2e/a11y-states.spec.ts`, `e2e/compare.spec.ts`.

- [ ] **Step 1:** Place `ThresholdBanner`, `WarningList`, `CostWaterfall`, `BreakdownTable`, and `PriceSuggestion` beneath the card in a `max-w-3xl` column. Add a small footnote inside the card: "Estimate only. Final price confirmed on Uniqbe's invoice." (supplements `DisclaimerBar`, does not replace it). Keep `FxBadge` in the header and `DisclaimerBar` at the bottom.
- [ ] **Step 2:** Apply the card frame and header to `CompareShell` only if it is a pure wrapper change; otherwise leave Compare for a follow-up and say so in the commit body.
- [ ] **Step 3:** Run `pnpm e2e --workers=1` in full; fix selector or sticky-offset regressions, never by weakening axe or target-size assertions.
- [ ] **Step 4:** Commit `feat(ui): breakdown beneath card, footnote`.

### Task 5: Verify and visual check

- [ ] **Step 1:** `pnpm verify`; expect all green.
- [ ] **Step 2:** `pnpm build`; expect success (`catalogue:check` passes).
- [ ] **Step 3:** `pnpm e2e --workers=1`; expect all pass on desktop-chromium and mobile-portrait.
- [ ] **Step 4:** Start the app, screenshot at 1280px and 375px with Playwright MCP, compare to the reference screenshot, report differences. Stop and ask before push or PR.

## Self-Review Notes

- Spec coverage: header/subtitle (T1), input grid (T2), fee/profit/margin/reset/currency line (T3), footnote + disclaimers (T4), invariant 6 retained (T1/T4).
- Types: `ResultHeadline`, `toResultHeadline`, `ResultBlock` props, `CalculatorCard` defined once and reused as named.
- Assumptions to confirm: product picker at top of card; breakdown kept beneath card; Compare page restyle conditional.

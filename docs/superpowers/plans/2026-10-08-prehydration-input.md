# Pre-hydration Input Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Plan-mode note:** this is the plan-mode draft. Task 0 Step 3 copies it to `docs/superpowers/plans/2026-10-08-prehydration-input.md` and commits it.

**Goal:** a visitor can type into the price or search box before the page finishes loading, and the simulator still uses what they typed. This also removes the cause of the flaky test "Back to simulator from /compare lands on a working simulator", which failed 20–40% of the time on mobile against production.

**Root cause.** Investigated 2026-10-08; systematic debugging Phase 1 is done, and Task 1 confirms it.

What happens:
- `/` and `/compare` are server-rendered. Every text input is a controlled React input, with its value taken from nuqs URL state or from `useState`.
- When text is typed before hydration, React 19 keeps that text in the DOM but not in state. State stays `""`.
- React's change tracker starts from the current DOM value. So typing the **same** text again fires no `onChange`.
- Typing *different* text does work. But until then the visitor sees their price with no verdict, next to the empty-state copy "Select a product and enter a selling price…".

Evidence:
- The failing test fills `9999.00` before hydration, then retries the identical fill for 30 s in `toPass`, and nothing happens. If React had reset the DOM, the retry would have worked.
- The other specs never hit this, because they search for and pick a product first, and that step only works after hydration.
- The Back link (`CompareShell.tsx:52`) is a plain `<a>`. That means a full page load, so the race between typing and hydration happens on every visit.

**Architecture:**
- A pure helper `typedBeforeHydration(values, domValues)` in `src/lib/prehydration.ts` returns the fields whose DOM value differs from state.
- A mount-only hook `useAdoptTypedValues(refs, values, onAdopt)` in `src/components/simulator/useAdoptTypedValues.ts` reads each input's DOM value once after hydration. It calls `onAdopt` **once** with every field that differs.
- `onAdopt` is batched on purpose. `useScenario`'s setter writes the whole scenario from the render-time snapshot, so separate updates for separate fields would overwrite each other.
- The hook is wired into the three components that own controlled text inputs:
  - `InputPanel`: 6 fields
  - `CompareShell`: 2 prices
  - `ProductPicker`: the search query

**Tech Stack:** Next.js 15.5 (App Router), React 19.3, nuqs 2.10, Vitest 2 (node environment, no React Testing Library), Playwright 1.63, TypeScript strict (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`), pnpm 10.33.2.

**Spec:** `PROJECT_SPEC.md`:
- line 699, the accessibility floor: "full mobile layout … Partners will use this on a phone next to a laptop"
- line 739, mobile: "inputs first, verdict card sticky"
- §14 T-33, "Accessibility + mobile pass"

The spec doesn't mention hydration. Its silence isn't permission for typed input to be ignored.

## Global Constraints

- **AGENTS.md invariants 1–6 stay intact.**
  - `src/engine/**` is untouched.
  - Money stays a decimal string, so adopted values pass through as the exact strings typed.
  - `catalogue.json` and `golden-fixtures.json` are untouched.
  - The FX badge and the disclaimer stay on every screen.
- **No new dependencies.** In particular, add no React Testing Library or jsdom. The pure helper is covered by Vitest and the components by Playwright.
- **Tooling:**
  - Prettier: `semi: true`, `singleQuote: false`, `trailingComma: "all"`, `printWidth: 100`. Run `pnpm prettier --write <changed files>` before each commit.
  - Vitest `include` is `tests/**/*.test.ts`. Imports are relative.
  - ESLint has no react-hooks plugin, so a mount-only `useEffect(..., [])` needs no disable comment.
- **Local E2E on this machine:** run with `--workers=1`, because of low RAM.
- **Every E2E route a spec adds must call `route.fallback()`, never `route.continue()`.** That way the target-header fixture (`e2e/fixtures.ts`) still adds the Vercel bypass headers on preview runs.
- **Commits:** one task per commit, Conventional Commits, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Done means:**
  - `pnpm verify` and `pnpm build` pass.
  - Local `pnpm e2e --workers=1` gives **41 passed and 5 skipped**: the earlier 33, plus 4 new tests × 2 projects.
  - The PR's "E2E (Vercel preview)" check is green.
- **Stop and ask** before any push, PR, merge, or change in the Vercel or GitHub dashboards.

## Review Focus

1. **Text typed before hydration into two fields at once,** such as price and shipping. Both must survive, with no lost update. Pinned in Task 1 by `keeps every field typed before hydration`.
2. **A field that only renders sometimes.** "Ad spend" renders only on Shopify. Its ref is `null`, so the field must be skipped and never adopted as `""`. Pinned in Task 2 by the "skips fields with no DOM node" test.
3. **A field cleared before hydration** when the URL already held a value, for example `?sp=10` emptied to `""`. The cleared value must win, never the stale URL value. Pinned in Task 2 by the "adopts an emptied field" test.
4. **A deep link with no early typing** (`/?p=X&sp=9999.00`). Nothing may be adopted, and the URL must not be rewritten. Pinned in Task 2 by the "returns nothing when every DOM value matches" test, and in Task 1 by `a deep link is not rewritten on load`.
5. **Preview runs.** A spec that holds the JS chunks must still reach a protected preview. Pinned by the Global Constraints rule to use `route.fallback()`, and checked by the PR's preview E2E run.

---

### Task 0: Ship t32-followups (HUMAN-gated)

The user chose "Ship it first" on 2026-10-08. Still confirm once, right before the push.

- [ ] **Step 1: Push and open the PR** (after the human says go)

```bash
git checkout t32-followups
git push -u origin t32-followups
gh pr create --base main --title "T-32 follow-ups: strict E2E target URL, origin-scoped bypass headers, workflow guards" --body "$(cat <<'EOF'
## Summary
- `e2e/target.ts`: parse PLAYWRIGHT_BASE_URL strictly to an origin (rejects paths, query, hash, missing host); lazy `isAgainstDeployment()`.
- `e2e/fixtures.ts` + `e2e/route-headers.ts`: Vercel bypass/toolbar headers go only to the target origin and never across a redirect (fetch with maxRedirects 0, then fulfill).
- Guard tests pin the spec imports and e2e-preview.yml's secret-safety settings.

## Test plan
- [x] pnpm verify (488/488), pnpm build
- [x] pnpm e2e --workers=1 → 33 passed, 5 skipped
- [x] deployment mode vs production → 21 passed, 17 skipped
- [ ] E2E (Vercel preview) check green — first real test of the bypass-cookie path for same-origin redirects

Known: the compare.spec.ts:25 mobile flake predates this branch; the follow-up plan fixes it.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Check the preview run**

Run: `gh run list --workflow e2e-preview.yml --limit 3`, then `gh run view <id> --log | grep -E "passed|skipped|failed|flaky"`.

Expected: green, with **21 passed and 17 skipped**. A CI retry may instead show 1 flaky, the known compare flake.
- If every test fails on a Vercel login page, the bypass cookie isn't being set on the preview. Stop and report it; don't turn traces on.

- [ ] **Step 3: The human merges.** Then branch this plan from the updated main:

```bash
git checkout main && git pull --ff-only && git checkout -b prehydration-input
cp "C:/Users/User/.claude/plans/docs-superpowers-plans-2026-10-06-t32-fo-tranquil-platypus.md" docs/superpowers/plans/2026-10-08-prehydration-input.md
git add docs/superpowers/plans/2026-10-08-prehydration-input.md
git commit -m "docs: add pre-hydration input plan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: test(e2e): reproduce typing before hydration deterministically

**Files:**
- Create: `e2e/prehydration.spec.ts`

**Interfaces:**
- Consumes:
  - `test` and `expect` from `./fixtures`
  - `firstCatalogueItem()` from `./helpers`
- Produces: nothing for other tasks. It is Task 2's RED test.

- [ ] **Step 1: Write the failing spec.** Create `e2e/prehydration.spec.ts`:

```ts
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

test("a /compare price typed before hydration is used once the page hydrates", async ({
  page,
}) => {
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
```

- [ ] **Step 2: Run it and confirm it fails for the right reason**

Run: `pnpm e2e --workers=1 e2e/prehydration.spec.ts`

Expected, with 8 runs (4 tests × 2 projects):
- **FAIL:** the first three tests, on both projects.
  - In the first test, `toHaveValue("9999.00")` **passes**, which confirms React keeps the typed DOM value.
  - The `VERDICT` / `toHaveURL(/sp=…/)` assertions then time out, which confirms state never picked it up.
- **PASS:** "a deep link is not rewritten on load", on both projects.

This output is the root-cause confirmation. Any other result means the hypothesis is wrong, so don't start Task 2:
- If `toHaveValue("9999.00")` fails, React reset the DOM, and the fix needs a different design.
- If a verdict appears, the bug isn't reproduced.

In either case, ledger `Ruling: hypothesis refuted — <observed output>` and stop to ask.

- [ ] **Step 3: Commit the RED spec**

It stays red at this commit on purpose; Task 2 turns it green.

```bash
pnpm prettier --write e2e/prehydration.spec.ts
git add e2e/prehydration.spec.ts
git commit -m "test(e2e): reproduce input typed before hydration being ignored

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: fix(simulator): adopt text typed before hydration

**Files:**
- Create: `src/lib/prehydration.ts`, `tests/lib/prehydration.test.ts`, `src/components/simulator/useAdoptTypedValues.ts`
- Modify:
  - `src/components/simulator/InputPanel.tsx`
  - `src/components/compare/CompareShell.tsx`
  - `src/components/simulator/ProductPicker.tsx`

**Interfaces:**
- Consumes: `ScenarioParams` from `src/lib/url-state.ts`, by structural typing only.
- Produces:
  - `typedBeforeHydration<K extends string>(values: Readonly<Record<K, string>>, domValues: Readonly<Record<K, string | undefined>>): Partial<Record<K, string>>`
  - `useAdoptTypedValues<K extends string>(refs: Readonly<Record<K, RefObject<HTMLInputElement | null>>>, values: Readonly<Record<K, string>>, onAdopt: (typed: Partial<Record<K, string>>) => void): void`

- [ ] **Step 1: Write the failing unit tests.** Create `tests/lib/prehydration.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { typedBeforeHydration } from "../../src/lib/prehydration";

describe("typedBeforeHydration", () => {
  it("returns nothing when every DOM value matches state (deep link, no early typing)", () => {
    expect(typedBeforeHydration({ sp: "10", sh: "0.00" }, { sp: "10", sh: "0.00" })).toEqual({});
  });

  it("returns each field whose DOM value differs from state", () => {
    expect(
      typedBeforeHydration(
        { sp: "", sh: "0.00", pk: "0.00" },
        { sp: "9999.00", sh: "3.50", pk: "0.00" },
      ),
    ).toEqual({ sp: "9999.00", sh: "3.50" });
  });

  it("adopts an emptied field, so a cleared price beats the stale URL value", () => {
    expect(typedBeforeHydration({ sp: "10" }, { sp: "" })).toEqual({ sp: "" });
  });

  it("skips fields with no DOM node (conditionally rendered inputs)", () => {
    expect(typedBeforeHydration({ ad: "0.00", sp: "" }, { ad: undefined, sp: "5" })).toEqual({
      sp: "5",
    });
  });

  it("passes the typed string through untouched (money stays a string)", () => {
    expect(typedBeforeHydration({ sp: "" }, { sp: " 12.50 " })).toEqual({ sp: " 12.50 " });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run tests/lib/prehydration.test.ts`
Expected: FAIL, because the module `../../src/lib/prehydration` can't be resolved.

- [ ] **Step 3: Implement the helper.** Create `src/lib/prehydration.ts`:

```ts
// Text a visitor typed into a server-rendered input before React hydrated.
// React 19 keeps that text in the DOM but not in state, and its change tracker
// then treats the DOM value as already seen, so typing the same text again
// never fires onChange. Returns the fields whose DOM value differs from state;
// a field with no DOM node (not rendered) is skipped. Values pass through as
// the exact strings typed — they are validated downstream like any input.
export function typedBeforeHydration<K extends string>(
  values: Readonly<Record<K, string>>,
  domValues: Readonly<Record<K, string | undefined>>,
): Partial<Record<K, string>> {
  const keys = Object.keys(values) as K[];
  return Object.fromEntries(
    keys.flatMap((key) => {
      const dom = domValues[key];
      return dom === undefined || dom === values[key] ? [] : [[key, dom]];
    }),
  ) as Partial<Record<K, string>>;
}
```

- [ ] **Step 4: Run the unit tests and confirm they pass**

Run: `pnpm vitest run tests/lib/prehydration.test.ts`
Expected: PASS 5/5.

- [ ] **Step 5: Create the hook.** Create `src/components/simulator/useAdoptTypedValues.ts`:

```ts
"use client";

import { useEffect, type RefObject } from "react";
import { typedBeforeHydration } from "../../lib/prehydration";

// Once, right after hydration, hands any text typed before hydration to
// onAdopt in a single call. One call, not one per field: useScenario's setter
// writes the whole scenario, so per-field updates would overwrite each other.
// After this, React owns the inputs and onChange handles everything.
export function useAdoptTypedValues<K extends string>(
  refs: Readonly<Record<K, RefObject<HTMLInputElement | null>>>,
  values: Readonly<Record<K, string>>,
  onAdopt: (typed: Partial<Record<K, string>>) => void,
): void {
  useEffect(() => {
    const keys = Object.keys(refs) as K[];
    const domValues = Object.fromEntries(
      keys.map((key) => [key, refs[key].current?.value]),
    ) as Record<K, string | undefined>;
    const typed = typedBeforeHydration(values, domValues);
    if (Object.keys(typed).length > 0) onAdopt(typed);
  }, []);
}
```

- [ ] **Step 6: Wire `InputPanel`.** In `src/components/simulator/InputPanel.tsx`:

Replace the import block with:

```ts
"use client";

import { useRef } from "react";
import type { ScenarioParams } from "../../lib/url-state";
import type { MarketRulesType, CategorySlugType } from "../../lib/schemas";
import { deriveReferralFeeDefault } from "../../lib/scenario-defaults";
import { useAdoptTypedValues } from "./useAdoptTypedValues";
```

Directly after `const marketRules = rules[scenario.market];`, add:

```ts
  const textRefs = {
    sellingPriceLocal: useRef<HTMLInputElement>(null),
    inboundShippingLocal: useRef<HTMLInputElement>(null),
    packagingLocal: useRef<HTMLInputElement>(null),
    adSpendLocal: useRef<HTMLInputElement>(null),
    dutyPct: useRef<HTMLInputElement>(null),
    referralFeePct: useRef<HTMLInputElement>(null),
  };
  useAdoptTypedValues(
    textRefs,
    {
      sellingPriceLocal: scenario.sellingPriceLocal,
      inboundShippingLocal: scenario.inboundShippingLocal,
      packagingLocal: scenario.packagingLocal,
      adSpendLocal: scenario.adSpendLocal,
      dutyPct: scenario.dutyPct,
      referralFeePct: scenario.referralFeePct,
    },
    (typed) => onChange({ ...scenario, ...typed }),
  );
```

Add a `ref` to each text input, on the line directly after its `id=`:

| input `id` | add |
|---|---|
| `selling-price` | `ref={textRefs.sellingPriceLocal}` |
| `shipping` | `ref={textRefs.inboundShippingLocal}` |
| `packaging` | `ref={textRefs.packagingLocal}` |
| `ad-spend` | `ref={textRefs.adSpendLocal}` |
| `duty-pct` | `ref={textRefs.dutyPct}` |
| `referral-fee-pct` | `ref={textRefs.referralFeePct}` |

Don't touch the checkboxes or the `<select>`.

- [ ] **Step 7: Wire `CompareShell`.** In `src/components/compare/CompareShell.tsx`:

- Change `import { useEffect } from "react";` to `import { useEffect, useRef } from "react";`.
- Add `import { useAdoptTypedValues } from "../simulator/useAdoptTypedValues";` directly after the `ThresholdBanner` import.
- Directly after the `useEffect(() => { … }, [itemCode]);` block, add:

```ts
  const priceRefs = {
    sp_uk: useRef<HTMLInputElement>(null),
    sp_au: useRef<HTMLInputElement>(null),
  };
  useAdoptTypedValues(priceRefs, { sp_uk: params.sp_uk, sp_au: params.sp_au }, (typed) =>
    setParams(typed),
  );
```

- In the price `<input>` inside `COLUMNS.map`, add `ref={priceRefs[col.priceKey]}` on the line after `id={inputId}`.

- [ ] **Step 8: Wire `ProductPicker`.** In `src/components/simulator/ProductPicker.tsx`:

- Change `import { useMemo, useState } from "react";` to `import { useMemo, useRef, useState } from "react";`.
- Add `import { useAdoptTypedValues } from "./useAdoptTypedValues";` directly after the `filterProducts` import.
- Directly after `const [query, setQuery] = useState("");`, add:

```ts
  const queryRef = useRef<HTMLInputElement>(null);
  useAdoptTypedValues({ query: queryRef }, { query }, (typed) => {
    if (typed.query !== undefined) setQuery(typed.query);
  });
```

- In `<input id="product-search" …>`, add `ref={queryRef}` on the line after `id="product-search"`.

- [ ] **Step 9: Run the E2E repro and confirm it passes**

Run: `pnpm e2e --workers=1 e2e/prehydration.spec.ts`

Playwright's webServer builds the app itself. Locally, `reuseExistingServer` is true, so stop any server already running on :3100 first.

Expected: PASS 8/8.

- [ ] **Step 10: Verify the whole suite**

```bash
pnpm prettier --write src/lib/prehydration.ts tests/lib/prehydration.test.ts src/components/simulator/useAdoptTypedValues.ts src/components/simulator/InputPanel.tsx src/components/compare/CompareShell.tsx src/components/simulator/ProductPicker.tsx
pnpm verify && pnpm build
pnpm e2e --workers=1
```

Expected:
- verify and build PASS.
- E2E gives **41 passed and 5 skipped**.
- The analytics specs stay green: the hook adds no `track()` call, and `useSettledTrack` de-dupes on the resolved scenario.

- [ ] **Step 11: Commit**

```bash
git add src/lib/prehydration.ts tests/lib/prehydration.test.ts src/components/simulator/useAdoptTypedValues.ts src/components/simulator/InputPanel.tsx src/components/compare/CompareShell.tsx src/components/simulator/ProductPicker.tsx
git commit -m "fix(simulator): use text typed before the page hydrates

React keeps pre-hydration typing in the DOM but not in state, and its
change tracker then ignores retyping the same value, so a price entered on
a slow phone showed with no verdict. Adopt differing DOM values once after
hydration, in one batched update per component.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: test(e2e): drop the hydration retry loop in the Back-to-simulator test

**Files:**
- Modify: `e2e/compare.spec.ts:25-35`

**Interfaces:**
- Consumes: Task 2's fix, through the running app.
- Produces: nothing.

- [ ] **Step 1: Replace the test.** In `e2e/compare.spec.ts`, replace the whole `test("Back to simulator from /compare lands on a working simulator", …)` block with:

```ts
test("Back to simulator from /compare lands on a working simulator", async ({ page }) => {
  const item = firstCatalogueItem();
  await page.goto(`/compare?p=${item.code}`);
  await page.getByRole("link", { name: "Back to simulator" }).click();
  await expect(page).toHaveURL(new RegExp(`p=${item.code}`));
  // Text typed before hydration is adopted (see e2e/prehydration.spec.ts),
  // so one fill is enough whether or not React has hydrated yet.
  await page.getByRole("textbox", { name: "Selling price" }).fill("9999.00");
  await expect(page.getByText(/PROFITABLE|MARGINAL|LOSS-MAKING/)).toBeVisible();
});
```

- [ ] **Step 2: Check it's stable locally**

Run: `pnpm e2e --workers=1 --project=mobile-portrait --grep "Back to simulator" --repeat-each=20`
Expected: **20 passed**.

The local build hydrates fast, so this run alone doesn't prove the fix. The deterministic proof is Task 1's RED run plus Task 2's GREEN run. Ship Step 3 re-checks this on production.

- [ ] **Step 3: Verify and commit**

```bash
pnpm prettier --write e2e/compare.spec.ts
pnpm verify && pnpm build && pnpm e2e --workers=1
git add e2e/compare.spec.ts
git commit -m "test(e2e): drop the hydration retry loop now that early typing is adopted

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: verify PASS, and E2E gives **41 passed and 5 skipped**.

---

### Ship (HUMAN stops)

- [ ] **Step 1: Ask the human before pushing.** Then:

```bash
git push -u origin prehydration-input
gh pr create --base main --title "fix: use text typed before the page hydrates (mobile)" --body "<summary + test plan; end with the Claude Code attribution line>"
```

- [ ] **Step 2: Check the preview run.** Expected: green, with **29 passed and 17 skipped**: the earlier 21, plus 4 pre-hydration tests × 2 projects. They need no local build, so they all run on a deployment. If the count differs, read the log, then ledger the actual number with a ruling.

- [ ] **Step 3: The human merges.** After the production deploy, run:

```bash
PLAYWRIGHT_BASE_URL=https://uniqbe-revenue-simulator.vercel.app pnpm e2e --workers=1 --project=mobile-portrait --grep "Back to simulator" --repeat-each=20
```

Expected: 20 passed. Before the fix, 20–40% of these runs failed.

## Out of scope

- The 3 deferred E2E-harness minors from the T-32 follow-ups review:
  - the import guard isn't recursive
  - `user:pass@` in the URL is accepted
  - some request paths aren't routed

  These belong in a separate plan.
- Turning the `<a>` Back link into a `next/link` client navigation. That would hide the race on this one path but not fix it for first visits.

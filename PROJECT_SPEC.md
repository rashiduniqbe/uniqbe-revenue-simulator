# Uniqbe Reseller Price Simulator — Build Specification

**Target executor:** AI code agent (Claude Code / Cursor / Copilot Agent) in VS Code
**Deployment target:** Vercel
**Derived from:** `Uniqbe_Reseller_Price_Simulator_FINAL_UK-AU_Plan.md` (25 Aug 2026) + `Uniqbe_Reseller_Quotation_20260824_v2.xlsx`
**Spec version:** 1.2 · 26 Aug 2026
**Changed in 1.2:** AU de-minimis comparand reverted to **goods only** per Uniqbe instruction (provisional). Boundary fixtures GF-06a/b/c regenerated; GF-06c repurposed as a negative control. See §2.8.
**Phase:** Path A (Lean Pilot) — UK first, Australia second

> **Read order for the agent:** §0 manifest → §2 data corrections → §7 engine spec → §14 ticket sequence. §7 is the part where correctness actually matters; everything else is scaffolding around it.

---

## 0. Machine-readable manifest

```json
{
  "project": {
    "name": "uniqbe-price-simulator",
    "description": "Profit simulator for Uniqbe dropship resellers selling into the UK and Australia",
    "specVersion": "1.0",
    "phase": "path-a-lean-pilot",
    "markets": ["UK", "AU"],
    "platforms": ["amazon", "ebay", "shopify", "other"],
    "packageManager": "pnpm@9",
    "nodeVersion": "22.x"
  },
  "stack": {
    "framework": "next@15",
    "router": "app",
    "react": "19",
    "language": "typescript@5.6",
    "tsconfig": { "strict": true, "noUncheckedIndexedAccess": true, "verbatimModuleSyntax": true },
    "styling": "tailwindcss@4",
    "components": "shadcn-ui (radix primitives, copied into repo, not a dependency)",
    "validation": "zod@3",
    "money": "decimal.js@10",
    "search": "fuse.js@7",
    "state": "nuqs@2 (URL search params as the single source of scenario state)",
    "unitTests": "vitest@2",
    "e2e": "@playwright/test@1",
    "lint": "eslint@9 (flat config) + prettier@3",
    "fxCache": "@upstash/redis (Vercel Marketplace integration)",
    "analytics": "posthog-js (EU cloud) — see §13"
  },
  "explicitlyNotUsed": {
    "database": "No Postgres/Prisma/Drizzle in Path A. The catalogue is a build-time artifact; the only mutable state is one FX cache key.",
    "orm": "n/a",
    "authentication": "None in Path A. The tool is public/unlisted. Deferred to Path B.",
    "serverSideCalculation": "The engine runs in the browser. See ADR-004."
  },
  "routes": [
    {
      "path": "/",
      "type": "server-component",
      "purpose": "Market picker + simulator, defaults to UK"
    },
    {
      "path": "/compare",
      "type": "server-component",
      "purpose": "UK vs AU side-by-side for one product"
    },
    {
      "path": "/api/fx",
      "type": "route-handler",
      "runtime": "edge",
      "purpose": "Read-only current cached FX snapshot"
    },
    {
      "path": "/api/cron/fx-refresh",
      "type": "route-handler",
      "runtime": "nodejs",
      "purpose": "Daily FX fetch, invoked by Vercel Cron, secured by CRON_SECRET"
    }
  ],
  "env": {
    "UPSTASH_REDIS_REST_URL": {
      "scope": "server",
      "required": true,
      "source": "Vercel Upstash integration (auto-injected)"
    },
    "UPSTASH_REDIS_REST_TOKEN": {
      "scope": "server",
      "required": true,
      "source": "Vercel Upstash integration (auto-injected)"
    },
    "CRON_SECRET": {
      "scope": "server",
      "required": true,
      "source": "Generated; guards /api/cron/*"
    },
    "FX_PRIMARY_URL": {
      "scope": "server",
      "required": false,
      "default": "https://api.frankfurter.dev/v1/latest"
    },
    "FX_FALLBACK_URL": { "scope": "server", "required": false, "default": "" },
    "FX_FALLBACK_API_KEY": { "scope": "server", "required": false, "default": "" },
    "NEXT_PUBLIC_POSTHOG_KEY": { "scope": "client", "required": false, "default": "" },
    "NEXT_PUBLIC_POSTHOG_HOST": {
      "scope": "client",
      "required": false,
      "default": "https://eu.i.posthog.com"
    }
  },
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "pnpm run catalogue:check && next build",
    "start": "next start",
    "lint": "eslint . && prettier --check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "catalogue:build": "tsx scripts/build-catalogue.ts",
    "catalogue:diff": "tsx scripts/catalogue-diff.ts",
    "catalogue:check": "tsx scripts/build-catalogue.ts --verify",
    "fx:seed": "tsx scripts/seed-fx.ts",
    "verify": "pnpm run typecheck && pnpm run lint && pnpm run test"
  },
  "deliveredArtifacts": {
    "data/catalogue.json": "Snapshot of the 24 Aug list, normalised. Regenerate per §2.7 on every price update.",
    "data/market-rules.json": "Fee/tax/duty tables from plan §6.2, restructured as typed config",
    "data/golden-fixtures.json": "16 regression vectors with exact expected outputs, catalogue-independent"
  }
}
```

---

## 1. What this is

A partner picks a Uniqbe product, a market, and a sales platform, enters an intended selling price, and gets a verdict — **Profitable / Marginal / Loss-making** — with a full cost breakdown showing where every unit of currency goes.

**Non-goals for Path A** (do not build these; they are Path B):

| Not building             | Why                                                                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Partner accounts / login | Pilot measures whether partners use it at all. Auth is friction against that measurement.                                                                         |
| Saved scenario history   | Replaced by shareable URLs (§9.4) at ~2% of the cost.                                                                                                             |
| Admin price-upload UI    | Price refresh is a `pnpm catalogue:build` + commit + auto-deploy. 2–3× weekly is well inside what a commit workflow handles.                                      |
| Database                 | Nothing needs to persist except one FX key.                                                                                                                       |
| Japan / US markets       | Explicitly deferred (plan §2). Do not add speculative scaffolding for them — but do keep the market module boundary clean (§7.2) so adding one later is additive. |

---

## 2. Source-data findings — corrections the agent must apply

I parsed the actual `.xlsx`. **Four things in the plan do not match the file.** Apply these corrections; do not build to the plan's stated figures where they conflict.

### 2.1 Catalogue shape (verified)

| Property                | Value                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------ |
| Rows                    | 247 (matches plan)                                                                   |
| Columns                 | `ProductCode`, `Brand`, `Product Name`, `Category`, `USD`, `HKD` (matches plan §5.1) |
| Distinct raw categories | 12 (matches plan)                                                                    |
| Distinct brands         | 21                                                                                   |
| Duplicate product codes | 0                                                                                    |
| Null values             | 0                                                                                    |
| `USD` dtype             | integer — **no cents anywhere in the file**                                          |
| `USD` range             | 13 – 1790                                                                            |
| `HKD / USD` ratio       | 7.769 – 7.818 (mean 7.7999)                                                          |

### 2.2 Correction A — the plan's catalogue counts are stale, and counts are not spec constants

Plan §6.1 and §6.2 (`catalogue_split_evidence`) claim **134 phones, 90 under / 44 at-or-over A$1,000**. The file as delivered has **127 phones**. At rate 1.395 with A$20 freight, the split is **72 under / 55 at-or-over** — 43%, not the "roughly a third" the plan describes.

**The number is not the point. The point is that no number here is durable.** Uniqbe reprices and re-lists 2–3× weekly, so product count, category mix, and threshold split all drift continuously. Treat every figure in this section as a **snapshot taken 26 Aug 2026 for calibration**, never as a value to encode. §2.7 sets out the rules that keep the build correct as the file changes.

What the snapshot is good for is sizing the risk:

| Source                                     | Phones  | At/over A$1k | % above   |
| ------------------------------------------ | ------- | ------------ | --------- |
| Plan §6.2 (stale)                          | 134     | 44           | 32.8%     |
| **File as delivered, 1.395, A$20 freight** | **127** | **55**       | **43.3%** |

The plan repeatedly frames the above-threshold branch as a minority case. It is not — and because the comparand is goods value converted at a live rate (§2.8), branch membership moves with FX alone, with no change to the catalogue:

| USD→AUD | Phones at/over A$1,000 (A$20 freight) |
| ------- | ------------------------------------- |
| 1.30    | 49 (38.6%)                            |
| 1.395   | 55 (43.3%)                            |
| 1.50    | 61 (48.0%)                            |

**Action:** treat the AU above-threshold path as a primary code path with test coverage equal to the below-threshold path. Never precompute, cache, or hardcode which products fall on which side.

### 2.3 Correction B — `HKD` is a derived column, not independent data

The `HKD / USD` ratio is 7.80 ± 0.004 across all 247 rows — the HKD peg, with rounding noise. HKD carries **zero information** not already in USD.

**Action:** ingest `HKD` into `catalogue.json` as `hkdRef` for traceability, but **never** use it in any calculation, and **never** display it to a partner. It exists to let Uniqbe staff cross-check a row against their own system.

### 2.4 Correction C — category labels are dirty and cannot be used as lookup keys

Raw values include `smart living` (lowercase), `Vacuumn Cleaners` (misspelt), and singular/plural inconsistency. Fee percentages key off category, so these must be normalised at build time, not at runtime.

| Raw label (file)                        | Canonical slug       | Display label        | Count |
| --------------------------------------- | -------------------- | -------------------- | ----- |
| `Mobile Phone`                          | `mobile-phone`       | Mobile Phone         | 127   |
| `Earphones`                             | `audio`              | Audio                | 56    |
| `Smart Wearables`                       | `wearable`           | Smart Wearables      | 21    |
| `Tablet`                                | `tablet`             | Tablet               | 17    |
| `Gaming and Consoles`                   | `gaming`             | Gaming & Consoles    | 7     |
| `Camera`                                | `camera`             | Camera               | 6     |
| `Smart Speaker` + `smart living`        | `smart-home`         | Smart Home           | 8     |
| `Keyboard` + `SmartTag` + `Accessories` | `computer-accessory` | Computer Accessories | 4     |
| `Vacuumn Cleaners`                      | `home-appliance`     | Home Appliances      | 1     |

**The build script must fail hard on an unmapped raw category** rather than defaulting it — a silent fallthrough would apply the wrong referral fee to a whole new product line the next time Uniqbe adds one.

### 2.5 Correction D — the plan's worked example understates UK cost

Plan §6.2 states VAT applies to eBay fees at 20%, reclaimable only if VAT-registered. But the §7 worked example charges no VAT on the £48.75 of Amazon fees. For a **non-VAT-registered** UK reseller — the exact newbie persona this tool exists for — that VAT is a real, unrecoverable cost of **£9.75**.

| §7 UK worked example | Plan's figure | Corrected   |
| -------------------- | ------------- | ----------- |
| Net profit           | £124.36       | **£114.61** |
| Margin               | 20.7%         | **19.1%**   |

**Where to find it in the plan:** line 145, inside the `UK.ebay` block of the §6.2 JSON — `"vat_on_ebay_fees_pct": "20% (reclaimable if VAT-registered)"`. The §7 table (lines 203–206) then goes straight from `− Fixed platform fee £0.75` to `= Net profit £124.36`, with no row for it.

**Action — the toggle already covers this.** Amazon and eBay charge VAT on their fees to _every_ UK seller. The `taxRegistered` toggle governs **recoverability, not incidence**: registered sellers reclaim the fee VAT, unregistered sellers absorb it. So the engine always computes `feeTax` and routes it to either the P&L or nowhere based on that single toggle. There is **no second user-facing control** — a "charge VAT on fees?" checkbox would let a partner switch off a cost that is not optional.

`_planParityDisableFeeTax` exists only so fixtures GF-01 and GF-04 can prove byte-exact reproduction of the plan's §7 arithmetic. It is test-only and must never be reachable from the UI.

### 2.6 Ambiguities the spec resolves by decision (confirm in Phase 0)

| #   | Ambiguity in plan                                                                                          | Decision taken here                                                                                                                                                                                                                                                                                                                                            | Confidence                                           |
| --- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | §8.1 step_4 says the A$1,000 threshold compares against "the product's AUD price" — goods only, or landed? | **SET TO `goods` by Uniqbe instruction, 26 Aug 2026** ("at the moment" — explicitly provisional). `comparand = goodsCostLocal`; freight is excluded. This aligns with ABF's published customs-value rule, which generally excludes international transport. Config-driven via `deMinimisComparand`; the engine reads it at runtime and never inlines the rule. | Provisional — confirm with a customs broker (§15 #2) |
| 2   | §7 charges import VAT as a full cost but never charges output VAT on the sale                              | The example models a **non-registered** reseller. Registered is a genuinely different calculation, not a variant. Both branches implemented and tested (`GF-02` vs `GF-03`).                                                                                                                                                                                   | High                                                 |
| 3   | "Margin %" denominator undefined                                                                           | **Margin = net profit ÷ gross selling price.** Reproduces §7's 20.7% and 25.3% exactly, confirming the plan meant this.                                                                                                                                                                                                                                        | High                                                 |
| 4   | Monthly platform fees (Shopify £25, Amazon Professional £25) have no per-unit meaning                      | **Excluded from per-unit profit.** Shown separately as "units/month to cover your £25 subscription" = `ceil(monthlyFee ÷ profitPerUnit)`.                                                                                                                                                                                                                      | High                                                 |
| 5   | Verdict bands never defined                                                                                | `profit ≤ 0` → Loss-making; `0 < margin < 12%` → Marginal; `margin ≥ 12%` → Profitable. Single exported constant.                                                                                                                                                                                                                                              | Low — **Uniqbe to set the 12%**                      |
| 6   | Is the entered selling price VAT-inclusive?                                                                | **Gross** — what the customer pays. Marketplaces display gross; asking a newbie for a net price would invite error.                                                                                                                                                                                                                                            | High                                                 |
| 7   | Marketplace referral fee charged on gross or net?                                                          | **Gross.** Amazon UK and eBay UK both charge on the total including VAT.                                                                                                                                                                                                                                                                                       | Medium                                               |

### 2.7 Adaptability contract — the catalogue is expected to change

Uniqbe's price list changes 2–3× weekly: products added, products withdrawn, prices moved. The build must absorb that without a developer. These are hard requirements, not guidance.

**R1 — No derived catalogue fact may be hardcoded anywhere in `src/`.** Not product count, not category counts, not the AU threshold split, not "43% of phones". Anything of that shape is computed at runtime from the loaded catalogue, or it does not exist. A grep for `247`, `127`, or `55` outside `data/` and this document must return nothing. Add an ESLint `no-magic-numbers` exception list rather than letting these creep in.

**R2 — The AU threshold split is a function of FX, and must be recomputed, never stored.** Under the goods-only rule the branch depends on `goodsCostLocal = usd × fxRate`, so it moves whenever the rate moves — with no change to the catalogue at all. At 1.395 the crossover sits at **USD 716.85**; a 7% FX swing shifts roughly nine products across it (§2.2). There is no durable answer to "how many products are above the threshold", only "this product, at today's rate." Any UI copy, cached value, or test asserting a fixed split is wrong. Freight does **not** enter this determination — see §2.8.

**R3 — Golden fixtures carry their own product data inline.** Every fixture in `data/golden-fixtures.json` embeds its own `usd` value and never looks up a product code in the live catalogue. This is deliberate: a Tuesday price change must not turn the regression suite red. Fixtures test the _engine_; the catalogue is tested separately by schema validation. **Never** rewrite a fixture to match a new catalogue price.

**R4 — Schema validation is the gate; counts are advisory.** `catalogue:check` enforces structure — column names, category mapping, code uniqueness, positive integer USD. It must **not** assert a row count. A price list dropping to 240 or growing to 300 products is normal business, not a build failure.

**R5 — New categories fail loudly with a fix instruction.** When Uniqbe adds a product line the raw category will be unmapped. The build script throws, and its error names the exact edit:

```
✗ Unmapped category "Drones" on row 214 (DJ00021).
  Add to CATEGORY_MAP in scripts/build-catalogue.ts:
      "Drones": "drone",
  Then add duty % and referral fee % for "drone" to BOTH markets
  in src/data/market-rules.json, or the fee lookup will throw at runtime.
```

Silent fallback to a default category is forbidden — it would quietly apply a phone's 8% referral fee to a 15%-category product across a whole new line.

**R6 — Withdrawn products degrade gracefully.** A shared URL may reference a product code that no longer exists. The app must render the empty simulator with _"That product is no longer in Uniqbe's price list — pick another"_, never crash, never 404, never silently substitute a different product.

**R7 — Prices are never cached client-side.** No `localStorage`, no service worker holding catalogue data. The catalogue arrives with the document on every load, so a redeploy propagates immediately. A partner must not be able to compute against a price list from last Tuesday.

**R8 — Two staleness clocks stay separate.** `priceListDate` (from the source filename) and `fx.asOf` (from the FX provider) are labelled distinctly in the UI at all times, per plan §9.2. When a partner asks "is this current?", they need to know _which_ thing is stale.

**R9 — Ship a diff tool.** `pnpm catalogue:diff <old.json> <new.json>` prints added / removed / repriced products with percentage deltas. At 2–3 updates a week this is what makes the PR reviewable — a reviewer needs to see "11 repriced, 2 added, 1 withdrawn", not a 90 KB JSON diff. Add as ticket **T-08b**.

### 2.8 The de-minimis comparand — goods only

**Decision (Uniqbe, 26 Aug 2026, provisional):** the A$1,000 test compares **`goodsCostLocal` alone**. Inbound freight is excluded.

```json
{ "AU": { "deMinimisLocal": 1000, "deMinimisComparand": "goods" } }
```

**Implementation rule.** The engine reads `deMinimisComparand` from `market-rules.json` at runtime and dispatches on it. The accepted values are `"goods"` and `"goods+freight"`, and an unrecognised value must **throw**, not fall back to a default. Do not inline `goods >= 1000` anywhere — reversing this decision has to stay a one-line config edit.

```typescript
function comparand(rules: MarketRules, goods: Decimal, freight: Decimal): Decimal {
  switch (rules.deMinimisComparand) {
    case "goods":
      return goods;
    case "goods+freight":
      return goods.plus(freight);
    default:
      throw new Error(`unknown deMinimisComparand: ${rules.deMinimisComparand}`);
  }
}
```

**What this buys.** The branch is now determined entirely by data Uniqbe controls — catalogue price and the FX rate. A partner cannot move a product across the tax boundary by editing their own freight estimate. That makes the AU verdict reproducible: two partners quoting the same product on the same day get the same branch, whatever they assume about shipping. Under the alternative rule they would not have.

**What it costs.** It is the less conservative reading. Freight-exclusive puts _fewer_ products into the GST branch, so if a customs broker files on a freight-inclusive basis the tool will under-state landed cost on products sitting just under the line. Six products currently sit within A$50 of it (goods A$950–1,000 at rate 1.395): three Honor 600 Pro variants at USD 684 → A$954.18, and three Motorola Razr 60 Ultra variants at USD 701 → A$977.89. That membership is today's; the band is permanent, its occupants are not. This is the main reason §15 #2 stays open.

**Boundary fixtures.** Three, and the third is the one that matters:

| Fixture  | Goods      | Freight      | Branch    | Import GST | Proves                                                  |
| -------- | ---------- | ------------ | --------- | ---------- | ------------------------------------------------------- |
| `GF-06a` | A$999.99   | A$20.00      | below     | `0.00`     | One cent under the line stays below                     |
| `GF-06b` | A$1,000.00 | A$20.00      | **above** | `102.00`   | The comparison is `>=`, inclusive                       |
| `GF-06c` | A$999.99   | **A$500.00** | below     | `0.00`     | **Negative control** — freight is outside the comparand |

`GF-06c` reuses `GF-06a`'s product and raises freight 25×, from A$20 to A$500. Under goods-only the branch must not move and import GST must stay exactly `0.00`. Verified discriminating: running the same fixture with `deMinimisComparand: "goods+freight"` flips it above and charges A$150.00 GST, so an implementation that quietly folds freight in **fails this test rather than passing silently**. A negative control that both rules satisfy would be worthless; this one is not.

**Reversibility.** Flip the config value, regenerate GF-06a/b/c, done. No engine change, no refactor.

---

## 3. Architecture decision record

### ADR-001 — Next.js 15 App Router on Vercel

**Decision:** Next.js 15, App Router, React 19, deployed on Vercel.
**Rationale:** The user specified Vercel. Next.js is the only framework with first-party Vercel support for cron, edge runtime, and ISR without configuration. The app is 95% static with one dynamic value (FX) — App Router's per-request/per-route caching model expresses that in about four lines.
**Rejected:** Vite + React SPA (no server-side FX fetch without a separate function, and the FX secret would need a proxy anyway); Remix (fine, but no advantage here and worse Vercel cron ergonomics); Astro (islands are a good fit for the static catalogue, but the calculator is one large interactive region, so islands buy nothing).

### ADR-002 — No database in Path A

**Decision:** Ship the catalogue as a committed JSON artifact generated from the `.xlsx`. No DB.
**Rationale:** 247 rows × 6 fields ≈ 45 KB raw, ~12 KB gzipped. The data changes 2–3× weekly via a human. A commit is already an audit log, a rollback mechanism, a review gate, and a deploy trigger. A database adds a runtime dependency, a migration story, connection-pool tuning on serverless, and an admin UI — for data that a `git revert` handles better.
**Trade-off accepted:** Uniqbe staff cannot update prices without running one command. That is exactly what Path A is meant to test the appetite for.
**Migration path to Path B:** `catalogue.json` and the DB row shape are the same schema. `getCatalogue()` is the seam — swap its implementation, nothing else changes.

### ADR-003 — Upstash Redis for the FX cache, not Next.js Data Cache

**Decision:** One Redis key holds the FX snapshot. A Vercel Cron job writes it daily.
**Rationale:** Plan §5.2 requires _serve-stale-on-failure with the true `asOf` date preserved_. Next.js `fetch` caching with `revalidate: 86400` cannot do this: on revalidation failure it either serves an entry with no way to expose its real age, or re-fetches per request. The requirement is not "cache for a day" — it is "hold the last known-good value and be honest about how old it is." That is application state, and it needs a real store.
**Rejected:** Vercel Edge Config (read-optimised, but writes go through a management API with low write limits and eventual propagation — awkward for a cron writer); Vercel KV (now Upstash under the hood anyway); Vercel Blob (no atomicity, wrong primitive); in-memory (serverless instances are ephemeral, so every cold start would re-fetch).
**Fallback chain:** Redis → in-repo `fx-seed.json` (committed, stale, clearly labelled) → hard error banner. The tool degrades to "yesterday's rate, labelled" and never to a blank screen.

### ADR-004 — The calculation engine runs in the browser

**Decision:** The engine is a pure, isomorphic TypeScript module. The server passes it the catalogue and the FX snapshot; every recalculation happens client-side.
**Rationale:** Partners will drag a price slider and toggle "VAT-registered?" repeatedly. Per-keystroke server round-trips would make it feel broken. Nothing in the calculation is secret — every rate is published by Amazon, eBay, and HMRC. Client-side gives instant feedback, makes the UK/AU comparison view free (run the engine twice), and makes the whole app statically renderable.
**Isomorphic requirement:** The same module runs under Vitest in Node for the golden fixtures. No `window` access, no DOM, no `Date.now()` inside the engine — the FX snapshot's `asOf` is passed in as an argument. **Determinism is a hard constraint**; a hidden clock read would make the fixtures flaky.

### ADR-005 — Decimal.js, not floats, and not integer minor units

**Decision:** `decimal.js` for all money and percentage arithmetic. `ROUND_HALF_UP` to 2 dp at every line item.
**Rationale:** Floats fail here concretely: `599.99 * 0.08 = 47.999200000000005`. Integer minor units are the usual fix, but this domain multiplies money by FX rates (4 dp) and percentages (1–2 dp) constantly, so you would be hand-rolling scaled-integer multiplication and rounding at every step — more code, more places to get it wrong.
**Rounding at each line item, not at the end:** the breakdown table must sum exactly to the displayed total. A partner who adds up the rows and finds them 3p short stops trusting the tool, and trust is the entire product. Per-line rounding costs a few cents of theoretical accuracy and buys an arithmetic guarantee. `assertBreakdownSums()` enforces it in tests (§11.3).

### ADR-006 — URL search params as scenario state

**Decision:** `nuqs` binds every input to a query parameter. No client state library.
**Rationale:** Makes every scenario shareable by copying the address bar — a partner can send a scenario to Uniqbe support, which is exactly the "reduce support burden" outcome in plan §12. Delivers ~80% of "saved history" for none of the cost. Also gives free back-button behaviour and reload survival.
**Constraint:** keep params short (`m`, `p`, `pl`, `sp`, `sh`) so URLs stay pasteable.

---

## 4. Repository structure

```
uniqbe-price-simulator/
├── .vscode/
│   ├── extensions.json          # recommended extensions (§10.1)
│   ├── settings.json            # format-on-save, TS SDK pin (§10.2)
│   └── tasks.json               # dev / test / catalogue tasks
├── AGENTS.md                    # standing instructions for the coding agent (§10.3)
├── .github/workflows/ci.yml     # typecheck + lint + test + e2e
├── scripts/
│   ├── build-catalogue.ts       # xlsx -> src/data/catalogue.json  (§5.2)
│   └── seed-fx.ts               # writes a fallback FX snapshot into the repo
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                     # RSC: loads catalogue + FX, renders shell
│   │   ├── compare/page.tsx
│   │   ├── api/fx/route.ts              # edge, GET current snapshot
│   │   └── api/cron/fx-refresh/route.ts # nodejs, daily writer
│   ├── engine/                  # ⬅ THE CORE. Pure. No React. No I/O.
│   │   ├── index.ts             # calculate(), suggestPrice()
│   │   ├── types.ts             # SimulationInput, SimulationResult, Breakdown
│   │   ├── money.ts             # Decimal wrappers, r2(), assertions
│   │   ├── markets/
│   │   │   ├── uk.ts            # VAT logic          ⬅ separate per plan §9.2
│   │   │   ├── au.ts            # GST + threshold    ⬅ separate per plan §9.2
│   │   │   └── registry.ts      # MarketModule interface + lookup
│   │   ├── platforms/
│   │   │   ├── amazon.ts  ├── ebay.ts  ├── shopify.ts  └── other.ts
│   │   └── verdict.ts           # band thresholds
│   ├── fx/
│   │   ├── providers/frankfurter.ts     # primary
│   │   ├── providers/fallback.ts        # commercial backup
│   │   ├── store.ts                     # Redis read/write + seed fallback
│   │   └── types.ts                     # FxSnapshot
│   ├── data/
│   │   ├── catalogue.json       # GENERATED — do not hand-edit
│   │   ├── market-rules.json    # hand-maintained, reviewed by Uniqbe
│   │   └── fx-seed.json         # last-resort committed fallback
│   ├── components/
│   │   ├── simulator/           # ProductPicker, MarketTabs, InputPanel,
│   │   │                        # BreakdownTable, VerdictCard, FxBadge,
│   │   │                        # ThresholdBanner, DisclaimerBar
│   │   └── ui/                  # shadcn primitives
│   └── lib/
│       ├── schemas.ts           # zod: catalogue, market-rules, fx
│       └── url-state.ts         # nuqs parsers
└── tests/
    ├── engine/golden.test.ts    # runs data/golden-fixtures.json
    ├── engine/properties.test.ts
    └── e2e/simulator.spec.ts
```

**Enforced boundary:** `src/engine/**` may not import from `src/app/**`, `src/components/**`, `next/*`, or `react`. Add an ESLint `no-restricted-imports` rule. This is what keeps the engine testable in isolation and portable to Path B's server.

---

## 5. Data layer

### 5.1 Catalogue schema

```typescript
// src/lib/schemas.ts
import { z } from "zod";

export const CategorySlug = z.enum([
  "mobile-phone",
  "audio",
  "wearable",
  "tablet",
  "gaming",
  "camera",
  "smart-home",
  "computer-accessory",
  "home-appliance",
]);

export const CatalogueItem = z.object({
  code: z.string().regex(/^[A-Z]{2}\d{5}$/), // e.g. AP13687
  brand: z.string().min(1),
  name: z.string().min(1),
  categoryRaw: z.string().min(1), // preserved for traceability
  category: CategorySlug,
  categoryLabel: z.string().min(1),
  usd: z.number().int().positive(), // file has no cents
  hkdRef: z.number().int().positive(), // reference only — never calculated with
  storageGb: z.number().int().positive().nullable(),
  search: z.string(), // precomputed lowercase haystack
});

export const Catalogue = z.object({
  schemaVersion: z.literal(1),
  sourceFile: z.string(),
  sourceSheet: z.literal("Pricelist"),
  priceListDate: z.string().date(), // ⬅ distinct from FX asOf. Plan §9.2.
  generatedAt: z.string().date(),
  baseCurrency: z.literal("USD"),
  productCount: z.number().int(),
  checksum: z.string(),
  items: z.array(CatalogueItem),
});
```

`priceListDate` and the FX `asOf` are **two different staleness clocks** and the UI must label them distinctly (plan §9.2). Do not merge them into one "last updated" field.

### 5.2 Build script contract — `scripts/build-catalogue.ts`

```json
{
  "input": "./Uniqbe_Reseller_Quotation_<YYYYMMDD>_v<N>.xlsx (path via argv, or newest match in ./pricelists/)",
  "output": "src/data/catalogue.json",
  "library": "exceljs (streaming reader; SheetJS community build has open CVEs)",
  "steps": [
    "Assert sheet 'Pricelist' exists; assert header row matches the six expected columns exactly, in order.",
    "Map each raw Category through CATEGORY_MAP. THROW on any unmapped value — never default.",
    "Assert ProductCode uniqueness. THROW on duplicates.",
    "Assert USD is a positive integer on every row. WARN (do not throw) if any USD/HKD ratio falls outside 7.70–7.90 — that signals the peg assumption broke or a row is mis-keyed.",
    "Derive storageGb by regex on Product Name (matches /(\\d+)\\s*(TB|GB)/i, TB x 1024). Null when absent.",
    "Derive the lowercase `search` haystack: brand + name + categoryLabel.",
    "Compute sha256(items)[0:16] as checksum.",
    "Parse the price-list date out of the source filename into priceListDate.",
    "Write pretty-printed JSON (1-space indent) so diffs are reviewable in a PR."
  ],
  "verifyMode": {
    "flag": "--verify",
    "behaviour": "Regenerate in memory and compare the checksum against the committed file. Exit 1 on mismatch. Wired into `pnpm build` so a stale or hand-edited catalogue fails CI rather than shipping."
  },
  "operatorRunbook": [
    "Drop the new .xlsx into ./pricelists/",
    "pnpm catalogue:build",
    "git diff --stat src/data/catalogue.json   # sanity-check the row delta",
    "Commit on a branch, open a PR. CI runs the golden fixtures against the new data.",
    "Merge -> Vercel deploys automatically."
  ]
}
```

### 5.3 Market rules

`src/data/market-rules.json` is delivered alongside this spec. Zod-validate it at module load — a typo in a fee percentage should crash the build, not silently mis-price 247 products.

**Every rate in it is indicative (plan §0) and `_meta.lastVerified` is `null`.** Ticket T-19 (§14) blocks launch on setting it.

---

## 6. FX subsystem

### 6.1 Snapshot shape

```typescript
export type FxSnapshot = {
  base: "USD";
  rates: { GBP: number; AUD: number };
  asOf: string; // ISO date of the RATE (from provider), not fetch time
  fetchedAt: string; // ISO datetime the fetch succeeded
  provider: "frankfurter" | "fallback" | "seed";
  degraded: boolean; // true when serving stale or seed data
  ageDays: number; // computed at read time from asOf
};
```

`asOf` comes from the **provider's** date field, never from the server clock. Frankfurter publishes ECB reference rates once per weekday — a Sunday fetch legitimately returns Friday's rate, and the UI must say Friday, not Sunday.

### 6.2 Refresh behaviour

| Trigger                            | Behaviour                                                                                                                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel Cron, daily `0 6 * * *` UTC | Fetch primary → on failure, fetch fallback → on failure, **leave the existing key untouched** and emit an error-level log. Never overwrite good data with a failure sentinel. |
| Page request                       | Read the Redis key. No fetching on the read path — a cold cache serves the seed, it does not block rendering on a third-party API.                                            |
| Redis key missing/unreachable      | Serve `src/data/fx-seed.json` with `provider: "seed"`, `degraded: true`.                                                                                                      |
| `ageDays > 3`                      | `degraded: true`. UI shows an amber banner naming the actual date.                                                                                                            |
| `ageDays > 14`                     | Amber banner escalates to red with explicit "these numbers may be materially wrong" wording.                                                                                  |

`vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/fx-refresh", "schedule": "0 6 * * *" }] }
```

The cron handler must verify `Authorization: Bearer ${CRON_SECRET}` and return 401 otherwise. Vercel Cron sends this header automatically when the env var is set. Without the check the endpoint is a public write to your cache.

### 6.3 Non-negotiable display rules (plan §5.2)

Both of these are load-bearing — they are what makes shipping a raw, un-marked-up rate honest rather than reckless:

1. **Wherever a converted figure appears**, show the rate and its date: `1 USD = 0.7424 GBP · rate as of 25 Aug 2026`. Component: `<FxBadge />`. Not a tooltip. Not collapsed. Visible.
2. **Wherever a converted price appears**, show: _"Final price is confirmed on Uniqbe's invoice, not by this tool."_ Component: `<DisclaimerBar />`, `position: sticky` at the viewport bottom.

Plan §5.3 is blunt about why: GBP and AUD are now _calculated_, not quoted, so the simulator's number will sometimes differ from Uniqbe's actual invoice. The disclaimer carries that weight. **Do not let a design pass bury it in a footer.**

---

## 7. Calculation engine — the authoritative specification

> This section is the contract. `data/golden-fixtures.json` is its executable form. If prose and fixtures ever disagree, **the fixtures win** — they were generated from a reference implementation and verified to reproduce plan §7 to the cent.

### 7.1 Types

```typescript
export type Market = "UK" | "AU";
export type Platform = "amazon" | "ebay" | "shopify" | "other";

export type SimulationInput = {
  market: Market;
  productCode: string;
  usd: number; // resolved from catalogue
  category: CategorySlug;
  platform: Platform;
  taxRegistered: boolean; // VAT-registered (UK) / GST-registered (AU)
  sellingPriceLocal: string; // GROSS — what the customer pays
  inboundShippingLocal: string; // Uniqbe HK -> end customer
  packagingLocal: string;
  adSpendLocal: string; // Shopify only; tool never guesses this
  dutyPct: string; // prefilled by category, user-editable
  referralFeePct: string; // prefilled by category, user-editable
  amazonPlan: "individual" | "professional";
  shopifyPlan: "basic" | "grow" | "advanced";
  shopifyHasAbn: boolean; // AU only
  ebayFreeTier: boolean; // AU only: trailing sales <= A$25,000
  // NOTE: there is deliberately NO user-facing "apply tax on fees" control.
  // Amazon/eBay charge VAT/GST on their fees to every seller; `taxRegistered`
  // alone decides whether it is recoverable. See §2.5.
  _planParityDisableFeeTax?: boolean; // TEST-ONLY. Never wired to UI. Used by GF-01/GF-04.
};

export type SimulationResult = {
  currency: "GBP" | "AUD";
  fx: { rate: string; asOf: string; degraded: boolean };
  breakdown: BreakdownLine[]; // ordered, display-ready
  goodsCostLocal: string;
  duty: string;
  auAboveThreshold: boolean | null; // null for UK
  importTax: string;
  importTaxReclaimable: boolean;
  landedCost: string;
  outputTax: string;
  netRevenue: string;
  platformFees: Record<string, string>;
  platformFeeSubtotal: string;
  taxOnPlatformFees: string;
  taxOnPlatformFeesCost: string; // 0 when reclaimable
  otherCosts: string;
  netProfit: string;
  marginPct: string;
  verdict: "profitable" | "marginal" | "loss-making";
  monthlyFeeCoverage: { monthlyFee: string; unitsRequired: number } | null;
  warnings: EngineWarning[];
};
```

All money crosses the engine boundary as **decimal strings**, never `number`. This prevents an accidental float round-trip through JSON or React props from silently corrupting a value.

### 7.2 The calculation, step by step

Each step rounds **half-up to 2 dp** before feeding the next.

| #   | Step                | Formula                                                                                 | Notes                                                                                                                                                                    |
| --- | ------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Goods cost          | `goods = r2(usd × fxRate)`                                                              | Only place FX is applied                                                                                                                                                 |
| 2   | Duty                | `duty = r2(goods × dutyPct)`                                                            | Base is goods only, excludes freight. 0% for all electronics categories; 5% for `home-appliance` in AU                                                                   |
| 3   | Threshold test (AU) | `above = (goods + shipping) >= 1000`                                                    | **`>=`, inclusive. Goods + freight** — Uniqbe decision, §2.6 #1. Note this makes the branch depend on a _user input_, not just the product — see §2.7. UK: always `true` |
| 4   | Import tax          | `base = goods + shipping + duty`<br>`importTax = above ? r2(base × taxRate) : 0`        | UK 20%, AU 10%. AU below threshold → exactly `0.00`                                                                                                                      |
| 5   | Landed cost         | `landed = goods + shipping + duty + (taxRegistered ? 0 : importTax)`                    | **Registered → import tax is reclaimable, so not a cost.** Surface it as a cashflow warning, not a P&L line                                                              |
| 6   | Output tax          | `outputTax = taxRegistered ? r2(P × rate/(1+rate)) : 0`<br>`netRevenue = P − outputTax` | UK: `P × 20/120`. AU: `P × 10/110`                                                                                                                                       |
| 7   | Platform fees       | see §7.3                                                                                | All computed on **gross** `P`                                                                                                                                            |
| 8   | Tax on fees         | `feeTax = r2(feeSubtotal × taxRate)`<br>`feeTaxCost = taxRegistered ? 0 : feeTax`       | **Always computed.** The registration toggle governs recoverability, not whether the fee tax exists. §2.5                                                                |
| 9   | Other costs         | `other = packaging + adSpend`                                                           |                                                                                                                                                                          |
| 10  | Profit              | `profit = netRevenue − landed − feeSubtotal − feeTaxCost − other`                       |                                                                                                                                                                          |
| 11  | Margin              | `margin = profit ÷ P × 100`                                                             | Denominator is **gross price** — §2.6 #3                                                                                                                                 |
| 12  | Verdict             | `profit ≤ 0` → loss-making<br>`margin < 12` → marginal<br>else profitable               | Threshold in `engine/verdict.ts`                                                                                                                                         |

### 7.3 Platform fee rules

| Platform    | Components                                                                                                                                                                                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Amazon**  | `referralFee = max(r2(P × pct), minReferralFee)` — UK min £0.25.<br>`+ perItemPlanFee` when `amazonPlan === "individual"` (£0.75 / A$0.99).<br>Professional plan → per-item fee is 0; monthly goes to `monthlyFeeCoverage`.                                                                                                          |
| **eBay**    | `referralFee = r2(P × pct)`.<br>UK: `+ regulatoryFee = r2(P × 0.42%)`, `+ perOrderFee` (£0.30 if `P ≤ 10`, else £0.40).<br>AU: `+ 2.5%` on the portion above A$4,000.<br>AU `ebayFreeTier === true` → **all transaction fees zero** (trailing sales ≤ A$25,000).                                                                     |
| **Shopify** | No referral fee. `paymentFee = r2(P × pct) + fixed` (UK Basic 2.0% + £0.25; AU Basic 1.75% + A$0.30).<br>Monthly subscription → `monthlyFeeCoverage`. AU: warn that 10% GST applies to the subscription unless `shopifyHasAbn`.<br>`adSpendLocal` input is **required** — plan §3 is explicit that Shopify has no built-in audience. |
| **Other**   | Zero fees. `feesAreTaxable: false`. Escape hatch for a partner's own channel.                                                                                                                                                                                                                                                        |

### 7.4 Market module interface

Plan §9.2 requires UK and AU tax logic in **separate, swappable modules**. Enforce it structurally:

```typescript
export interface MarketModule {
  readonly id: Market;
  readonly currency: "GBP" | "AUD";
  readonly taxName: "VAT" | "GST";
  readonly taxRatePct: number;
  isAboveThreshold(goods: Decimal): boolean; // UK: always true
  computeDuty(goods: Decimal, dutyPct: Decimal): Decimal;
  computeImportTax(goods: Decimal, shipping: Decimal, duty: Decimal, above: boolean): Decimal;
  computeOutputTax(gross: Decimal, registered: boolean): Decimal;
  warnings(ctx: EngineContext): EngineWarning[];
}
```

**Do not** write one shared function with `if (market === "AU")` branches inside it. The whole point is that a change to Australia's threshold cannot break the UK.

### 7.5 Price suggestion — closed form with a bounded correction

Profit is **linear in P**, so no iterative solver is needed:

```
profit  = P·k − P·f_eff − F − L
target  : profit = m·P

  where  k     = registered ? 1/(1+taxRate) : 1     (output-tax factor)
         f_eff = variable fee rate, × (1+taxRate) when fee tax is an unrecoverable cost
         F     = fixed per-unit costs (per-order fee, per-item plan fee, payment fixed,
                 packaging, ad spend)
         L     = landed cost
         m     = target margin as a fraction

  ⇒  P = (F + L) / (k − f_eff − m)
```

**Guard:** if `k − f_eff − m ≤ 0`, the target margin is unreachable at any price. Return `null` and have the UI say so plainly — do not return a huge number.

**Bounded correction:** the closed form is continuous, but the engine rounds per line item, so the seed price can under-deliver the target by a cent or two. After solving, feed the seed back through `calculate()` and nudge upward in £0.01 steps until **both** `margin ≥ target` **and** `profit ≥ 0`. Cap at 25 steps. Empirically this takes 0–17 steps.

The `profit ≥ 0` condition is not redundant: at a 0% target, a profit of −£0.02 still renders as `-0.00%` and would pass a margin-only check. A break-even suggestion that loses money is the single worst bug this tool could ship.

### 7.6 Warnings the engine must emit

| Code                                 | Condition                         | Message intent                                                                                |
| ------------------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------- |
| `AU_BELOW_THRESHOLD`                 | AU, goods < A$1,000               | No GST modelled — Uniqbe's stated policy (§6.3), not permanent law                            |
| `AU_NEAR_THRESHOLD`                  | AU, goods within 5% of A$1,000    | An FX move could flip this product into the GST branch                                        |
| `IMPORT_TAX_CASHFLOW`                | `taxRegistered && importTax > 0`  | Reclaimable, but you pay it before you reclaim it                                             |
| `FX_DEGRADED`                        | `fx.degraded`                     | Rate is N days old                                                                            |
| `CUSTOMS_DECLARED_VALUE_UNCONFIRMED` | always                            | Uses reseller cost as customs value; Uniqbe's actual declared value is unconfirmed (plan §10) |
| `DOORSTEP_LIABILITY`                 | `importTax > 0 \|\| duty > 0`     | You are liable to Uniqbe, but the courier bills your end customer (plan §6.3)                 |
| `SHOPIFY_NO_AUDIENCE`                | Shopify && `adSpendLocal === "0"` | Shopify has no built-in traffic; a zero ad budget is unrealistic                              |
| `SHOPIFY_AU_GST_ON_SUB`              | AU && Shopify && `!shopifyHasAbn` | 10% GST is added to your subscription without an ABN                                          |
| `NOT_TAX_ADVICE`                     | always                            | Estimate, not tax advice (plan §10)                                                           |

---

## 8. Golden fixtures

`data/golden-fixtures.json` ships with this spec: **12 calculation cases + 4 solver cases**, each with exact expected output. Frozen FX rates (`USD/GBP 0.7424`, `USD/AUD 1.395`) taken from plan §7.

**Every fixture embeds its own `usd` value and never reads the live catalogue** (rule R3, §2.7). Price-list updates cannot turn this suite red.

| ID     | Covers                                                                                    | Expected profit | Margin  | Verdict     |
| ------ | ----------------------------------------------------------------------------------------- | --------------- | ------- | ----------- |
| GF-01  | **Plan §7 UK parity** (`_planParityDisableFeeTax`)                                        | £124.36         | 20.73%  | profitable  |
| GF-02  | UK, not registered, fee tax on _(default)_                                                | £114.61         | 19.10%  | profitable  |
| GF-03  | UK, **VAT-registered** — import VAT reclaimed, output VAT due                             | £95.51          | 15.92%  | profitable  |
| GF-04  | **Plan §7 AU parity**, below threshold                                                    | A$253.11        | 25.31%  | profitable  |
| GF-05  | AU **above** A$1,000 — iPhone 17 Pro 1TB                                                  | A$174.57        | 5.82%   | marginal    |
| GF-06a | AU boundary — goods **A$999.99** → below                                                  | A$255.72        | 18.27%  | profitable  |
| GF-06b | AU boundary — goods **exactly A$1,000.00** → above (`>=`)                                 | A$153.71        | 10.98%  | marginal    |
| GF-06c | **Negative control** — GF-06a with freight A$20→**A$500** → stays below, GST stays `0.00` | A$231.72        | 12.20%  | profitable  |
| GF-07  | UK eBay — regulatory fee + per-order tier                                                 | −£11.07         | −4.43%  | loss-making |
| GF-08  | AU eBay **free tier** — all fees zero                                                     | A$235.25        | 39.27%  | profitable  |
| GF-09  | UK Shopify, VAT-registered, ad spend + packaging                                          | £123.37         | 19.01%  | profitable  |
| GF-10  | Loss case — price below landed cost                                                       | −£67.08         | −16.81% | loss-making |

**GF-01 and GF-04 reproduce the plan's worked example exactly** (landed £426.88 / A$665.89; profit £124.36 / A$253.11; margin 20.7% / 25.3%). If your implementation matches these two, the FX, duty, import-tax, and referral-fee paths are all correct.

**GF-05 is the finding that matters commercially.** The same catalogue, one branch over, drops the margin from 25.3% to 5.82% — into "marginal". That is not an edge case: it was 43% of the phone catalogue at the time of the snapshot, and it moves with both FX and freight (§2.2, §2.8).

**GF-06c is the fixture that catches the most likely implementation bug.** An engine that folded freight into the comparand — the natural misreading of plan §8.1 step_4, and the rule this spec carried until v1.2 — would still pass GF-06a and GF-06b. Only 06c fails it: same product, freight raised 25× to A$500, branch must not move and `importTax` must stay exactly `"0.00"`. Verified discriminating (running it under `goods+freight` flips the branch and charges A$150.00), so it is a real control, not a fixture both rules satisfy.

Solver cases:

| ID    | Target            | Seed (closed form) | Suggested (after nudge)  | Steps |
| ----- | ----------------- | ------------------ | ------------------------ | ----- |
| SV-01 | 0% (break-even)   | £473.04            | **£473.21**              | 17    |
| SV-02 | 20%               | £607.43            | **£607.60**              | 17    |
| SV-03 | 15% (AU, GST-reg) | A$1,065.27         | **A$1,065.27**           | 0     |
| SV-04 | 90% (AU eBay)     | —                  | **`null`** — unreachable | —     |

---

## 9. UI specification

### 9.1 Design direction

The subject is money a partner is about to risk. The job of the page is to make one verdict unmissable and its arithmetic checkable. Design accordingly: **the breakdown table is the hero, not a hero banner.** Resist a marketing-style landing page — a partner arriving here has already decided to use the tool.

| Token                | Value                                                                                            | Rationale                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Type — data          | `ui-monospace, "SF Mono", "JetBrains Mono", monospace`, tabular figures                          | Every currency column must align on the decimal point. Non-negotiable for a ledger.                                      |
| Type — interface     | `Inter Variable` or system stack                                                                 | Neutral; the numbers carry the personality                                                                               |
| Verdict — profitable | `#0F766E` (teal-700)                                                                             | Deliberately _not_ the default success-green; teal reads considered rather than celebratory                              |
| Verdict — marginal   | `#B45309` (amber-700)                                                                            |                                                                                                                          |
| Verdict — loss       | `#B91C1C` (red-700)                                                                              |                                                                                                                          |
| Surface              | `#FAFAF9` / `#FFFFFF` cards                                                                      | Neutral warm-grey. Do not use `#F4F1EA` cream + terracotta — it is the current AI-design default and reads as templated. |
| Radius               | `6px` cards, `4px` inputs                                                                        |                                                                                                                          |
| Accessibility floor  | WCAG AA contrast, visible keyboard focus, `prefers-reduced-motion` respected, full mobile layout | Partners will use this on a phone next to a laptop                                                                       |

**Signature element:** a horizontal **cost waterfall** above the breakdown table — a single stacked bar running left-to-right from gross selling price through each deduction to the profit remainder, each segment proportionally sized and colour-keyed to its table row. Hovering a table row highlights its segment. It answers "where did my money go?" at a glance and makes a loss viscerally obvious: the profit segment inverts and crosses the axis. One bold element; everything else stays quiet.

Colour must never be the only signal — every verdict carries a text label, and every waterfall segment is labelled in the table.

### 9.2 Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Uniqbe Price Simulator          [ 🇬🇧 UK ] [ 🇦🇺 Australia ] │
│  Prices as of 24 Aug 2026 · 1 USD = 0.7424 GBP (25 Aug)      │  ← two clocks, labelled
├───────────────────────────┬──────────────────────────────────┤
│  YOUR SETUP               │   ┌────────────────────────────┐ │
│  Product  [search all ▾]  │   │  PROFITABLE                │ │
│    OnePlus Nord 6 512GB   │   │  £114.61 per unit · 19.1%  │ │
│    Cost  £343.73          │   └────────────────────────────┘ │
│  Platform [Amazon ▾]      │                                  │
│  VAT-registered? [No ●]   │   ▓▓▓▓▓▓▓▓▓▓▓░░░░▒▒▒██  waterfall │
│                           │                                  │
│  Selling price  [599.99]  │   Gross selling price   £599.99  │
│  Shipping       [ 12.00]  │   − Goods cost         −£343.73  │
│  Packaging      [  0.00]  │   − Shipping            −£12.00  │
│  Duty %         [ 0.0  ]  │   − Import duty (0%)     £0.00  │
│                           │   − Import VAT (20%)    −£71.15  │
│  [ Suggest a price for    │   − Amazon referral 8%  −£48.00  │
│    20% margin ]           │   − Amazon per-item      −£0.75  │
│                           │   − VAT on fees          −£9.75  │
│                           │   ─────────────────────────────  │
│                           │   = Net profit          £114.61  │
├───────────────────────────┴──────────────────────────────────┤
│ ⓘ You settle duty and VAT with Uniqbe — but the parcel ships │
│   from Hong Kong to your customer's door, and the courier    │
│   usually asks them for it.                                  │
├──────────────────────────────────────────────────────────────┤
│ Final price is confirmed on Uniqbe's invoice, not by this     │  ← sticky, always visible
│ tool. Estimate only — not tax advice.                         │
└──────────────────────────────────────────────────────────────┘
```

Mobile: single column, inputs first, verdict card `position: sticky` at the top so it stays visible while editing. Breakdown stays a table — do not collapse it to cards, alignment is the point.

### 9.3 Copy rules

Write from the partner's side of the screen. Name things they recognise.

| Don't                           | Do                                                                      |
| ------------------------------- | ----------------------------------------------------------------------- |
| "Submit"                        | "Calculate"                                                             |
| "Invalid input"                 | "Enter a selling price above £0"                                        |
| "VAT-registered: true"          | "You're VAT-registered"                                                 |
| "de_minimis threshold exceeded" | "This product is over A$1,000, so GST applies at the border"            |
| "Error fetching FX"             | "Using the exchange rate from 22 Aug — today's rate hasn't arrived yet" |

**The AU threshold banner is required, both ways** (plan §9.2). Below: _"Under A$1,000 — no GST charged today. This reflects Uniqbe's current policy, not a permanent rule."* Above: *"Over A$1,000 — GST of 10% applies at the border and is included below."_

### 9.4 URL state

`/?m=UK&p=OP00573&pl=amazon&reg=0&sp=599.99&sh=12&pkg=0&duty=0`

Every param optional with a sane default. Unknown product code → fall back to no selection with a toast, never a crash. `/compare?p=OP00573&sp_uk=599.99&sp_au=999.99` renders both markets from one product.

---

## 10. VS Code + agent workflow

### 10.1 `.vscode/extensions.json`

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "vitest.explorer",
    "ms-playwright.playwright",
    "yoavbls.pretty-ts-errors",
    "usernamehw.errorlens",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

### 10.2 `.vscode/settings.json`

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "files.associations": { "*.css": "tailwindcss" },
  "vitest.enable": true,
  "search.exclude": { "**/src/data/catalogue.json": true }
}
```

That last line matters more than it looks — the generated catalogue blob otherwise drowns every project-wide search.

### 10.3 `AGENTS.md` — standing rules for the coding agent

```markdown
# Agent rules

## Invariants — never violate

1. `src/engine/**` is pure. No React, no Next, no I/O, no `Date.now()`, no `Math.random()`.
2. Money is `Decimal` internally and a decimal string at every boundary. Never `number`.
3. Never edit `src/data/catalogue.json` by hand. Regenerate it.
   3a. Never hardcode a fact derived from the catalogue — no product counts, no
   category counts, no threshold splits. Compute at runtime or omit.
   3b. Never assert a row count in a test. The price list changes weekly.
4. Never change an expected value in `data/golden-fixtures.json` to make a test pass.
   A failing fixture means the code is wrong, or the spec changed and a human
   must approve the new value.
5. UK and AU tax logic stay in separate modules. No `if (market === "AU")` inside
   a shared tax function.
   5a. The AU A$1,000 test uses `goods + inboundShipping`, never goods alone.
   Read the comparand from market-rules.json; do not inline the rule.
   5b. There is no user-facing control for VAT/GST on platform fees. `taxRegistered`
   governs recoverability only. `_planParityDisableFeeTax` is test-only.
6. The FX badge and the invoice disclaimer render on every screen showing a
   converted price. Do not remove them to simplify a layout.

## Workflow

- Run `pnpm verify` before declaring any ticket done.
- One ticket per commit. Conventional Commits.
- Write the test first for anything in `src/engine/`.
- If a spec section is ambiguous, stop and ask. Do not invent a tax rule.
```

Point Claude Code / Cursor at this file. Rule 4 is the one that earns its keep: an agent's default instinct on a red test is to adjust the assertion.

---

## 11. Testing

### 11.1 Layers

| Layer           | Tool                     | Scope                                                         | Gate          |
| --------------- | ------------------------ | ------------------------------------------------------------- | ------------- |
| Golden fixtures | Vitest                   | All 16 vectors, exact string equality                         | Blocks merge  |
| Property tests  | Vitest + fast-check      | Invariants (§11.3)                                            | Blocks merge  |
| Schema          | Vitest                   | Zod parse of all three data files                             | Blocks merge  |
| Component       | Vitest + Testing Library | Threshold banner, FX badge, verdict card                      | Blocks merge  |
| E2E smoke       | Playwright               | Load → pick product → enter price → see verdict; both markets | Blocks deploy |
| Visual          | Playwright screenshots   | Breakdown table + waterfall                                   | Advisory      |

### 11.2 Golden fixture runner

```typescript
import fixtures from "../../data/golden-fixtures.json";

describe.each(fixtures.cases)("$id — $description", (c) => {
  const actual = calculate(c.input as SimulationInput, c.fx);
  it.each(Object.keys(c.expected))("%s matches", (field) => {
    expect(actual[field]).toBe(c.expected[field]); // string equality — no float tolerance
  });
});
```

String equality, not `toBeCloseTo`. A cent of drift is a bug, not noise.

### 11.3 Property tests

Across randomised valid inputs:

1. **Breakdown sums exactly:** `netRevenue − landedCost − platformFeeSubtotal − taxOnPlatformFeesCost − otherCosts === netProfit`. _(Verified passing on all 10 fixtures.)_
2. **Monotonic in price:** raising `sellingPriceLocal` never lowers `netProfit`.
3. **Monotonic in cost:** raising any cost input never raises `netProfit`.
4. **Threshold is a step, on the comparand:** for AU, `goods = 999.99` → `importTax === "0.00"`; `goods = 1000.00` → `importTax > 0`. **Generate freight independently of goods and assert the branch is invariant to it** — under `deMinimisComparand: "goods"`, no freight value may change `auAboveThreshold`. This is the property-test form of GF-06c and it must fail if the comparand config is ignored.
5. **Solver round-trips:** `suggestPrice(input, m)` fed back through `calculate` yields `margin ≥ m` **and** `profit ≥ 0`, or returned `null`.
6. **No NaN, no Infinity, no `-0.00`** in any output field, ever.
7. **Registration invariance:** with all taxes at 0%, the registered and non-registered branches produce identical profit. _(Catches sign errors in the reclaim logic.)_
8. **Catalogue independence:** the engine's output depends only on its `SimulationInput`. Mutating `catalogue.json` between two identical `calculate()` calls changes nothing. _(Enforces R3.)_

### 11.4 Manual QA before pilot

- [ ] **Every** product in the current catalogue renders without a calculation error (script-driven sweep — iterate the file, do not assert a count)
- [ ] Every AU product whose `goods + freight` reaches A$1,000 shows the GST banner; every one below shows the policy banner
- [ ] Raising freight on a near-threshold product visibly flips the banner and the numbers
- [ ] Kill Redis → app serves seed rates with a visible degraded banner, no crash
- [ ] Point `FX_PRIMARY_URL` at a 500 → cron leaves the old value intact
- [ ] Keyboard-only pass through the whole flow
- [ ] Real iPhone SE and a mid-range Android, portrait

---

## 12. CI/CD and deployment

### 12.1 Pipeline

```
push branch
  └─> GitHub Actions: pnpm install --frozen-lockfile
      ├─ typecheck
      ├─ lint
      ├─ test  (golden + property + schema + component)
      ├─ catalogue:check   ⬅ fails if catalogue.json is stale or hand-edited
      └─ build
  └─> Vercel Preview Deployment
      └─ Playwright E2E against the preview URL
  └─> PR review (human)
  └─> merge to main
      └─> Vercel Production
```

### 12.2 Vercel configuration

| Setting               | Value                                                             |
| --------------------- | ----------------------------------------------------------------- |
| Framework preset      | Next.js                                                           |
| Build command         | `pnpm build`                                                      |
| Install command       | `pnpm install --frozen-lockfile`                                  |
| Node                  | 22.x                                                              |
| Region                | `lhr1` (London) — closest to the UK pilot cohort                  |
| Cron                  | `/api/cron/fx-refresh` at `0 6 * * *`                             |
| Integration           | Upstash Redis via Vercel Marketplace (auto-injects both env vars) |
| Deployment protection | Password-protect the preview environment during the pilot         |

**Region note:** `lhr1` favours UK partners. Once Australia has real traffic, measure before adding `syd1` — the app is mostly static and Vercel's CDN serves it from the edge regardless. Only the cron and the FX read hit the origin, and neither is latency-sensitive.

### 12.3 Rollback

`git revert` + push. Because the catalogue is a committed artifact, this rolls back **prices and code together** — no scenario where reverted code meets forward-migrated data. That property is a direct dividend of ADR-002.

---

## 13. Measuring the pilot

Plan §12 defines five metrics that require event tracking. Instrument these from day one — retrofitting analytics after a pilot has run means the pilot answered nothing.

| Event               | Properties                                                        | Feeds plan §12 metric                                                 |
| ------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| `simulator_viewed`  | `market`, `referrer`                                              | Adoption                                                              |
| `product_selected`  | `productCode`, `category`, `market`                               | Which catalogue segments partners actually test                       |
| `calculation_run`   | `market`, `platform`, `verdict`, `marginBand`, `auAboveThreshold` | **"Number of loss-making verdicts shown"** — the core evidence metric |
| `price_suggested`   | `targetMargin`, `reachable`                                       | Feature value                                                         |
| `comparison_viewed` | `productCode`                                                     | Whether UK/AU comparison earns its build cost                         |
| `scenario_shared`   | —                                                                 | Proxy for the support-burden metric                                   |

**Never send** partner-entered selling prices, margins, or shipping costs to analytics. Those are the partner's commercial data. Send the _band_ (`marginBand: "0-10"`), never the value. PostHog EU cloud, `person_profiles: "identified_only"`, no session recording.

---

## 14. Build plan — ordered tickets

Each ticket is independently committable with its own acceptance criterion.

### Phase 0 — blockers (no code)

| ID   | Task                                                                                                                  | Owner             | Blocks                                                        |
| ---- | --------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------- |
| T-00 | Confirm the **customs declared value** Uniqbe uses on shipments (plan §10, §13.1)                                     | Uniqbe ops        | Accuracy of every import-tax figure                           |
| T-01 | ~~Confirm comparand~~ — **set to `goods` (provisional).** Downgraded to a sanity check with a customs broker (§15 #2) | Customs broker    | Nothing — build proceeds                                      |
| T-02 | Pull **live fee rates** from Amazon Seller Central + eBay Seller Hub, UK and AU                                       | Uniqbe            | `market-rules.json` accuracy                                  |
| T-03 | **Tax review** of all VAT/GST/duty content (plan §13.4)                                                               | Qualified adviser | Launch                                                        |
| T-04 | Set the **verdict threshold** (default 12%, §2.6 #5)                                                                  | Uniqbe            | Verdict semantics                                             |
| T-05 | Confirm §2.5 — that plan §7 omitted fee VAT in error                                                                  | Uniqbe            | Nothing — structure is settled, only the confirmation is open |

> T-00 through T-03 do not block _writing_ code — they block _launching_ it. Start Phase 1 in parallel; treat `market-rules.json` as the single file that changes when they land.

### Phase 1 — foundation

| ID    | Ticket                                                                                   | Acceptance                                                                                                                                                |
| ----- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-06  | Scaffold Next.js 15 + TS strict + Tailwind 4 + ESLint/Prettier; `.vscode/*`; `AGENTS.md` | `pnpm verify` passes on an empty project                                                                                                                  |
| T-07  | Zod schemas for catalogue, market-rules, fx                                              | Invalid fixture data fails the parse in a test                                                                                                            |
| T-08  | `scripts/build-catalogue.ts` + `--verify`                                                | Regenerates the delivered `catalogue.json` byte-identically; throws on an unmapped category with the R5 fix-instruction message; **asserts no row count** |
| T-08b | `scripts/catalogue-diff.ts` — added / removed / repriced with % deltas                   | Diffing the delivered file against a hand-edited copy reports exactly the seeded changes                                                                  |
| T-09  | `src/engine/money.ts` — Decimal wrappers, `r2()`, `assertBreakdownSums()`                | Unit tests on rounding edges (`.005`, `.995`, negatives)                                                                                                  |

### Phase 2 — engine (highest risk; build test-first)

| ID   | Ticket                                                                                                     | Acceptance                                                                                  |
| ---- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| T-10 | `MarketModule` interface + `markets/uk.ts`                                                                 | GF-01, GF-02, GF-03 pass                                                                    |
| T-11 | `markets/au.ts` incl. threshold branch; comparand read from config via `comparand()` (§2.8), never inlined | GF-04, GF-05, GF-06a, GF-06b, **GF-06c** pass; an unknown `deMinimisComparand` value throws |
| T-12 | Platform modules: amazon, ebay, shopify, other                                                             | GF-07, GF-08, GF-09 pass                                                                    |
| T-13 | `verdict.ts` + warning emitters                                                                            | GF-10 passes; all 9 warning codes fire under the right conditions                           |
| T-14 | `suggestPrice()` — closed form + bounded nudge                                                             | SV-01…SV-04 pass; SV-04 returns `null`                                                      |
| T-15 | Property test suite (§11.3)                                                                                | All 7 invariants hold over 10,000 generated cases                                           |

**Gate: all 16 golden fixtures green before any UI work starts.**

### Phase 3 — FX

| ID   | Ticket                                                             | Acceptance                                                            |
| ---- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| T-16 | `FxSnapshot` type, Frankfurter provider, fallback provider         | Provider unit tests with mocked responses                             |
| T-17 | Redis store + seed fallback + `ageDays`/`degraded`                 | Killing Redis serves seed data with `degraded: true`                  |
| T-18 | `/api/cron/fx-refresh` with `CRON_SECRET`; `/api/fx` read endpoint | Unauthenticated POST → 401; provider failure leaves the key untouched |

### Phase 4 — UI (UK)

| ID   | Ticket                                                                           | Acceptance                                                                                                         |
| ---- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| T-19 | App shell, layout, `<FxBadge />`, sticky `<DisclaimerBar />`                     | Both render on every route showing a converted price                                                               |
| T-20 | `<ProductPicker />` — Fuse.js over the loaded catalogue, size read from the data | Typing "nord 512" surfaces both Nord 6 512GB variants in under 50 ms; works unchanged on a catalogue of 200 or 400 |
| T-21 | `<InputPanel />` + nuqs URL binding                                              | Reload restores the full scenario; back button works                                                               |
| T-22 | `<BreakdownTable />` — tabular figures, aligned decimals                         | Displayed rows sum to the displayed total, always                                                                  |
| T-23 | `<VerdictCard />` + cost waterfall                                               | Loss inverts the profit segment; row hover highlights its segment                                                  |
| T-24 | Price-suggestion control                                                         | Unreachable target shows plain-language explanation, not a number                                                  |
| T-25 | Warning surface — all 9 codes, correctly prioritised                             | `NOT_TAX_ADVICE` and `DOORSTEP_LIABILITY` always visible                                                           |

### Phase 5 — Australia

| ID   | Ticket                                                                                                            | Acceptance                                                                                                                                    |
| ---- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| T-26 | Market tabs; AU rules wired through                                                                               | Switching markets preserves product + recalculates                                                                                            |
| T-27 | `<ThresholdBanner />` — both branches, explicit about which applied and why, and that freight is part of the test | Editing freight on a near-threshold product flips the banner live; sweep over the whole current catalogue produces zero unbannered AU results |
| T-28 | eBay AU free tier toggle; Shopify AU ABN toggle                                                                   | GF-08 behaviour reachable through the UI                                                                                                      |

### Phase 6 — ship

| ID   | Ticket                                                                                                                             | Acceptance                                                                                                                                             |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-29 | `/compare` UK vs AU                                                                                                                | Renders both from one product; carries the §7 "not always cheaper" caveat                                                                              |
| T-30 | PostHog events (§13)                                                                                                               | No partner price or margin value in any payload                                                                                                        |
| T-31 | Playwright E2E + GitHub Actions CI                                                                                                 | Green on a preview deployment                                                                                                                          |
| T-32 | Vercel production, cron, Upstash, `lhr1`, preview password                                                                         | Cron fires and writes; verified over 3 consecutive days                                                                                                |
| T-33 | Accessibility + mobile pass                                                                                                        | WCAG AA; keyboard-only complete; real-device check                                                                                                     |
| T-34 | Full-catalogue sweep — every product in the current file, both markets, all platforms, freight at A$0/20/50                        | Zero errors, zero NaN, zero `-0.00`                                                                                                                    |
| T-35 | **Adaptability drill** — regenerate the catalogue from a mutated `.xlsx` (2 products removed, 3 added, 5 repriced, 1 new category) | Build fails on the new category with the R5 message; after mapping it, all fixtures still pass and `catalogue:diff` reports exactly the seeded changes |

**Rough sizing:** Phase 1–2 ≈ 1 week · Phase 3 ≈ 2 days · Phase 4 ≈ 1 week · Phase 5 ≈ 3 days · Phase 6 ≈ 4 days. Total ≈ **3 weeks**, inside the plan's 2–4 week Phase 1 estimate — because the engine spec and its fixtures already exist.

---

## 15. Open questions for Uniqbe

Ordered by how much damage a wrong answer does.

1. **Customs declared value** (T-00) — the tool currently assumes the reseller's USD cost _is_ the declared value. If Uniqbe declares something else, every UK import-VAT figure is wrong by that ratio. Highest-impact unknown in the build.
2. **A$1,000 comparand — `goods` only, set 26 Aug and described as provisional.** This matches ABF's published customs-value rule, which generally excludes international transport, so it is the defensible reading. But it is the *less* conservative one: it puts fewer products into the GST branch, so if a broker files freight-inclusive the tool under-states landed cost on anything sitting just under the line. Six products are within A$50 of it today (§2.8). One conversation with a customs broker closes this; until then it stays open, and it is a one-line config flip either way.
3. **Fee-VAT discrepancy** (§2.5) — **resolved in structure** (the `taxRegistered` toggle handles it; no second control). Still worth confirming with Uniqbe that plan §7 omitted it in error rather than reflecting some arrangement I am unaware of. Worth £9.75 on a single £600 unit, landing on precisely the non-registered newbies the tool is for.
4. **Verdict threshold** (T-04) — 12% is my placeholder. This is a commercial judgement about what Uniqbe wants to tell a partner is "good", not a technical one.
5. **Catalogue drift** (§2.2) — confirmed as expected behaviour; §2.7 now specifies how the build absorbs it. Remaining question is operational, not technical: **who runs `pnpm catalogue:build` and merges the PR** on each of the 2–3 weekly updates, and what the turnaround expectation is. If that person is not comfortable with git, Path B's admin screen moves up the priority list sooner than the plan assumes.
6. **eBay AU free tier** — should it default on or off? It changes AU eBay margin by ~13 percentage points. Defaulting it on flatters the numbers for anyone who has outgrown it.
7. **Professional vs Individual Amazon plan** — the tool defaults to Individual (per-item fee). For a partner doing volume this overstates per-unit cost. Should the default flip above some volume assumption?

---

## Appendix — delivered files

| File                        | Contents                                                                                                                            | Destination in repo          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `data/catalogue.json`       | Snapshot of the 24 Aug list, normalised, checksum `3b7c57f8805c77b2`. **Regenerate on every price update — do not treat as fixed.** | `src/data/catalogue.json`    |
| `data/market-rules.json`    | UK + AU fee/tax/duty tables, typed and slug-keyed                                                                                   | `src/data/market-rules.json` |
| `data/golden-fixtures.json` | 12 calculation + 4 solver vectors, catalogue-independent                                                                            | `data/golden-fixtures.json`  |

All three are Zod-validatable against §5.1 and were produced from the actual source workbook, not from the plan's prose.

_Every fee, tax, duty, and FX figure in this specification inherits the plan's own caveat: indicative as of August 2026, to be re-verified against the official source before launch. `market-rules.json` carries `_meta.lastVerified: null` until Phase 0 closes it out._

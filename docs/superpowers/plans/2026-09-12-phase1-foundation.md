# Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js 15 project skeleton and the three foundation pieces Phase 2 (the calculation engine) depends on: schema validation for all three data files, a working catalogue build pipeline sourced from Uniqbe's real price-list file, and the shared money-math primitives.

**Architecture:** A single Next.js 15 App Router project at the repo root (this git repo is the project — no nested subfolder). Data flows one direction: raw `.xlsx` in `pricelists/` → `scripts/build-catalogue.ts` → `src/data/catalogue.json` (a generated, git-committed artifact). `src/data/market-rules.json` is hand-maintained. Both are Zod-validated at load time via `src/lib/schemas.ts`. `src/engine/money.ts` provides the Decimal-based arithmetic primitives every later engine module will use — it has zero dependents yet in this plan, but Phase 2 cannot start without it.

**Tech Stack:** Next.js 15 (App Router) + React 19 + TypeScript 5.6 strict, Tailwind CSS 4, Zod 3, Decimal.js 10, ExcelJS (catalogue parsing), Vitest 2, ESLint 9 (flat config) + Prettier 3, pnpm, tsx (running `.ts` scripts directly).

**Spec:** `PROJECT_SPEC.md` (this repo) — specifically §0 (manifest), §4 (repo structure), §5 (data layer), §10 (agent workflow files), §14 Phase 1 tickets T-06–T-09.

## Global Constraints

- Package manager `pnpm`; Node `22.x` target (local dev Node is 24.x — compatible, not a blocker).
- `next@15` App Router, `react@19`, `typescript@5.6` with `strict: true`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true` (type-only imports must use `import type`).
- `tailwindcss@4`, `zod@3`, `decimal.js@10`, `vitest@2`, `eslint@9` flat config + `prettier@3`.
- No database (ADR-002) — the catalogue is a committed JSON artifact.
- `src/data/catalogue.json` is **generated** — never hand-edit it (AGENTS.md rule 3).
- No catalogue-derived fact (product counts, category counts, threshold splits) may ever be hardcoded in `src/` (AGENTS.md rule 3a) — a lint exception list is deferred to when `src/engine` exists in Phase 2.
- The catalogue build throws hard on an unmapped category — never silently defaults (R5, §2.7).
- `catalogue:check` must never assert a row count (R4, §2.7) — the price list changes 2–3×/week.
- One ticket per commit, Conventional Commits format.
- Run `pnpm verify` (`typecheck && lint && test`) before considering any task done.

## Deviation from the spec (read before starting Task 3)

`PROJECT_SPEC.md` assumes the build script's input is `Uniqbe_Reseller_Quotation_20260824_v2.xlsx` and that running it reproduces the committed `catalogue.json` (247 items, checksum `3b7c57f8805c77b2`) byte-identically. **That source file is not in this repository.** The only real price-list file present is the untracked `Uniqbe Reseller Quotation 20260826.xlsx` (255 product rows, verified by inspecting its XML directly — sheet name `Pricelist`, header row 8, columns `ProductCode | Brand | Product Name | Category | USD (trailing space in header) | HKD`, data rows 9–263).

So Task 3's acceptance criterion is **redefined**: the build script must produce a schema-valid, deterministic catalogue from the file that actually exists, not byte-match a snapshot whose source is gone. `catalogue.json` will legitimately change (247 → 255 items, new checksum) — this is the adaptability contract (§2.7) working as intended, not a regression.

Also: the real file contains raw category values `"Smart Speaker"` **and** `"smart speaker"` (two casings, same file) plus `"smart living"` — the spec's §2.4 table only lists title-case/lowercase-inconsistent-across-files, not within one file. Task 3's `CATEGORY_MAP` lookup is therefore case-insensitive (trim + lowercase both the map keys and the raw input), so it does not spuriously throw on a casing variant of a category it already knows.

---

## File Structure

```
root/
├── package.json, pnpm-lock.yaml, tsconfig.json, next.config.ts
├── postcss.config.mjs
├── eslint.config.js, .prettierrc.json
├── vitest.config.ts
├── AGENTS.md
├── .vscode/{extensions.json, settings.json, tasks.json}
├── pricelists/
│   └── Uniqbe Reseller Quotation 20260826.xlsx      (moved from repo root)
├── data/
│   └── golden-fixtures.json                          (moved from repo root; unused until Phase 2)
├── src/
│   ├── app/{layout.tsx, page.tsx, globals.css}
│   ├── data/{catalogue.json, market-rules.json}      (moved/regenerated)
│   ├── engine/money.ts
│   └── lib/schemas.ts
├── scripts/{build-catalogue.ts, catalogue-diff.ts}
└── tests/
    ├── lib/schemas.test.ts
    ├── scripts/{build-catalogue.test.ts, catalogue-diff.test.ts}
    └── engine/money.test.ts
```

---

### Task 1: T-06 — Scaffold the Next.js project and relocate data files

**Files:**

- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.js`, `.prettierrc.json`, `vitest.config.ts`, `AGENTS.md`
- Create: `.vscode/extensions.json`, `.vscode/settings.json`, `.vscode/tasks.json`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Move: `Uniqbe Reseller Quotation 20260826.xlsx` → `pricelists/Uniqbe Reseller Quotation 20260826.xlsx`
- Move: `market-rules.json` → `src/data/market-rules.json`
- Move: `catalogue.json` → `src/data/catalogue.json`
- Move: `golden-fixtures.json` → `data/golden-fixtures.json`

**Interfaces:**

- Produces: a working `pnpm verify` pipeline (`typecheck`, `lint`, `test`) that later tasks extend. No exported functions yet.

- [ ] **Step 1: Initialize the package and install dependencies**

```bash
pnpm init
pnpm add next@15 react@19 react-dom@19
pnpm add -D typescript@5.6 @types/node @types/react @types/react-dom \
  tailwindcss@4 @tailwindcss/postcss postcss \
  eslint@9 @eslint/js typescript-eslint eslint-config-prettier prettier@3 \
  vitest@2 tsx
```

- [ ] **Step 2: Write `package.json` scripts**

```json
{
  "name": "uniqbe-price-simulator",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": "22.x" },
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . && prettier --check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "verify": "pnpm run typecheck && pnpm run lint && pnpm run test"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Write `next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 5: Write Tailwind 4 setup**

`postcss.config.mjs`:

```javascript
export default {
  plugins: { "@tailwindcss/postcss": {} },
};
```

`src/app/globals.css`:

```css
@import "tailwindcss";
```

- [ ] **Step 6: Write `eslint.config.js` and `.prettierrc.json`**

```javascript
// eslint.config.js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["node_modules/**", ".next/**", "src/data/catalogue.json"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
);
```

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 7: Write `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    include: ["tests/**/*.test.ts"],
  },
});
```

`passWithNoTests: true` is required here because this task adds no tests of its own — Task 2 adds the first real ones.

- [ ] **Step 8: Write the minimal app shell**

`src/app/layout.tsx`:

```tsx
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Uniqbe Price Simulator",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:

```tsx
export default function HomePage() {
  return <main>Uniqbe Price Simulator — under construction.</main>;
}
```

- [ ] **Step 9: Write `.vscode/extensions.json` and `.vscode/settings.json`** (verbatim from `PROJECT_SPEC.md` §10.1–10.2)

```json
// .vscode/extensions.json
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

```json
// .vscode/settings.json
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

`.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    { "label": "dev", "type": "shell", "command": "pnpm dev", "problemMatcher": [] },
    { "label": "verify", "type": "shell", "command": "pnpm verify", "problemMatcher": [] },
    {
      "label": "catalogue:build",
      "type": "shell",
      "command": "pnpm catalogue:build",
      "problemMatcher": []
    }
  ]
}
```

- [ ] **Step 10: Write `AGENTS.md`** (verbatim from `PROJECT_SPEC.md` §10.3)

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
   5a. The AU A$1,000 test uses the comparand read from `market-rules.json`
   (`deMinimisComparand`, currently `"goods"`); never inline the rule.
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

- [ ] **Step 11: Relocate the delivered artifacts**

```bash
mkdir -p pricelists src/data data
git mv "Uniqbe Reseller Quotation 20260826.xlsx" "pricelists/Uniqbe Reseller Quotation 20260826.xlsx"
git mv market-rules.json src/data/market-rules.json
git mv catalogue.json src/data/catalogue.json
git mv golden-fixtures.json data/golden-fixtures.json
```

- [ ] **Step 12: Run verify to confirm the scaffold is sound**

Run: `pnpm verify`
Expected: `typecheck`, `lint`, and `test` (0 tests, passes due to `passWithNoTests`) all succeed.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 15 project and relocate delivered data artifacts"
```

---

### Task 2: T-07 — Zod schemas for catalogue, market-rules, and FX snapshot

**Files:**

- Create: `src/lib/schemas.ts`
- Test: `tests/lib/schemas.test.ts`

**Interfaces:**

- Consumes: `src/data/market-rules.json` (real file, moved in Task 1) as a validation fixture.
- Produces: `CategorySlug`, `CatalogueItem`, `Catalogue`, `MarketRules`, `FxSnapshot` — Zod schemas exported from `src/lib/schemas.ts`, each with an inferred TS type of the same name suffixed `Type` (e.g. `CatalogueType`). Consumed by Task 3 (`scripts/build-catalogue.ts` validates its own output against `Catalogue`) and by Phase 2's engine.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/schemas.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Catalogue, CatalogueItem, MarketRules, FxSnapshot } from "../../src/lib/schemas";

describe("CatalogueItem", () => {
  it("accepts a real catalogue item", () => {
    const item = {
      code: "AM00106",
      brand: "Amazon",
      name: "Echo Spot 2024 (Black)",
      categoryRaw: "Smart Speaker",
      category: "smart-home",
      categoryLabel: "Smart Home",
      usd: 70,
      hkdRef: 546,
      storageGb: null,
      search: "amazon echo spot 2024 (black) smart home",
    };
    expect(() => CatalogueItem.parse(item)).not.toThrow();
  });

  it("rejects a non-integer usd value", () => {
    const item = {
      code: "AM00106",
      brand: "Amazon",
      name: "Echo Spot 2024 (Black)",
      categoryRaw: "Smart Speaker",
      category: "smart-home",
      categoryLabel: "Smart Home",
      usd: 69.99,
      hkdRef: 546,
      storageGb: null,
      search: "amazon echo spot 2024 (black) smart home",
    };
    expect(() => CatalogueItem.parse(item)).toThrow();
  });

  it("rejects an unknown category slug", () => {
    const item = {
      code: "AM00106",
      brand: "Amazon",
      name: "Echo Spot 2024 (Black)",
      categoryRaw: "Drones",
      category: "drone",
      categoryLabel: "Drone",
      usd: 70,
      hkdRef: 546,
      storageGb: null,
      search: "amazon echo spot 2024 (black) drone",
    };
    expect(() => CatalogueItem.parse(item)).toThrow();
  });
});

describe("Catalogue", () => {
  it("parses the real generated catalogue file", () => {
    const raw = JSON.parse(readFileSync("src/data/catalogue.json", "utf-8"));
    expect(() => Catalogue.parse(raw)).not.toThrow();
  });
});

describe("MarketRules", () => {
  it("parses the real market-rules.json file", () => {
    const raw = JSON.parse(readFileSync("src/data/market-rules.json", "utf-8"));
    expect(() => MarketRules.parse(raw)).not.toThrow();
  });

  it("rejects a market block with a non-numeric duty percentage", () => {
    const raw = JSON.parse(readFileSync("src/data/market-rules.json", "utf-8"));
    raw.UK.dutyPctByCategory["mobile-phone"] = "zero";
    expect(() => MarketRules.parse(raw)).toThrow();
  });
});

describe("FxSnapshot", () => {
  it("accepts a well-formed snapshot", () => {
    const snapshot = {
      base: "USD",
      rates: { GBP: 0.7424, AUD: 1.395 },
      asOf: "2026-08-25",
      fetchedAt: "2026-08-26T06:00:00.000Z",
      provider: "frankfurter",
      degraded: false,
      ageDays: 1,
    };
    expect(() => FxSnapshot.parse(snapshot)).not.toThrow();
  });

  it("rejects an unknown provider", () => {
    const snapshot = {
      base: "USD",
      rates: { GBP: 0.7424, AUD: 1.395 },
      asOf: "2026-08-25",
      fetchedAt: "2026-08-26T06:00:00.000Z",
      provider: "openexchangerates",
      degraded: false,
      ageDays: 1,
    };
    expect(() => FxSnapshot.parse(snapshot)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/schemas.test.ts`
Expected: FAIL — `src/lib/schemas.ts` does not exist yet (`Cannot find module '../../src/lib/schemas'`).

- [ ] **Step 3: Write `src/lib/schemas.ts`**

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
export type CategorySlugType = z.infer<typeof CategorySlug>;

export const CatalogueItem = z.object({
  code: z.string().regex(/^[A-Z]{2}\d{5}$/),
  brand: z.string().min(1),
  name: z.string().min(1),
  categoryRaw: z.string().min(1),
  category: CategorySlug,
  categoryLabel: z.string().min(1),
  usd: z.number().int().positive(),
  hkdRef: z.number().int().positive(),
  storageGb: z.number().int().positive().nullable(),
  search: z.string(),
});
export type CatalogueItemType = z.infer<typeof CatalogueItem>;

export const Catalogue = z.object({
  schemaVersion: z.literal(1),
  sourceFile: z.string(),
  sourceSheet: z.literal("Pricelist"),
  priceListDate: z.string().date(),
  generatedAt: z.string().date(),
  baseCurrency: z.literal("USD"),
  referenceCurrency: z.literal("HKD"),
  productCount: z.number().int(),
  checksum: z.string(),
  items: z.array(CatalogueItem),
});
export type CatalogueType = z.infer<typeof Catalogue>;

const AmazonFees = z.object({
  referralFeePctDefault: z.number(),
  referralFeePctByCategory: z.record(CategorySlug, z.number()),
  minReferralFee: z.number().optional(),
  individualPerItemFee: z.number(),
  professionalMonthlyFee: z.number(),
  feesAreTaxable: z.boolean(),
});

const EbayFees = z.object({
  referralFeePctDefault: z.number(),
  referralFeePctByCategory: z.record(CategorySlug, z.number()),
  regulatoryFeePct: z.number(),
  perOrderFee: z.object({
    thresholdLocal: z.number(),
    low: z.number(),
    high: z.number(),
  }),
  tieredAbove: z.object({ thresholdLocal: z.number(), pctAbove: z.number() }).optional(),
  freeTierTrailingSalesLocal: z.number().optional(),
  individualPerItemFee: z.number(),
  feesAreTaxable: z.boolean(),
});

const ShopifyPlanFee = z.object({ pct: z.number(), fixed: z.number() });

const ShopifyFees = z.object({
  referralFeePctDefault: z.number(),
  monthlyByPlan: z.object({ basic: z.number(), grow: z.number(), advanced: z.number() }),
  payments: z.object({ basic: ShopifyPlanFee, grow: ShopifyPlanFee, advanced: ShopifyPlanFee }),
  subscriptionGstUnlessAbn: z.boolean().optional(),
  feesAreTaxable: z.boolean(),
  requiresAdSpendInput: z.boolean(),
});

const OtherFees = z.object({
  referralFeePctDefault: z.number(),
  feesAreTaxable: z.literal(false),
});

const MarketBlock = z.object({
  marketLabel: z.string(),
  currency: z.enum(["GBP", "AUD"]),
  locale: z.string(),
  consumptionTaxName: z.enum(["VAT", "GST"]),
  consumptionTaxRatePct: z.number(),
  deMinimisLocal: z.number().nullable(),
  deMinimisNote: z.string(),
  deMinimisComparand: z.enum(["goods", "goods+freight"]).optional(),
  deMinimisComparandNote: z.string().optional(),
  importTaxBase: z.string(),
  liableParty: z.string(),
  dutyPctByCategory: z.record(CategorySlug, z.number()),
  platforms: z.object({
    amazon: AmazonFees,
    ebay: EbayFees,
    shopify: ShopifyFees,
    other: OtherFees,
  }),
});

export const MarketRules = z.object({
  _meta: z.object({
    schemaVersion: z.number(),
    sourceSection: z.string(),
    verificationStatus: z.string(),
    lastVerified: z.string().nullable(),
    specVersion: z.string(),
    changeLog: z.array(z.string()),
  }),
  UK: MarketBlock,
  AU: MarketBlock,
});
export type MarketRulesType = z.infer<typeof MarketRules>;

export const FxSnapshot = z.object({
  base: z.literal("USD"),
  rates: z.object({ GBP: z.number(), AUD: z.number() }),
  asOf: z.string().date(),
  fetchedAt: z.string(),
  provider: z.enum(["frankfurter", "fallback", "seed"]),
  degraded: z.boolean(),
  ageDays: z.number(),
});
export type FxSnapshotType = z.infer<typeof FxSnapshot>;
```

Note: `referenceCurrency` is added on top of the literal §5.1 spec text because the real delivered `catalogue.json` already carries that field — see the file read during planning.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/schemas.test.ts`
Expected: PASS (all cases)

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas.ts tests/lib/schemas.test.ts
git commit -m "feat: add Zod schemas for catalogue, market-rules, and FX snapshot"
```

---

### Task 3: T-08 — `scripts/build-catalogue.ts` + `--verify`

**Files:**

- Create: `scripts/build-catalogue.ts`
- Test: `tests/scripts/build-catalogue.test.ts`
- Modify: `package.json:scripts` (add `catalogue:build`, `catalogue:check`; update `build`)
- Regenerates: `src/data/catalogue.json`

**Interfaces:**

- Consumes: `CategorySlugType`, `CatalogueItem`, `Catalogue` from `src/lib/schemas.ts` (Task 2); `pricelists/Uniqbe Reseller Quotation 20260826.xlsx` (moved in Task 1).
- Produces: exported pure functions `mapCategory(raw: string): { slug: CategorySlugType; label: string }`, `deriveStorageGb(name: string): number | null`, `buildSearchHaystack(brand: string, name: string, categoryLabel: string): string`, `computeChecksum(items: CatalogueItemType[]): string`, `parsePriceListDate(sourceFile: string): string`, `buildCatalogue(rows: RawRow[], sourceFile: string): CatalogueType`, and the `RawRow` type — all consumed by Task 4 (`catalogue-diff.ts` reads the same `CatalogueItemType` shape) and, later, by the Phase 2 engine and Phase 6's adaptability drill (T-35).

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/scripts/build-catalogue.test.ts
import { describe, expect, it, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import {
  mapCategory,
  deriveStorageGb,
  buildSearchHaystack,
  computeChecksum,
  parsePriceListDate,
} from "../../scripts/build-catalogue";
import { Catalogue } from "../../src/lib/schemas";

describe("mapCategory", () => {
  it("maps every known raw category, case-insensitively", () => {
    expect(mapCategory("Mobile Phone").slug).toBe("mobile-phone");
    expect(mapCategory("Earphones").slug).toBe("audio");
    expect(mapCategory("Smart Wearables").slug).toBe("wearable");
    expect(mapCategory("Tablet").slug).toBe("tablet");
    expect(mapCategory("Gaming and Consoles").slug).toBe("gaming");
    expect(mapCategory("Camera").slug).toBe("camera");
    expect(mapCategory("Smart Speaker").slug).toBe("smart-home");
    expect(mapCategory("smart speaker").slug).toBe("smart-home");
    expect(mapCategory("smart living").slug).toBe("smart-home");
    expect(mapCategory("Keyboard").slug).toBe("computer-accessory");
    expect(mapCategory("SmartTag").slug).toBe("computer-accessory");
    expect(mapCategory("Accessories").slug).toBe("computer-accessory");
    expect(mapCategory("Vacuumn Cleaners").slug).toBe("home-appliance");
  });

  it("throws with a fix instruction on an unmapped category", () => {
    expect(() => mapCategory("Drones")).toThrowError(/Unmapped category "Drones"/);
    expect(() => mapCategory("Drones")).toThrowError(/CATEGORY_MAP/);
  });
});

describe("deriveStorageGb", () => {
  it("parses GB", () => {
    expect(deriveStorageGb("Galaxy S25 256GB")).toBe(256);
  });
  it("parses TB as GB x 1024", () => {
    expect(deriveStorageGb("iPhone 17 Pro 1TB")).toBe(1024);
  });
  it("returns null when absent", () => {
    expect(deriveStorageGb("Echo Dot 5th Generation (Charcoal)")).toBeNull();
  });
});

describe("buildSearchHaystack", () => {
  it("lowercases and joins brand, name, category label", () => {
    expect(buildSearchHaystack("Amazon", "Echo Spot 2024 (Black)", "Smart Home")).toBe(
      "amazon echo spot 2024 (black) smart home",
    );
  });
});

describe("computeChecksum", () => {
  it("is deterministic for the same items", () => {
    const items = [{ code: "AA00001" }];
    expect(computeChecksum(items as never)).toBe(computeChecksum(items as never));
  });
  it("changes when items change", () => {
    const a = computeChecksum([{ code: "AA00001" }] as never);
    const b = computeChecksum([{ code: "AA00002" }] as never);
    expect(a).not.toBe(b);
  });
});

describe("parsePriceListDate", () => {
  it("extracts YYYY-MM-DD from a filename with spaces", () => {
    expect(parsePriceListDate("Uniqbe Reseller Quotation 20260826.xlsx")).toBe("2026-08-26");
  });
  it("throws when no date is present", () => {
    expect(() => parsePriceListDate("pricelist.xlsx")).toThrow();
  });
});

describe("build-catalogue CLI, run against the real price list", () => {
  const outputPath = "src/data/catalogue.json";
  let before: string;

  beforeAll(() => {
    before = readFileSync(outputPath, "utf-8");
    execSync("pnpm tsx scripts/build-catalogue.ts", { stdio: "pipe" });
  });

  it("produces a schema-valid catalogue", () => {
    const raw = JSON.parse(readFileSync(outputPath, "utf-8"));
    expect(() => Catalogue.parse(raw)).not.toThrow();
  });

  it("has no duplicate product codes", () => {
    const raw = JSON.parse(readFileSync(outputPath, "utf-8"));
    const codes = raw.items.map((i: { code: string }) => i.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("--verify exits 0 against its own freshly-built output", () => {
    expect(() =>
      execSync("pnpm tsx scripts/build-catalogue.ts --verify", { stdio: "pipe" }),
    ).not.toThrow();
  });

  it("--verify exits non-zero when the committed file is stale", () => {
    const raw = JSON.parse(readFileSync(outputPath, "utf-8"));
    raw.checksum = "0000000000000000";
    writeFileSync(outputPath, JSON.stringify(raw, null, 1));
    expect(() =>
      execSync("pnpm tsx scripts/build-catalogue.ts --verify", { stdio: "pipe" }),
    ).toThrow();
    // restore
    writeFileSync(outputPath, before);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/scripts/build-catalogue.test.ts`
Expected: FAIL — `scripts/build-catalogue.ts` does not exist yet.

- [ ] **Step 3: Write `scripts/build-catalogue.ts`**

```typescript
// scripts/build-catalogue.ts
import { createHash } from "node:crypto";
import { readdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { Catalogue, type CategorySlugType, type CatalogueItemType } from "../src/lib/schemas";

export type RawRow = {
  productCode: string;
  brand: string;
  name: string;
  categoryRaw: string;
  usd: number;
  hkd: number;
};

const CATEGORY_MAP: Record<string, { slug: CategorySlugType; label: string }> = {
  "mobile phone": { slug: "mobile-phone", label: "Mobile Phone" },
  earphones: { slug: "audio", label: "Audio" },
  "smart wearables": { slug: "wearable", label: "Smart Wearables" },
  tablet: { slug: "tablet", label: "Tablet" },
  "gaming and consoles": { slug: "gaming", label: "Gaming & Consoles" },
  camera: { slug: "camera", label: "Camera" },
  "smart speaker": { slug: "smart-home", label: "Smart Home" },
  "smart living": { slug: "smart-home", label: "Smart Home" },
  keyboard: { slug: "computer-accessory", label: "Computer Accessories" },
  smarttag: { slug: "computer-accessory", label: "Computer Accessories" },
  accessories: { slug: "computer-accessory", label: "Computer Accessories" },
  "vacuumn cleaners": { slug: "home-appliance", label: "Home Appliances" },
};

export function mapCategory(raw: string): { slug: CategorySlugType; label: string } {
  const key = raw.trim().toLowerCase();
  const mapped = CATEGORY_MAP[key];
  if (!mapped) {
    throw new Error(
      `Unmapped category "${raw}".\n` +
        `  Add to CATEGORY_MAP in scripts/build-catalogue.ts:\n` +
        `      "${key}": { slug: "?", label: "?" },\n` +
        `  Then add duty % and referral fee % for the new slug to BOTH markets\n` +
        `  in src/data/market-rules.json, or the fee lookup will throw at runtime.`,
    );
  }
  return mapped;
}

export function deriveStorageGb(name: string): number | null {
  const match = name.match(/(\d+)\s*(TB|GB)/i);
  if (!match?.[1] || !match[2]) return null;
  const value = Number(match[1]);
  return match[2].toUpperCase() === "TB" ? value * 1024 : value;
}

export function buildSearchHaystack(brand: string, name: string, categoryLabel: string): string {
  return `${brand} ${name} ${categoryLabel}`.toLowerCase();
}

export function computeChecksum(items: CatalogueItemType[]): string {
  return createHash("sha256").update(JSON.stringify(items)).digest("hex").slice(0, 16);
}

export function parsePriceListDate(sourceFile: string): string {
  const match = sourceFile.match(/(\d{4})(\d{2})(\d{2})/);
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new Error(`Could not parse a YYYYMMDD date out of source filename "${sourceFile}".`);
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function normalizeRow(raw: RawRow): CatalogueItemType {
  if (!Number.isInteger(raw.usd) || raw.usd <= 0) {
    throw new Error(`Row ${raw.productCode}: USD must be a positive integer, got ${raw.usd}`);
  }
  const ratio = raw.hkd / raw.usd;
  if (ratio < 7.7 || ratio > 7.9) {
    console.warn(
      `WARN: ${raw.productCode} has HKD/USD ratio ${ratio.toFixed(3)}, outside the expected 7.70-7.90 peg band.`,
    );
  }
  const { slug, label } = mapCategory(raw.categoryRaw);
  return {
    code: raw.productCode,
    brand: raw.brand,
    name: raw.name,
    categoryRaw: raw.categoryRaw,
    category: slug,
    categoryLabel: label,
    usd: raw.usd,
    hkdRef: raw.hkd,
    storageGb: deriveStorageGb(raw.name),
    search: buildSearchHaystack(raw.brand, raw.name, label),
  };
}

export function buildCatalogue(rows: RawRow[], sourceFile: string) {
  const codes = new Set<string>();
  const items = rows.map((raw) => {
    if (codes.has(raw.productCode)) {
      throw new Error(`Duplicate ProductCode "${raw.productCode}" found in ${sourceFile}.`);
    }
    codes.add(raw.productCode);
    return normalizeRow(raw);
  });
  return Catalogue.parse({
    schemaVersion: 1,
    sourceFile,
    sourceSheet: "Pricelist",
    priceListDate: parsePriceListDate(sourceFile),
    generatedAt: new Date().toISOString().slice(0, 10),
    baseCurrency: "USD",
    referenceCurrency: "HKD",
    productCount: items.length,
    checksum: computeChecksum(items),
    items,
  });
}

const EXPECTED_HEADERS = ["productcode", "brand", "product name", "category", "usd", "hkd"];

async function readWorkbook(path: string): Promise<{ rows: RawRow[]; sourceFile: string }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const sheet = workbook.getWorksheet("Pricelist");
  if (!sheet) throw new Error(`Sheet "Pricelist" not found in ${path}.`);

  let headerRow = -1;
  for (let r = 1; r <= 20; r++) {
    const row = sheet.getRow(r);
    const values = EXPECTED_HEADERS.map((_, i) =>
      String(row.getCell(i + 1).value ?? "")
        .trim()
        .toLowerCase(),
    );
    if (JSON.stringify(values) === JSON.stringify(EXPECTED_HEADERS)) {
      headerRow = r;
      break;
    }
  }
  if (headerRow === -1) {
    throw new Error(
      `Could not find a header row matching [${EXPECTED_HEADERS.join(", ")}] in the first 20 rows of "${path}".`,
    );
  }

  const rows: RawRow[] = [];
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const productCode = String(row.getCell(1).value ?? "").trim();
    if (productCode === "") break;
    rows.push({
      productCode,
      brand: String(row.getCell(2).value ?? "").trim(),
      name: String(row.getCell(3).value ?? "").trim(),
      categoryRaw: String(row.getCell(4).value ?? "").trim(),
      usd: Number(row.getCell(5).value),
      hkd: Number(row.getCell(6).value),
    });
  }
  return { rows, sourceFile: path.split(/[/\\]/).pop() ?? path };
}

function resolveInputPath(): string {
  const argPath = process.argv.find((a) => a.endsWith(".xlsx"));
  if (argPath) return argPath;
  const dir = "pricelists";
  const candidates = readdirSync(dir).filter((f) => f.endsWith(".xlsx"));
  if (candidates.length === 0) throw new Error(`No .xlsx files found in ./${dir}/`);
  const newest = candidates.sort().at(-1);
  if (!newest) throw new Error(`No .xlsx files found in ./${dir}/`);
  return join(dir, newest);
}

async function main() {
  const verify = process.argv.includes("--verify");
  const inputPath = resolveInputPath();
  const { rows, sourceFile } = await readWorkbook(inputPath);
  const catalogue = buildCatalogue(rows, sourceFile);
  const outputPath = "src/data/catalogue.json";

  if (verify) {
    if (!existsSync(outputPath)) {
      console.error(`✗ ${outputPath} does not exist.`);
      process.exit(1);
    }
    const committed = JSON.parse(readFileSync(outputPath, "utf-8"));
    if (committed.checksum !== catalogue.checksum) {
      console.error(
        `✗ Checksum mismatch: committed ${committed.checksum}, freshly built ${catalogue.checksum}.\n` +
          `  Run "pnpm catalogue:build" and commit the result.`,
      );
      process.exit(1);
    }
    console.log(`✓ ${outputPath} matches ${inputPath} (checksum ${catalogue.checksum}).`);
    return;
  }

  writeFileSync(outputPath, JSON.stringify(catalogue, null, 1));
  console.log(
    `Wrote ${catalogue.items.length} products to ${outputPath} (checksum ${catalogue.checksum}).`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 4: Install `exceljs` and run tests to verify they pass**

```bash
pnpm add exceljs
pnpm vitest run tests/scripts/build-catalogue.test.ts
```

Expected: PASS (all cases). This regenerates `src/data/catalogue.json` as a side effect of the CLI-invoking tests — that is intended; see "Deviation from the spec" above.

- [ ] **Step 5: Update `package.json` scripts**

```json
{
  "scripts": {
    "build": "pnpm run catalogue:check && next build",
    "catalogue:build": "tsx scripts/build-catalogue.ts",
    "catalogue:check": "tsx scripts/build-catalogue.ts --verify"
  }
}
```

- [ ] **Step 6: Run the full verify pipeline and commit**

```bash
pnpm verify
git add scripts/build-catalogue.ts tests/scripts/build-catalogue.test.ts \
  package.json pnpm-lock.yaml src/data/catalogue.json
git commit -m "feat: build catalogue.json from the real Uniqbe price list via build-catalogue.ts"
```

---

### Task 4: T-08b — `scripts/catalogue-diff.ts`

**Files:**

- Create: `scripts/catalogue-diff.ts`
- Test: `tests/scripts/catalogue-diff.test.ts`
- Modify: `package.json:scripts` (add `catalogue:diff`)

**Interfaces:**

- Consumes: `CatalogueItemType` from `src/lib/schemas.ts` (Task 2).
- Produces: `diffCatalogues(oldItems: CatalogueItemType[], newItems: CatalogueItemType[]): CatalogueDiff` and the `CatalogueDiff` type, exported from `scripts/catalogue-diff.ts`. No other task in this plan consumes it; it exists for the human PR-review workflow described in §2.7 R9, and later phases' operator runbook (§5.2).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/scripts/catalogue-diff.test.ts
import { describe, expect, it } from "vitest";
import { diffCatalogues } from "../../scripts/catalogue-diff";
import type { CatalogueItemType } from "../../src/lib/schemas";

function item(overrides: Partial<CatalogueItemType>): CatalogueItemType {
  return {
    code: "AA00001",
    brand: "TestBrand",
    name: "Test Product",
    categoryRaw: "Tablet",
    category: "tablet",
    categoryLabel: "Tablet",
    usd: 100,
    hkdRef: 780,
    storageGb: null,
    search: "testbrand test product tablet",
    ...overrides,
  };
}

describe("diffCatalogues", () => {
  it("detects an added product", () => {
    const before = [item({ code: "AA00001" })];
    const after = [item({ code: "AA00001" }), item({ code: "AA00002" })];
    const diff = diffCatalogues(before, after);
    expect(diff.added.map((i) => i.code)).toEqual(["AA00002"]);
    expect(diff.removed).toHaveLength(0);
    expect(diff.repriced).toHaveLength(0);
  });

  it("detects a removed product", () => {
    const before = [item({ code: "AA00001" }), item({ code: "AA00002" })];
    const after = [item({ code: "AA00001" })];
    const diff = diffCatalogues(before, after);
    expect(diff.removed.map((i) => i.code)).toEqual(["AA00002"]);
  });

  it("detects a repriced product with a percentage delta", () => {
    const before = [item({ code: "AA00001", usd: 100 })];
    const after = [item({ code: "AA00001", usd: 110 })];
    const diff = diffCatalogues(before, after);
    expect(diff.repriced).toEqual([{ code: "AA00001", oldUsd: 100, newUsd: 110, pctChange: 10 }]);
  });

  it("reports no changes for identical catalogues", () => {
    const items = [item({ code: "AA00001" })];
    const diff = diffCatalogues(items, items);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.repriced).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/scripts/catalogue-diff.test.ts`
Expected: FAIL — `scripts/catalogue-diff.ts` does not exist yet.

- [ ] **Step 3: Write `scripts/catalogue-diff.ts`**

```typescript
// scripts/catalogue-diff.ts
import { readFileSync } from "node:fs";
import type { CatalogueItemType } from "../src/lib/schemas";

export type CatalogueDiff = {
  added: CatalogueItemType[];
  removed: CatalogueItemType[];
  repriced: { code: string; oldUsd: number; newUsd: number; pctChange: number }[];
};

export function diffCatalogues(
  oldItems: CatalogueItemType[],
  newItems: CatalogueItemType[],
): CatalogueDiff {
  const oldByCode = new Map(oldItems.map((i) => [i.code, i]));
  const newByCode = new Map(newItems.map((i) => [i.code, i]));

  const added = newItems.filter((i) => !oldByCode.has(i.code));
  const removed = oldItems.filter((i) => !newByCode.has(i.code));
  const repriced = newItems
    .filter((i) => {
      const before = oldByCode.get(i.code);
      return before !== undefined && before.usd !== i.usd;
    })
    .map((i) => {
      const before = oldByCode.get(i.code);
      if (!before) throw new Error(`Unreachable: ${i.code} was filtered as present.`);
      return {
        code: i.code,
        oldUsd: before.usd,
        newUsd: i.usd,
        pctChange: Math.round(((i.usd - before.usd) / before.usd) * 1000) / 10,
      };
    });

  return { added, removed, repriced };
}

function main() {
  const [, , oldPath, newPath] = process.argv;
  if (!oldPath || !newPath) {
    console.error("Usage: pnpm catalogue:diff <old.json> <new.json>");
    process.exit(1);
  }
  const oldCatalogue = JSON.parse(readFileSync(oldPath, "utf-8"));
  const newCatalogue = JSON.parse(readFileSync(newPath, "utf-8"));
  const diff = diffCatalogues(oldCatalogue.items, newCatalogue.items);

  console.log(
    `${diff.added.length} added, ${diff.removed.length} removed, ${diff.repriced.length} repriced`,
  );
  for (const i of diff.added) console.log(`  + ${i.code} ${i.brand} ${i.name} ($${i.usd})`);
  for (const i of diff.removed) console.log(`  - ${i.code} ${i.brand} ${i.name}`);
  for (const r of diff.repriced) {
    const sign = r.pctChange >= 0 ? "+" : "";
    console.log(`  ~ ${r.code} $${r.oldUsd} -> $${r.newUsd} (${sign}${r.pctChange}%)`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/scripts/catalogue-diff.test.ts`
Expected: PASS (all cases)

- [ ] **Step 5: Add the script and commit**

```json
{ "scripts": { "catalogue:diff": "tsx scripts/catalogue-diff.ts" } }
```

```bash
git add scripts/catalogue-diff.ts tests/scripts/catalogue-diff.test.ts package.json
git commit -m "feat: add catalogue-diff.ts for reviewing price-list updates"
```

---

### Task 5: T-09 — `src/engine/money.ts`

**Files:**

- Create: `src/engine/money.ts`
- Test: `tests/engine/money.test.ts`

**Interfaces:**

- Consumes: `decimal.js`.
- Produces: `Money` (a `Decimal` class cloned with fixed rounding config), `r2(value: Decimal.Value): Decimal`, `assertBreakdownSums(lines: string[], total: string): void`, exported from `src/engine/money.ts`. Consumed by every Phase 2 engine module (`markets/uk.ts`, `markets/au.ts`, `platforms/*.ts`, `index.ts`) — none of which exist in this plan, but their calculations all round through `r2` and verify through `assertBreakdownSums`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/engine/money.test.ts
import { describe, expect, it } from "vitest";
import { Money, r2, assertBreakdownSums } from "../../src/engine/money";

describe("r2", () => {
  it("rounds half up at the exact 2dp boundary", () => {
    expect(r2("0.005").toFixed(2)).toBe("0.01");
    expect(r2("0.995").toFixed(2)).toBe("1.00");
  });

  it("rounds half away from zero for negatives", () => {
    expect(r2("-0.005").toFixed(2)).toBe("-0.01");
  });

  it("never produces a signed zero string", () => {
    expect(r2("-0.001").toFixed(2)).toBe("0.00");
    expect(r2("-0.0000001").toFixed(2)).toBe("0.00");
  });

  it("leaves an already-2dp value unchanged", () => {
    expect(r2("47.99").toFixed(2)).toBe("47.99");
  });

  it("accepts a Money instance directly", () => {
    expect(r2(new Money("599.996")).toFixed(2)).toBe("600.00");
  });
});

describe("assertBreakdownSums", () => {
  it("does not throw when lines sum exactly to the total", () => {
    expect(() => assertBreakdownSums(["599.99", "-343.73", "-12.00"], "244.26")).not.toThrow();
  });

  it("throws with actual vs expected when lines are short by a cent", () => {
    expect(() => assertBreakdownSums(["599.99", "-343.73", "-12.01"], "244.26")).toThrowError(
      /244\.25.*244\.26/s,
    );
  });

  it("treats an empty line list as summing to zero", () => {
    expect(() => assertBreakdownSums([], "0.00")).not.toThrow();
    expect(() => assertBreakdownSums([], "0.01")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/engine/money.test.ts`
Expected: FAIL — `src/engine/money.ts` does not exist yet.

- [ ] **Step 3: Write `src/engine/money.ts`**

```typescript
// src/engine/money.ts
import Decimal from "decimal.js";

export const Money = Decimal.clone({
  precision: 30,
  rounding: Decimal.ROUND_HALF_UP,
});
export type MoneyType = InstanceType<typeof Money>;

export function r2(value: Decimal.Value): MoneyType {
  const rounded = new Money(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return rounded.isZero() ? new Money(0) : rounded;
}

export function assertBreakdownSums(lines: string[], total: string): void {
  const actual = lines.reduce((sum, line) => sum.plus(new Money(line)), new Money(0));
  const expected = new Money(total);
  if (!actual.equals(expected)) {
    throw new Error(
      `Breakdown lines sum to ${actual.toFixed(2)} but expected total is ${expected.toFixed(2)}.`,
    );
  }
}
```

`r2` normalizes any negative-zero result (`-0.00`) to a plain `0` `Money` instance — this is the property-test invariant #6 from §11.3 ("no `-0.00` in any output field") enforced at the one place every line item passes through, rather than left for Phase 2 to remember.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/engine/money.test.ts`
Expected: PASS (all cases)

- [ ] **Step 5: Run full verify and commit**

```bash
pnpm verify
git add src/engine/money.ts tests/engine/money.test.ts
git commit -m "feat: add Decimal-based money primitives (r2, assertBreakdownSums)"
```

---

## Verification (end-to-end, after all 5 tasks)

```bash
pnpm verify                                  # typecheck + lint + all tests green
pnpm dev                                     # confirm the app boots at localhost:3000 with the placeholder page
cat src/data/catalogue.json | node -e "const c=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(c.productCount, c.items.length, c.checksum)"
pnpm catalogue:build && pnpm catalogue:check # confirm the build is idempotent
```

At the end of Task 5, `src/data/catalogue.json` should hold 255 items sourced from `Uniqbe Reseller Quotation 20260826.xlsx`, `src/lib/schemas.ts` validates all three data files, and `src/engine/money.ts` is ready for Phase 2 (`markets/uk.ts`, `markets/au.ts`, the platform fee modules, and `verdict.ts`) to build on — none of which are in scope for this plan.

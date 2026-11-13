import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import catalogueRaw from "../../src/data/catalogue.json";
import rulesRaw from "../../src/data/market-rules.json";
import fxSeedRaw from "../../src/data/fx-seed.json";
import { Catalogue, FxRawSnapshot, MarketRules } from "../../src/lib/schemas";
import { toFxSnapshot } from "../../src/fx/store";
import { calculate, suggestPrice } from "../../src/engine";
import { buildMarketInput, fxInputFor } from "../../src/lib/compare";
import type { FxInput, Platform, SimulationInput } from "../../src/engine/types";

const catalogue = Catalogue.parse(catalogueRaw);
const rules = MarketRules.parse(rulesRaw);
const fx = toFxSnapshot(FxRawSnapshot.parse(fxSeedRaw), new Date("2026-08-25T12:00:00.000Z"));
const auFx = fxInputFor(fx, "AU");

const PLATFORMS: Platform[] = ["amazon", "ebay", "shopify", "woocommerce"];
const TARGETS = [3, 5, 8, 10];
const REGISTERED = [false, true];
// Far above any catalogue price: if the target fails even here, it is unreachable.
const CEILING_PRICE = "10000000.00";

type Priceless = Omit<SimulationInput, "sellingPriceLocal">;

function withoutPrice(input: SimulationInput): Priceless {
  const copy: Partial<SimulationInput> = { ...input };
  delete copy.sellingPriceLocal;
  return copy as Priceless;
}

function meets(input: Priceless, price: string, fxIn: FxInput, target: number): boolean {
  const r = calculate({ ...input, sellingPriceLocal: price }, fxIn, rules);
  return new Decimal(r.marginPct).gte(target) && new Decimal(r.netProfit).gte(0);
}

// Spec §7.5 nudges upward from the closed-form seed, so "minimal" means the
// first qualifying cent at or above the seed: when the solver moved off the
// seed (steps > 0), one cent less must miss. Returns a failure message, or null.
function checkMinimal(input: Priceless, fxIn: FxInput, target: number): string | null {
  const s = suggestPrice(input, fxIn, rules, target);
  if (s === null) {
    return meets(input, CEILING_PRICE, fxIn, target) ? "null but a price exists" : null;
  }
  if (!meets(input, s.price, fxIn, target)) return `${s.price} misses the target`;
  const below = new Decimal(s.price).minus("0.01");
  if (s.steps > 0 && meets(input, below.toFixed(2), fxIn, target)) {
    return `${s.price} is not minimal (${below.toFixed(2)} also meets it)`;
  }
  return null;
}

function auInput(overrides: Partial<SimulationInput>): Priceless {
  const item = catalogue.items[0];
  if (!item) throw new Error("catalogue has no items");
  return withoutPrice({
    ...buildMarketInput(item, "AU", overrides.platform ?? "ebay", "1.00", rules),
    ...overrides,
  });
}

// Iterates whatever the catalogue contains; never asserts a count (AGENTS 3b).
describe("suggestPrice minimality over the catalogue (AU)", () => {
  it("returns the smallest cent that meets each target, or null only when none exists", () => {
    const failures: string[] = [];
    for (const item of catalogue.items) {
      for (const platform of PLATFORMS) {
        for (const taxRegistered of REGISTERED) {
          const base = withoutPrice({
            ...buildMarketInput(item, "AU", platform, "1.00", rules),
            taxRegistered,
          });
          for (const target of TARGETS) {
            const msg = checkMinimal(base, auFx, target);
            if (msg)
              failures.push(`${item.code}/${platform}/reg=${taxRegistered}/${target}%: ${msg}`);
          }
        }
      }
    }
    expect(failures.slice(0, 20)).toEqual([]);
  }, 300_000);
});

describe("suggestPrice minimality edge cases (AU)", () => {
  const cases: Array<{ name: string; input: Priceless; fx?: FxInput }> = [
    // A$4,200 goods: the eBay price lands above the A$4,000 tier at every target.
    { name: "eBay above the A$4,000 tier", input: auInput({ usd: 3000, platform: "ebay" }) },
    // Goods just under A$1,000: inside the near-threshold band.
    { name: "goods near A$1,000", input: auInput({ usd: 707, platform: "amazon" }) },
    {
      name: "home-appliance 5% duty",
      input: auInput({ usd: 400, platform: "amazon", category: "home-appliance", dutyPct: "5" }),
    },
    {
      name: "large ad spend on WooCommerce",
      input: auInput({ usd: 300, platform: "woocommerce", adSpendLocal: "250.00" }),
    },
    {
      name: "large ad spend on Shopify, registered",
      input: auInput({
        usd: 300,
        platform: "shopify",
        adSpendLocal: "250.00",
        taxRegistered: true,
      }),
    },
  ];
  const fxAt = { rate: "1.4", asOf: "2026-11-11", degraded: false };
  const ukFx = { rate: "0.7424", asOf: "2026-11-11", degraded: false };

  // UK Amazon's minimum referral fee (not in the closed form) puts the answer
  // ~60 cents above the seed: past the old 25-step cap, which returned null.
  it("finds a price more than 25 cents above the seed instead of returning null", () => {
    const item = catalogue.items[0];
    if (!item) throw new Error("catalogue has no items");
    const input = withoutPrice({
      ...buildMarketInput(item, "UK", "amazon", "1.00", rules),
      goodsCostLocal: "0.01",
    });
    const s = suggestPrice(input, ukFx, rules, 50);
    expect(s).not.toBeNull();
    expect(s!.steps).toBeGreaterThan(25);
    expect(checkMinimal(input, ukFx, 50)).toBeNull();
  });

  for (const c of cases) {
    it.each(TARGETS)(`${c.name} at %i%%`, (target) => {
      expect(checkMinimal(c.input, c.fx ?? fxAt, target)).toBeNull();
    });
  }
});

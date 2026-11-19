import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import catalogueRaw from "../../../src/data/catalogue.json";
import rulesRaw from "../../../src/data/market-rules.json";
import { Catalogue, MarketRules } from "../../../src/lib/schemas";
import { calculate } from "../../../src/engine";
import { buildPrototypeInput } from "../../../src/lib/prototype-input";
import { toDisplay, type DisplayCurrency } from "../../../src/lib/display-currency";
import {
  SIM_PLATFORMS,
  cellScenario,
  simulateCatalogue,
  simulateProduct,
  type SimContext,
  type SimSettings,
} from "../../../src/lib/simulation/simulate";

const catalogue = Catalogue.parse(catalogueRaw);
const rules = MarketRules.parse(rulesRaw);
const rates = { AUD: 1.4579, HKD: 7.845 };
const ctx: SimContext = {
  rules,
  fx: { rate: String(rates.AUD), asOf: "2026-11-11", degraded: false },
  rates,
};
const NO_OVERRIDES = { customCost: "", declaredValue: "" };

const settings = (over: Partial<SimSettings> = {}): SimSettings => ({
  targetMarginPct: 5,
  taxRegistered: false,
  currency: "AUD",
  inboundShipping: "0.00",
  packaging: "0.00",
  adSpend: "0.00",
  ...over,
});

const firstOfEachCategory = () => {
  const seen = new Map<string, (typeof catalogue.items)[number]>();
  for (const item of catalogue.items) if (!seen.has(item.category)) seen.set(item.category, item);
  return [...seen.values()];
};

const anyItem = () => {
  const item = catalogue.items[0];
  if (!item) throw new Error("catalogue has no items");
  return item;
};

// What the calculator computes for a cell, through the calculator's own path.
function calculatorResult(
  item: (typeof catalogue.items)[number],
  s: SimSettings,
  platform: (typeof SIM_PLATFORMS)[number],
  price: string,
) {
  const scenario = cellScenario(item, s, platform, price);
  const input = buildPrototypeInput(scenario, item, rules, s.currency, rates, NO_OVERRIDES);
  if (!input) throw new Error("calculator could not build an input");
  return calculate(input, ctx.fx, rules);
}

describe("simulateProduct", () => {
  it("returns one cell per simulated platform and leaves Other out", () => {
    const row = simulateProduct(anyItem(), settings(), ctx);
    expect(Object.keys(row.cells).sort()).toEqual([...SIM_PLATFORMS].sort());
    expect(SIM_PLATFORMS).not.toContain("other");
  });

  const currencies: DisplayCurrency[] = ["AUD", "USD", "HKD"];
  for (const currency of currencies) {
    it(`matches the calculator to the cent in ${currency}, one SKU per category`, () => {
      for (const item of firstOfEachCategory()) {
        for (const targetMarginPct of [3, 10] as const) {
          for (const taxRegistered of [false, true]) {
            const s = settings({ currency, targetMarginPct, taxRegistered, packaging: "2.50" });
            const row = simulateProduct(item, s, ctx);
            for (const platform of SIM_PLATFORMS) {
              const cell = row.cells[platform];
              const where = `${item.code}/${platform}/${currency}/${targetMarginPct}/${taxRegistered}`;
              expect(cell, where).not.toBeNull();
              const r = calculatorResult(item, s, platform, cell!.price);
              expect(new Decimal(r.marginPct).gte(targetMarginPct), where).toBe(true);
              expect(cell!.marginPct, where).toBe(r.marginPct);
              expect(cell!.netProfit, where).toBe(toDisplay(r.netProfit, rates, currency));
            }
          }
        }
      }
    });
  }

  it("applies ad spend to Shopify and WooCommerce only", () => {
    const item = anyItem();
    const without = simulateProduct(item, settings(), ctx);
    const withAds = simulateProduct(item, settings({ adSpend: "40.00" }), ctx);
    expect(withAds.cells.amazon).toEqual(without.cells.amazon);
    expect(withAds.cells.ebay).toEqual(without.cells.ebay);
    for (const p of ["shopify", "woocommerce"] as const) {
      expect(new Decimal(withAds.cells[p]!.price).gt(without.cells[p]!.price)).toBe(true);
    }
  });

  it("reports the fee total the seller pays (fees plus unrecovered GST on fees)", () => {
    const item = anyItem();
    const s = settings();
    const cell = simulateProduct(item, s, ctx).cells.ebay!;
    const r = calculatorResult(item, s, "ebay", cell.price);
    const fees = new Decimal(r.platformFeeSubtotal).plus(r.taxOnPlatformFeesCost).toFixed(2);
    expect(cell.feeTotal).toBe(fees);
  });

  it("flags goods at or over A$1,000 and goods just under it", () => {
    const pricey = { ...anyItem(), usd: 2000 };
    const near = { ...anyItem(), usd: 670 }; // 670 x 1.4579 = A$976.79, within 5%
    const cheap = { ...anyItem(), usd: 100 };
    expect(simulateProduct(pricey, settings(), ctx)).toMatchObject({
      auAboveThreshold: true,
      nearThreshold: false,
    });
    expect(simulateProduct(near, settings(), ctx)).toMatchObject({
      auAboveThreshold: false,
      nearThreshold: true,
    });
    expect(simulateProduct(cheap, settings(), ctx)).toMatchObject({
      auAboveThreshold: false,
      nearThreshold: false,
    });
  });

  it("shows import GST in the landed cost only when it is not reclaimed", () => {
    const pricey = { ...anyItem(), usd: 2000 };
    const notReg = simulateProduct(pricey, settings(), ctx);
    const reg = simulateProduct(pricey, settings({ taxRegistered: true }), ctx);
    expect(new Decimal(notReg.importTax).gt(0)).toBe(true);
    expect(new Decimal(notReg.landedCost).minus(reg.landedCost).toFixed(2)).toBe(notReg.importTax);
  });

  it("returns a null cell when the target cannot be reached", () => {
    const item = anyItem();
    const tinyRules = structuredClone(rules);
    tinyRules.AU.platforms.amazon.referralFeePctByCategory[item.category] = 99;
    const row = simulateProduct(item, settings(), { ...ctx, rules: tinyRules });
    expect(row.cells.amazon).toBeNull();
    expect(row.cells.ebay).not.toBeNull();
  });
});

describe("simulateCatalogue", () => {
  it("returns one row per product, in catalogue order", () => {
    const items = catalogue.items.slice(0, 5);
    const rows = simulateCatalogue(items, settings(), ctx);
    expect(rows?.map((r) => r.code)).toEqual(items.map((i) => i.code));
  });

  it("returns null when a cost field is not a usable amount", () => {
    expect(
      simulateCatalogue(catalogue.items.slice(0, 2), settings({ packaging: "abc" }), ctx),
    ).toBeNull();
    expect(
      simulateCatalogue(catalogue.items.slice(0, 2), settings({ adSpend: "-1" }), ctx),
    ).toBeNull();
  });
});

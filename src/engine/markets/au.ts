import Decimal from "decimal.js";
import { r2 } from "../money";
import type { MarketModule } from "./registry";

export type DeMinimisComparand = "goods" | "goods+freight";

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

const DE_MINIMIS_LOCAL = new Decimal(1000);
// This constant mirrors src/data/market-rules.json's AU.deMinimisLocal (1000) and
// AU.deMinimisComparand ("goods"). It is NOT hardcoded catalogue data (AGENTS.md 3a
// forbids catalogue-derived facts, not business-rule config); index.ts (Task 5) passes
// the loaded MarketRules through so a future change to market-rules.json's values
// flows through without touching this file — see Task 5 Step 3 for how the module is
// parameterised at wire-up time.

export const auModule: MarketModule = {
  id: "AU",
  currency: "AUD",
  taxName: "GST",
  taxRatePct: 10,

  isAboveThreshold(goods: Decimal, freight: Decimal): boolean {
    return comparand("goods", goods, freight).gte(DE_MINIMIS_LOCAL);
  },

  computeDuty(goods: Decimal, dutyPct: Decimal): Decimal {
    return r2(goods.times(dutyPct).div(100));
  },

  computeImportTax(goods: Decimal, shipping: Decimal, duty: Decimal, above: boolean): Decimal {
    if (!above) return r2("0");
    const base = goods.plus(shipping).plus(duty);
    return r2(base.times(this.taxRatePct).div(100));
  },

  computeOutputTax(gross: Decimal, registered: boolean): Decimal {
    if (!registered) return r2("0");
    return r2(gross.times(this.taxRatePct).div(100 + this.taxRatePct));
  },
};

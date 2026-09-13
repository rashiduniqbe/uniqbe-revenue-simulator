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
// forbids catalogue-derived facts, not business-rule config) — but it IS a hardcoded
// compile-time constant here, and the "goods" comparand kind passed to comparand()
// below (isAboveThreshold) is likewise hardcoded, not read from market-rules.json at
// runtime. index.ts does NOT thread MarketRules into this module at all — it calls
// this module's methods through the static MARKET_MODULES registry with no rules
// parameter. The same threshold/comparand values are ALSO independently duplicated
// in src/engine/warnings.ts (AU_DE_MINIMIS). Changing the AU de-minimis threshold or
// comparand requires manually editing BOTH this file and warnings.ts, and keeping
// them in sync is the developer's responsibility until a future refactor threads
// MarketRules through the MarketModule/EngineContext interfaces — that refactor is
// out of scope for this plan.

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

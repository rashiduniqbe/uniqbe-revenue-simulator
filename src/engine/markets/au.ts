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

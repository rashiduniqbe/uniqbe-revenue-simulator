import Decimal from "decimal.js";
import { r2 } from "../money";
import type { MarketModule } from "./registry";

export const ukModule: MarketModule = {
  id: "UK",
  currency: "GBP",
  taxName: "VAT",
  taxRatePct: 20,

  isAboveThreshold(): boolean {
    return true;
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

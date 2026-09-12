import type { Decimal } from "decimal.js";
import type { Market } from "../types";

export type EngineContext = {
  market: Market;
  goods: Decimal;
  shipping: Decimal;
  duty: Decimal;
  above: boolean | null;
  importTax: Decimal;
  registered: boolean;
  platform: string;
  adSpend: Decimal;
  shopifyHasAbn: boolean;
};

export interface MarketModule {
  readonly id: Market;
  readonly currency: "GBP" | "AUD";
  readonly taxName: "VAT" | "GST";
  readonly taxRatePct: number;
  isAboveThreshold(goods: Decimal, freight: Decimal): boolean;
  computeDuty(goods: Decimal, dutyPct: Decimal): Decimal;
  computeImportTax(goods: Decimal, shipping: Decimal, duty: Decimal, above: boolean): Decimal;
  computeOutputTax(gross: Decimal, registered: boolean): Decimal;
}

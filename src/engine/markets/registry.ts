import type { Decimal } from "decimal.js";
import type { Market, Platform } from "../types";

export type DeMinimisComparand = "goods" | "goods+freight";

// The de-minimis slice of a market's rules block. Passed in from
// market-rules.json at call time so the engine never inlines the rule (AGENTS.md 5a).
export type DeMinimisRule = {
  deMinimisLocal: number | null;
  deMinimisComparand?: DeMinimisComparand;
};

export type EngineContext = {
  market: Market;
  goods: Decimal;
  shipping: Decimal;
  duty: Decimal;
  above: boolean | null;
  importTax: Decimal;
  registered: boolean;
  platform: Platform;
  adSpend: Decimal;
  shopifyHasAbn: boolean;
  deMinimis: DeMinimisRule;
};

export interface MarketModule {
  readonly id: Market;
  readonly currency: "GBP" | "AUD";
  readonly taxName: "VAT" | "GST";
  readonly taxRatePct: number;
  isAboveThreshold(goods: Decimal, freight: Decimal, rule: DeMinimisRule): boolean;
  computeDuty(goods: Decimal, dutyPct: Decimal): Decimal;
  computeImportTax(goods: Decimal, shipping: Decimal, duty: Decimal, above: boolean): Decimal;
  computeOutputTax(gross: Decimal, registered: boolean): Decimal;
}

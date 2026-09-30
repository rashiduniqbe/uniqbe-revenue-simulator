import { parseAsString, parseAsStringEnum } from "nuqs";
import { calculate } from "../engine";
import type { FxInput, Market, Platform, SimulationInput, SimulationResult } from "../engine/types";
import type { CatalogueItemType, FxSnapshotType, MarketRulesType } from "./schemas";
import { DEFAULT_SCENARIO } from "./url-state";
import { deriveDutyPctDefault, deriveReferralFeeDefault } from "./scenario-defaults";
import { isValidDecimalString } from "./decimal-validation";

export type CompareItem = Pick<CatalogueItemType, "code" | "usd" | "category">;

// Spec §9.4: /compare?p=OP00573&sp_uk=599.99&sp_au=999.99
export const compareParsers = {
  p: parseAsString.withDefault(""),
  pl: parseAsStringEnum(["amazon", "ebay", "shopify", "other"] as const).withDefault("amazon"),
  sp_uk: parseAsString.withDefault(""),
  sp_au: parseAsString.withDefault(""),
};

export const COMPARE_CAVEAT =
  "Neither market is always cheaper for the same product. Import tax, the A$1,000 GST threshold and each platform's fees change the result, so compare the profit, not the selling price.";

export function fxInputFor(fx: FxSnapshotType, market: Market): FxInput {
  const rate = market === "UK" ? fx.rates.GBP : fx.rates.AUD;
  return { rate: String(rate), asOf: fx.asOf, degraded: fx.degraded };
}

export function buildMarketInput(
  item: CompareItem,
  market: Market,
  platform: Platform,
  sellingPriceLocal: string,
  rules: MarketRulesType,
): SimulationInput {
  return {
    ...DEFAULT_SCENARIO,
    market,
    platform,
    productCode: item.code,
    usd: item.usd,
    category: item.category,
    sellingPriceLocal,
    dutyPct: deriveDutyPctDefault(rules, market, item.category),
    referralFeePct: deriveReferralFeeDefault(rules, market, platform, item.category),
  };
}

export function compareMarket(
  item: CompareItem,
  market: Market,
  platform: Platform,
  sellingPriceLocal: string,
  rules: MarketRulesType,
  fx: FxSnapshotType,
): SimulationResult | null {
  const price = sellingPriceLocal.trim();
  if (!isValidDecimalString(price) || !(Number(price) > 0)) return null;
  return calculate(
    buildMarketInput(item, market, platform, price, rules),
    fxInputFor(fx, market),
    rules,
  );
}

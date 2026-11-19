import type { MarketRulesType, CategorySlugType } from "./schemas";
import type { Market, Platform } from "../engine/types";
import type { ScenarioParams } from "./url-state";

// Switching platform re-derives the referral fee (when a product is chosen)
// and clears values that only apply to another platform: calculate() deducts
// adSpendLocal on every platform, and ebayFreeTier / shopifyHasAbn only mean
// something on their own platform, so leftovers would silently skew profit.
// Ad spend is kept on the own-store platforms (see platformTakesAdSpend).
export function withPlatform(
  scenario: ScenarioParams,
  platform: Platform,
  rules: MarketRulesType,
  category: CategorySlugType | null,
): ScenarioParams {
  return {
    ...scenario,
    platform,
    referralFeePct: category
      ? deriveReferralFeeDefault(rules, scenario.market, platform, category)
      : scenario.referralFeePct,
    adSpendLocal: platformTakesAdSpend(platform) ? scenario.adSpendLocal : "0.00",
    ebayFreeTier: platform === "ebay" ? scenario.ebayFreeTier : false,
    shopifyHasAbn: platform === "shopify" ? scenario.shopifyHasAbn : false,
  };
}

// Own-store platforms bring no marketplace traffic, so ad spend is an input there.
export function platformTakesAdSpend(platform: Platform): boolean {
  return platform === "shopify" || platform === "woocommerce";
}

export function deriveDutyPctDefault(
  rules: MarketRulesType,
  market: Market,
  category: CategorySlugType,
): string {
  return String(rules[market].dutyPctByCategory[category]);
}

export function deriveReferralFeeDefault(
  rules: MarketRulesType,
  market: Market,
  platform: Platform,
  category: CategorySlugType,
): string {
  const platformFees = rules[market].platforms[platform];
  return "referralFeePctByCategory" in platformFees
    ? String(platformFees.referralFeePctByCategory[category])
    : String(platformFees.referralFeePctDefault);
}

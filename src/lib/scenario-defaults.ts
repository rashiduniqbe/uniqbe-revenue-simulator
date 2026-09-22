import type { MarketRulesType, CategorySlugType } from "./schemas";
import type { Market, Platform } from "../engine/types";

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

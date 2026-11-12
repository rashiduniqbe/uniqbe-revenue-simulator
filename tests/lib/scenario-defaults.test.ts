import { describe, expect, it } from "vitest";
import {
  deriveDutyPctDefault,
  deriveReferralFeeDefault,
  withPlatform,
} from "../../src/lib/scenario-defaults";
import { MarketRules } from "../../src/lib/schemas";
import { DEFAULT_SCENARIO } from "../../src/lib/url-state";
import marketRulesData from "../../src/data/market-rules.json";

const rules = MarketRules.parse(marketRulesData);

describe("withPlatform", () => {
  const shopifyScenario = {
    ...DEFAULT_SCENARIO,
    market: "AU" as const,
    platform: "shopify" as const,
    adSpendLocal: "12.50",
    shopifyHasAbn: true,
  };

  it("re-derives the referral fee for the new platform when a category is known", () => {
    const next = withPlatform(shopifyScenario, "amazon", rules, "mobile-phone");
    expect(next.platform).toBe("amazon");
    expect(next.referralFeePct).toBe(
      deriveReferralFeeDefault(rules, "AU", "amazon", "mobile-phone"),
    );
  });

  it("keeps the typed referral fee when no product is selected", () => {
    const next = withPlatform({ ...shopifyScenario, referralFeePct: "9" }, "ebay", rules, null);
    expect(next.referralFeePct).toBe("9");
  });

  it("clears ad spend and platform-only toggles that no longer apply", () => {
    const next = withPlatform({ ...shopifyScenario, ebayFreeTier: true }, "amazon", rules, null);
    expect(next.adSpendLocal).toBe("0.00");
    expect(next.shopifyHasAbn).toBe(false);
    expect(next.ebayFreeTier).toBe(false);
  });

  it("keeps the toggles that belong to the chosen platform", () => {
    const next = withPlatform(shopifyScenario, "shopify", rules, null);
    expect(next.adSpendLocal).toBe("12.50");
    expect(next.shopifyHasAbn).toBe(true);
  });

  it("does not mutate the scenario it was given", () => {
    const before = { ...shopifyScenario };
    withPlatform(shopifyScenario, "amazon", rules, "mobile-phone");
    expect(shopifyScenario).toEqual(before);
  });
});

describe("deriveDutyPctDefault", () => {
  it("reads the duty percentage for the given market and category", () => {
    expect(deriveDutyPctDefault(rules, "UK", "home-appliance")).toBe("0");
    expect(deriveDutyPctDefault(rules, "AU", "home-appliance")).toBe("5");
  });
});

describe("deriveReferralFeeDefault", () => {
  it("uses the category-specific rate when the platform has one", () => {
    expect(deriveReferralFeeDefault(rules, "UK", "amazon", "mobile-phone")).toBe("7");
    expect(deriveReferralFeeDefault(rules, "AU", "amazon", "mobile-phone")).toBe("8");
  });

  it("falls back to the platform default when there is no per-category rate", () => {
    expect(deriveReferralFeeDefault(rules, "UK", "other", "mobile-phone")).toBe("0");
    expect(deriveReferralFeeDefault(rules, "AU", "other", "mobile-phone")).toBe("0");
  });
});

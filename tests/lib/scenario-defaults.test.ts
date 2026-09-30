import { describe, expect, it } from "vitest";
import { deriveDutyPctDefault, deriveReferralFeeDefault } from "../../src/lib/scenario-defaults";
import { MarketRules } from "../../src/lib/schemas";
import marketRulesData from "../../src/data/market-rules.json";

const rules = MarketRules.parse(marketRulesData);

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

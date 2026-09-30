import { describe, expect, it } from "vitest";
import { MarketRules } from "../../src/lib/schemas";
import rulesRaw from "../../src/data/market-rules.json";
import { DEFAULT_SCENARIO } from "../../src/lib/url-state";
import { resolveSimulationInput } from "../../src/lib/simulate-input";
import { deriveDutyPctDefault, deriveReferralFeeDefault } from "../../src/lib/scenario-defaults";

const rules = MarketRules.parse(rulesRaw);
const item = { code: "TEST", usd: 400, category: "mobile-phone" } as const;
const base = { ...DEFAULT_SCENARIO, productCode: "TEST", sellingPriceLocal: "500.00" };

describe("resolveSimulationInput", () => {
  it("trims a whitespace-padded price and other numeric fields", () => {
    const input = resolveSimulationInput(
      {
        ...base,
        sellingPriceLocal: " 500.00 ",
        adSpendLocal: "5 ",
        dutyPct: " 2 ",
        referralFeePct: "8 ",
      },
      item,
      rules,
    );
    expect(input).not.toBeNull();
    expect(input?.sellingPriceLocal).toBe("500.00");
    expect(input?.adSpendLocal).toBe("5");
    expect(input?.dutyPct).toBe("2");
    expect(input?.referralFeePct).toBe("8");
  });

  it.each(["Infinity", "0x10", "0", "-5", "abc", ""])("rejects price %j", (sp) => {
    expect(resolveSimulationInput({ ...base, sellingPriceLocal: sp }, item, rules)).toBeNull();
  });

  it("falls back to market defaults when du/rf are empty", () => {
    const input = resolveSimulationInput({ ...base, market: "AU", platform: "ebay" }, item, rules);
    expect(input?.dutyPct).toBe(deriveDutyPctDefault(rules, "AU", item.category));
    expect(input?.referralFeePct).toBe(
      deriveReferralFeeDefault(rules, "AU", "ebay", item.category),
    );
  });

  it("returns null when another numeric field is malformed", () => {
    expect(resolveSimulationInput({ ...base, packagingLocal: "x" }, item, rules)).toBeNull();
  });
});

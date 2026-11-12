import { describe, expect, it } from "vitest";
import { buildPrototypeInput } from "../../src/lib/prototype-input";
import { MarketRules } from "../../src/lib/schemas";
import { DEFAULT_SCENARIO } from "../../src/lib/url-state";
import rulesRaw from "../../src/data/market-rules.json";

const rules = MarketRules.parse(rulesRaw);
const rates = { AUD: 1.5, HKD: 7.8 };
const item = { usd: 100, category: "mobile-phone" as const };
const scenario = {
  ...DEFAULT_SCENARIO,
  market: "AU" as const,
  productCode: "TT00001",
  sellingPriceLocal: "200",
  inboundShippingLocal: "10",
  packagingLocal: "2",
  adSpendLocal: "0",
};
const noOverrides = { customCost: "", declaredValue: "" };

describe("buildPrototypeInput", () => {
  it("converts every money field from the chosen currency to AUD", () => {
    const input = buildPrototypeInput(scenario, item, rules, "USD", rates, noOverrides);
    expect(input).toMatchObject({
      sellingPriceLocal: "300",
      inboundShippingLocal: "15",
      packagingLocal: "3",
      adSpendLocal: "0",
    });
  });

  it("passes AUD amounts through unchanged", () => {
    const input = buildPrototypeInput(scenario, item, rules, "AUD", rates, noOverrides);
    expect(input?.sellingPriceLocal).toBe("200");
  });

  it("leaves duty and referral percentages alone", () => {
    const input = buildPrototypeInput(
      { ...scenario, dutyPct: "5", referralFeePct: "8" },
      item,
      rules,
      "HKD",
      rates,
      noOverrides,
    );
    expect(input).toMatchObject({ dutyPct: "5", referralFeePct: "8" });
  });

  it("omits both overrides when their fields are blank", () => {
    const input = buildPrototypeInput(scenario, item, rules, "USD", rates, noOverrides);
    expect(input).not.toHaveProperty("goodsCostLocal");
    expect(input).not.toHaveProperty("declaredValueLocal");
  });

  it("converts a custom cost and a declared value to AUD overrides", () => {
    const input = buildPrototypeInput(scenario, item, rules, "HKD", rates, {
      customCost: "780",
      declaredValue: " 1560 ",
    });
    expect(input).toMatchObject({ goodsCostLocal: "150", declaredValueLocal: "300" });
  });

  it("returns null when a custom cost or declared value is malformed or not positive", () => {
    for (const bad of ["abc", "0", "-5"]) {
      expect(
        buildPrototypeInput(scenario, item, rules, "USD", rates, {
          ...noOverrides,
          customCost: bad,
        }),
      ).toBeNull();
      expect(
        buildPrototypeInput(scenario, item, rules, "USD", rates, {
          ...noOverrides,
          declaredValue: bad,
        }),
      ).toBeNull();
    }
  });

  it("returns null when the selling price is missing", () => {
    expect(
      buildPrototypeInput(
        { ...scenario, sellingPriceLocal: "" },
        item,
        rules,
        "USD",
        rates,
        noOverrides,
      ),
    ).toBeNull();
  });

  it("returns null for HKD when no HKD rate is available", () => {
    expect(buildPrototypeInput(scenario, item, rules, "HKD", { AUD: 1.5 }, noOverrides)).toBeNull();
  });
});

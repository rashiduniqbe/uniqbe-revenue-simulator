import { describe, expect, it } from "vitest";
import { buildPrototypeInput, isDeclaredBelowPrice } from "../../src/lib/prototype-input";
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

describe("isDeclaredBelowPrice", () => {
  it("is true when the declared value is below the store price", () => {
    expect(isDeclaredBelowPrice({ customCost: "", declaredValue: "99.99" }, "100.00")).toBe(true);
  });

  it("compares against the custom price when one is typed", () => {
    expect(isDeclaredBelowPrice({ customCost: "80", declaredValue: "90" }, "100.00")).toBe(false);
    expect(isDeclaredBelowPrice({ customCost: "80", declaredValue: "79" }, "100.00")).toBe(true);
  });

  it("is false when the declared value equals or exceeds the price", () => {
    expect(isDeclaredBelowPrice({ customCost: "", declaredValue: "100" }, "100.00")).toBe(false);
    expect(isDeclaredBelowPrice({ customCost: "", declaredValue: "150" }, "100.00")).toBe(false);
  });

  it("is false when there is nothing usable to compare", () => {
    expect(isDeclaredBelowPrice({ customCost: "", declaredValue: "" }, "100.00")).toBe(false);
    expect(isDeclaredBelowPrice({ customCost: "", declaredValue: "abc" }, "100.00")).toBe(false);
    expect(isDeclaredBelowPrice({ customCost: "", declaredValue: "50" }, null)).toBe(false);
  });

  it("falls back to the store price when the custom price is malformed", () => {
    expect(isDeclaredBelowPrice({ customCost: "x", declaredValue: "50" }, "100.00")).toBe(true);
  });
});

describe("buildPrototypeInput ad spend", () => {
  it("ignores ad spend on a platform with no ad-spend field", () => {
    const input = buildPrototypeInput(
      { ...scenario, platform: "amazon", adSpendLocal: "40" },
      item,
      rules,
      "AUD",
      rates,
      noOverrides,
    );
    expect(input?.adSpendLocal).toBe("0");
  });

  it("keeps ad spend on Shopify and WooCommerce", () => {
    for (const platform of ["shopify", "woocommerce"] as const) {
      const input = buildPrototypeInput(
        { ...scenario, platform, adSpendLocal: "40" },
        item,
        rules,
        "AUD",
        rates,
        noOverrides,
      );
      expect(input?.adSpendLocal).toBe("40");
    }
  });
});

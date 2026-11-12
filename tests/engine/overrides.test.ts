import { describe, expect, it } from "vitest";
import { calculate, suggestPrice } from "../../src/engine/index";
import { MarketRules } from "../../src/lib/schemas";
import rulesRaw from "../../src/data/market-rules.json";
import type { FxInput, SimulationInput } from "../../src/engine/types";

const rules = MarketRules.parse(rulesRaw);
const fx: FxInput = { rate: "1.5", asOf: "2026-08-25", degraded: false };
const threshold = rules.AU.deMinimisLocal as number;

const base: SimulationInput = {
  market: "AU",
  productCode: "TT00001",
  usd: 100,
  category: "mobile-phone",
  platform: "other",
  taxRegistered: false,
  sellingPriceLocal: "5000.00",
  inboundShippingLocal: "0.00",
  packagingLocal: "0.00",
  adSpendLocal: "0.00",
  dutyPct: "5",
  referralFeePct: "0",
  amazonPlan: "professional",
  shopifyPlan: "basic",
  shopifyHasAbn: false,
  ebayFreeTier: false,
};

const line = (input: SimulationInput, label: string) =>
  calculate(input, fx, rules).breakdown.find((l) => l.label === label)?.amount;

describe("goodsCostLocal override", () => {
  it("replaces usd × rate as the goods cost", () => {
    const result = calculate({ ...base, goodsCostLocal: "123.45" }, fx, rules);
    expect(result.goodsCostLocal).toBe("123.45");
    expect(line({ ...base, goodsCostLocal: "123.45" }, "Goods cost")).toBe("-123.45");
  });

  it("is ignored when absent (usd × rate as before)", () => {
    expect(calculate(base, fx, rules).goodsCostLocal).toBe("150.00");
  });

  it("drives duty and the threshold test when no declared value is given", () => {
    const above = String(threshold + 100);
    const result = calculate({ ...base, goodsCostLocal: above }, fx, rules);
    expect(result.auAboveThreshold).toBe(true);
    expect(result.duty).toBe(((threshold + 100) * 0.05).toFixed(2));
  });
});

describe("declaredValueLocal override", () => {
  it("is the customs value for the threshold, duty and import GST", () => {
    const declared = String(threshold + 500);
    const result = calculate({ ...base, declaredValueLocal: declared }, fx, rules);
    expect(result.goodsCostLocal).toBe("150.00");
    expect(result.auAboveThreshold).toBe(true);
    const duty = (threshold + 500) * 0.05;
    expect(result.duty).toBe(duty.toFixed(2));
    expect(result.importTax).toBe(((threshold + 500 + duty) * 0.1).toFixed(2));
  });

  it("can put an expensive item under the threshold", () => {
    const result = calculate(
      { ...base, usd: 5000, declaredValueLocal: String(threshold - 1) },
      fx,
      rules,
    );
    expect(result.auAboveThreshold).toBe(false);
    expect(result.importTax).toBe("0.00");
  });

  it("drops the 'declared value unconfirmed' warning once a value is declared", () => {
    const codes = (input: SimulationInput) =>
      calculate(input, fx, rules).warnings.map((w) => w.code);
    expect(codes(base)).toContain("CUSTOMS_DECLARED_VALUE_UNCONFIRMED");
    expect(codes({ ...base, declaredValueLocal: "100" })).not.toContain(
      "CUSTOMS_DECLARED_VALUE_UNCONFIRMED",
    );
  });

  it("keeps the breakdown summing to net profit", () => {
    expect(() =>
      calculate({ ...base, goodsCostLocal: "77.77", declaredValueLocal: "1234.56" }, fx, rules),
    ).not.toThrow();
  });
});

describe("suggestPrice with overrides", () => {
  it("prices against the overridden goods cost", () => {
    const { sellingPriceLocal, ...rest } = base;
    expect(sellingPriceLocal).toBe("5000.00");
    const plain = suggestPrice(rest, fx, rules, 20);
    const cheaper = suggestPrice({ ...rest, goodsCostLocal: "10.00" }, fx, rules, 20);
    expect(plain).not.toBeNull();
    expect(cheaper).not.toBeNull();
    expect(Number(cheaper?.price)).toBeLessThan(Number(plain?.price));
  });
});

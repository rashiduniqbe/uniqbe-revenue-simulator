import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { calculate, suggestPrice } from "../../src/engine/index";
import { MarketRules } from "../../src/lib/schemas";
import rulesRaw from "../../src/data/market-rules.json";
import type { SimulationInput } from "../../src/engine/types";

const rules = MarketRules.parse(rulesRaw);
const fx = { rate: "1.5", asOf: "2026-11-11", degraded: false };

function withoutPrice(input: SimulationInput): Omit<SimulationInput, "sellingPriceLocal"> {
  const copy: Partial<SimulationInput> = { ...input };
  delete copy.sellingPriceLocal;
  return copy as Omit<SimulationInput, "sellingPriceLocal">;
}

function wooInput(overrides: Partial<SimulationInput> = {}): SimulationInput {
  return {
    market: "AU",
    productCode: "TEST",
    usd: 500,
    category: "mobile-phone",
    platform: "woocommerce",
    taxRegistered: false,
    sellingPriceLocal: "1000.00",
    inboundShippingLocal: "0.00",
    packagingLocal: "0.00",
    adSpendLocal: "0.00",
    dutyPct: "0",
    referralFeePct: "0",
    amazonPlan: "professional",
    shopifyPlan: "basic",
    shopifyHasAbn: false,
    ebayFreeTier: false,
    ...overrides,
  };
}

const codes = (r: ReturnType<typeof calculate>) => r.warnings.map((w) => w.code);

describe("calculate on WooCommerce (AU)", () => {
  it("adds one paymentFee line from the AU WooPayments rate", () => {
    const r = calculate(wooInput(), fx, rules);
    expect(r.platformFees).toEqual({ paymentFee: "17.80" });
    expect(r.platformFeeSubtotal).toBe("17.80");
  });

  it("charges GST on the fee as a cost when not registered", () => {
    const r = calculate(wooInput({ packagingLocal: "5.00", adSpendLocal: "10.00" }), fx, rules);
    expect(r.taxOnPlatformFees).toBe("1.78");
    expect(r.taxOnPlatformFeesCost).toBe("1.78");
    expect(r.otherCosts).toBe("15.00");
    // 1000 - 750 - 17.80 - 1.78 - 15
    expect(r.netProfit).toBe("215.42");
    expect(r.marginPct).toBe("21.54");
  });

  it("recovers GST on the fee when registered", () => {
    const r = calculate(
      wooInput({ taxRegistered: true, packagingLocal: "5.00", adSpendLocal: "10.00" }),
      fx,
      rules,
    );
    expect(r.taxOnPlatformFees).toBe("1.78");
    expect(r.taxOnPlatformFeesCost).toBe("0.00");
    // 909.09 - 750 - 17.80 - 15
    expect(r.netProfit).toBe("126.29");
  });

  it("applies import GST above A$1,000 goods (not registered)", () => {
    const r = calculate(wooInput({ usd: 800, sellingPriceLocal: "2000.00" }), fx, rules);
    expect(r.auAboveThreshold).toBe(true);
    expect(r.importTax).toBe("120.00");
    expect(r.platformFees).toEqual({ paymentFee: "35.30" });
    // 2000 - 1320 - 35.30 - 3.53
    expect(r.netProfit).toBe("641.17");
  });

  it("reclaims import GST above A$1,000 when registered", () => {
    const r = calculate(
      wooInput({ usd: 800, sellingPriceLocal: "2000.00", taxRegistered: true }),
      fx,
      rules,
    );
    // 1818.18 - 1200 - 35.30
    expect(r.netProfit).toBe("582.88");
    expect(codes(r)).toContain("IMPORT_TAX_CASHFLOW");
  });

  it("warns about a zero ad budget and the assumed gateway rate", () => {
    const r = calculate(wooInput(), fx, rules);
    expect(codes(r)).toContain("WOOCOMMERCE_NO_AUDIENCE");
    expect(codes(r)).toContain("WOOCOMMERCE_PAYMENT_RATE_ASSUMED");
    expect(codes(r)).not.toContain("SHOPIFY_NO_AUDIENCE");
    expect(codes(r)).not.toContain("SHOPIFY_AU_GST_ON_SUB");
  });

  it("drops the no-audience warning once ad spend is set, keeps the rate warning", () => {
    const r = calculate(wooInput({ adSpendLocal: "10.00" }), fx, rules);
    expect(codes(r)).not.toContain("WOOCOMMERCE_NO_AUDIENCE");
    expect(codes(r)).toContain("WOOCOMMERCE_PAYMENT_RATE_ASSUMED");
  });
});

describe("suggestPrice on WooCommerce (AU)", () => {
  const cases = [
    { taxRegistered: false, adSpendLocal: "0.00", usd: 500 },
    { taxRegistered: true, adSpendLocal: "25.00", usd: 500 },
    { taxRegistered: false, adSpendLocal: "0.00", usd: 800 },
  ];
  // Minimality (one cent less misses the target) is covered by the solver sweep.
  it.each(cases)("solves a price that meets the target for %o", (c) => {
    const base = withoutPrice(wooInput(c));
    const target = 10;
    const s = suggestPrice(base, fx, rules, target);
    expect(s).not.toBeNull();
    const at = calculate({ ...base, sellingPriceLocal: s!.price }, fx, rules);
    expect(new Decimal(at.marginPct).gte(target)).toBe(true);
    expect(new Decimal(at.netProfit).gte(0)).toBe(true);
  });
});

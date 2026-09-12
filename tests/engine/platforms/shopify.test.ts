import { describe, expect, it } from "vitest";
import { Money } from "../../../src/engine/money";
import { computeShopifyFees } from "../../../src/engine/platforms/shopify";
import type { ShopifyFeesType } from "../../../src/lib/schemas";

const ukShopify: ShopifyFeesType = {
  referralFeePctDefault: 0,
  monthlyByPlan: { basic: 25, grow: 65, advanced: 344 },
  payments: {
    basic: { pct: 2.0, fixed: 0.25 },
    grow: { pct: 1.7, fixed: 0.25 },
    advanced: { pct: 1.5, fixed: 0.25 },
  },
  feesAreTaxable: true,
  requiresAdSpendInput: true,
};

describe("computeShopifyFees", () => {
  it("GF-09: UK basic plan, 2.0% + £0.25 fixed on £649.00", () => {
    const fees = computeShopifyFees(new Money("649.00"), ukShopify, "basic");
    expect(fees.paymentFee).toBe("13.23");
  });
});

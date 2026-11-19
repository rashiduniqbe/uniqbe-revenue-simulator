import { describe, expect, it } from "vitest";
import { Money } from "../../../src/engine/money";
import { computeWooCommerceFees } from "../../../src/engine/platforms/woocommerce";
import type { WooCommerceFeesType } from "../../../src/lib/schemas";

const woo: WooCommerceFeesType = {
  referralFeePctDefault: 0,
  payments: { pct: 1.75, fixed: 0.3 },
  monthlyFeeLocal: 0,
  feesAreTaxable: true,
  requiresAdSpendInput: true,
  paymentsNote: "test",
};

describe("computeWooCommerceFees", () => {
  it("charges pct of the gross price plus the fixed fee, each rounded to the cent", () => {
    expect(computeWooCommerceFees(new Money("1000.00"), woo).paymentFee).toBe("17.80");
  });

  it("rounds the percentage part half-up before adding the fixed fee", () => {
    // 1.75% of 99.99 = 1.749825 -> 1.75, + 0.30
    expect(computeWooCommerceFees(new Money("99.99"), woo).paymentFee).toBe("2.05");
  });
});

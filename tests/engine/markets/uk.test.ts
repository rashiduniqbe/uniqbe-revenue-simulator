import { describe, expect, it } from "vitest";
import { Money } from "../../../src/engine/money";
import { ukModule } from "../../../src/engine/markets/uk";

describe("ukModule", () => {
  it("is always above threshold regardless of goods/freight", () => {
    expect(ukModule.isAboveThreshold(new Money(0), new Money(0))).toBe(true);
    expect(ukModule.isAboveThreshold(new Money(999999), new Money(0))).toBe(true);
  });

  it("computes duty as goods x dutyPct/100 (GF-01/02/03: 0% on mobile-phone)", () => {
    expect(ukModule.computeDuty(new Money("343.73"), new Money(0)).toFixed(2)).toBe("0.00");
  });

  it("computes import tax on goods+shipping+duty at 20% when above (GF-01/02/03)", () => {
    const tax = ukModule.computeImportTax(
      new Money("343.73"),
      new Money("12.00"),
      new Money("0.00"),
      true,
    );
    expect(tax.toFixed(2)).toBe("71.15");
  });

  it("computes output tax as gross x 20/120 when registered (GF-03)", () => {
    expect(ukModule.computeOutputTax(new Money("599.99"), true).toFixed(2)).toBe("100.00");
  });

  it("computes zero output tax when not registered (GF-01/02)", () => {
    expect(ukModule.computeOutputTax(new Money("599.99"), false).toFixed(2)).toBe("0.00");
  });

  it("has the correct market identity", () => {
    expect(ukModule.id).toBe("UK");
    expect(ukModule.currency).toBe("GBP");
    expect(ukModule.taxName).toBe("VAT");
    expect(ukModule.taxRatePct).toBe(20);
  });
});

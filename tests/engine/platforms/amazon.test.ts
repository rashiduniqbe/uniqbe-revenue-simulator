import { describe, expect, it } from "vitest";
import { Money } from "../../../src/engine/money";
import { computeAmazonFees } from "../../../src/engine/platforms/amazon";
import type { AmazonFeesType } from "../../../src/lib/schemas";

const ukAmazon: AmazonFeesType = {
  referralFeePctDefault: 8,
  referralFeePctByCategory: {
    "mobile-phone": 7,
    tablet: 7,
    camera: 7,
    "computer-accessory": 7,
    audio: 8,
    wearable: 8,
    gaming: 8,
    "smart-home": 8,
    "home-appliance": 15,
  },
  minReferralFee: 0.25,
  individualPerItemFee: 0.75,
  professionalMonthlyFee: 25.0,
  feesAreTaxable: true,
};

const auAmazon: AmazonFeesType = {
  referralFeePctDefault: 8,
  referralFeePctByCategory: {
    "mobile-phone": 8,
    tablet: 8,
    audio: 8,
    wearable: 8,
    camera: 8,
    gaming: 8,
    "smart-home": 8,
    "computer-accessory": 8,
    "home-appliance": 15,
  },
  individualPerItemFee: 0.99,
  professionalMonthlyFee: 49.95,
  feesAreTaxable: true,
};

describe("computeAmazonFees", () => {
  it("GF-01/02/03: UK individual plan, 8% referral fee on £599.99", () => {
    const fees = computeAmazonFees(new Money("599.99"), ukAmazon, "individual", new Money(8));
    expect(fees.referralFee).toBe("48.00");
    expect(fees.perItemPlanFee).toBe("0.75");
  });

  it("GF-04: AU individual plan, 8% referral fee on A$999.99", () => {
    const fees = computeAmazonFees(new Money("999.99"), auAmazon, "individual", new Money(8));
    expect(fees.referralFee).toBe("80.00");
    expect(fees.perItemPlanFee).toBe("0.99");
  });

  it("GF-05: AU individual plan, 8% referral fee on A$2999.00", () => {
    const fees = computeAmazonFees(new Money("2999.00"), auAmazon, "individual", new Money(8));
    expect(fees.referralFee).toBe("239.92");
    expect(fees.perItemPlanFee).toBe("0.99");
  });

  it("applies the UK minReferralFee floor on a very low price", () => {
    const fees = computeAmazonFees(new Money("1.00"), ukAmazon, "individual", new Money(8));
    expect(fees.referralFee).toBe("0.25");
  });

  it("professional plan has no per-item fee", () => {
    const fees = computeAmazonFees(new Money("599.99"), ukAmazon, "professional", new Money(8));
    expect(fees.perItemPlanFee).toBeUndefined();
    expect(fees.referralFee).toBe("48.00");
  });
});

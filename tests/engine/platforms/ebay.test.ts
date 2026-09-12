import { describe, expect, it } from "vitest";
import { Money } from "../../../src/engine/money";
import { computeEbayFees } from "../../../src/engine/platforms/ebay";
import type { EbayFeesType } from "../../../src/lib/schemas";

const ukEbay: EbayFeesType = {
  referralFeePctDefault: 9,
  referralFeePctByCategory: {
    "mobile-phone": 8,
    tablet: 8,
    "computer-accessory": 8,
    audio: 9,
    wearable: 9,
    camera: 9,
    gaming: 9,
    "smart-home": 9,
    "home-appliance": 9,
  },
  regulatoryFeePct: 0.42,
  perOrderFee: { thresholdLocal: 10, low: 0.3, high: 0.4 },
  individualPerItemFee: 0,
  feesAreTaxable: true,
};

const auEbay: EbayFeesType = {
  referralFeePctDefault: 13.4,
  referralFeePctByCategory: {
    "mobile-phone": 13.4,
    tablet: 13.4,
    audio: 13.4,
    wearable: 13.4,
    camera: 13.4,
    gaming: 13.4,
    "smart-home": 13.4,
    "computer-accessory": 13.4,
    "home-appliance": 13.4,
  },
  tieredAbove: { thresholdLocal: 4000, pctAbove: 2.5 },
  regulatoryFeePct: 0,
  perOrderFee: { thresholdLocal: 10, low: 0, high: 0 },
  freeTierTrailingSalesLocal: 25000,
  individualPerItemFee: 0,
  feesAreTaxable: true,
};

describe("computeEbayFees", () => {
  it("GF-07: UK, 9% referral + 0.42% regulatory + per-order fee (P > £10 -> high tier)", () => {
    const fees = computeEbayFees(new Money("249.99"), ukEbay, "UK", new Money(9), false);
    expect(fees.referralFee).toBe("22.50");
    expect(fees.regulatoryFee).toBe("1.05");
    expect(new Money(fees.perOrderFee ?? "0").toFixed(2)).toBe("0.40"); // fixture says "0.4" — normalized
  });

  it("GF-08: AU free tier zeroes every fee to a single referralFee:0.00", () => {
    const fees = computeEbayFees(new Money("599.00"), auEbay, "AU", new Money(13.4), true);
    expect(fees).toEqual({ referralFee: "0.00" });
  });

  it("AU non-free-tier: applies the tiered rate to the portion above the threshold", () => {
    // Not covered by a golden fixture — derived directly from market-rules.json's
    // AU.platforms.ebay.tieredAbove (thresholdLocal 4000, pctAbove 2.5%).
    // P = 5000: 4000 @ 13.4% = 536.00, 1000 @ 2.5% = 25.00 -> referralFee 561.00
    const fees = computeEbayFees(new Money("5000.00"), auEbay, "AU", new Money(13.4), false);
    expect(fees.referralFee).toBe("561.00");
  });
});

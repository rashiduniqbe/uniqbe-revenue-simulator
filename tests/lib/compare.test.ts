import { describe, expect, it } from "vitest";
import { MarketRules, type FxSnapshotType } from "../../src/lib/schemas";
import rulesRaw from "../../src/data/market-rules.json";
import {
  buildMarketInput,
  compareMarket,
  fxInputFor,
  type CompareItem,
} from "../../src/lib/compare";
import { deriveDutyPctDefault, deriveReferralFeeDefault } from "../../src/lib/scenario-defaults";

const rules = MarketRules.parse(rulesRaw);
const item: CompareItem = { code: "TEST", usd: 400, category: "mobile-phone" };
const fx: FxSnapshotType = {
  base: "USD",
  rates: { GBP: 0.7424, AUD: 1.395 },
  asOf: "2026-08-25",
  fetchedAt: "2026-08-25T06:00:00.000Z",
  provider: "seed",
  ageDays: 0,
  degraded: true,
};

describe("fxInputFor", () => {
  it("picks the market's rate and carries asOf/degraded through", () => {
    expect(fxInputFor(fx, "UK")).toEqual({ rate: "0.7424", asOf: "2026-08-25", degraded: true });
    expect(fxInputFor(fx, "AU").rate).toBe("1.395");
  });
});

describe("buildMarketInput", () => {
  it("derives duty and referral defaults per market, not shared across them", () => {
    const uk = buildMarketInput(item, "UK", "amazon", "500.00", rules);
    const au = buildMarketInput(item, "AU", "amazon", "900.00", rules);
    expect(uk.dutyPct).toBe(deriveDutyPctDefault(rules, "UK", "mobile-phone"));
    expect(au.referralFeePct).toBe(deriveReferralFeeDefault(rules, "AU", "amazon", "mobile-phone"));
    expect(uk.market).toBe("UK");
    expect(au.market).toBe("AU");
    expect(uk.usd).toBe(400);
    expect(au.sellingPriceLocal).toBe("900.00");
  });
});

describe("compareMarket", () => {
  it("returns a result in the market's currency for a valid price", () => {
    const uk = compareMarket(item, "UK", "amazon", "500.00", rules, fx);
    const au = compareMarket(item, "AU", "amazon", "900.00", rules, fx);
    expect(uk?.currency).toBe("GBP");
    expect(uk?.auAboveThreshold).toBeNull();
    expect(au?.currency).toBe("AUD");
    expect(typeof au?.auAboveThreshold).toBe("boolean");
  });

  it.each(["", "0", "-5", "abc", "1,000"])("returns null for price %j", (price) => {
    expect(compareMarket(item, "UK", "amazon", price, rules, fx)).toBeNull();
  });
});

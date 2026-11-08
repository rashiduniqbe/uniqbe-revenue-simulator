import { describe, expect, it } from "vitest";
import { MarketRules, type FxSnapshotType } from "../../src/lib/schemas";
import rulesRaw from "../../src/data/market-rules.json";
import { compareMarket, type CompareItem } from "../../src/lib/compare";
import { PLATFORM_FEE_LABELS } from "../../src/lib/breakdown-format";
import { toResultHeadline } from "../../src/lib/result-headline";

const rules = MarketRules.parse(rulesRaw);
const fx: FxSnapshotType = {
  base: "USD",
  rates: { GBP: 0.7424, AUD: 1.395 },
  asOf: "2026-08-25",
  fetchedAt: "2026-08-25T06:00:00.000Z",
  provider: "seed",
  ageDays: 0,
  degraded: true,
};
const item: CompareItem = { code: "TEST", usd: 400, category: "mobile-phone" };

function ebayResult() {
  const result = compareMarket(item, "UK", "ebay", "500.00", rules, fx);
  if (!result) throw new Error("fixture should produce a result");
  return result;
}

describe("toResultHeadline", () => {
  it("returns null for a null result", () => {
    expect(toResultHeadline(null)).toBeNull();
  });

  it("passes platformFeeSubtotal netProfit and marginPct through as decimal strings", () => {
    const result = ebayResult();
    const headline = toResultHeadline(result);
    expect(headline?.platformFees).toBe(result.platformFeeSubtotal);
    expect(headline?.netProfit).toBe(result.netProfit);
    expect(headline?.marginPct).toBe(result.marginPct);
    expect(headline?.verdict).toBe(result.verdict);
  });

  it("feeBreakdownLine lists every platformFees key", () => {
    const result = ebayResult();
    const keys = Object.keys(result.platformFees);
    expect(keys.length).toBeGreaterThan(0);
    const line = toResultHeadline(result)?.feeBreakdownLine ?? "";
    for (const key of keys) {
      expect(line).toContain(PLATFORM_FEE_LABELS[key] ?? key);
      expect(line).toContain(result.platformFees[key]);
    }
    expect(line.split(" + ")).toHaveLength(keys.length);
  });
});

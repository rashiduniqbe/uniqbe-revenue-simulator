import { describe, expect, it } from "vitest";
import fc from "fast-check";
import rulesRaw from "../../../src/data/market-rules.json";
import { MarketRules, type FxSnapshotType } from "../../../src/lib/schemas";
import { calculate } from "../../../src/engine";
import { buildMarketInput, fxInputFor, type CompareItem } from "../../../src/lib/compare";
import {
  calculationRun,
  comparisonViewed,
  priceSuggested,
  productSelected,
  referrerSource,
  scenarioShared,
  simulatorViewed,
} from "../../../src/lib/analytics/events";

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

function resultAt(price: string, market: "UK" | "AU" = "UK") {
  return calculate(
    buildMarketInput(item, market, "amazon", price, rules),
    fxInputFor(fx, market),
    rules,
  );
}

describe("referrerSource", () => {
  it("empty referrer is direct", () => {
    expect(referrerSource("", "sim.uniqbe.com")).toBe("direct");
  });
  it("same host is internal, whatever the path or query", () => {
    expect(referrerSource("https://sim.uniqbe.com/?sp=599.99", "sim.uniqbe.com")).toBe("internal");
  });
  it("external referrer keeps the hostname only, never path or query", () => {
    expect(referrerSource("https://www.google.com/search?q=uniqbe+599", "sim.uniqbe.com")).toBe(
      "www.google.com",
    );
  });
  it("unparseable referrer is unknown", () => {
    expect(referrerSource("not a url", "sim.uniqbe.com")).toBe("unknown");
  });
});

describe("event builders", () => {
  it("calculationRun sends the spec §13 properties with a band, not the margin", () => {
    const result = resultAt("9999.00");
    expect(calculationRun(result, "UK", "amazon")).toEqual({
      name: "calculation_run",
      properties: {
        market: "UK",
        platform: "amazon",
        verdict: result.verdict,
        marginBand: expect.stringMatching(/^(<0|0-10|10-20|20-30|30\+)$/),
        auAboveThreshold: null,
      },
    });
  });

  it("calculationRun carries the AU threshold branch", () => {
    const event = calculationRun(resultAt("19999.00", "AU"), "AU", "amazon");
    expect(event.name).toBe("calculation_run");
    expect(typeof (event.properties as { auAboveThreshold: unknown }).auAboveThreshold).toBe(
      "boolean",
    );
  });

  it("priceSuggested bands the target margin", () => {
    expect(priceSuggested(25, true)).toEqual({
      name: "price_suggested",
      properties: { targetMargin: "20-30", reachable: true },
    });
  });

  it("the remaining builders match spec §13", () => {
    expect(simulatorViewed("AU", "direct")).toEqual({
      name: "simulator_viewed",
      properties: { market: "AU", referrer: "direct" },
    });
    expect(productSelected("TEST", "mobile-phone", "UK")).toEqual({
      name: "product_selected",
      properties: { productCode: "TEST", category: "mobile-phone", market: "UK" },
    });
    expect(comparisonViewed("TEST")).toEqual({
      name: "comparison_viewed",
      properties: { productCode: "TEST" },
    });
    expect(scenarioShared()).toEqual({ name: "scenario_shared", properties: {} });
  });

  it("property: no calculation_run payload ever contains a money value", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9_999_999 }),
        fc.constantFrom("UK", "AU"),
        (cents, m) => {
          const market = m as "UK" | "AU";
          const price = (cents / 100).toFixed(2);
          const result = resultAt(price, market);
          const json = JSON.stringify(calculationRun(result, market, "amazon"));
          // No decimal number of any kind: prices, profit and margin are all decimal strings.
          expect(json).not.toMatch(/\d\.\d/);
          expect(json).not.toContain(result.netProfit);
          expect(json).not.toContain(result.marginPct);
        },
      ),
      { numRuns: 200 },
    );
  });
});

import { describe, expect, it } from "vitest";
import fixturesRaw from "../../data/golden-fixtures.json";
import { calculate } from "../../src/engine/index";
import { Money } from "../../src/engine/money";
import { MarketRules } from "../../src/lib/schemas";
import rulesRaw from "../../src/data/market-rules.json";
import type { SimulationInput } from "../../src/engine/types";

const rules = MarketRules.parse(rulesRaw);

// Normalizes a money-shaped value for comparison so a delivered fixture quirk like
// "0.4" (instead of "0.40") doesn't fail the test over formatting, while a real
// one-cent value difference still fails (see plan Correction C5).
function money(v: string): string {
  return new Money(v).toFixed(2);
}

function toSimulationInput(raw: Record<string, unknown>): SimulationInput {
  return {
    market: raw.market as SimulationInput["market"],
    productCode: (raw.productCode as string) ?? "TEST",
    usd: raw.usd as number,
    category: (raw.category as SimulationInput["category"]) ?? "mobile-phone",
    platform: raw.platform as SimulationInput["platform"],
    taxRegistered: raw.taxRegistered as boolean,
    sellingPriceLocal: String(raw.sellingPriceLocal),
    inboundShippingLocal: String(raw.inboundShippingLocal),
    packagingLocal: String(raw.packagingLocal ?? 0),
    adSpendLocal: String(raw.adSpendLocal ?? 0),
    dutyPct: String(raw.dutyPct),
    referralFeePct: String(raw.referralFeePct ?? 0),
    amazonPlan: (raw.amazonPlan as SimulationInput["amazonPlan"]) ?? "individual",
    shopifyPlan: (raw.shopifyPlan as SimulationInput["shopifyPlan"]) ?? "basic",
    shopifyHasAbn: (raw.shopifyHasAbn as boolean) ?? false,
    ebayFreeTier: (raw.ebayFreeTier as boolean) ?? false,
    _planParityDisableFeeTax: raw._planParityDisableFeeTax as boolean | undefined,
  };
}

describe.each(fixturesRaw.cases)("$id — $description", (c) => {
  const input = toSimulationInput(c.input as Record<string, unknown>);
  const fx = { rate: String(c.fx.rate), asOf: c.fx.asOf, degraded: false };
  const actual = calculate(input, fx, rules);
  const expected = c.expected as Record<string, unknown>;

  for (const field of Object.keys(expected)) {
    if (field === "platformFees") {
      it(`platformFees matches`, () => {
        const expectedFees = expected.platformFees as Record<string, string>;
        const actualFees = actual.platformFees;
        expect(Object.keys(actualFees).sort()).toEqual(Object.keys(expectedFees).sort());
        for (const key of Object.keys(expectedFees)) {
          const actualFee = actualFees[key] ?? "0";
          const expectedFee = expectedFees[key] ?? "0";
          expect(money(actualFee)).toBe(money(expectedFee));
        }
      });
      continue;
    }
    it(`${field} matches`, () => {
      const expectedValue = expected[field];
      const actualValue = (actual as unknown as Record<string, unknown>)[field];
      if (typeof expectedValue === "string" && /^-?\d+\.\d+$/.test(expectedValue)) {
        expect(money(String(actualValue ?? "0"))).toBe(money(expectedValue));
      } else {
        expect(actualValue).toBe(expectedValue);
      }
    });
  }
});

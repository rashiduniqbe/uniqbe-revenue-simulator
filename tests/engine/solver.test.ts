import { describe, expect, it } from "vitest";
import fixturesRaw from "../../data/golden-fixtures.json";
import { suggestPrice } from "../../src/engine/index";
import { MarketRules } from "../../src/lib/schemas";
import rulesRaw from "../../src/data/market-rules.json";
import type { SimulationInput } from "../../src/engine/types";

const rules = MarketRules.parse(rulesRaw);

function toSolverInput(raw: Record<string, unknown>): Omit<SimulationInput, "sellingPriceLocal"> {
  return {
    market: raw.market as SimulationInput["market"],
    productCode: "TEST",
    usd: raw.usd as number,
    category: "mobile-phone",
    platform: raw.platform as SimulationInput["platform"],
    taxRegistered: raw.taxRegistered as boolean,
    inboundShippingLocal: String(raw.inboundShippingLocal),
    packagingLocal: String(raw.packagingLocal ?? 0),
    adSpendLocal: String(raw.adSpendLocal ?? 0),
    dutyPct: String(raw.dutyPct),
    referralFeePct: String(raw.referralFeePct ?? 0),
    amazonPlan: (raw.amazonPlan as SimulationInput["amazonPlan"]) ?? "individual",
    shopifyPlan: "basic",
    shopifyHasAbn: false,
    ebayFreeTier: (raw.ebayFreeTier as boolean) ?? false,
  };
}

describe.each(fixturesRaw.solverCases)("$id — $description", (c) => {
  const input = toSolverInput(c.input as Record<string, unknown>);
  const fx = { rate: String(c.fx.rate), asOf: c.fx.asOf, degraded: false };

  it("matches the expected suggestion (or null when unreachable)", () => {
    const result = suggestPrice(input, fx, rules, c.targetMarginPct);
    if (c.expected === null) {
      expect(result).toBeNull();
      return;
    }
    expect(result).not.toBeNull();
    expect(result?.price).toBe(c.expected.suggestedPriceGross);
  });
});

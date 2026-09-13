import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import fixturesRaw from "../../data/golden-fixtures.json";
import { calculate, suggestPrice } from "../../src/engine/index";
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

// Fix 1 & 2 (final whole-branch review): suggestPrice()'s eBay branch was missing
// perOrderFee entirely (undershooting the seed, so an achievable UK eBay price at a
// low target margin ran out the nudge budget and returned null) and ignored eBay's
// AU tieredAbove rate structure (overshooting for prices above the A$4,000 tier).
// These cases are hand-verified against the corrected two-regime closed form, not
// against data/golden-fixtures.json — that file's solverCases (SV-01..SV-04) are
// covered by the describe.each block above and are left untouched.
describe("eBay solver fix — perOrderFee and tiered rate (Fix 1 & 2)", () => {
  it("UK eBay at 0% target margin returns a real price (previously null: perOrderFee omitted)", () => {
    const input: Omit<SimulationInput, "sellingPriceLocal"> = {
      market: "UK",
      productCode: "TEST",
      usd: 463,
      category: "mobile-phone",
      platform: "ebay",
      taxRegistered: false,
      inboundShippingLocal: "12",
      packagingLocal: "0",
      adSpendLocal: "0",
      dutyPct: "0",
      referralFeePct: "9",
      amazonPlan: "individual",
      shopifyPlan: "basic",
      shopifyHasAbn: false,
      ebayFreeTier: false,
    };
    const fx = { rate: "0.7424", asOf: "2026-08-25", degraded: false };

    const suggestion = suggestPrice(input, fx, rules, 0);

    expect(suggestion).not.toBeNull();
    if (!suggestion) return; // narrows for TypeScript; already asserted above

    const result = calculate({ ...input, sellingPriceLocal: suggestion.price }, fx, rules);
    expect(new Decimal(result.marginPct).gte(0)).toBe(true);
    expect(new Decimal(result.netProfit).gte(0)).toBe(true);
  });

  it("AU eBay with usd large enough to land above A$4,000 satisfies calculate()'s margin/profit check when fed back", () => {
    const input: Omit<SimulationInput, "sellingPriceLocal"> = {
      market: "AU",
      productCode: "TEST",
      usd: 3000,
      category: "mobile-phone",
      platform: "ebay",
      taxRegistered: false,
      inboundShippingLocal: "20",
      packagingLocal: "0",
      adSpendLocal: "0",
      dutyPct: "0",
      referralFeePct: "13.4",
      amazonPlan: "individual",
      shopifyPlan: "basic",
      shopifyHasAbn: false,
      ebayFreeTier: false,
    };
    const fx = { rate: "1.395", asOf: "2026-08-25", degraded: false };
    const targetMarginPct = 20;

    const suggestion = suggestPrice(input, fx, rules, targetMarginPct);

    expect(suggestion).not.toBeNull();
    if (!suggestion) return; // narrows for TypeScript; already asserted above

    // Confirms this case actually exercises the tiered (above-A$4,000) regime,
    // not just the flat-rate closed form.
    expect(new Decimal(suggestion.price).gt(4000)).toBe(true);

    const result = calculate({ ...input, sellingPriceLocal: suggestion.price }, fx, rules);
    expect(new Decimal(result.marginPct).gte(targetMarginPct)).toBe(true);
    expect(new Decimal(result.netProfit).gte(0)).toBe(true);
  });
});

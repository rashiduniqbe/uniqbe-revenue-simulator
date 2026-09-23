import { describe, expect, it } from "vitest";
import { decodeScenario, encodeScenario, DEFAULT_SCENARIO } from "../../src/lib/url-state";

describe("encodeScenario / decodeScenario", () => {
  it("round-trips a fully-specified scenario", () => {
    const scenario = {
      market: "UK" as const,
      productCode: "OP00572",
      platform: "amazon" as const,
      taxRegistered: true,
      sellingPriceLocal: "599.99",
      inboundShippingLocal: "12.00",
      packagingLocal: "1.50",
      adSpendLocal: "0.00",
      dutyPct: "0",
      referralFeePct: "8",
      amazonPlan: "professional" as const,
      shopifyPlan: "basic" as const,
      shopifyHasAbn: false,
      ebayFreeTier: false,
    };
    const params = encodeScenario(scenario);
    expect(decodeScenario(params)).toEqual(scenario);
  });

  it("returns every default for an empty URLSearchParams", () => {
    expect(decodeScenario(new URLSearchParams())).toEqual(DEFAULT_SCENARIO);
  });

  it("uses the short param names from the plan's URL schema", () => {
    const params = encodeScenario({ ...DEFAULT_SCENARIO, productCode: "OP00572", sellingPriceLocal: "599.99" });
    expect(params.get("p")).toBe("OP00572");
    expect(params.get("sp")).toBe("599.99");
    expect(params.get("m")).toBe("UK");
  });

  it("decodes booleans correctly, not as truthy strings", () => {
    const params = new URLSearchParams({ reg: "true", abn: "false" });
    const decoded = decodeScenario(params);
    expect(decoded.taxRegistered).toBe(true);
    expect(decoded.shopifyHasAbn).toBe(false);
  });

  it("round-trips an AU scenario with ebayFreeTier and shopifyHasAbn set", () => {
    const scenario = {
      ...DEFAULT_SCENARIO,
      market: "AU" as const,
      platform: "ebay" as const,
      ebayFreeTier: true,
      shopifyHasAbn: true,
    };
    const params = encodeScenario(scenario);
    expect(decodeScenario(params)).toEqual(scenario);
    expect(params.get("m")).toBe("AU");
    expect(params.get("et")).toBe("true");
    expect(params.get("abn")).toBe("true");
  });
});

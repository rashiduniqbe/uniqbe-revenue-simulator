import { describe, expect, it } from "vitest";
import { Money } from "../../src/engine/money";
import { emitWarnings } from "../../src/engine/warnings";
import type { EngineContext } from "../../src/engine/markets/registry";

function baseCtx(overrides: Partial<EngineContext>): EngineContext {
  return {
    market: "UK",
    goods: new Money("343.73"),
    shipping: new Money("12.00"),
    duty: new Money("0.00"),
    above: true,
    importTax: new Money("71.15"),
    registered: false,
    platform: "amazon",
    adSpend: new Money("0.00"),
    shopifyHasAbn: false,
    ...overrides,
  };
}

describe("emitWarnings", () => {
  it("always includes NOT_TAX_ADVICE and CUSTOMS_DECLARED_VALUE_UNCONFIRMED", () => {
    const codes = emitWarnings(baseCtx({})).map((w) => w.code);
    expect(codes).toContain("NOT_TAX_ADVICE");
    expect(codes).toContain("CUSTOMS_DECLARED_VALUE_UNCONFIRMED");
  });

  it("DOORSTEP_LIABILITY fires when duty or import tax is non-zero", () => {
    const codes = emitWarnings(baseCtx({ importTax: new Money("71.15") })).map((w) => w.code);
    expect(codes).toContain("DOORSTEP_LIABILITY");
  });

  it("DOORSTEP_LIABILITY does not fire when both duty and import tax are zero", () => {
    const codes = emitWarnings(
      baseCtx({ duty: new Money("0.00"), importTax: new Money("0.00") }),
    ).map((w) => w.code);
    expect(codes).not.toContain("DOORSTEP_LIABILITY");
  });

  it("IMPORT_TAX_CASHFLOW fires only when registered and import tax > 0", () => {
    const registered = emitWarnings(
      baseCtx({ registered: true, importTax: new Money("71.15") }),
    ).map((w) => w.code);
    expect(registered).toContain("IMPORT_TAX_CASHFLOW");

    const unregistered = emitWarnings(
      baseCtx({ registered: false, importTax: new Money("71.15") }),
    ).map((w) => w.code);
    expect(unregistered).not.toContain("IMPORT_TAX_CASHFLOW");
  });

  it("AU_BELOW_THRESHOLD fires for AU when below, AU_NEAR_THRESHOLD when within 5%", () => {
    const below = emitWarnings(
      baseCtx({ market: "AU", above: false, goods: new Money("645.89") }),
    ).map((w) => w.code);
    expect(below).toContain("AU_BELOW_THRESHOLD");

    // 5% of 1000 = 50 -> goods=960 is within 5% of the 1000 threshold
    const near = emitWarnings(
      baseCtx({ market: "AU", above: false, goods: new Money("960.00") }),
    ).map((w) => w.code);
    expect(near).toContain("AU_NEAR_THRESHOLD");
  });

  it("SHOPIFY_NO_AUDIENCE fires for Shopify with zero ad spend", () => {
    const codes = emitWarnings(baseCtx({ platform: "shopify", adSpend: new Money("0.00") })).map(
      (w) => w.code,
    );
    expect(codes).toContain("SHOPIFY_NO_AUDIENCE");
  });

  it("SHOPIFY_AU_GST_ON_SUB fires for AU Shopify without an ABN", () => {
    const codes = emitWarnings(
      baseCtx({ market: "AU", platform: "shopify", shopifyHasAbn: false }),
    ).map((w) => w.code);
    expect(codes).toContain("SHOPIFY_AU_GST_ON_SUB");

    const withAbn = emitWarnings(
      baseCtx({ market: "AU", platform: "shopify", shopifyHasAbn: true }),
    ).map((w) => w.code);
    expect(withAbn).not.toContain("SHOPIFY_AU_GST_ON_SUB");
  });
});

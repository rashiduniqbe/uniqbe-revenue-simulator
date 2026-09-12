import { describe, expect, it } from "vitest";
import { Money } from "../../../src/engine/money";
import { auModule, comparand } from "../../../src/engine/markets/au";

describe("comparand", () => {
  it("returns goods alone for 'goods'", () => {
    expect(comparand("goods", new Money("999.99"), new Money("500.00")).toFixed(2)).toBe("999.99");
  });

  it("returns goods+freight for 'goods+freight'", () => {
    expect(comparand("goods+freight", new Money("999.99"), new Money("20.00")).toFixed(2)).toBe(
      "1019.99",
    );
  });

  it("throws on an unrecognised comparand value", () => {
    // @ts-expect-error -- deliberately invalid to prove the runtime throws
    expect(() => comparand("goods+tax", new Money("1"), new Money("1"))).toThrow(
      /unknown deMinimisComparand/,
    );
  });
});

describe("auModule", () => {
  it("has the correct market identity", () => {
    expect(auModule.id).toBe("AU");
    expect(auModule.currency).toBe("AUD");
    expect(auModule.taxName).toBe("GST");
    expect(auModule.taxRatePct).toBe(10);
  });

  it("GF-06a: goods A$999.99, freight A$20 -> below (goods-only comparand)", () => {
    expect(auModule.isAboveThreshold(new Money("999.99"), new Money("20.00"))).toBe(false);
  });

  it("GF-06b: goods exactly A$1,000.00 -> above (>= is inclusive)", () => {
    expect(auModule.isAboveThreshold(new Money("1000.00"), new Money("20.00"))).toBe(true);
  });

  it("GF-06c negative control: same goods as GF-06a, freight raised to A$500 -> still below", () => {
    expect(auModule.isAboveThreshold(new Money("999.99"), new Money("500.00"))).toBe(false);
  });

  it("GF-05: goods A$2301.75 -> above", () => {
    expect(auModule.isAboveThreshold(new Money("2301.75"), new Money("25.00"))).toBe(true);
  });

  it("computes import tax at 10% on goods+shipping+duty when above (GF-05)", () => {
    const tax = auModule.computeImportTax(
      new Money("2301.75"),
      new Money("25.00"),
      new Money("0.00"),
      true,
    );
    expect(tax.toFixed(2)).toBe("232.68");
  });

  it("computes zero import tax when below threshold (GF-06a/GF-06c)", () => {
    const tax = auModule.computeImportTax(
      new Money("999.99"),
      new Money("500.00"),
      new Money("0.00"),
      false,
    );
    expect(tax.toFixed(2)).toBe("0.00");
  });

  it("computes output tax as gross x 10/110 when registered", () => {
    // Not directly covered by a GF calc fixture (SV-03/SV-04 exercise it via the solver);
    // verified by hand: 1065.27 x 10/110 = 96.8427... -> 96.84
    expect(auModule.computeOutputTax(new Money("1065.27"), true).toFixed(2)).toBe("96.84");
  });
});

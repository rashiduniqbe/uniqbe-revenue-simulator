import { describe, expect, it } from "vitest";
import { alignedAmount } from "../../src/lib/breakdown-format";

describe("alignedAmount", () => {
  it("left-pads a positive amount to match the widest realistic column", () => {
    expect(alignedAmount("599.99", 10)).toBe("    599.99");
  });

  it("left-pads a negative amount the same way", () => {
    expect(alignedAmount("-343.73", 10)).toBe("   -343.73");
  });

  it("does not truncate an amount wider than the given width", () => {
    expect(alignedAmount("-123456.78", 5)).toBe("-123456.78");
  });
});

import { describe, expect, it } from "vitest";
import { Money, r2, assertBreakdownSums } from "../../src/engine/money";

describe("r2", () => {
  it("rounds half up at the exact 2dp boundary", () => {
    expect(r2("0.005").toFixed(2)).toBe("0.01");
    expect(r2("0.995").toFixed(2)).toBe("1.00");
  });

  it("rounds half away from zero for negatives", () => {
    expect(r2("-0.005").toFixed(2)).toBe("-0.01");
  });

  it("never produces a signed zero string", () => {
    expect(r2("-0.001").toFixed(2)).toBe("0.00");
    expect(r2("-0.0000001").toFixed(2)).toBe("0.00");
  });

  it("leaves an already-2dp value unchanged", () => {
    expect(r2("47.99").toFixed(2)).toBe("47.99");
  });

  it("accepts a Money instance directly", () => {
    expect(r2(new Money("599.996")).toFixed(2)).toBe("600.00");
  });
});

describe("assertBreakdownSums", () => {
  it("does not throw when lines sum exactly to the total", () => {
    expect(() => assertBreakdownSums(["599.99", "-343.73", "-12.00"], "244.26")).not.toThrow();
  });

  it("throws with actual vs expected when lines are short by a cent", () => {
    expect(() => assertBreakdownSums(["599.99", "-343.73", "-12.01"], "244.26")).toThrowError(
      /244\.25.*244\.26/s,
    );
  });

  it("treats an empty line list as summing to zero", () => {
    expect(() => assertBreakdownSums([], "0.00")).not.toThrow();
    expect(() => assertBreakdownSums([], "0.01")).toThrow();
  });
});

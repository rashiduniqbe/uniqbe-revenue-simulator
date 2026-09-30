import { describe, expect, it } from "vitest";
import { computeWaterfallSegments } from "../../src/lib/waterfall";
import type { BreakdownLine } from "../../src/engine/types";

describe("computeWaterfallSegments", () => {
  it("sizes each deduction segment proportionally to the gross selling price, profit included", () => {
    const lines: BreakdownLine[] = [
      { label: "Gross selling price", amount: "100.00" },
      { label: "Goods cost", amount: "-40.00" },
      { label: "Shipping", amount: "-10.00" },
    ];
    const segments = computeWaterfallSegments(lines, "50.00");
    // Gross selling price itself is the 100% reference, not a rendered segment.
    const labels = segments.map((s) => s.label);
    expect(labels).toEqual(["Goods cost", "Shipping", "Net profit"]);
    expect(segments[0]!.widthPct).toBeCloseTo(40, 5);
    expect(segments[1]!.widthPct).toBeCloseTo(10, 5);
    expect(segments[2]!.widthPct).toBeCloseTo(50, 5);
    const totalWidth = segments.reduce((sum, s) => sum + s.widthPct, 0);
    expect(totalWidth).toBeCloseTo(100, 5);
  });

  it("marks every deduction as negative and the profit segment as negative only when it is a loss", () => {
    const lines: BreakdownLine[] = [
      { label: "Gross selling price", amount: "100.00" },
      { label: "Goods cost", amount: "-120.00" },
    ];
    const segments = computeWaterfallSegments(lines, "-20.00");
    const profitSegment = segments.find((s) => s.label === "Net profit")!;
    expect(profitSegment.negative).toBe(true);
    const goodsSegment = segments.find((s) => s.label === "Goods cost")!;
    expect(goodsSegment.negative).toBe(true);
  });

  it("marks a positive profit segment as not negative", () => {
    const lines: BreakdownLine[] = [
      { label: "Gross selling price", amount: "100.00" },
      { label: "Goods cost", amount: "-40.00" },
    ];
    const segments = computeWaterfallSegments(lines, "60.00");
    expect(segments.find((s) => s.label === "Net profit")!.negative).toBe(false);
  });

  it("gives a zero-amount line a zero-width segment rather than dropping it", () => {
    const lines: BreakdownLine[] = [
      { label: "Gross selling price", amount: "100.00" },
      { label: "Import duty", amount: "0.00" },
    ];
    const segments = computeWaterfallSegments(lines, "100.00");
    expect(segments.find((s) => s.label === "Import duty")!.widthPct).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { marginBand } from "../../../src/lib/analytics/bands";

describe("marginBand", () => {
  it.each([
    ["-250.00", "<0"],
    ["-0.01", "<0"],
    ["-0.00", "0-10"],
    ["0", "0-10"],
    ["9.99", "0-10"],
    ["10", "10-20"],
    ["19.99", "10-20"],
    ["20.00", "20-30"],
    ["29.999", "20-30"],
    ["30", "30+"],
    ["99.99", "30+"],
  ])("%s -> %s (lower edge inclusive)", (pct, band) => {
    expect(marginBand(pct)).toBe(band);
  });
});

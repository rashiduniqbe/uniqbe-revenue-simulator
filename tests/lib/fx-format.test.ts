import { describe, expect, it } from "vitest";
import { formatFxBadgeText } from "../../src/lib/fx-format";

describe("formatFxBadgeText", () => {
  it("formats the exact example from the spec", () => {
    expect(formatFxBadgeText(0.7424, "GBP", "2026-08-25")).toBe(
      "1 USD = 0.7424 GBP · rate as of 25 Aug 2026",
    );
  });

  it("pads a rate with fewer than 4 decimal places", () => {
    expect(formatFxBadgeText(1.395, "AUD", "2026-01-05")).toBe(
      "1 USD = 1.3950 AUD · rate as of 5 Jan 2026",
    );
  });

  it("does not shift the date across a UTC/local timezone boundary", () => {
    // A naive `new Date("2026-12-31")` formatted in a negative-UTC-offset
    // timezone renders as 30 Dec, not 31 Dec. This function must not use
    // the Date constructor on a bare date string for that reason.
    expect(formatFxBadgeText(0.75, "GBP", "2026-12-31")).toBe(
      "1 USD = 0.7500 GBP · rate as of 31 Dec 2026",
    );
  });
});

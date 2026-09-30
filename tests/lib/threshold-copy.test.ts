import { describe, expect, it } from "vitest";
import { thresholdBannerText } from "../../src/lib/threshold-copy";

describe("thresholdBannerText", () => {
  it("reproduces the §9.3 above-threshold copy at A$1,000", () => {
    expect(thresholdBannerText(true, 1000)).toBe(
      "Over A$1,000 — GST of 10% applies at the border and is included below.",
    );
  });

  it("reproduces the §9.3 below-threshold copy at A$1,000", () => {
    expect(thresholdBannerText(false, 1000)).toBe(
      "Under A$1,000 — no GST charged today. This reflects Uniqbe's current policy, not a permanent rule.",
    );
  });

  it("follows the configured threshold instead of a hardcoded one", () => {
    expect(thresholdBannerText(true, 1500)).toMatch(/^Over A\$1,500 /);
  });
});

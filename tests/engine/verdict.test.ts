import { describe, expect, it } from "vitest";
import { Money } from "../../src/engine/money";
import { verdict, VERDICT_MARGIN_THRESHOLD_PCT } from "../../src/engine/verdict";

describe("VERDICT_MARGIN_THRESHOLD_PCT", () => {
  it("is the §2.6 #5 placeholder value of 12", () => {
    expect(VERDICT_MARGIN_THRESHOLD_PCT).toBe(12);
  });
});

describe("verdict", () => {
  it("is loss-making when profit <= 0, regardless of margin", () => {
    expect(verdict(new Money("-67.08"), new Money("-16.81"))).toBe("loss-making");
    expect(verdict(new Money("0.00"), new Money("0.00"))).toBe("loss-making");
  });

  it("is marginal when profit > 0 but margin < threshold (GF-05: 5.82%, GF-06b: 10.98%)", () => {
    expect(verdict(new Money("174.57"), new Money("5.82"))).toBe("marginal");
    expect(verdict(new Money("153.71"), new Money("10.98"))).toBe("marginal");
  });

  it("is profitable when margin >= threshold (GF-01: 20.73%)", () => {
    expect(verdict(new Money("124.36"), new Money("20.73"))).toBe("profitable");
  });

  it("GF-10: loss case is loss-making", () => {
    expect(verdict(new Money("-67.08"), new Money("-16.81"))).toBe("loss-making");
  });
});

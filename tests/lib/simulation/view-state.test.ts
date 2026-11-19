import { describe, expect, it } from "vitest";
import { decodeSimState, resolveView } from "../../../src/lib/simulation/view-state";

const params = (q: string) => new URLSearchParams(q);

describe("resolveView", () => {
  it("opens the simulation when the URL has no keys", () => {
    expect(resolveView(params(""))).toBe("sim");
  });

  it("opens the calculator for an old link with a product", () => {
    expect(resolveView(params("m=AU&p=AP13698"))).toBe("calc");
  });

  it("opens the calculator for an old link with only a selling price", () => {
    expect(resolveView(params("sp=2500"))).toBe("calc");
  });

  it("lets v win over p and sp", () => {
    expect(resolveView(params("v=sim&p=AP13698&sp=2500"))).toBe("sim");
    expect(resolveView(params("v=calc"))).toBe("calc");
  });

  it("ignores an empty p or sp", () => {
    expect(resolveView(params("p=&sp="))).toBe("sim");
  });

  it("ignores an unknown v and falls back to the link rule", () => {
    expect(resolveView(params("v=table&p=AP13698"))).toBe("calc");
  });
});

describe("decodeSimState", () => {
  it("uses the defaults for an empty URL", () => {
    expect(decodeSimState(params(""))).toEqual({
      targetMarginPct: 5,
      category: "all",
      query: "",
      sort: "cost-desc",
      page: 1,
      gst: "all",
      row: "",
      rowPlatform: "amazon",
    });
  });

  it("reads every simulation key", () => {
    expect(
      decodeSimState(
        params("tm=10&cat=audio&q=pixel&sort=profit-desc&pg=3&gst=above&row=GO00001&rpl=ebay"),
      ),
    ).toEqual({
      targetMarginPct: 10,
      category: "audio",
      query: "pixel",
      sort: "profit-desc",
      page: 3,
      gst: "above",
      row: "GO00001",
      rowPlatform: "ebay",
    });
  });

  it("falls back to the default for a target margin it does not offer", () => {
    expect(decodeSimState(params("tm=12")).targetMarginPct).toBe(5);
  });
});

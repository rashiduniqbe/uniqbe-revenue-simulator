import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Catalogue, CatalogueItem, MarketRules, FxSnapshot } from "../../src/lib/schemas";

describe("CatalogueItem", () => {
  it("accepts a real catalogue item", () => {
    const item = {
      code: "AM00106",
      brand: "Amazon",
      name: "Echo Spot 2024 (Black)",
      categoryRaw: "Smart Speaker",
      category: "smart-home",
      categoryLabel: "Smart Home",
      usd: 70,
      hkdRef: 546,
      storageGb: null,
      search: "amazon echo spot 2024 (black) smart home",
    };
    expect(() => CatalogueItem.parse(item)).not.toThrow();
  });

  it("rejects a non-integer usd value", () => {
    const item = {
      code: "AM00106",
      brand: "Amazon",
      name: "Echo Spot 2024 (Black)",
      categoryRaw: "Smart Speaker",
      category: "smart-home",
      categoryLabel: "Smart Home",
      usd: 69.99,
      hkdRef: 546,
      storageGb: null,
      search: "amazon echo spot 2024 (black) smart home",
    };
    expect(() => CatalogueItem.parse(item)).toThrow();
  });

  it("rejects an unknown category slug", () => {
    const item = {
      code: "AM00106",
      brand: "Amazon",
      name: "Echo Spot 2024 (Black)",
      categoryRaw: "Drones",
      category: "drone",
      categoryLabel: "Drone",
      usd: 70,
      hkdRef: 546,
      storageGb: null,
      search: "amazon echo spot 2024 (black) drone",
    };
    expect(() => CatalogueItem.parse(item)).toThrow();
  });
});

describe("Catalogue", () => {
  it("parses the real generated catalogue file", () => {
    const raw = JSON.parse(readFileSync("src/data/catalogue.json", "utf-8"));
    expect(() => Catalogue.parse(raw)).not.toThrow();
  });
});

describe("MarketRules", () => {
  it("parses the real market-rules.json file", () => {
    const raw = JSON.parse(readFileSync("src/data/market-rules.json", "utf-8"));
    expect(() => MarketRules.parse(raw)).not.toThrow();
  });

  it("rejects a market block with a non-numeric duty percentage", () => {
    const raw = JSON.parse(readFileSync("src/data/market-rules.json", "utf-8"));
    raw.UK.dutyPctByCategory["mobile-phone"] = "zero";
    expect(() => MarketRules.parse(raw)).toThrow();
  });
});

describe("FxSnapshot", () => {
  it("accepts a well-formed snapshot", () => {
    const snapshot = {
      base: "USD",
      rates: { GBP: 0.7424, AUD: 1.395 },
      asOf: "2026-08-25",
      fetchedAt: "2026-08-26T06:00:00.000Z",
      provider: "frankfurter",
      degraded: false,
      ageDays: 1,
    };
    expect(() => FxSnapshot.parse(snapshot)).not.toThrow();
  });

  it("rejects an unknown provider", () => {
    const snapshot = {
      base: "USD",
      rates: { GBP: 0.7424, AUD: 1.395 },
      asOf: "2026-08-25",
      fetchedAt: "2026-08-26T06:00:00.000Z",
      provider: "openexchangerates",
      degraded: false,
      ageDays: 1,
    };
    expect(() => FxSnapshot.parse(snapshot)).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { diffCatalogues } from "../../scripts/catalogue-diff";
import type { CatalogueItemType } from "../../src/lib/schemas";

function item(overrides: Partial<CatalogueItemType>): CatalogueItemType {
  return {
    code: "AA00001",
    brand: "TestBrand",
    name: "Test Product",
    categoryRaw: "Tablet",
    category: "tablet",
    categoryLabel: "Tablet",
    usd: 100,
    hkdRef: 780,
    storageGb: null,
    search: "testbrand test product tablet",
    ...overrides,
  };
}

describe("diffCatalogues", () => {
  it("detects an added product", () => {
    const before = [item({ code: "AA00001" })];
    const after = [item({ code: "AA00001" }), item({ code: "AA00002" })];
    const diff = diffCatalogues(before, after);
    expect(diff.added.map((i) => i.code)).toEqual(["AA00002"]);
    expect(diff.removed).toHaveLength(0);
    expect(diff.repriced).toHaveLength(0);
  });

  it("detects a removed product", () => {
    const before = [item({ code: "AA00001" }), item({ code: "AA00002" })];
    const after = [item({ code: "AA00001" })];
    const diff = diffCatalogues(before, after);
    expect(diff.removed.map((i) => i.code)).toEqual(["AA00002"]);
  });

  it("detects a repriced product with a percentage delta", () => {
    const before = [item({ code: "AA00001", usd: 100 })];
    const after = [item({ code: "AA00001", usd: 110 })];
    const diff = diffCatalogues(before, after);
    expect(diff.repriced).toEqual([{ code: "AA00001", oldUsd: 100, newUsd: 110, pctChange: 10 }]);
  });

  it("reports no changes for identical catalogues", () => {
    const items = [item({ code: "AA00001" })];
    const diff = diffCatalogues(items, items);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.repriced).toHaveLength(0);
  });
});

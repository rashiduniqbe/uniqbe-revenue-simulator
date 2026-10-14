import { describe, expect, it } from "vitest";
import { filterProducts } from "../../src/lib/search";
import catalogueData from "../../src/data/catalogue.json";
import { Catalogue, type CatalogueItemType } from "../../src/lib/schemas";

const catalogue = Catalogue.parse(catalogueData);

describe("filterProducts", () => {
  it("returns every item for an empty query", () => {
    expect(filterProducts(catalogue.items, "")).toEqual(catalogue.items);
    expect(filterProducts(catalogue.items, "   ")).toEqual(catalogue.items);
  });

  it('surfaces every variant matching both tokens of "nord 512"', () => {
    const makeItem = (code: string, name: string): CatalogueItemType => ({
      code,
      brand: "OnePlus",
      name,
      categoryRaw: "mobile phone",
      category: "mobile-phone",
      categoryLabel: "Mobile Phone",
      usd: 400,
      hkdRef: 3100,
      storageGb: null,
      search: `oneplus ${name.toLowerCase()} mobile phone`,
    });
    const items = [
      makeItem("TT00001", "Nord 6 Dual Sim 12GB RAM 512GB 5G (Pitch Black)"),
      makeItem("TT00002", "Nord 6 Dual Sim 12GB RAM 512GB 5G (Fresh Mint)"),
      makeItem("TT00003", "Echo Dot 5th Generation (Charcoal)"),
    ];
    const codes = filterProducts(items, "nord 512").map((item) => item.code);
    expect(codes).toEqual(expect.arrayContaining(["TT00001", "TT00002"]));
    expect(codes).not.toContain("TT00003");
  });

  it("returns no results for a query that matches nothing in the catalogue", () => {
    expect(filterProducts(catalogue.items, "zzzznonexistentproductzzzz")).toEqual([]);
  });

  it("stays under 50ms on the full real catalogue", () => {
    const start = performance.now();
    filterProducts(catalogue.items, "nord 512");
    const elapsedMs = performance.now() - start;
    expect(elapsedMs).toBeLessThan(50);
  });

  it("stays under 50ms on a synthetic catalogue of 400 items", () => {
    const synthetic = Array.from({ length: 400 }, (_, i) => ({
      ...catalogue.items[0]!,
      code: `ZZ${String(i).padStart(5, "0")}`,
      search: `synthetic product number ${i} widget gadget`,
    }));
    const start = performance.now();
    filterProducts(synthetic, "widget 250");
    const elapsedMs = performance.now() - start;
    expect(elapsedMs).toBeLessThan(50);
  });
});

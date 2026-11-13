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

  describe("SKU and keyword matching", () => {
    const makePhone = (code: string, name: string): CatalogueItemType => ({
      code,
      brand: "Test",
      name,
      categoryRaw: "mobile phone",
      category: "mobile-phone",
      categoryLabel: "Mobile Phone",
      usd: 1000,
      hkdRef: 7800,
      storageGb: null,
      search: `${name.toLowerCase()} mobile phone`,
    });
    const items = [
      makePhone("TT13690", "Apple iPhone 17 Pro Single Sim + eSim 512GB (Deep Blue) HK Spec"),
      makePhone("TT13693", "Apple iPhone 17 Pro Single Sim + eSim 1TB (Deep Blue) HK Spec"),
      makePhone(
        "TT04447",
        "Galaxy S25 Ultra S938B Dual Sim 12GB RAM 256GB 5G (Titanium Silver Blue)",
      ),
      makePhone("TT04900", "Galaxy A37 A376B Dual Sim 8GB RAM 128GB 5G (Awesome Charcoal)"),
    ];
    const codesFor = (query: string) => filterProducts(items, query).map((item) => item.code);

    it("finds an item by its exact SKU, ignoring case", () => {
      expect(codesFor("TT13693")).toEqual(["TT13693"]);
      expect(codesFor("tt13693")).toEqual(["TT13693"]);
    });

    it("finds items by a SKU prefix", () => {
      expect(codesFor("TT136")).toEqual(["TT13690", "TT13693"]);
    });

    it("ranks an exact SKU match first", () => {
      const ranked = [items[0]!, { ...items[1]!, search: `${items[1]!.search} tt13690` }];
      expect(filterProducts(ranked, "TT13693").map((item) => item.code)[0]).toBe("TT13693");
      const reversed = [...ranked].reverse();
      expect(filterProducts(reversed, "TT13690").map((item) => item.code)).toEqual([
        "TT13690",
        "TT13693",
      ]);
    });

    it("requires every word of the query to appear", () => {
      expect(codesFor("galaxy s25")).toEqual(["TT04447"]);
    });

    it("finds a pasted full product name without its sibling variants", () => {
      expect(codesFor("Apple iPhone 17 Pro Single Sim + eSim 1TB (Deep Blue)")).toEqual([
        "TT13693",
      ]);
    });

    it("returns nothing for a misspelt word", () => {
      expect(codesFor("iphnoe")).toEqual([]);
    });
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

import { describe, expect, it } from "vitest";
import { filterProducts } from "../../src/lib/search";
import catalogueData from "../../src/data/catalogue.json";
import { Catalogue } from "../../src/lib/schemas";

const catalogue = Catalogue.parse(catalogueData);

describe("filterProducts", () => {
  it("returns every item for an empty query", () => {
    expect(filterProducts(catalogue.items, "")).toEqual(catalogue.items);
    expect(filterProducts(catalogue.items, "   ")).toEqual(catalogue.items);
  });

  it('surfaces both real Nord 6 512GB variants for "nord 512"', () => {
    const results = filterProducts(catalogue.items, "nord 512");
    const codes = results.map((item) => item.code);
    expect(codes).toContain("OP00572");
    expect(codes).toContain("OP00573");
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

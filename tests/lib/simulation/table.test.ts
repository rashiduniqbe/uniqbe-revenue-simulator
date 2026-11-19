import { describe, expect, it } from "vitest";
import {
  PAGE_SIZE,
  categoryOptions,
  filterRows,
  paginate,
  sortRows,
  summarize,
} from "../../../src/lib/simulation/table";
import type { SimCell, SimPlatform, SimRow } from "../../../src/lib/simulation/simulate";

function cell(platform: SimPlatform, price: string, netProfit: string): SimCell {
  return { platform, price, netProfit, marginPct: "5.00", feeTotal: "1.00" };
}

function row(over: Partial<SimRow> & Pick<SimRow, "code">): SimRow {
  return {
    name: `Product ${over.code}`,
    category: "mobile-phone",
    categoryLabel: "Mobile Phone",
    search: `product ${over.code.toLowerCase()} mobile phone`,
    usd: 100,
    goodsCost: "100.00",
    landedCost: "100.00",
    importTax: "0.00",
    auAboveThreshold: false,
    nearThreshold: false,
    cells: {
      amazon: cell("amazon", "110.00", "5.00"),
      ebay: cell("ebay", "120.00", "6.00"),
      shopify: cell("shopify", "105.00", "5.00"),
      woocommerce: cell("woocommerce", "105.00", "5.00"),
    },
    ...over,
  };
}

const phone = row({ code: "AP00001", name: "iPhone Air", usd: 900 });
const buds = row({
  code: "SA00002",
  name: "Galaxy Buds",
  usd: 120,
  category: "audio",
  categoryLabel: "Audio",
  search: "galaxy buds audio",
  auAboveThreshold: true,
});
const watch = row({
  code: "GO00003",
  name: "Pixel Watch",
  usd: 300,
  category: "wearable",
  categoryLabel: "Wearable",
  search: "pixel watch wearable",
  nearThreshold: true,
});
const rows = [phone, buds, watch];

describe("filterRows", () => {
  it("matches the SKU as well as the name", () => {
    expect(filterRows(rows, { query: "sa00002", category: "all", gst: "all" })).toEqual([buds]);
    expect(filterRows(rows, { query: "pixel", category: "all", gst: "all" })).toEqual([watch]);
  });

  it("filters by category slug", () => {
    expect(filterRows(rows, { query: "", category: "audio", gst: "all" })).toEqual([buds]);
  });

  it("filters by the A$1,000 line", () => {
    expect(filterRows(rows, { query: "", category: "all", gst: "above" })).toEqual([buds]);
    expect(filterRows(rows, { query: "", category: "all", gst: "below" })).toEqual([phone, watch]);
  });
});

describe("sortRows", () => {
  it("sorts by Uniqbe price, high to low by default order", () => {
    expect(sortRows(rows, "cost-desc").map((r) => r.code)).toEqual([
      "AP00001",
      "GO00003",
      "SA00002",
    ]);
    expect(sortRows(rows, "cost-asc").map((r) => r.code)).toEqual([
      "SA00002",
      "GO00003",
      "AP00001",
    ]);
  });

  it("sorts by name", () => {
    expect(sortRows(rows, "name").map((r) => r.name)).toEqual([
      "Galaxy Buds",
      "iPhone Air",
      "Pixel Watch",
    ]);
  });

  it("sorts by the best profit on any platform, high to low", () => {
    const rich = row({
      code: "XX00009",
      cells: { ...phone.cells, ebay: cell("ebay", "9", "99.00") },
    });
    expect(sortRows([phone, rich], "profit-desc")[0]?.code).toBe("XX00009");
  });

  it("does not reorder the input array", () => {
    const input = [...rows];
    sortRows(input, "name");
    expect(input).toEqual(rows);
  });
});

describe("paginate", () => {
  const many = Array.from({ length: PAGE_SIZE + 3 }, (_, i) =>
    row({ code: `AA${String(i).padStart(5, "0")}` }),
  );

  it("cuts a page of PAGE_SIZE rows and counts the pages", () => {
    const p = paginate(many, 1);
    expect(p.rows).toHaveLength(PAGE_SIZE);
    expect(p.pageCount).toBe(2);
    expect(paginate(many, 2).rows).toHaveLength(3);
  });

  it("clamps a page past the end to the last page", () => {
    expect(paginate(many, 99).page).toBe(2);
  });

  it("has one empty page for no rows", () => {
    expect(paginate([], 1)).toEqual({ rows: [], page: 1, pageCount: 1 });
  });
});

describe("categoryOptions", () => {
  it("lists each category once with its count, by label", () => {
    expect(categoryOptions([phone, buds, watch, row({ code: "AP00004" })])).toEqual([
      { slug: "audio", label: "Audio", count: 1 },
      { slug: "mobile-phone", label: "Mobile Phone", count: 2 },
      { slug: "wearable", label: "Wearable", count: 1 },
    ]);
  });
});

describe("summarize", () => {
  it("gives the median markup over the Uniqbe price and the median profit per platform", () => {
    const a = row({ code: "AA00001", goodsCost: "100.00" });
    const b = row({
      code: "AA00002",
      goodsCost: "200.00",
      cells: { ...a.cells, amazon: cell("amazon", "260.00", "9.00") },
    });
    const c = row({
      code: "AA00003",
      goodsCost: "100.00",
      cells: { ...a.cells, amazon: cell("amazon", "150.00", "7.00") },
    });
    const s = summarize([a, b, c]);
    // markups: 10%, 30%, 50% -> 30%; profits 5, 9, 7 -> 7
    expect(s.platforms.amazon).toEqual({
      medianMarkupPct: "30.0",
      medianProfit: "7.00",
      solved: 3,
    });
  });

  it("averages the two middle values for an even count and skips unsolved cells", () => {
    const a = row({ code: "AA00001" });
    const b = row({ code: "AA00002", cells: { ...a.cells, ebay: cell("ebay", "140.00", "8.00") } });
    const c = row({ code: "AA00003", cells: { ...a.cells, ebay: null } });
    expect(summarize([a, b, c]).platforms.ebay).toEqual({
      medianMarkupPct: "30.0",
      medianProfit: "7.00",
      solved: 2,
    });
  });

  it("counts rows at or over A$1,000 and rows near it", () => {
    expect(summarize(rows)).toMatchObject({ aboveThreshold: 1, nearThreshold: 1 });
  });

  it("reports no medians when nothing is solved", () => {
    expect(summarize([]).platforms.shopify).toEqual({
      medianMarkupPct: null,
      medianProfit: null,
      solved: 0,
    });
  });
});

import { describe, expect, it } from "vitest";
import { buildCatalogueFromXlsx } from "../../../src/lib/catalogue-build";
import {
  LARGE_CHANGE_PCT_THRESHOLD,
  previewPricelist,
} from "../../../src/lib/admin/pricelist-preview";
import { makeWorkbook, quotationName, validRow, type Row } from "../../helpers/make-workbook";

async function currentCatalogue(rows: Row[], date = "20261013") {
  const buffer = await makeWorkbook(rows);
  return (await buildCatalogueFromXlsx(buffer, quotationName(date))).catalogue;
}

const baseRows = [validRow("AA00001", 100), validRow("AA00002", 200), validRow("AA00003", 300)];

describe("previewPricelist", () => {
  it("reports added, removed and repriced items against the current catalogue", async () => {
    const current = await currentCatalogue(baseRows);
    const upload = await makeWorkbook([
      validRow("AA00001", 100),
      validRow("AA00002", 210),
      validRow("AA00004", 400),
    ]);
    const result = await previewPricelist(upload, quotationName("20261110"), current);
    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(result.currentPriceListDate).toBe("2026-10-13");
    expect(result.newPriceListDate).toBe("2026-11-10");
    expect(result.diff.added.map((i) => i.code)).toEqual(["AA00004"]);
    expect(result.diff.removed.map((i) => i.code)).toEqual(["AA00003"]);
    expect(result.diff.repriced).toEqual([
      { code: "AA00002", oldUsd: 200, newUsd: 210, pctChange: 5 },
    ]);
    expect(result.largeChanges).toEqual([]);
    expect(result.checksum).toMatch(/^[0-9a-f]{16}$/);
  });

  it("rejects a price list that is not newer than the current one", async () => {
    const current = await currentCatalogue(baseRows);
    const upload = await makeWorkbook(baseRows);
    for (const date of ["20261013", "20260922"]) {
      const result = await previewPricelist(upload, quotationName(date), current);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.join(" ")).toMatch(/not newer/);
    }
  });

  it("accepts an older price list when explicitly overridden", async () => {
    const current = await currentCatalogue(baseRows);
    const upload = await makeWorkbook(baseRows);
    const result = await previewPricelist(upload, quotationName("20260922"), current, {
      allowOlder: true,
    });
    expect(result.ok).toBe(true);
  });

  it("flags repricings at or above the large-change threshold", async () => {
    const current = await currentCatalogue([validRow("AA00001", 100), validRow("AA00002", 100)]);
    const bumped = 100 + LARGE_CHANGE_PCT_THRESHOLD;
    const upload = await makeWorkbook([validRow("AA00001", bumped), validRow("AA00002", 101)]);
    const result = await previewPricelist(upload, quotationName("20261110"), current);
    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(result.largeChanges.map((r) => r.code)).toEqual(["AA00001"]);
  });

  it("surfaces build errors verbatim, including the unmapped-category fix instruction", async () => {
    const current = await currentCatalogue(baseRows);
    const upload = await makeWorkbook([["AA00001", "B", "Thing", "Drones", 100, 780]]);
    const result = await previewPricelist(upload, quotationName("20261110"), current);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join("\n")).toMatch(/Unmapped category "Drones"[\s\S]*CATEGORY_MAP/);
    }
  });

  it("returns a duplicate-code error rather than throwing", async () => {
    const current = await currentCatalogue(baseRows);
    const upload = await makeWorkbook([validRow("AA00001"), validRow("AA00001")]);
    const result = await previewPricelist(upload, quotationName("20261110"), current);
    expect(result.ok).toBe(false);
  });

  it("returns an error, not a throw, for bytes that are not a workbook", async () => {
    const current = await currentCatalogue(baseRows);
    const result = await previewPricelist(
      Buffer.from("PK\x03\x04 not really"),
      quotationName("20261110"),
      current,
    );
    expect(result.ok).toBe(false);
  });

  it("passes HKD/USD peg warnings through", async () => {
    const current = await currentCatalogue(baseRows);
    const upload = await makeWorkbook([["AA00001", "B", "Thing", "Tablet", 100, 900]]);
    const result = await previewPricelist(upload, quotationName("20261110"), current);
    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(result.warnings.join(" ")).toMatch(/AA00001.*peg band/);
  });
});

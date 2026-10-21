import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildCatalogueFromXlsx, serializeCatalogue } from "../../src/lib/catalogue-build";
import { Catalogue } from "../../src/lib/schemas";

const HEADERS = ["ProductCode", "Brand", "Product Name", "Category", "USD", "HKD"];
const FILE = "Uniqbe Reseller Quotation 20261013.xlsx";

type Row = [string, string, string, string, number, number];

const validRow = (code: string, usd = 100): Row => [
  code,
  "TestBrand",
  `Test Product ${code} 256GB`,
  "Tablet",
  usd,
  Math.round(usd * 7.8),
];

async function makeWorkbook(
  rows: Row[],
  options: { sheetName?: string; headers?: string[]; leadingRows?: number } = {},
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(options.sheetName ?? "Pricelist");
  for (let i = 0; i < (options.leadingRows ?? 0); i++) sheet.addRow([`banner ${i}`]);
  sheet.addRow(options.headers ?? HEADERS);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("buildCatalogueFromXlsx", () => {
  it("builds a schema-valid catalogue from a workbook buffer", async () => {
    const buffer = await makeWorkbook([validRow("AA00001"), validRow("AA00002", 250)]);
    const { catalogue, warnings } = await buildCatalogueFromXlsx(buffer, FILE);
    expect(() => Catalogue.parse(catalogue)).not.toThrow();
    expect(catalogue.items.map((i) => i.code)).toEqual(["AA00001", "AA00002"]);
    expect(catalogue.priceListDate).toBe("2026-10-13");
    expect(catalogue.sourceFile).toBe(FILE);
    expect(catalogue.productCount).toBe(catalogue.items.length);
    expect(warnings).toEqual([]);
  });

  it("serializes exactly as the CLI writes it, so the upload and the CLI commit identical bytes", async () => {
    const buffer = await makeWorkbook([validRow("AA00001")]);
    const { catalogue } = await buildCatalogueFromXlsx(buffer, FILE);
    expect(serializeCatalogue(catalogue)).toBe(JSON.stringify(catalogue, null, 1));
    expect(JSON.parse(serializeCatalogue(catalogue))).toEqual(catalogue);
  });

  it("finds the header row below leading banner rows", async () => {
    const buffer = await makeWorkbook([validRow("AA00001")], { leadingRows: 3 });
    const { catalogue } = await buildCatalogueFromXlsx(buffer, FILE);
    expect(catalogue.items).toHaveLength(1);
  });

  it("is deterministic: same workbook gives the same checksum", async () => {
    const buffer = await makeWorkbook([validRow("AA00001")]);
    const a = await buildCatalogueFromXlsx(buffer, FILE);
    const b = await buildCatalogueFromXlsx(buffer, FILE);
    expect(a.catalogue.checksum).toBe(b.catalogue.checksum);
  });

  it("rejects an unmapped category with the fix instruction", async () => {
    const row: Row = ["AA00001", "B", "Thing", "Drones", 100, 780];
    const buffer = await makeWorkbook([row]);
    await expect(buildCatalogueFromXlsx(buffer, FILE)).rejects.toThrow(
      /Unmapped category "Drones"/,
    );
    await expect(buildCatalogueFromXlsx(buffer, FILE)).rejects.toThrow(/CATEGORY_MAP/);
  });

  it("rejects a duplicate product code", async () => {
    const buffer = await makeWorkbook([validRow("AA00001"), validRow("AA00001")]);
    await expect(buildCatalogueFromXlsx(buffer, FILE)).rejects.toThrow(
      /Duplicate ProductCode "AA00001"/,
    );
  });

  it("rejects a workbook whose header row does not match", async () => {
    const buffer = await makeWorkbook([validRow("AA00001")], {
      headers: ["Code", "Brand", "Name", "Category", "USD", "HKD"],
    });
    await expect(buildCatalogueFromXlsx(buffer, FILE)).rejects.toThrow(/header row/);
  });

  it("rejects a workbook with no Pricelist sheet", async () => {
    const buffer = await makeWorkbook([validRow("AA00001")], { sheetName: "Other" });
    await expect(buildCatalogueFromXlsx(buffer, FILE)).rejects.toThrow(
      /Sheet "Pricelist" not found/,
    );
  });

  it.each(["__proto__", "constructor", "toString", "hasOwnProperty"])(
    "treats the inherited property name %j as an unmapped category",
    async (category) => {
      const buffer = await makeWorkbook([["AA00001", "B", "Thing", category, 100, 780]]);
      await expect(buildCatalogueFromXlsx(buffer, FILE)).rejects.toThrow(/Unmapped category/);
    },
  );

  it("clips an absurdly long echoed category so errors stay small", async () => {
    const buffer = await makeWorkbook([["AA00001", "B", "Thing", "x".repeat(5000), 100, 780]]);
    const error = await buildCatalogueFromXlsx(buffer, FILE).catch((e: unknown) => e);
    expect((error as Error).message.length).toBeLessThan(800);
  });

  it("errors when a blank row would silently cut the price list short", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Pricelist");
    sheet.addRow(HEADERS);
    sheet.addRow(validRow("AA00001"));
    sheet.addRow([]);
    sheet.addRow(validRow("AA00002"));
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    await expect(buildCatalogueFromXlsx(buffer, FILE)).rejects.toThrow(/blank row/i);
  });

  it("reads formula cells by their displayed text, not [object Object]", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Pricelist");
    sheet.addRow(HEADERS);
    sheet.addRow(["AA00001", "B", { formula: '"Thing"', result: "Thing" }, "Tablet", 100, 780]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const { catalogue } = await buildCatalogueFromXlsx(buffer, FILE);
    expect(catalogue.items[0]?.name).toBe("Thing");
  });

  it("rejects bytes that are not an xlsx", async () => {
    const buffer = Buffer.from("this is not a zip file");
    await expect(buildCatalogueFromXlsx(buffer, FILE)).rejects.toThrow();
  });

  it("rejects a filename without a date", async () => {
    const buffer = await makeWorkbook([validRow("AA00001")]);
    await expect(buildCatalogueFromXlsx(buffer, "pricelist.xlsx")).rejects.toThrow(/YYYYMMDD/);
  });

  it("returns a warning, not a throw, for an HKD/USD ratio outside the peg band", async () => {
    const off: Row = ["AA00001", "B", "Thing", "Tablet", 100, 900];
    const buffer = await makeWorkbook([off]);
    const { catalogue, warnings } = await buildCatalogueFromXlsx(buffer, FILE);
    expect(catalogue.items).toHaveLength(1);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/AA00001.*peg band/);
  });

  it("rejects a non-integer or non-positive USD price", async () => {
    const buffer = await makeWorkbook([["AA00001", "B", "Thing", "Tablet", 0, 0]]);
    await expect(buildCatalogueFromXlsx(buffer, FILE)).rejects.toThrow(
      /USD must be a positive integer/,
    );
  });
});

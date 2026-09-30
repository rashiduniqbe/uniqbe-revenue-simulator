import { describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import {
  CATEGORY_MAP,
  buildCatalogue,
  readWorkbook,
  type RawRow,
} from "../../scripts/build-catalogue";
import { diffCatalogues } from "../../scripts/catalogue-diff";

const NEW_CATEGORY_RAW = "Drones";
const REPRICE_DELTA_USD = 10;

async function writePriceList(path: string, rows: RawRow[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Pricelist");
  sheet.addRow(["ProductCode", "Brand", "Product Name", "Category", "USD", "HKD"]);
  for (const r of rows) sheet.addRow([r.productCode, r.brand, r.name, r.categoryRaw, r.usd, r.hkd]);
  await wb.xlsx.writeFile(path);
}

function latestPriceList(): string {
  const newest = readdirSync("pricelists")
    .filter((f) => f.endsWith(".xlsx"))
    .sort()
    .at(-1);
  if (!newest) throw new Error("no price list in ./pricelists");
  return join("pricelists", newest);
}

describe("adaptability drill (T-35)", () => {
  it("fails on a new category with the R5 message, then diffs exactly the seeded changes", async () => {
    const { rows, sourceFile } = await readWorkbook(latestPriceList());
    const baseline = buildCatalogue(rows, sourceFile);

    // Seed: 2 removed, 5 repriced, 3 added (one in a brand-new category).
    const removed = rows.slice(0, 2).map((r) => r.productCode);
    const repriced = rows.slice(2, 7).map((r) => r.productCode);
    const template = rows[7];
    if (!template) throw new Error("price list too small for the drill");
    const added: RawRow[] = [
      { ...template, productCode: "DR00001", name: "Drill Product One" },
      { ...template, productCode: "DR00002", name: "Drill Product Two" },
      { ...template, productCode: "DR00003", name: "Drill Drone", categoryRaw: NEW_CATEGORY_RAW },
    ];
    const mutatedRows: RawRow[] = [
      ...rows
        .filter((r) => !removed.includes(r.productCode))
        .map((r) =>
          repriced.includes(r.productCode) ? { ...r, usd: r.usd + REPRICE_DELTA_USD } : r,
        ),
      ...added,
    ];

    const dir = mkdtempSync(join(tmpdir(), "drill-"));
    const mutatedPath = join(dir, "Uniqbe Reseller Quotation 20991231.xlsx");
    await writePriceList(mutatedPath, mutatedRows);
    const reread = await readWorkbook(mutatedPath);

    // 1. The build refuses the unmapped category with the R5 fix instruction.
    expect(() => buildCatalogue(reread.rows, reread.sourceFile)).toThrow(
      /Unmapped category "Drones"[\s\S]*Add to CATEGORY_MAP/,
    );

    // 2. After mapping it, the diff reports exactly the seeded changes.
    const mapped = { ...CATEGORY_MAP, drones: { slug: "camera" as const, label: "Camera" } };
    const next = buildCatalogue(reread.rows, reread.sourceFile, mapped);
    const diff = diffCatalogues(baseline.items, next.items);

    expect(diff.added.map((i) => i.code).sort()).toEqual(["DR00001", "DR00002", "DR00003"]);
    expect(diff.removed.map((i) => i.code).sort()).toEqual([...removed].sort());
    expect(diff.repriced.map((r) => r.code).sort()).toEqual([...repriced].sort());
    for (const r of diff.repriced) expect(r.newUsd - r.oldUsd).toBe(REPRICE_DELTA_USD);
  }, 60_000);
});

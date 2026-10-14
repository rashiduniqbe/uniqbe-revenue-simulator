import ExcelJS from "exceljs";
import type { RawRow } from "./core";

const SHEET_NAME = "Pricelist";
const HEADER_SCAN_ROWS = 20;
const EXPECTED_HEADERS = ["productcode", "brand", "product name", "category", "usd", "hkd"];

// .text is the displayed string, so formula and rich-text cells read as their result
// instead of "[object Object]".
const cellText = (row: ExcelJS.Row, col: number): string => row.getCell(col).text.trim();

function findHeaderRow(sheet: ExcelJS.Worksheet): number {
  for (let r = 1; r <= HEADER_SCAN_ROWS; r++) {
    const row = sheet.getRow(r);
    const values = EXPECTED_HEADERS.map((_, i) => cellText(row, i + 1).toLowerCase());
    if (JSON.stringify(values) === JSON.stringify(EXPECTED_HEADERS)) return r;
  }
  return -1;
}

// Reading stops at the first blank ProductCode. A stray blank row in the middle of the sheet
// would silently drop every product below it, so refuse rather than publish a truncated list.
function assertNothingAfterBlankRow(sheet: ExcelJS.Worksheet, blankRow: number): void {
  for (let r = blankRow + 1; r <= sheet.rowCount; r++) {
    if (cellText(sheet.getRow(r), 1) !== "") {
      throw new Error(
        `Row ${blankRow} is a blank row but row ${r} still has data. ` +
          `Remove the blank row so the price list is not cut short.`,
      );
    }
  }
}

export function readRows(sheet: ExcelJS.Worksheet, label: string): RawRow[] {
  const headerRow = findHeaderRow(sheet);
  if (headerRow === -1) {
    throw new Error(
      `Could not find a header row matching [${EXPECTED_HEADERS.join(", ")}] in the first ${HEADER_SCAN_ROWS} rows of "${label}".`,
    );
  }
  const rows: RawRow[] = [];
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const productCode = cellText(row, 1);
    if (productCode === "") {
      assertNothingAfterBlankRow(sheet, r);
      break;
    }
    rows.push({
      productCode,
      brand: cellText(row, 2),
      name: cellText(row, 3),
      categoryRaw: cellText(row, 4),
      usd: Number(row.getCell(5).value),
      hkd: Number(row.getCell(6).value),
    });
  }
  return rows;
}

function pricelistSheet(workbook: ExcelJS.Workbook, label: string): ExcelJS.Worksheet {
  const sheet = workbook.getWorksheet(SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" not found in ${label}.`);
  return sheet;
}

export async function readWorkbookBuffer(buffer: Buffer, label: string): Promise<RawRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return readRows(pricelistSheet(workbook, label), label);
}

export async function readWorkbookFile(path: string): Promise<RawRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  return readRows(pricelistSheet(workbook, path), path);
}

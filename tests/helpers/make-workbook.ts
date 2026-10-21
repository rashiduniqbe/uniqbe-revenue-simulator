import ExcelJS from "exceljs";

export const HEADERS = ["ProductCode", "Brand", "Product Name", "Category", "USD", "HKD"];

export type Row = [string, string, string, string, number, number];

export const validRow = (code: string, usd = 100): Row => [
  code,
  "TestBrand",
  `Test Product ${code} 256GB`,
  "Tablet",
  usd,
  Math.round(usd * 7.8),
];

export function quotationName(yyyymmdd: string): string {
  return `Uniqbe Reseller Quotation ${yyyymmdd}.xlsx`;
}

export async function makeWorkbook(rows: Row[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Pricelist");
  sheet.addRow(HEADERS);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// scripts/build-catalogue.ts
import { createHash } from "node:crypto";
import { readdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { Catalogue, type CategorySlugType, type CatalogueItemType } from "../src/lib/schemas";

export type RawRow = {
  productCode: string;
  brand: string;
  name: string;
  categoryRaw: string;
  usd: number;
  hkd: number;
};

const CATEGORY_MAP: Record<string, { slug: CategorySlugType; label: string }> = {
  "mobile phone": { slug: "mobile-phone", label: "Mobile Phone" },
  earphones: { slug: "audio", label: "Audio" },
  "smart wearables": { slug: "wearable", label: "Smart Wearables" },
  tablet: { slug: "tablet", label: "Tablet" },
  "gaming and consoles": { slug: "gaming", label: "Gaming & Consoles" },
  camera: { slug: "camera", label: "Camera" },
  "smart speaker": { slug: "smart-home", label: "Smart Home" },
  "smart living": { slug: "smart-home", label: "Smart Home" },
  keyboard: { slug: "computer-accessory", label: "Computer Accessories" },
  smarttag: { slug: "computer-accessory", label: "Computer Accessories" },
  accessories: { slug: "computer-accessory", label: "Computer Accessories" },
  "vacuumn cleaners": { slug: "home-appliance", label: "Home Appliances" },
};

export function mapCategory(raw: string): { slug: CategorySlugType; label: string } {
  const key = raw.trim().toLowerCase();
  const mapped = CATEGORY_MAP[key];
  if (!mapped) {
    throw new Error(
      `Unmapped category "${raw}".\n` +
        `  Add to CATEGORY_MAP in scripts/build-catalogue.ts:\n` +
        `      "${key}": { slug: "?", label: "?" },\n` +
        `  Then add duty % and referral fee % for the new slug to BOTH markets\n` +
        `  in src/data/market-rules.json, or the fee lookup will throw at runtime.`,
    );
  }
  return mapped;
}

export function deriveStorageGb(name: string): number | null {
  const match = name.match(/(\d+)\s*(TB|GB)/i);
  if (!match?.[1] || !match[2]) return null;
  const value = Number(match[1]);
  return match[2].toUpperCase() === "TB" ? value * 1024 : value;
}

export function buildSearchHaystack(brand: string, name: string, categoryLabel: string): string {
  return `${brand} ${name} ${categoryLabel}`.toLowerCase();
}

export function computeChecksum(items: CatalogueItemType[]): string {
  return createHash("sha256").update(JSON.stringify(items)).digest("hex").slice(0, 16);
}

export function parsePriceListDate(sourceFile: string): string {
  const match = sourceFile.match(/(\d{4})(\d{2})(\d{2})/);
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new Error(`Could not parse a YYYYMMDD date out of source filename "${sourceFile}".`);
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function normalizeRow(raw: RawRow): CatalogueItemType {
  if (!Number.isInteger(raw.usd) || raw.usd <= 0) {
    throw new Error(`Row ${raw.productCode}: USD must be a positive integer, got ${raw.usd}`);
  }
  const ratio = raw.hkd / raw.usd;
  if (ratio < 7.7 || ratio > 7.9) {
    console.warn(
      `WARN: ${raw.productCode} has HKD/USD ratio ${ratio.toFixed(3)}, outside the expected 7.70-7.90 peg band.`,
    );
  }
  const { slug, label } = mapCategory(raw.categoryRaw);
  return {
    code: raw.productCode,
    brand: raw.brand,
    name: raw.name,
    categoryRaw: raw.categoryRaw,
    category: slug,
    categoryLabel: label,
    usd: raw.usd,
    hkdRef: raw.hkd,
    storageGb: deriveStorageGb(raw.name),
    search: buildSearchHaystack(raw.brand, raw.name, label),
  };
}

export function buildCatalogue(rows: RawRow[], sourceFile: string) {
  const codes = new Set<string>();
  const items = rows.map((raw) => {
    if (codes.has(raw.productCode)) {
      throw new Error(`Duplicate ProductCode "${raw.productCode}" found in ${sourceFile}.`);
    }
    codes.add(raw.productCode);
    return normalizeRow(raw);
  });
  return Catalogue.parse({
    schemaVersion: 1,
    sourceFile,
    sourceSheet: "Pricelist",
    priceListDate: parsePriceListDate(sourceFile),
    generatedAt: new Date().toISOString().slice(0, 10),
    baseCurrency: "USD",
    referenceCurrency: "HKD",
    productCount: items.length,
    checksum: computeChecksum(items),
    items,
  });
}

const EXPECTED_HEADERS = ["productcode", "brand", "product name", "category", "usd", "hkd"];

async function readWorkbook(path: string): Promise<{ rows: RawRow[]; sourceFile: string }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const sheet = workbook.getWorksheet("Pricelist");
  if (!sheet) throw new Error(`Sheet "Pricelist" not found in ${path}.`);

  let headerRow = -1;
  for (let r = 1; r <= 20; r++) {
    const row = sheet.getRow(r);
    const values = EXPECTED_HEADERS.map((_, i) =>
      String(row.getCell(i + 1).value ?? "")
        .trim()
        .toLowerCase(),
    );
    if (JSON.stringify(values) === JSON.stringify(EXPECTED_HEADERS)) {
      headerRow = r;
      break;
    }
  }
  if (headerRow === -1) {
    throw new Error(
      `Could not find a header row matching [${EXPECTED_HEADERS.join(", ")}] in the first 20 rows of "${path}".`,
    );
  }

  const rows: RawRow[] = [];
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const productCode = String(row.getCell(1).value ?? "").trim();
    if (productCode === "") break;
    rows.push({
      productCode,
      brand: String(row.getCell(2).value ?? "").trim(),
      name: String(row.getCell(3).value ?? "").trim(),
      categoryRaw: String(row.getCell(4).value ?? "").trim(),
      usd: Number(row.getCell(5).value),
      hkd: Number(row.getCell(6).value),
    });
  }
  return { rows, sourceFile: path.split(/[/\\]/).pop() ?? path };
}

function resolveInputPath(): string {
  const argPath = process.argv.find((a) => a.endsWith(".xlsx"));
  if (argPath) return argPath;
  const dir = "pricelists";
  const candidates = readdirSync(dir).filter((f) => f.endsWith(".xlsx"));
  if (candidates.length === 0) throw new Error(`No .xlsx files found in ./${dir}/`);
  const newest = candidates.sort().at(-1);
  if (!newest) throw new Error(`No .xlsx files found in ./${dir}/`);
  return join(dir, newest);
}

async function main() {
  const verify = process.argv.includes("--verify");
  const inputPath = resolveInputPath();
  const { rows, sourceFile } = await readWorkbook(inputPath);
  const catalogue = buildCatalogue(rows, sourceFile);
  const outputPath = "src/data/catalogue.json";

  if (verify) {
    if (!existsSync(outputPath)) {
      console.error(`✗ ${outputPath} does not exist.`);
      process.exit(1);
    }
    const committed = JSON.parse(readFileSync(outputPath, "utf-8"));
    if (committed.checksum !== catalogue.checksum) {
      console.error(
        `✗ Checksum mismatch: committed ${committed.checksum}, freshly built ${catalogue.checksum}.\n` +
          `  Run "pnpm catalogue:build" and commit the result.`,
      );
      process.exit(1);
    }
    console.log(`✓ ${outputPath} matches ${inputPath} (checksum ${catalogue.checksum}).`);
    return;
  }

  writeFileSync(outputPath, JSON.stringify(catalogue, null, 1));
  console.log(
    `Wrote ${catalogue.items.length} products to ${outputPath} (checksum ${catalogue.checksum}).`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

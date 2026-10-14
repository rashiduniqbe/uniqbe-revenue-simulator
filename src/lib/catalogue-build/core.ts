import { createHash } from "node:crypto";
import { Catalogue, type CatalogueItemType, type CategorySlugType } from "../schemas";

export type RawRow = {
  productCode: string;
  brand: string;
  name: string;
  categoryRaw: string;
  usd: number;
  hkd: number;
};

export type CategoryMap = Record<string, { slug: CategorySlugType; label: string }>;

const MAX_ECHOED_CHARS = 80;

/** Spreadsheet text echoed into an error must not be able to make that error huge. */
export function clip(value: string, max: number = MAX_ECHOED_CHARS): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

const PEG_BAND_MIN = 7.7;
const PEG_BAND_MAX = 7.9;

export const CATEGORY_MAP: CategoryMap = {
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

export function mapCategory(
  raw: string,
  categoryMap: CategoryMap = CATEGORY_MAP,
): { slug: CategorySlugType; label: string } {
  const key = raw.trim().toLowerCase();
  // hasOwn, not a plain lookup: "__proto__" or "constructor" must not resolve to inherited members.
  const mapped = Object.hasOwn(categoryMap, key) ? categoryMap[key] : undefined;
  if (!mapped) {
    throw new Error(
      `Unmapped category "${clip(raw)}".\n` +
        `  Add to CATEGORY_MAP in src/lib/catalogue-build/core.ts:\n` +
        `      "${clip(key)}": { slug: "?", label: "?" },\n` +
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

function normalizeRow(
  raw: RawRow,
  categoryMap: CategoryMap,
  warnings: string[],
): CatalogueItemType {
  if (!Number.isInteger(raw.usd) || raw.usd <= 0) {
    throw new Error(
      `Row ${clip(raw.productCode)}: USD must be a positive integer, got ${clip(String(raw.usd))}`,
    );
  }
  const ratio = raw.hkd / raw.usd;
  if (ratio < PEG_BAND_MIN || ratio > PEG_BAND_MAX) {
    warnings.push(
      `${raw.productCode} has HKD/USD ratio ${ratio.toFixed(3)}, outside the expected ${PEG_BAND_MIN.toFixed(2)}-${PEG_BAND_MAX.toFixed(2)} peg band.`,
    );
  }
  const { slug, label } = mapCategory(raw.categoryRaw, categoryMap);
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

export type BuildResult = {
  catalogue: ReturnType<typeof Catalogue.parse>;
  warnings: string[];
};

export function buildCatalogue(
  rows: RawRow[],
  sourceFile: string,
  categoryMap: CategoryMap = CATEGORY_MAP,
): BuildResult {
  const warnings: string[] = [];
  const codes = new Set<string>();
  const items = rows.map((raw) => {
    if (codes.has(raw.productCode)) {
      throw new Error(
        `Duplicate ProductCode "${clip(raw.productCode)}" found in ${clip(sourceFile)}.`,
      );
    }
    codes.add(raw.productCode);
    return normalizeRow(raw, categoryMap, warnings);
  });
  const catalogue = Catalogue.parse({
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
  return { catalogue, warnings };
}

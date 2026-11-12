import { z } from "zod";
import { StorepriceRow, type LiveItemType } from "../schemas";
import { buildSearchHaystack, deriveStorageGb, mapCategory } from "../catalogue-build/core";

export type StorepriceFailure =
  "no-product-array" | "invalid-json" | "invalid-rows" | "no-usable-items";

export type SkippedRow = { code: string; reason: string };

export type StorepriceParseResult =
  | { ok: true; items: LiveItemType[]; skipped: SkippedRow[] }
  | { ok: false; reason: StorepriceFailure };

// storeprice.uniqbe.com is a static page that inlines its product list as a
// single-line `const P = [...];` statement. `.` stops at a newline, so the
// greedy match runs to the last `];` on that one line.
const PRODUCT_ARRAY = /const P = (\[.*\]);/;

function toLiveItem(row: z.infer<typeof StorepriceRow>): LiveItemType | SkippedRow {
  let mapped: ReturnType<typeof mapCategory>;
  try {
    mapped = mapCategory(row.cat);
  } catch {
    // No duty / referral-fee mapping exists for this category, and inventing
    // one would be inventing a tax rule — leave the product out instead.
    return { code: row.sku, reason: `no duty mapping for "${row.cat}"` };
  }
  return {
    code: row.sku,
    name: row.name,
    categoryRaw: row.cat,
    category: mapped.slug,
    categoryLabel: mapped.label,
    usd: row.dsNum,
    storageGb: deriveStorageGb(row.name),
    search: buildSearchHaystack("", row.name, mapped.label).trim(),
  };
}

export function parseStorepriceHtml(html: string): StorepriceParseResult {
  const match = PRODUCT_ARRAY.exec(html);
  if (!match?.[1]) return { ok: false, reason: "no-product-array" };

  let raw: unknown;
  try {
    raw = JSON.parse(match[1]);
  } catch {
    return { ok: false, reason: "invalid-json" };
  }

  const rows = z.array(z.unknown()).safeParse(raw);
  if (!rows.success) return { ok: false, reason: "invalid-rows" };

  // Validate row by row: one odd product (withdrawn from dropship, bad SKU)
  // must not take every other product down with it.
  const items: LiveItemType[] = [];
  const skipped: SkippedRow[] = [];
  let validRows = 0;
  for (const candidate of rows.data) {
    const row = StorepriceRow.safeParse(candidate);
    if (!row.success) {
      skipped.push({ code: skuOf(candidate), reason: "invalid row" });
      continue;
    }
    validRows += 1;
    const result = toLiveItem(row.data);
    if ("reason" in result) skipped.push(result);
    else items.push(result);
  }
  if (validRows === 0) return { ok: false, reason: "invalid-rows" };
  if (items.length === 0) return { ok: false, reason: "no-usable-items" };
  return { ok: true, items, skipped };
}

function skuOf(candidate: unknown): string {
  const sku = (candidate as { sku?: unknown } | null)?.sku;
  return typeof sku === "string" ? sku.slice(0, 20) : "unknown";
}

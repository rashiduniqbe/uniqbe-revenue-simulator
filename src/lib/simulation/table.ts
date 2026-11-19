import Decimal from "decimal.js";
import { filterProducts } from "../search";
import { SIM_PLATFORMS, type SimCell, type SimPlatform, type SimRow } from "./simulate";
import type { GstFilter, SimSort } from "./view-state";

export const PAGE_SIZE = 25;

export type RowFilters = { query: string; category: string; gst: GstFilter };

/** Search (name or SKU, every word must match), category and A$1,000-line filters. */
export function filterRows(rows: readonly SimRow[], filters: RowFilters): SimRow[] {
  const inCategory =
    filters.category === "all" ? rows : rows.filter((r) => r.category === filters.category);
  const onGstSide =
    filters.gst === "all"
      ? inCategory
      : inCategory.filter((r) => r.auAboveThreshold === (filters.gst === "above"));
  return filterProducts(onGstSide, filters.query);
}

// The most a seller keeps on any platform: what "most profit" sorts by.
function bestProfit(row: SimRow): Decimal | null {
  const profits = SIM_PLATFORMS.flatMap((p) => {
    const cell = row.cells[p];
    return cell ? [new Decimal(cell.netProfit)] : [];
  });
  return profits.length === 0 ? null : Decimal.max(...profits);
}

const COMPARE: Record<SimSort, (a: SimRow, b: SimRow) => number> = {
  "cost-desc": (a, b) => b.usd - a.usd,
  "cost-asc": (a, b) => a.usd - b.usd,
  name: (a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  "profit-desc": (a, b) => {
    const pa = bestProfit(a);
    const pb = bestProfit(b);
    if (pa === null || pb === null) return pa === pb ? 0 : pa === null ? 1 : -1;
    return pb.comparedTo(pa);
  },
};

/** A sorted copy; ties keep their catalogue order. */
export function sortRows(rows: readonly SimRow[], sort: SimSort): SimRow[] {
  return [...rows].sort(COMPARE[sort]);
}

export type Page = { rows: SimRow[]; page: number; pageCount: number };

export function paginate(rows: readonly SimRow[], page: number): Page {
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, Math.trunc(page)), pageCount);
  const start = (current - 1) * PAGE_SIZE;
  return { rows: rows.slice(start, start + PAGE_SIZE), page: current, pageCount };
}

export type CategoryOption = { slug: string; label: string; count: number };

/** The categories present in the rows, with counts, sorted by label. */
export function categoryOptions(rows: readonly SimRow[]): CategoryOption[] {
  const bySlug = new Map<string, CategoryOption>();
  for (const r of rows) {
    const seen = bySlug.get(r.category);
    bySlug.set(r.category, {
      slug: r.category,
      label: r.categoryLabel,
      count: (seen?.count ?? 0) + 1,
    });
  }
  return [...bySlug.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export type PlatformSummary = {
  medianMarkupPct: string | null;
  medianProfit: string | null;
  solved: number;
};

export type SimSummary = {
  platforms: Record<SimPlatform, PlatformSummary>;
  aboveThreshold: number;
  nearThreshold: number;
};

function median(values: Decimal[]): Decimal | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a.comparedTo(b));
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] as Decimal;
  return sorted.length % 2 === 1 ? upper : (sorted[mid - 1] as Decimal).plus(upper).div(2);
}

function summarizePlatform(rows: readonly SimRow[], platform: SimPlatform): PlatformSummary {
  const solved = rows.flatMap((r) => {
    const cell: SimCell | null = r.cells[platform];
    return cell ? [{ cell, goods: new Decimal(r.goodsCost) }] : [];
  });
  const markups = solved
    .filter(({ goods }) => goods.gt(0))
    .map(({ cell, goods }) => new Decimal(cell.price).div(goods).minus(1).times(100));
  const markup = median(markups);
  const profit = median(solved.map(({ cell }) => new Decimal(cell.netProfit)));
  return {
    medianMarkupPct: markup === null ? null : markup.toFixed(1, Decimal.ROUND_HALF_UP),
    medianProfit: profit === null ? null : profit.toFixed(2, Decimal.ROUND_HALF_UP),
    solved: solved.length,
  };
}

/** Medians per platform over the given rows, plus the A$1,000-line counts. */
export function summarize(rows: readonly SimRow[]): SimSummary {
  const platforms = Object.fromEntries(
    SIM_PLATFORMS.map((p) => [p, summarizePlatform(rows, p)]),
  ) as Record<SimPlatform, PlatformSummary>;
  return {
    platforms,
    aboveThreshold: rows.filter((r) => r.auAboveThreshold).length,
    nearThreshold: rows.filter((r) => r.nearThreshold).length,
  };
}

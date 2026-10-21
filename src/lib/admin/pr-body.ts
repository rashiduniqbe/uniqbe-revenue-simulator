import type { CatalogueDiff } from "../catalogue-build";

type PrDetailsInput = {
  diff: CatalogueDiff;
  warnings: string[];
  largeChanges: CatalogueDiff["repriced"];
};

// Spreadsheet text goes into a PR body. Collapsing newlines and backticks keeps it on one line
// inside one code fence, so it cannot close the fence, start markdown or ping anyone.
const clean = (value: string): string => value.replace(/[\r\n]+/g, " ").replace(/`/g, "'");

const formatRepriced = (r: CatalogueDiff["repriced"][number]): string =>
  `${clean(r.code)} $${r.oldUsd} -> $${r.newUsd} (${r.pctChange >= 0 ? "+" : ""}${r.pctChange}%)`;

export function summarizeDiff(diff: CatalogueDiff): string {
  return `${diff.added.length} added, ${diff.removed.length} removed, ${diff.repriced.length} repriced`;
}

export function formatPrDetails({ diff, warnings, largeChanges }: PrDetailsInput): string {
  const lines: string[] = [];
  if (warnings.length > 0) {
    lines.push(`Warnings (${warnings.length}):`, ...warnings.map((w) => `  ! ${clean(w)}`), "");
  }
  if (largeChanges.length > 0) {
    lines.push(
      `Large changes (${largeChanges.length}):`,
      ...largeChanges.map((r) => `  ! ${formatRepriced(r)}`),
      "",
    );
  }
  for (const i of diff.added)
    lines.push(`+ ${clean(`${i.code} ${i.brand} ${i.name}`)} ($${i.usd})`);
  for (const i of diff.removed) lines.push(`- ${clean(`${i.code} ${i.brand} ${i.name}`)}`);
  for (const r of diff.repriced) lines.push(`~ ${formatRepriced(r)}`);
  return ["```text", ...lines, "```"].join("\n");
}

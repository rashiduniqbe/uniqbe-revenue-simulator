import { readFileSync } from "node:fs";
import type { CatalogueItemType } from "../src/lib/schemas";

export type CatalogueDiff = {
  added: CatalogueItemType[];
  removed: CatalogueItemType[];
  repriced: { code: string; oldUsd: number; newUsd: number; pctChange: number }[];
};

export function diffCatalogues(
  oldItems: CatalogueItemType[],
  newItems: CatalogueItemType[],
): CatalogueDiff {
  const oldByCode = new Map(oldItems.map((i) => [i.code, i]));
  const newByCode = new Map(newItems.map((i) => [i.code, i]));

  const added = newItems.filter((i) => !oldByCode.has(i.code));
  const removed = oldItems.filter((i) => !newByCode.has(i.code));
  const repriced = newItems
    .filter((i) => {
      const before = oldByCode.get(i.code);
      return before !== undefined && before.usd !== i.usd;
    })
    .map((i) => {
      const before = oldByCode.get(i.code);
      if (!before) throw new Error(`Unreachable: ${i.code} was filtered as present.`);
      return {
        code: i.code,
        oldUsd: before.usd,
        newUsd: i.usd,
        pctChange: Math.round(((i.usd - before.usd) / before.usd) * 1000) / 10,
      };
    });

  return { added, removed, repriced };
}

function main() {
  const [, , oldPath, newPath] = process.argv;
  if (!oldPath || !newPath) {
    console.error("Usage: pnpm catalogue:diff <old.json> <new.json>");
    process.exit(1);
  }
  const oldCatalogue = JSON.parse(readFileSync(oldPath, "utf-8"));
  const newCatalogue = JSON.parse(readFileSync(newPath, "utf-8"));
  const diff = diffCatalogues(oldCatalogue.items, newCatalogue.items);

  console.log(
    `${diff.added.length} added, ${diff.removed.length} removed, ${diff.repriced.length} repriced`,
  );
  for (const i of diff.added) console.log(`  + ${i.code} ${i.brand} ${i.name} ($${i.usd})`);
  for (const i of diff.removed) console.log(`  - ${i.code} ${i.brand} ${i.name}`);
  for (const r of diff.repriced) {
    const sign = r.pctChange >= 0 ? "+" : "";
    console.log(`  ~ ${r.code} $${r.oldUsd} -> $${r.newUsd} (${sign}${r.pctChange}%)`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

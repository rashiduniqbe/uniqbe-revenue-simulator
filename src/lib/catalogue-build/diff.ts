import type { CatalogueItemType } from "../schemas";

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

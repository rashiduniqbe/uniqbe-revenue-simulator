import Fuse from "fuse.js";
import type { CatalogueItemType } from "./schemas";

const FUSE_OPTIONS = {
  keys: ["search"],
  threshold: 0.4,
  ignoreLocation: true,
};

export function filterProducts(
  items: CatalogueItemType[],
  query: string,
): CatalogueItemType[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return items;
  }
  const fuse = new Fuse(items, FUSE_OPTIONS);
  return fuse.search(trimmed).map((result) => result.item);
}

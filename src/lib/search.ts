import Fuse from "fuse.js";

const FUSE_OPTIONS = {
  keys: ["search"],
  threshold: 0.4,
  ignoreLocation: true,
};

export function filterProducts<T extends { search: string }>(items: T[], query: string): T[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return items;
  }
  const fuse = new Fuse(items, FUSE_OPTIONS);
  return fuse.search(trimmed).map((result) => result.item);
}

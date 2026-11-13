export interface Searchable {
  code: string;
  search: string;
}

// Strict, predictable matching: every word typed must appear somewhere in the
// product's SKU or search text. No fuzzy matching — a near-miss query used to
// pull in unrelated products (e.g. "galaxy s25" matched Galaxy A37s).
export function filterProducts<T extends Searchable>(items: readonly T[], query: string): T[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return [...items];
  }

  const matches = items.filter((item) => {
    const haystack = `${item.code} ${item.search}`.toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });

  // An exact SKU hit goes first; everything else keeps catalogue order.
  const isExactCode = (item: T) => tokens.includes(item.code.toLowerCase());
  return [...matches.filter(isExactCode), ...matches.filter((item) => !isExactCode(item))];
}

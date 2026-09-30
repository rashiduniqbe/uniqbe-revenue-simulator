"use client";

import { useMemo, useState } from "react";
import type { CatalogueItemType } from "../../lib/schemas";
import { filterProducts } from "../../lib/search";

interface ProductPickerProps {
  items: CatalogueItemType[];
  selectedCode: string;
  onSelect: (code: string) => void;
}

export function ProductPicker({ items, selectedCode, onSelect }: ProductPickerProps) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => filterProducts(items, query), [items, query]);
  const selected = items.find((item) => item.code === selectedCode) ?? null;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="product-search" className="text-sm font-medium">
        Product
      </label>
      <input
        id="product-search"
        type="text"
        className="rounded border border-neutral-300 px-3 py-2 text-sm"
        placeholder={selected ? selected.name : "Search all products…"}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {query.trim() !== "" && (
        <ul className="max-h-64 overflow-y-auto rounded border border-neutral-200 bg-white">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-neutral-500">
              No products match &ldquo;{query}&rdquo;.
            </li>
          ) : (
            results.map((item) => (
              <li key={item.code}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100"
                  onClick={() => {
                    onSelect(item.code);
                    setQuery("");
                  }}
                >
                  {item.brand} {item.name}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";
import type { CatalogueItemType } from "../../lib/schemas";
import { filterProducts } from "../../lib/search";
import { useAdoptTypedValues } from "./useAdoptTypedValues";
import { TEXT_INPUT_CLASS } from "./control-classes";

interface ProductPickerProps {
  items: CatalogueItemType[];
  selectedCode: string;
  onSelect: (code: string) => void;
}

export function ProductPicker({ items, selectedCode, onSelect }: ProductPickerProps) {
  const [query, setQuery] = useState("");
  const queryRef = useRef<HTMLInputElement>(null);
  useAdoptTypedValues({ query: queryRef }, { query }, (typed) => {
    if (typed.query !== undefined) setQuery(typed.query);
  });
  const results = useMemo(() => filterProducts(items, query), [items, query]);
  const selected = items.find((item) => item.code === selectedCode) ?? null;
  const statusText =
    query.trim() === ""
      ? ""
      : results.length === 0
        ? "No products match."
        : results.length === 1
          ? "1 product matches."
          : `${results.length} products match.`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="product-search" className="text-sm font-medium">
        Product
      </label>
      <input
        id="product-search"
        ref={queryRef}
        type="text"
        className={TEXT_INPUT_CLASS}
        placeholder={selected ? selected.name : "Search all products…"}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <p data-testid="product-search-status" aria-live="polite" className="sr-only">
        {statusText}
      </p>
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
                  className="min-h-11 w-full px-3 py-2 text-left text-sm hover:bg-neutral-100"
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

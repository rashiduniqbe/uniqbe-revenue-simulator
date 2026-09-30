"use client";

import type { Market } from "../../engine/types";

interface MarketTabsProps {
  market: Market;
  onChange: (market: Market) => void;
}

const MARKET_TABS: { value: Market; label: string }[] = [
  { value: "UK", label: "🇬🇧 UK" },
  { value: "AU", label: "🇦🇺 Australia" },
];

export function MarketTabs({ market, onChange }: MarketTabsProps) {
  return (
    <div className="flex gap-2" role="tablist" aria-label="Market">
      {MARKET_TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={market === tab.value}
          className={
            market === tab.value
              ? "rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1 text-sm text-white"
              : "rounded-full border border-neutral-300 px-3 py-1 text-sm text-neutral-700 hover:bg-neutral-100"
          }
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

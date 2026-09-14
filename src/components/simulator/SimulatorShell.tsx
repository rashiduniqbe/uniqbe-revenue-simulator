"use client";

import type { CatalogueType, MarketRulesType, FxSnapshotType } from "../../lib/schemas";
import { FxBadge } from "./FxBadge";
import { DisclaimerBar } from "./DisclaimerBar";

interface SimulatorShellProps {
  catalogue: CatalogueType;
  rules: MarketRulesType;
  fx: FxSnapshotType;
}

export function SimulatorShell({ catalogue, rules, fx }: SimulatorShellProps) {
  const market = "UK" as const;
  const currency = market === "UK" ? "GBP" : "AUD";
  const rate = market === "UK" ? fx.rates.GBP : fx.rates.AUD;

  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAF9]">
      <header className="border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Uniqbe Price Simulator</h1>
          <span className="rounded-full border border-neutral-300 px-3 py-1 text-sm">UK</span>
        </div>
        <FxBadge rate={rate} currency={currency} asOf={fx.asOf} />
      </header>

      <main className="flex-1 px-4 py-6">
        <p className="text-neutral-600">
          Select a product to start ({catalogue.items.length} products loaded, {rules.UK.marketLabel}).
        </p>
      </main>

      <DisclaimerBar />
    </div>
  );
}

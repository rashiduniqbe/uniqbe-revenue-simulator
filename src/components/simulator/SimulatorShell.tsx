"use client";

import { useState } from "react";
import type { CatalogueType, MarketRulesType, FxSnapshotType } from "../../lib/schemas";
import { FxBadge } from "./FxBadge";
import { DisclaimerBar } from "./DisclaimerBar";
import { ProductPicker } from "./ProductPicker";

interface SimulatorShellProps {
  catalogue: CatalogueType;
  rules: MarketRulesType;
  fx: FxSnapshotType;
}

export function SimulatorShell({ catalogue, fx }: SimulatorShellProps) {
  const market = "UK" as const;
  const currency = market === "UK" ? "GBP" : "AUD";
  const rate = market === "UK" ? fx.rates.GBP : fx.rates.AUD;
  const [productCode, setProductCode] = useState("");
  const selectedItem = catalogue.items.find((item) => item.code === productCode) ?? null;

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
        <ProductPicker items={catalogue.items} selectedCode={productCode} onSelect={setProductCode} />
        {selectedItem && (
          <p className="mt-4 text-sm text-neutral-600">
            Selected: {selectedItem.brand} {selectedItem.name} — cost ${selectedItem.usd} USD
          </p>
        )}
      </main>

      <DisclaimerBar />
    </div>
  );
}

"use client";

import { useState } from "react";
import type { CatalogueType, MarketRulesType, FxSnapshotType } from "../../lib/schemas";
import { useScenario } from "../../lib/url-state";
import { isValidDecimalString } from "../../lib/decimal-validation";
import { calculate } from "../../engine";
import type { FxInput } from "../../engine/types";
import { FxBadge } from "./FxBadge";
import { DisclaimerBar } from "./DisclaimerBar";
import { ProductPicker } from "./ProductPicker";
import { InputPanel } from "./InputPanel";
import { PriceSuggestion } from "./PriceSuggestion";
import { BreakdownTable } from "./BreakdownTable";
import { VerdictCard } from "./VerdictCard";
import { CostWaterfall } from "./CostWaterfall";
import { WarningList } from "./WarningList";

interface SimulatorShellProps {
  catalogue: CatalogueType;
  rules: MarketRulesType;
  fx: FxSnapshotType;
}

export function SimulatorShell({ catalogue, rules, fx }: SimulatorShellProps) {
  const [scenario, setScenario] = useScenario();
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const market = "UK" as const;
  const currency = market === "UK" ? "GBP" : "AUD";
  const rate = market === "UK" ? fx.rates.GBP : fx.rates.AUD;

  const selectedItem = catalogue.items.find((item) => item.code === scenario.productCode) ?? null;

  function selectProduct(code: string) {
    const item = catalogue.items.find((i) => i.code === code);
    if (!item) return;
    const platformFees = rules.UK.platforms[scenario.platform];
    const referralDefault =
      "referralFeePctByCategory" in platformFees
        ? String(platformFees.referralFeePctByCategory[item.category])
        : String(platformFees.referralFeePctDefault);
    setScenario({
      ...scenario,
      productCode: code,
      dutyPct: String(rules.UK.dutyPctByCategory[item.category]),
      referralFeePct: referralDefault,
    });
  }

  const fxInput: FxInput = { rate: String(rate), asOf: fx.asOf, degraded: fx.degraded };
  const sellingPriceValid = Number(scenario.sellingPriceLocal) > 0;
  // Every one of these fields is fed straight into `new Decimal(...)` inside
  // calculate() with no validation of its own — an empty, blank, or
  // malformed value (e.g. from clearing an input, or a deep link missing a
  // param) would throw and crash the page. Gate the call so `result` simply
  // stays null (same as the "no price entered" state) until all of them
  // parse cleanly.
  const numericFieldsValid =
    isValidDecimalString(scenario.inboundShippingLocal) &&
    isValidDecimalString(scenario.packagingLocal) &&
    isValidDecimalString(scenario.adSpendLocal) &&
    isValidDecimalString(scenario.dutyPct) &&
    isValidDecimalString(scenario.referralFeePct);
  const result =
    selectedItem && sellingPriceValid && numericFieldsValid
      ? calculate(
          { ...scenario, market: "UK", usd: selectedItem.usd, category: selectedItem.category },
          fxInput,
          rules,
        )
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAF9]">
      <header className="border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Uniqbe Price Simulator</h1>
          <span className="rounded-full border border-neutral-300 px-3 py-1 text-sm">UK</span>
        </div>
        <FxBadge rate={rate} currency={currency} asOf={fx.asOf} />
      </header>

      <main className="flex flex-1 flex-col gap-6 px-4 py-6 md:flex-row">
        <section className="flex flex-col gap-4 md:w-80">
          <ProductPicker
            items={catalogue.items}
            selectedCode={scenario.productCode}
            onSelect={selectProduct}
          />
          <InputPanel
            scenario={scenario}
            onChange={setScenario}
            rules={rules}
            category={selectedItem?.category ?? null}
          />
          {selectedItem && (
            <PriceSuggestion
              input={{ ...scenario, market: "UK", usd: selectedItem.usd, category: selectedItem.category }}
              fx={fxInput}
              rules={rules}
              disabled={!selectedItem}
              onApply={(price) => setScenario({ ...scenario, sellingPriceLocal: price })}
            />
          )}
        </section>

        <section className="flex-1">
          {result ? (
            <div className="flex flex-col gap-4">
              <WarningList warnings={result.warnings} />
              <VerdictCard
                verdict={result.verdict}
                netProfit={result.netProfit}
                marginPct={result.marginPct}
                currency={result.currency}
              />
              <CostWaterfall
                lines={result.breakdown}
                netProfit={result.netProfit}
                hoveredLabel={hoveredLabel}
                onHoverLabel={setHoveredLabel}
              />
              <BreakdownTable
                lines={result.breakdown}
                netProfit={result.netProfit}
                currency={result.currency}
                hoveredLabel={hoveredLabel}
                onHoverLabel={setHoveredLabel}
              />
            </div>
          ) : (
            <p className="text-neutral-500">
              Select a product and enter a selling price to see your profit breakdown.
            </p>
          )}
        </section>
      </main>

      <DisclaimerBar />
    </div>
  );
}

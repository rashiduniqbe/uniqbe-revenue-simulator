"use client";

import { useState } from "react";
import type { CatalogueType, MarketRulesType, FxSnapshotType } from "../../lib/schemas";
import { DEFAULT_SCENARIO, useScenario } from "../../lib/url-state";
import { resolveSimulationInput } from "../../lib/simulate-input";
import { calculate } from "../../engine";
import type { Market } from "../../engine/types";
import { fxInputFor } from "../../lib/compare";
import { deriveDutyPctDefault, deriveReferralFeeDefault } from "../../lib/scenario-defaults";
import { FxBadge } from "./FxBadge";
import { DisclaimerBar } from "./DisclaimerBar";
import { ProductPicker } from "./ProductPicker";
import { InputPanel } from "./InputPanel";
import { PriceSuggestion } from "./PriceSuggestion";
import { BreakdownTable } from "./BreakdownTable";
import { VerdictCard } from "./VerdictCard";
import { CostWaterfall } from "./CostWaterfall";
import { WarningList } from "./WarningList";
import { MarketTabs } from "./MarketTabs";
import { ThresholdBanner } from "./ThresholdBanner";

interface SimulatorShellProps {
  catalogue: CatalogueType;
  rules: MarketRulesType;
  fx: FxSnapshotType;
}

export function SimulatorShell({ catalogue, rules, fx }: SimulatorShellProps) {
  const [scenario, setScenario] = useScenario();
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const market = scenario.market;
  const currency = market === "UK" ? "GBP" : "AUD";
  const rate = market === "UK" ? fx.rates.GBP : fx.rates.AUD;

  const selectedItem = catalogue.items.find((item) => item.code === scenario.productCode) ?? null;

  function selectProduct(code: string) {
    const item = catalogue.items.find((i) => i.code === code);
    if (!item) return;
    setScenario({
      ...scenario,
      productCode: code,
      dutyPct: deriveDutyPctDefault(rules, market, item.category),
      referralFeePct: deriveReferralFeeDefault(rules, market, scenario.platform, item.category),
    });
  }

  function selectMarket(nextMarket: Market) {
    const derivedFields = selectedItem
      ? {
          dutyPct: deriveDutyPctDefault(rules, nextMarket, selectedItem.category),
          referralFeePct: deriveReferralFeeDefault(
            rules,
            nextMarket,
            scenario.platform,
            selectedItem.category,
          ),
        }
      : {};
    // ebayFreeTier/shopifyHasAbn have no effect outside AU (see src/engine/platforms/ebay.ts
    // and src/engine/warnings.ts) but leaving a toggle silently armed after switching away
    // from AU is confusing state to carry in the URL.
    const resetAuFields = nextMarket === "AU" ? {} : { ebayFreeTier: false, shopifyHasAbn: false };
    // Local-currency amounts do not carry meaning across markets — a price
    // entered in GBP is not the same real value typed as AUD. Reset them to
    // DEFAULT_SCENARIO's empty state on every market switch so the UI doesn't
    // silently present a stale number in the new currency.
    const resetLocalCurrencyFields = {
      sellingPriceLocal: DEFAULT_SCENARIO.sellingPriceLocal,
      inboundShippingLocal: DEFAULT_SCENARIO.inboundShippingLocal,
      packagingLocal: DEFAULT_SCENARIO.packagingLocal,
      adSpendLocal: DEFAULT_SCENARIO.adSpendLocal,
    };
    setScenario({
      ...scenario,
      market: nextMarket,
      ...derivedFields,
      ...resetAuFields,
      ...resetLocalCurrencyFields,
    });
  }

  const fxInput = fxInputFor(fx, market);
  // calculate() feeds these strings straight into `new Decimal(...)`, so an
  // empty, padded or malformed value would throw. resolveSimulationInput trims,
  // fills empty duty/referral from market defaults, and returns null (no
  // result yet) unless everything parses.
  const resolved = selectedItem ? resolveSimulationInput(scenario, selectedItem, rules) : null;
  // The suggester validates the same fields but never trims them, so hand it the
  // resolved (trimmed, defaulted) values; the price is irrelevant to it.
  const suggestionInput = selectedItem
    ? {
        ...(resolveSimulationInput(
          { ...scenario, sellingPriceLocal: "1" },
          selectedItem,
          rules,
        ) ?? {
          ...scenario,
          usd: selectedItem.usd,
          category: selectedItem.category,
        }),
        sellingPriceLocal: scenario.sellingPriceLocal,
      }
    : null;
  const result = resolved ? calculate(resolved, fxInput, rules) : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAF9]">
      <header className="border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Uniqbe Price Simulator</h1>
          <MarketTabs market={market} onChange={selectMarket} />
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
          {selectedItem && (
            <a
              href={`/compare?p=${encodeURIComponent(selectedItem.code)}&pl=${scenario.platform}`}
              className="text-sm underline"
            >
              Compare UK vs Australia
            </a>
          )}
          <InputPanel
            scenario={scenario}
            onChange={setScenario}
            rules={rules}
            category={selectedItem?.category ?? null}
          />
          {selectedItem && suggestionInput && (
            <PriceSuggestion
              input={suggestionInput}
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
              {result.auAboveThreshold !== null && rules.AU.deMinimisLocal !== null && (
                <ThresholdBanner
                  aboveThreshold={result.auAboveThreshold}
                  thresholdLocal={rules.AU.deMinimisLocal}
                />
              )}
              <WarningList
                warnings={
                  result.auAboveThreshold === false
                    ? result.warnings.filter((w) => w.code !== "AU_BELOW_THRESHOLD")
                    : result.warnings
                }
              />
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

"use client";

import { useEffect, useRef } from "react";
import { useQueryStates } from "nuqs";
import type { CatalogueType, FxSnapshotType, MarketRulesType } from "../../lib/schemas";
import type { Market } from "../../engine/types";
import { COMPARE_CAVEAT, compareMarket, compareParsers } from "../../lib/compare";
import { FxBadge } from "../simulator/FxBadge";
import { DisclaimerBar } from "../simulator/DisclaimerBar";
import { ProductPicker } from "../simulator/ProductPicker";
import { VerdictCard } from "../simulator/VerdictCard";
import { BreakdownTable } from "../simulator/BreakdownTable";
import { WarningList } from "../simulator/WarningList";
import { ThresholdBanner } from "../simulator/ThresholdBanner";
import { useAdoptTypedValues } from "../simulator/useAdoptTypedValues";
import { track } from "../../lib/analytics/client";
import { comparisonViewed } from "../../lib/analytics/events";

interface CompareShellProps {
  catalogue: CatalogueType;
  rules: MarketRulesType;
  fx: FxSnapshotType;
}

const COLUMNS: {
  market: Market;
  label: string;
  priceKey: "sp_uk" | "sp_au";
  currency: "GBP" | "AUD";
}[] = [
  { market: "UK", label: "UK", priceKey: "sp_uk", currency: "GBP" },
  { market: "AU", label: "Australia", priceKey: "sp_au", currency: "AUD" },
];

export function CompareShell({ catalogue, rules, fx }: CompareShellProps) {
  const [params, setParams] = useQueryStates(compareParsers);
  const item = catalogue.items.find((i) => i.code === params.p) ?? null;
  const itemCode = item?.code ?? null;
  // Once per product compared. An unknown or empty code sends nothing.
  useEffect(() => {
    if (itemCode !== null) track(comparisonViewed(itemCode));
  }, [itemCode]);
  const priceRefs = {
    sp_uk: useRef<HTMLInputElement>(null),
    sp_au: useRef<HTMLInputElement>(null),
  };
  useAdoptTypedValues(priceRefs, { sp_uk: params.sp_uk, sp_au: params.sp_au }, (typed) =>
    setParams(typed),
  );

  const backParams = new URLSearchParams({ pl: params.pl });
  if (params.p) backParams.set("p", params.p);
  const backHref = `/?${backParams.toString()}`;

  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAF9]">
      <header className="border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Compare UK vs Australia</h1>
          <a href={backHref} className="text-sm underline">
            Back to simulator
          </a>
        </div>
        <FxBadge rate={fx.rates.GBP} currency="GBP" asOf={fx.asOf} />
        <FxBadge rate={fx.rates.AUD} currency="AUD" asOf={fx.asOf} />
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 py-6">
        <ProductPicker
          items={catalogue.items}
          selectedCode={params.p}
          onSelect={(code) => setParams({ p: code })}
        />
        <p className="text-sm text-neutral-700" data-testid="compare-caveat">
          {COMPARE_CAVEAT}
        </p>
        {item === null ? (
          <p className="text-neutral-500">Select a product to compare both markets.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {COLUMNS.map((col) => {
              const price = params[col.priceKey];
              const result = compareMarket(item, col.market, params.pl, price, rules, fx);
              const inputId = `price-${col.market.toLowerCase()}`;
              return (
                <section key={col.market} className="flex flex-col gap-3" aria-label={col.label}>
                  <h2 className="font-semibold">{col.label}</h2>
                  <label htmlFor={inputId} className="text-sm font-medium">
                    Selling price ({col.currency})
                  </label>
                  <input
                    id={inputId}
                    ref={priceRefs[col.priceKey]}
                    type="text"
                    inputMode="decimal"
                    className="block rounded border border-neutral-300 px-3 py-2 font-mono text-sm"
                    value={price}
                    onChange={(e) => setParams({ [col.priceKey]: e.target.value })}
                  />
                  {result === null ? (
                    <p className="text-neutral-500">Enter a selling price.</p>
                  ) : (
                    <>
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
                      <BreakdownTable
                        lines={result.breakdown}
                        netProfit={result.netProfit}
                        currency={result.currency}
                        hoveredLabel={null}
                        onHoverLabel={() => {}}
                      />
                    </>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>

      <DisclaimerBar />
    </div>
  );
}

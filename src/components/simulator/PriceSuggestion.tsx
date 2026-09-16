"use client";

import { useState } from "react";
import { suggestPrice } from "../../engine";
import type { SimulationInput, FxInput } from "../../engine/types";
import type { MarketRulesType } from "../../lib/schemas";

interface PriceSuggestionProps {
  input: Omit<SimulationInput, "sellingPriceLocal">;
  fx: FxInput;
  rules: MarketRulesType;
  onApply: (price: string) => void;
  disabled: boolean;
}

const DEFAULT_TARGET_MARGIN_PCT = 20;

export function PriceSuggestion({ input, fx, rules, onApply, disabled }: PriceSuggestionProps) {
  const [targetMarginPct, setTargetMarginPct] = useState(DEFAULT_TARGET_MARGIN_PCT);
  const [result, setResult] = useState<{ price: string; steps: number } | null>(null);
  const [hasSuggested, setHasSuggested] = useState(false);

  function handleSuggest() {
    setResult(suggestPrice(input, fx, rules, targetMarginPct));
    setHasSuggested(true);
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-white p-3">
      <label htmlFor="target-margin" className="text-sm font-medium">
        Suggest a price for a target margin
      </label>
      <div className="flex items-center gap-2">
        <input
          id="target-margin"
          type="number"
          className="w-20 rounded border border-neutral-300 px-2 py-1 text-sm"
          value={targetMarginPct}
          min={0}
          max={99}
          onChange={(event) => {
            setTargetMarginPct(Number(event.target.value));
            setHasSuggested(false);
            setResult(null);
          }}
        />
        <span className="text-sm text-neutral-600">% margin</span>
        <button
          type="button"
          className="rounded bg-neutral-900 px-3 py-1 text-sm text-white disabled:opacity-40"
          disabled={disabled}
          onClick={handleSuggest}
        >
          Suggest
        </button>
      </div>
      {result && (
        <p className="text-sm text-neutral-700">
          Suggested price: <span className="font-mono">{result.price}</span>{" "}
          <button type="button" className="underline" onClick={() => onApply(result.price)}>
            Apply
          </button>
        </p>
      )}
      {result === null && hasSuggested && (
        <p className="text-sm text-neutral-500">
          A {targetMarginPct}% margin isn&rsquo;t reachable at any selling price for this setup —
          the platform fees alone exceed what&rsquo;s left after costs. Try a lower target margin
          or a different platform.
        </p>
      )}
    </div>
  );
}

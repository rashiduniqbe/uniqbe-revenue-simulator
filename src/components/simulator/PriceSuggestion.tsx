"use client";

import { useEffect, useRef, useState } from "react";
import { suggestPrice } from "../../engine";
import type { SimulationInput, FxInput } from "../../engine/types";
import type { MarketRulesType } from "../../lib/schemas";
import { isValidDecimalString } from "../../lib/decimal-validation";

type SuggestionInput = Omit<SimulationInput, "sellingPriceLocal">;

interface PriceSuggestionProps {
  input: SuggestionInput;
  fx: FxInput;
  rules: MarketRulesType;
  onApply: (price: string) => void;
  disabled: boolean;
}

const DEFAULT_TARGET_MARGIN_PCT = 20;

function isSuggestionInputValid(input: SuggestionInput): boolean {
  return (
    isValidDecimalString(input.inboundShippingLocal) &&
    isValidDecimalString(input.packagingLocal) &&
    isValidDecimalString(input.adSpendLocal) &&
    isValidDecimalString(input.dutyPct) &&
    isValidDecimalString(input.referralFeePct)
  );
}

export function PriceSuggestion({ input, fx, rules, onApply, disabled }: PriceSuggestionProps) {
  const [targetMarginPct, setTargetMarginPct] = useState(DEFAULT_TARGET_MARGIN_PCT);
  const [result, setResult] = useState<{ price: string; steps: number } | null>(null);
  const [hasSuggested, setHasSuggested] = useState(false);
  // Tracks the scenario input that produced the current `result`, so a
  // suggestion computed against a stale scenario (platform/input changed
  // after suggesting) never lingers as something Apply-able.
  const suggestedForInputRef = useRef<SuggestionInput | null>(null);

  useEffect(() => {
    const suggestedFor = suggestedForInputRef.current;
    if (suggestedFor !== null && JSON.stringify(suggestedFor) !== JSON.stringify(input)) {
      setResult(null);
      setHasSuggested(false);
      suggestedForInputRef.current = null;
    }
  }, [input]);

  function handleSuggest() {
    if (!isSuggestionInputValid(input)) return;
    setResult(suggestPrice(input, fx, rules, targetMarginPct));
    setHasSuggested(true);
    suggestedForInputRef.current = input;
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
          the platform fees alone exceed what&rsquo;s left after costs. Try a lower target margin or
          a different platform.
        </p>
      )}
    </div>
  );
}

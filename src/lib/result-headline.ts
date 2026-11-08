import type { SimulationResult } from "../engine/types";
import { CURRENCY_SYMBOL, platformFeeLabel } from "./breakdown-format";

export interface ResultHeadline {
  platformFees: string;
  feeBreakdownLine: string;
  netProfit: string;
  marginPct: string;
  verdict: SimulationResult["verdict"];
}

// Money stays a decimal string end to end: the engine's strings are passed
// through or concatenated, never parsed into numbers.
export function toResultHeadline(result: SimulationResult | null): ResultHeadline | null {
  if (!result) return null;
  const symbol = CURRENCY_SYMBOL[result.currency];
  const feeBreakdownLine = Object.entries(result.platformFees)
    .map(([key, amount]) => `${platformFeeLabel(key)} ${symbol}${amount}`)
    .join(" + ");
  return {
    platformFees: result.platformFeeSubtotal,
    feeBreakdownLine,
    netProfit: result.netProfit,
    marginPct: result.marginPct,
    verdict: result.verdict,
  };
}

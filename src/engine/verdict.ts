import type Decimal from "decimal.js";

export const VERDICT_MARGIN_THRESHOLD_PCT = 12;

export function verdict(
  profit: Decimal,
  marginPct: Decimal,
): "profitable" | "marginal" | "loss-making" {
  if (profit.lte(0)) return "loss-making";
  if (marginPct.lt(VERDICT_MARGIN_THRESHOLD_PCT)) return "marginal";
  return "profitable";
}

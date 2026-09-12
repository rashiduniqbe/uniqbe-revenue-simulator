import Decimal from "decimal.js";
import { r2 } from "../money";
import type { Market } from "../types";
import type { EbayFeesType } from "../../lib/schemas";

export function computeEbayFees(
  gross: Decimal,
  rules: EbayFeesType,
  market: Market,
  referralFeePct: Decimal,
  freeTier: boolean,
): Record<string, string> {
  if (market === "AU" && freeTier) {
    return { referralFee: "0.00" };
  }

  let referralFee: Decimal;
  if (rules.tieredAbove && gross.gt(rules.tieredAbove.thresholdLocal)) {
    const base = new Decimal(rules.tieredAbove.thresholdLocal);
    const excess = gross.minus(base);
    referralFee = r2(base.times(referralFeePct).div(100)).plus(
      r2(excess.times(rules.tieredAbove.pctAbove).div(100)),
    );
  } else {
    referralFee = r2(gross.times(referralFeePct).div(100));
  }

  const fees: Record<string, string> = { referralFee: referralFee.toFixed(2) };

  if (rules.regulatoryFeePct > 0) {
    fees.regulatoryFee = r2(gross.times(rules.regulatoryFeePct).div(100)).toFixed(2);
  }

  const perOrderAmount = gross.lte(rules.perOrderFee.thresholdLocal)
    ? rules.perOrderFee.low
    : rules.perOrderFee.high;
  if (perOrderAmount > 0) {
    fees.perOrderFee = r2(new Decimal(perOrderAmount)).toFixed(2);
  }

  return fees;
}

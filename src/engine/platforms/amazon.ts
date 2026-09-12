import Decimal from "decimal.js";
import { r2 } from "../money";
import type { AmazonFeesType } from "../../lib/schemas";

export function computeAmazonFees(
  gross: Decimal,
  rules: AmazonFeesType,
  plan: "individual" | "professional",
  referralFeePct: Decimal,
): Record<string, string> {
  const rawReferral = r2(gross.times(referralFeePct).div(100));
  const floor = new Decimal(rules.minReferralFee ?? 0);
  const referralFee = rawReferral.lt(floor) ? r2(floor) : rawReferral;

  const fees: Record<string, string> = { referralFee: referralFee.toFixed(2) };
  if (plan === "individual") {
    fees.perItemPlanFee = r2(new Decimal(rules.individualPerItemFee)).toFixed(2);
  }
  return fees;
}

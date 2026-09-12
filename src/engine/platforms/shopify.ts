import Decimal from "decimal.js";
import { r2 } from "../money";
import type { ShopifyFeesType } from "../../lib/schemas";

export function computeShopifyFees(
  gross: Decimal,
  rules: ShopifyFeesType,
  plan: "basic" | "grow" | "advanced",
): Record<string, string> {
  const planFee = rules.payments[plan];
  const paymentFee = r2(gross.times(planFee.pct).div(100)).plus(r2(new Decimal(planFee.fixed)));
  return { paymentFee: paymentFee.toFixed(2) };
}

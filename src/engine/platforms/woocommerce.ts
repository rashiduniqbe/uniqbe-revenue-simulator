import Decimal from "decimal.js";
import { r2 } from "../money";
import type { WooCommerceFeesType } from "../../lib/schemas";

// Same shape as Shopify Payments: pct of the gross price plus a fixed fee per order.
export function computeWooCommerceFees(
  gross: Decimal,
  rules: WooCommerceFeesType,
): Record<string, string> {
  const { pct, fixed } = rules.payments;
  const paymentFee = r2(gross.times(pct).div(100)).plus(r2(new Decimal(fixed)));
  return { paymentFee: paymentFee.toFixed(2) };
}

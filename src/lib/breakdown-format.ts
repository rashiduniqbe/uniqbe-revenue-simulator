// Currency symbol shown ahead of every formatted amount in the simulator UI.
// Single source of truth — was previously duplicated verbatim in
// BreakdownTable.tsx and VerdictCard.tsx.
export const CURRENCY_SYMBOL: Record<"GBP" | "AUD", string> = { GBP: "£", AUD: "A$" };

// calculate() (src/engine/index.ts) spreads each platform module's fee
// object straight into the breakdown using its raw camelCase object keys.
// Those keys are read from src/engine/platforms/{amazon,ebay,shopify,other}.ts:
//   amazon.ts  -> referralFee, perItemPlanFee
//   ebay.ts    -> referralFee, regulatoryFee, perOrderFee
//   shopify.ts -> paymentFee
//   other.ts   -> (none)
// This maps those engine keys to user-facing copy per spec §9.3 ("write
// from the partner's side of the screen"). Any key not listed here falls
// back to the raw label unchanged, so an engine key added later never
// crashes or silently disappears from the breakdown — it just shows up
// unmapped until this table is updated.
export const PLATFORM_FEE_LABELS: Record<string, string> = {
  referralFee: "Referral fee",
  perItemPlanFee: "Per-item fee",
  regulatoryFee: "Regulatory operating fee",
  perOrderFee: "Per-order fee",
  paymentFee: "Payment processing fee",
};

export function platformFeeLabel(rawLabel: string): string {
  return PLATFORM_FEE_LABELS[rawLabel] ?? rawLabel;
}

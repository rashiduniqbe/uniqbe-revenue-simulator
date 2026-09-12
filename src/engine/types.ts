import type { CategorySlugType } from "../lib/schemas";

export type Market = "UK" | "AU";
export type Platform = "amazon" | "ebay" | "shopify" | "other";

export type WarningCode =
  | "AU_BELOW_THRESHOLD"
  | "AU_NEAR_THRESHOLD"
  | "IMPORT_TAX_CASHFLOW"
  | "FX_DEGRADED"
  | "CUSTOMS_DECLARED_VALUE_UNCONFIRMED"
  | "DOORSTEP_LIABILITY"
  | "SHOPIFY_NO_AUDIENCE"
  | "SHOPIFY_AU_GST_ON_SUB"
  | "NOT_TAX_ADVICE";

export type EngineWarning = {
  code: WarningCode;
};

export type BreakdownLine = {
  label: string;
  amount: string;
};

export type SimulationInput = {
  market: Market;
  productCode: string;
  usd: number;
  category: CategorySlugType;
  platform: Platform;
  taxRegistered: boolean;
  sellingPriceLocal: string;
  inboundShippingLocal: string;
  packagingLocal: string;
  adSpendLocal: string;
  dutyPct: string;
  referralFeePct: string;
  amazonPlan: "individual" | "professional";
  shopifyPlan: "basic" | "grow" | "advanced";
  shopifyHasAbn: boolean;
  ebayFreeTier: boolean;
  _planParityDisableFeeTax?: boolean;
};

export type FxInput = {
  rate: string;
  asOf: string;
  degraded: boolean;
};

export type SimulationResult = {
  currency: "GBP" | "AUD";
  fx: FxInput;
  breakdown: BreakdownLine[];
  goodsCostLocal: string;
  inboundShipping: string;
  duty: string;
  auAboveThreshold: boolean | null;
  importTax: string;
  importTaxReclaimable: boolean;
  landedCost: string;
  sellingPriceGross: string;
  outputTax: string;
  netRevenue: string;
  platformFees: Record<string, string>;
  platformFeeSubtotal: string;
  taxOnPlatformFees: string;
  taxOnPlatformFeesCost: string;
  otherCosts: string;
  netProfit: string;
  marginPct: string;
  verdict: "profitable" | "marginal" | "loss-making";
  monthlyFeeCoverage: { monthlyFee: string; unitsRequired: number } | null;
  warnings: EngineWarning[];
};

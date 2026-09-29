import type { EngineWarning, WarningCode } from "../engine/types";

export const WARNING_COPY: Record<WarningCode, { message: string; alwaysVisible: boolean }> = {
  FX_DEGRADED: {
    message: "This exchange rate is more than a few days old.",
    alwaysVisible: false,
  },
  CUSTOMS_DECLARED_VALUE_UNCONFIRMED: {
    message:
      "This estimate uses your reseller cost as the customs declared value — Uniqbe's actual declared value has not been confirmed.",
    alwaysVisible: false,
  },
  DOORSTEP_LIABILITY: {
    message:
      "You are liable to Uniqbe for duty and tax, but the courier usually bills your end customer for it at the door.",
    alwaysVisible: true,
  },
  IMPORT_TAX_CASHFLOW: {
    message: "Import tax is reclaimable, but you pay it upfront before you reclaim it.",
    alwaysVisible: false,
  },
  AU_BELOW_THRESHOLD: {
    message:
      "No GST is modelled below A$1,000 goods value — this reflects Uniqbe's stated policy, not permanent law.",
    alwaysVisible: false,
  },
  AU_NEAR_THRESHOLD: {
    message: "This product is close to the A$1,000 threshold — a small FX move could push it over.",
    alwaysVisible: false,
  },
  SHOPIFY_NO_AUDIENCE: {
    message: "Shopify has no built-in marketplace traffic — a $0 ad budget is unrealistic here.",
    alwaysVisible: false,
  },
  SHOPIFY_AU_GST_ON_SUB: {
    message: "Without an ABN on file, 10% GST is added to your Shopify subscription itself.",
    alwaysVisible: false,
  },
  NOT_TAX_ADVICE: {
    message: "This is an estimate, not tax advice.",
    alwaysVisible: true,
  },
};

// A Record (not an array + indexOf) so adding a 10th WarningCode without
// updating this map is a compile error, the same way WARNING_COPY already
// forces every code to be handled. A forgotten array entry would otherwise
// silently sort that code first via indexOf() === -1.
const PRIORITY: Record<WarningCode, number> = {
  FX_DEGRADED: 0,
  CUSTOMS_DECLARED_VALUE_UNCONFIRMED: 1,
  DOORSTEP_LIABILITY: 2,
  IMPORT_TAX_CASHFLOW: 3,
  AU_BELOW_THRESHOLD: 4,
  AU_NEAR_THRESHOLD: 5,
  SHOPIFY_NO_AUDIENCE: 6,
  SHOPIFY_AU_GST_ON_SUB: 7,
  NOT_TAX_ADVICE: 8,
};

export function sortWarningsByPriority(warnings: EngineWarning[]): EngineWarning[] {
  return [...warnings].sort((a, b) => PRIORITY[a.code] - PRIORITY[b.code]);
}

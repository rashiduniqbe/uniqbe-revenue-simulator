import type { Market, Platform, SimulationResult } from "../../engine/types";
import { marginBand, type MarginBand } from "./bands";

// Spec §13. Every property is a catalogue fact or a band — never a
// partner-entered price, margin or shipping cost.
export type AnalyticsEvent =
  | { name: "simulator_viewed"; properties: { market: Market; referrer: string } }
  | {
      name: "product_selected";
      properties: { productCode: string; category: string; market: Market };
    }
  | {
      name: "calculation_run";
      properties: {
        market: Market;
        platform: Platform;
        verdict: SimulationResult["verdict"];
        marginBand: MarginBand;
        auAboveThreshold: boolean | null;
      };
    }
  | { name: "price_suggested"; properties: { targetMargin: MarginBand; reachable: boolean } }
  | { name: "comparison_viewed"; properties: { productCode: string } }
  | { name: "scenario_shared"; properties: Record<string, never> };

// Only the referring site's hostname — its path/query could carry anything.
export function referrerSource(referrer: string, ownHost: string): string {
  if (referrer === "") return "direct";
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return "unknown";
  }
  return url.host === ownHost ? "internal" : url.hostname;
}

export function simulatorViewed(market: Market, referrer: string): AnalyticsEvent {
  return { name: "simulator_viewed", properties: { market, referrer } };
}

export function productSelected(
  productCode: string,
  category: string,
  market: Market,
): AnalyticsEvent {
  return { name: "product_selected", properties: { productCode, category, market } };
}

export function calculationRun(
  result: SimulationResult,
  market: Market,
  platform: Platform,
): AnalyticsEvent {
  return {
    name: "calculation_run",
    properties: {
      market,
      platform,
      verdict: result.verdict,
      marginBand: marginBand(result.marginPct),
      auAboveThreshold: result.auAboveThreshold,
    },
  };
}

export function priceSuggested(targetMarginPct: number, reachable: boolean): AnalyticsEvent {
  return {
    name: "price_suggested",
    properties: { targetMargin: marginBand(String(targetMarginPct)), reachable },
  };
}

export function comparisonViewed(productCode: string): AnalyticsEvent {
  return { name: "comparison_viewed", properties: { productCode } };
}

export function scenarioShared(): AnalyticsEvent {
  return { name: "scenario_shared", properties: {} };
}

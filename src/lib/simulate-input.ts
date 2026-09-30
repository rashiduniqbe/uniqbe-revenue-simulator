import type { SimulationInput } from "../engine/types";
import type { CatalogueItemType, MarketRulesType } from "./schemas";
import type { ScenarioParams } from "./url-state";
import { isValidDecimalString } from "./decimal-validation";
import { deriveDutyPctDefault, deriveReferralFeeDefault } from "./scenario-defaults";

type ScenarioItem = Pick<CatalogueItemType, "usd" | "category">;

// Turns raw URL-state text into a calculate()-safe input, or null when any
// numeric field is unusable. Every field is trimmed (decimal.js throws on
// "5 "), and an empty duty/referral field falls back to the market default so
// a bare deep link still renders a result (spec §9.4).
export function resolveSimulationInput(
  scenario: ScenarioParams,
  item: ScenarioItem,
  rules: MarketRulesType,
): SimulationInput | null {
  const sellingPriceLocal = scenario.sellingPriceLocal.trim();
  const inboundShippingLocal = scenario.inboundShippingLocal.trim();
  const packagingLocal = scenario.packagingLocal.trim();
  const adSpendLocal = scenario.adSpendLocal.trim();
  const dutyPct =
    scenario.dutyPct.trim() || deriveDutyPctDefault(rules, scenario.market, item.category);
  const referralFeePct =
    scenario.referralFeePct.trim() ||
    deriveReferralFeeDefault(rules, scenario.market, scenario.platform, item.category);

  const valid =
    isValidDecimalString(sellingPriceLocal) &&
    Number(sellingPriceLocal) > 0 &&
    [inboundShippingLocal, packagingLocal, adSpendLocal, dutyPct, referralFeePct].every(
      isValidDecimalString,
    );
  if (!valid) return null;

  return {
    ...scenario,
    sellingPriceLocal,
    inboundShippingLocal,
    packagingLocal,
    adSpendLocal,
    dutyPct,
    referralFeePct,
    usd: item.usd,
    category: item.category,
  };
}

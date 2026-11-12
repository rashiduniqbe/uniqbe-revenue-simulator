import Decimal from "decimal.js";
import type { SimulationInput } from "../engine/types";
import type { CatalogueItemType, MarketRulesType } from "./schemas";
import type { ScenarioParams } from "./url-state";
import { isValidDecimalString } from "./decimal-validation";
import { resolveSimulationInput } from "./simulate-input";
import { toAud, type DisplayCurrency } from "./display-currency";

type Rates = { AUD: number; HKD?: number };
type Overrides = { customCost: string; declaredValue: string };

const INVALID = Symbol("invalid");

// Every money field on the prototype is typed in the chosen display currency;
// the engine works in AUD. Turns the typed scenario into a calculate() input,
// or null when anything can't be used yet (same contract as resolveSimulationInput).
export function buildPrototypeInput(
  scenario: ScenarioParams,
  item: Pick<CatalogueItemType, "usd" | "category">,
  rules: MarketRulesType,
  currency: DisplayCurrency,
  rates: Rates,
  overrides: Overrides,
): SimulationInput | null {
  if (currency === "HKD" && rates.HKD === undefined) return null;

  // Malformed text is passed through untouched so resolveSimulationInput rejects it.
  const toEngine = (value: string): string =>
    isValidDecimalString(value) ? (toAud(value.trim(), rates, currency) ?? value) : value;

  const resolved = resolveSimulationInput(
    {
      ...scenario,
      sellingPriceLocal: toEngine(scenario.sellingPriceLocal),
      inboundShippingLocal: toEngine(scenario.inboundShippingLocal),
      packagingLocal: toEngine(scenario.packagingLocal),
      adSpendLocal: toEngine(scenario.adSpendLocal),
    },
    item,
    rules,
  );
  if (!resolved) return null;

  const customCost = optionalPositive(overrides.customCost, rates, currency);
  const declaredValue = optionalPositive(overrides.declaredValue, rates, currency);
  if (customCost === INVALID || declaredValue === INVALID) return null;

  return {
    ...resolved,
    ...(customCost === undefined ? {} : { goodsCostLocal: customCost }),
    ...(declaredValue === undefined ? {} : { declaredValueLocal: declaredValue }),
  };
}

// Blank means "not overridden"; anything typed must be a positive amount.
function optionalPositive(
  raw: string,
  rates: Rates,
  currency: DisplayCurrency,
): string | undefined | typeof INVALID {
  const value = raw.trim();
  if (value === "") return undefined;
  if (!isValidDecimalString(value) || new Decimal(value).lte(0)) return INVALID;
  return toAud(value, rates, currency) ?? INVALID;
}

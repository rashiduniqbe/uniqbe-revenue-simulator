import Decimal from "decimal.js";
import type { SimulationInput } from "../engine/types";
import type { CatalogueItemType, MarketRulesType } from "./schemas";
import type { ScenarioParams } from "./url-state";
import { isValidDecimalString } from "./decimal-validation";
import { resolveSimulationInput } from "./simulate-input";
import { platformTakesAdSpend } from "./scenario-defaults";
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
      // The ad-spend field only shows on own-store platforms. A value left in
      // the URL (e.g. shared with the simulation) must not be deducted unseen.
      adSpendLocal: platformTakesAdSpend(scenario.platform) ? toEngine(scenario.adSpendLocal) : "0",
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

// True when a usable declared value is below the product price in use (the
// custom price if one is typed and valid, otherwise the store price). Both
// are in the same display currency. Drives the under-declaration warning.
export function isDeclaredBelowPrice(overrides: Overrides, storePrice: string | null): boolean {
  const declared = overrides.declaredValue.trim();
  if (!isValidDecimalString(declared)) return false;
  const custom = overrides.customCost.trim();
  const price = isValidDecimalString(custom) ? custom : storePrice;
  if (price === null || !isValidDecimalString(price)) return false;
  return new Decimal(declared).lt(new Decimal(price));
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

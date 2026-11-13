import Decimal from "decimal.js";
import { calculate, suggestPrice } from "../../engine";
import type { FxInput, SimulationInput, SimulationResult } from "../../engine/types";
import type { LiveItemType, MarketRulesType } from "../schemas";
import { DEFAULT_SCENARIO, type ScenarioParams } from "../url-state";
import { platformTakesAdSpend } from "../scenario-defaults";
import { buildPrototypeInput } from "../prototype-input";
import { isValidDecimalString } from "../decimal-validation";
import { toDisplay, type DisplayCurrency } from "../display-currency";

// "Other" has no fees, so it adds nothing to a price comparison.
export const SIM_PLATFORMS = ["amazon", "ebay", "shopify", "woocommerce"] as const;
export type SimPlatform = (typeof SIM_PLATFORMS)[number];

export const TARGET_MARGINS = [3, 5, 8, 10] as const;
export type TargetMarginPct = (typeof TARGET_MARGINS)[number];

/** One run of the simulation. Money fields are typed in `currency`, like the calculator's. */
export type SimSettings = {
  targetMarginPct: TargetMarginPct;
  taxRegistered: boolean;
  currency: DisplayCurrency;
  inboundShipping: string;
  packaging: string;
  adSpend: string;
};

export type SimContext = {
  rules: MarketRulesType;
  fx: FxInput;
  rates: { AUD: number; HKD?: number };
};

/** A solved price for one platform. Money is in the display currency. */
export type SimCell = {
  platform: SimPlatform;
  price: string;
  netProfit: string;
  marginPct: string;
  feeTotal: string;
};

export type SimItem = Pick<
  LiveItemType,
  "code" | "name" | "category" | "categoryLabel" | "usd" | "search"
>;

export type SimRow = {
  code: string;
  name: string;
  category: SimItem["category"];
  categoryLabel: string;
  search: string;
  usd: number;
  goodsCost: string;
  landedCost: string;
  importTax: string;
  auAboveThreshold: boolean;
  nearThreshold: boolean;
  cells: Record<SimPlatform, SimCell | null>;
};

// The calculator's fixed plan defaults (DEFAULT_SCENARIO): Amazon Professional,
// Shopify Basic, eBay free tier off, no ABN.
const NO_OVERRIDES = { customCost: "", declaredValue: "" };
// A placeholder price that only exists so the cost side can be read.
const PROBE_PRICE = "1.00";
// Converting to the display currency can shave a fraction of a cent; a few
// display cents always cover that. Past this, the cell reports no price.
const MAX_DISPLAY_NUDGES = 10;
const DISPLAY_CENT = new Decimal("0.01");

/**
 * The calculator scenario a cell stands for, in the display currency. The row
 * action writes exactly these values to the URL, so the calculator rebuilds
 * the same input. Duty and referral fee stay blank: the calculator fills the
 * category defaults, as it does for any product.
 */
export function cellScenario(
  item: Pick<SimItem, "code">,
  settings: SimSettings,
  platform: SimPlatform,
  price: string,
): ScenarioParams {
  return {
    ...DEFAULT_SCENARIO,
    market: "AU",
    productCode: item.code,
    platform,
    taxRegistered: settings.taxRegistered,
    sellingPriceLocal: price,
    inboundShippingLocal: settings.inboundShipping,
    packagingLocal: settings.packaging,
    adSpendLocal: platformTakesAdSpend(platform) ? settings.adSpend : "0.00",
  };
}

/** The engine input for a cell at a display-currency price, built the calculator's way. */
export function cellInput(
  item: SimItem,
  settings: SimSettings,
  platform: SimPlatform,
  price: string,
  ctx: SimContext,
): SimulationInput | null {
  return buildPrototypeInput(
    cellScenario(item, settings, platform, price),
    item,
    ctx.rules,
    settings.currency,
    ctx.rates,
    NO_OVERRIDES,
  );
}

function withoutPrice(input: SimulationInput): Omit<SimulationInput, "sellingPriceLocal"> {
  const copy: Partial<SimulationInput> = { ...input };
  delete copy.sellingPriceLocal;
  return copy as Omit<SimulationInput, "sellingPriceLocal">;
}

function meetsTarget(result: SimulationResult, target: number): boolean {
  return new Decimal(result.marginPct).gte(target) && new Decimal(result.netProfit).gte(0);
}

// Solves in AUD, then finds the display price the calculator will accept:
// converted rounding up, and nudged up a display cent at a time until the
// calculator's own path meets the target.
function solveCell(
  item: SimItem,
  settings: SimSettings,
  platform: SimPlatform,
  ctx: SimContext,
): SimCell | null {
  const probe = cellInput(item, settings, platform, PROBE_PRICE, ctx);
  if (!probe) return null;
  const solved = suggestPrice(withoutPrice(probe), ctx.fx, ctx.rules, settings.targetMarginPct);
  if (!solved) return null;

  const first = toDisplay(solved.price, ctx.rates, settings.currency, "up");
  if (first === null) return null;
  let price = new Decimal(first);
  for (let i = 0; i <= MAX_DISPLAY_NUDGES; i += 1) {
    const input = cellInput(item, settings, platform, price.toFixed(2), ctx);
    if (!input) return null;
    const result = calculate(input, ctx.fx, ctx.rules);
    if (meetsTarget(result, settings.targetMarginPct)) {
      return toCell(platform, price.toFixed(2), result, settings.currency, ctx);
    }
    price = price.plus(DISPLAY_CENT);
  }
  return null;
}

function toCell(
  platform: SimPlatform,
  price: string,
  result: SimulationResult,
  currency: DisplayCurrency,
  ctx: SimContext,
): SimCell {
  const display = (aud: string) => toDisplay(aud, ctx.rates, currency) ?? aud;
  const fees = new Decimal(result.platformFeeSubtotal).plus(result.taxOnPlatformFeesCost);
  return {
    platform,
    price,
    netProfit: display(result.netProfit),
    marginPct: result.marginPct,
    feeTotal: display(fees.toFixed(2)),
  };
}

/** True when every typed cost is a plain, non-negative amount. */
export function areSettingsUsable(settings: SimSettings): boolean {
  return [settings.inboundShipping, settings.packaging, settings.adSpend].every(
    (v) => isValidDecimalString(v) && !new Decimal(v.trim()).isNegative(),
  );
}

/** Solves every simulated platform for one product. Settings must be usable. */
export function simulateProduct(item: SimItem, settings: SimSettings, ctx: SimContext): SimRow {
  // The cost side does not depend on price or platform: read it once.
  const probeInput = cellInput(item, settings, "amazon", PROBE_PRICE, ctx);
  if (!probeInput) throw new Error(`simulateProduct: unusable settings for ${item.code}`);
  const probe = calculate(probeInput, ctx.fx, ctx.rules);
  const display = (aud: string) => toDisplay(aud, ctx.rates, settings.currency) ?? aud;

  const cells = Object.fromEntries(
    SIM_PLATFORMS.map((platform) => [platform, solveCell(item, settings, platform, ctx)]),
  ) as Record<SimPlatform, SimCell | null>;

  return {
    code: item.code,
    name: item.name,
    category: item.category,
    categoryLabel: item.categoryLabel,
    search: item.search,
    usd: item.usd,
    goodsCost: display(probe.goodsCostLocal),
    landedCost: display(probe.landedCost),
    importTax: settings.taxRegistered ? display("0") : display(probe.importTax),
    auAboveThreshold: probe.auAboveThreshold === true,
    nearThreshold: probe.warnings.some((w) => w.code === "AU_NEAR_THRESHOLD"),
    cells,
  };
}

/** Simulates every product, in order, or null when a typed cost is unusable. */
export function simulateCatalogue(
  items: readonly SimItem[],
  settings: SimSettings,
  ctx: SimContext,
): SimRow[] | null {
  if (!areSettingsUsable(settings)) return null;
  return items.map((item) => simulateProduct(item, settings, ctx));
}

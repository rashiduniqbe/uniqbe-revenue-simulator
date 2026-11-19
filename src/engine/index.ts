import Decimal from "decimal.js";
import { r2, assertBreakdownSums } from "./money";
import { ukModule } from "./markets/uk";
import { auModule } from "./markets/au";
import type { MarketModule } from "./markets/registry";
import { computeAmazonFees } from "./platforms/amazon";
import { computeEbayFees } from "./platforms/ebay";
import { computeShopifyFees } from "./platforms/shopify";
import { computeOtherFees } from "./platforms/other";
import { computeWooCommerceFees } from "./platforms/woocommerce";
import { verdict } from "./verdict";
import { emitWarnings } from "./warnings";
import type { FxInput, SimulationInput, SimulationResult, BreakdownLine } from "./types";
import type { MarketRulesType } from "../lib/schemas";

const MARKET_MODULES: Record<SimulationInput["market"], MarketModule> = {
  UK: ukModule,
  AU: auModule,
};

// Formats a cost line's amount for the breakdown array. A plain
// `-${value.toFixed(2)}` produces the misleading string "-0.00" whenever
// value is exactly zero; this normalizes that case to "0.00".
function negativeAmount(value: Decimal): string {
  return value.isZero() ? "0.00" : `-${value.toFixed(2)}`;
}

// The cost of goods (usd × rate unless overridden) and the customs value the
// threshold, duty and import tax are assessed on (the goods cost unless a
// declared value is given). Both in local currency.
function goodsAndCustomsValue(
  input: Pick<SimulationInput, "usd" | "goodsCostLocal" | "declaredValueLocal">,
  fxRate: Decimal,
): { goods: Decimal; customsValue: Decimal } {
  const goods =
    input.goodsCostLocal !== undefined
      ? r2(input.goodsCostLocal)
      : r2(new Decimal(input.usd).times(fxRate));
  const customsValue =
    input.declaredValueLocal !== undefined ? r2(input.declaredValueLocal) : goods;
  return { goods, customsValue };
}

export function calculate(
  input: SimulationInput,
  fx: FxInput,
  rules: MarketRulesType,
): SimulationResult {
  const market = MARKET_MODULES[input.market];
  const marketRules = rules[input.market];

  const fxRate = new Decimal(fx.rate);
  const { goods, customsValue } = goodsAndCustomsValue(input, fxRate);
  const shipping = r2(input.inboundShippingLocal);
  const dutyPct = new Decimal(input.dutyPct);
  const duty = market.computeDuty(customsValue, dutyPct);

  const above = market.isAboveThreshold(customsValue, shipping, marketRules);
  const importTax = market.computeImportTax(customsValue, shipping, duty, above);

  const landed = input.taxRegistered
    ? goods.plus(shipping).plus(duty)
    : goods.plus(shipping).plus(duty).plus(importTax);

  const sellingPriceGross = r2(input.sellingPriceLocal);
  if (sellingPriceGross.lte(0)) {
    throw new Error("sellingPriceLocal must be a positive value");
  }
  const outputTax = market.computeOutputTax(sellingPriceGross, input.taxRegistered);
  const netRevenue = sellingPriceGross.minus(outputTax);

  const referralFeePct = new Decimal(input.referralFeePct);
  let platformFees: Record<string, string>;
  switch (input.platform) {
    case "amazon":
      platformFees = computeAmazonFees(
        sellingPriceGross,
        marketRules.platforms.amazon,
        input.amazonPlan,
        referralFeePct,
      );
      break;
    case "ebay":
      platformFees = computeEbayFees(
        sellingPriceGross,
        marketRules.platforms.ebay,
        input.market,
        referralFeePct,
        input.ebayFreeTier,
      );
      break;
    case "shopify":
      platformFees = computeShopifyFees(
        sellingPriceGross,
        marketRules.platforms.shopify,
        input.shopifyPlan,
      );
      break;
    case "woocommerce":
      platformFees = computeWooCommerceFees(sellingPriceGross, marketRules.platforms.woocommerce);
      break;
    case "other":
      platformFees = computeOtherFees();
      break;
  }

  const platformFeeSubtotal = Object.values(platformFees).reduce((sum, v) => {
    return sum.plus(new Decimal(v));
  }, new Decimal("0"));

  const feeTax = input._planParityDisableFeeTax
    ? r2("0")
    : r2(platformFeeSubtotal.times(market.taxRatePct).div(100));
  const feeTaxCost = input.taxRegistered ? r2("0") : feeTax;

  const otherCosts = r2(input.packagingLocal).plus(r2(input.adSpendLocal));

  const netProfit = netRevenue
    .minus(landed)
    .minus(platformFeeSubtotal)
    .minus(feeTaxCost)
    .minus(otherCosts);

  const marginPct = r2(netProfit.div(sellingPriceGross).times(100));

  const breakdown: BreakdownLine[] = [
    { label: "Gross selling price", amount: sellingPriceGross.toFixed(2) },
    { label: `Output ${market.taxName}`, amount: negativeAmount(outputTax) },
    { label: "Goods cost", amount: negativeAmount(goods) },
    { label: "Shipping", amount: negativeAmount(shipping) },
    { label: "Import duty", amount: negativeAmount(duty) },
    {
      label: `Import ${market.taxName}`,
      amount: input.taxRegistered ? "0.00" : negativeAmount(importTax),
    },
    ...Object.entries(platformFees).map(([label, amount]) => ({
      label,
      amount: negativeAmount(new Decimal(amount)),
    })),
    { label: `${market.taxName} on fees`, amount: negativeAmount(feeTaxCost) },
    { label: "Other costs", amount: negativeAmount(otherCosts) },
  ];

  assertBreakdownSums(
    breakdown.map((l) => l.amount),
    netProfit.toFixed(2),
  );

  const warnings = emitWarnings({
    market: input.market,
    // The near-threshold check compares the customs value, like the threshold itself.
    goods: customsValue,
    declaredValueSupplied: input.declaredValueLocal !== undefined,
    shipping,
    duty,
    above: input.market === "AU" ? above : null,
    importTax,
    registered: input.taxRegistered,
    platform: input.platform,
    adSpend: r2(input.adSpendLocal),
    shopifyHasAbn: input.shopifyHasAbn,
    deMinimis: marketRules,
  });
  if (fx.degraded) {
    warnings.push({ code: "FX_DEGRADED" });
  }

  const result: SimulationResult = {
    currency: market.currency,
    fx: { rate: fxRate.toFixed(4), asOf: fx.asOf, degraded: fx.degraded },
    breakdown,
    goodsCostLocal: goods.toFixed(2),
    inboundShipping: shipping.toFixed(2),
    duty: duty.toFixed(2),
    auAboveThreshold: input.market === "AU" ? above : null,
    importTax: importTax.toFixed(2),
    importTaxReclaimable: input.taxRegistered && importTax.gt(0),
    landedCost: landed.toFixed(2),
    sellingPriceGross: sellingPriceGross.toFixed(2),
    outputTax: outputTax.toFixed(2),
    netRevenue: netRevenue.toFixed(2),
    platformFees,
    platformFeeSubtotal: platformFeeSubtotal.toFixed(2),
    taxOnPlatformFees: feeTax.toFixed(2),
    taxOnPlatformFeesCost: feeTaxCost.toFixed(2),
    otherCosts: otherCosts.toFixed(2),
    netProfit: netProfit.toFixed(2),
    marginPct: marginPct.toFixed(2),
    verdict: verdict(netProfit, marginPct),
    monthlyFeeCoverage: null,
    warnings,
  };

  return result;
}

const NUDGE_STEP = new Decimal("0.01");
const MIN_PRICE = new Decimal("0.01");
// Spec §7.5's bounded correction: one-cent steps up from the seed.
const LINEAR_NUDGE_STEPS = 25;
// Doubling steps after that: 2^48 cents is far beyond any real price.
const MAX_GALLOP_STEPS = 48;

export function suggestPrice(
  input: Omit<SimulationInput, "sellingPriceLocal">,
  fx: FxInput,
  rules: MarketRulesType,
  targetMarginPct: number,
): { price: string; steps: number } | null {
  const market = MARKET_MODULES[input.market];
  const marketRules = rules[input.market];
  const fxRate = new Decimal(fx.rate);
  const { goods, customsValue } = goodsAndCustomsValue(input, fxRate);
  const shipping = r2(input.inboundShippingLocal);
  const dutyPct = new Decimal(input.dutyPct);
  const duty = market.computeDuty(customsValue, dutyPct);
  const above = market.isAboveThreshold(customsValue, shipping, marketRules);
  const importTax = market.computeImportTax(customsValue, shipping, duty, above);
  const landed = input.taxRegistered
    ? goods.plus(shipping).plus(duty)
    : goods.plus(shipping).plus(duty).plus(importTax);

  const k = input.taxRegistered ? new Decimal(1).div(1 + market.taxRatePct / 100) : new Decimal(1);

  const referralFeePct = new Decimal(input.referralFeePct).div(100);
  const feeTaxRate = input.taxRegistered ? new Decimal(0) : new Decimal(market.taxRatePct).div(100);
  const m = new Decimal(targetMarginPct).div(100);
  let fEff: Decimal;
  let fixedCosts: Decimal;

  switch (input.platform) {
    case "amazon": {
      const rate = referralFeePct.times(new Decimal(1).plus(feeTaxRate));
      const perItem =
        input.amazonPlan === "individual"
          ? new Decimal(marketRules.platforms.amazon.individualPerItemFee)
          : new Decimal(0);
      fEff = rate;
      fixedCosts = perItem;
      break;
    }
    case "ebay": {
      const eb = marketRules.platforms.ebay;
      const isFreeTier = input.market === "AU" && input.ebayFreeTier;

      if (isFreeTier) {
        fEff = new Decimal(0);
        fixedCosts = new Decimal(0);
        break;
      }

      const regRate =
        eb.regulatoryFeePct > 0 ? new Decimal(eb.regulatoryFeePct).div(100) : new Decimal(0);
      const perOrder = new Decimal(eb.perOrderFee.high);

      const flatFEff = referralFeePct.plus(regRate).times(new Decimal(1).plus(feeTaxRate));
      const flatFixedCosts = perOrder.times(new Decimal(1).plus(feeTaxRate));
      const flatDenominator = k.minus(flatFEff).minus(m);

      if (flatDenominator.lte(0)) {
        // Unreachable at the base rate. eBay's tiered discount only ever LOWERS the
        // effective fee above the threshold, so it can never rescue a target that's
        // already unreachable at the flat rate -- it can only reduce an overshoot for
        // a target that IS reachable. Fall through to the flat values so the normal
        // post-switch denominator<=0 check returns null.
        fEff = flatFEff;
        fixedCosts = flatFixedCosts;
        break;
      }

      if (!eb.tieredAbove) {
        fEff = flatFEff;
        fixedCosts = flatFixedCosts;
        break;
      }

      const threshold = new Decimal(eb.tieredAbove.thresholdLocal);
      const flatCandidate = r2(flatFixedCosts.plus(landed).div(flatDenominator));

      if (flatCandidate.lte(threshold)) {
        fEff = flatFEff;
        fixedCosts = flatFixedCosts;
        break;
      }

      const pctAbove = new Decimal(eb.tieredAbove.pctAbove).div(100);
      const tieredConstant = threshold.times(referralFeePct.minus(pctAbove));
      fEff = pctAbove.plus(regRate).times(new Decimal(1).plus(feeTaxRate));
      fixedCosts = tieredConstant.plus(perOrder).times(new Decimal(1).plus(feeTaxRate));
      break;
    }
    case "shopify": {
      const plan = marketRules.platforms.shopify.payments[input.shopifyPlan];
      fEff = new Decimal(plan.pct).div(100).times(new Decimal(1).plus(feeTaxRate));
      fixedCosts = new Decimal(plan.fixed);
      break;
    }
    case "woocommerce": {
      const { pct, fixed } = marketRules.platforms.woocommerce.payments;
      fEff = new Decimal(pct).div(100).times(new Decimal(1).plus(feeTaxRate));
      fixedCosts = new Decimal(fixed);
      break;
    }
    case "other":
      fEff = new Decimal(0);
      fixedCosts = new Decimal(0);
      break;
  }

  fixedCosts = fixedCosts.plus(r2(input.packagingLocal)).plus(r2(input.adSpendLocal));

  const denominator = k.minus(fEff).minus(m);

  if (denominator.lte(0)) {
    return null;
  }

  const seed = Decimal.max(r2(fixedCosts.plus(landed).div(denominator)), MIN_PRICE);
  const meets = (price: Decimal): boolean => {
    const result = calculate({ ...input, sellingPriceLocal: price.toFixed(2) }, fx, rules);
    return (
      new Decimal(result.marginPct).gte(targetMarginPct) && new Decimal(result.netProfit).gte(0)
    );
  };

  // Spec §7.5: nudge upward from the seed one cent at a time. The answer is
  // the first qualifying cent at or above the seed (golden SV cases pin this).
  for (let steps = 0; steps < LINEAR_NUDGE_STEPS; steps += 1) {
    const price = seed.plus(NUDGE_STEP.times(steps));
    if (meets(price)) return { price: price.toFixed(2), steps };
  }

  // Rounding, the eBay tier or the de minimis line can push the answer past
  // the linear nudge. Returning null there would hide a price that exists, so
  // gallop upward in doubling steps, then bisect back to the first cent.
  const lastMiss = seed.plus(NUDGE_STEP.times(LINEAR_NUDGE_STEPS - 1));
  const hit = gallopUp(lastMiss, meets);
  if (hit === null) return null;
  const price = bisectToCent(hit.miss, hit.hit, meets);
  return { price: price.toFixed(2), steps: price.minus(seed).div(NUDGE_STEP).toNumber() };
}

function gallopUp(
  from: Decimal,
  meets: (price: Decimal) => boolean,
): { miss: Decimal; hit: Decimal } | null {
  let miss = from;
  let gap = NUDGE_STEP;
  for (let i = 0; i < MAX_GALLOP_STEPS; i += 1) {
    const higher = from.plus(gap);
    if (meets(higher)) return { miss, hit: higher };
    miss = higher;
    gap = gap.times(2);
  }
  return null;
}

// Narrows a (miss, hit] range to adjacent cents and returns the hit.
function bisectToCent(
  missIn: Decimal,
  hitIn: Decimal,
  meets: (price: Decimal) => boolean,
): Decimal {
  let miss = missIn;
  let hit = hitIn;
  while (hit.minus(miss).gt(NUDGE_STEP)) {
    const mid = r2(miss.plus(hit).div(2));
    const probe = mid.eq(miss) ? miss.plus(NUDGE_STEP) : mid;
    if (meets(probe)) hit = probe;
    else miss = probe;
  }
  return hit;
}

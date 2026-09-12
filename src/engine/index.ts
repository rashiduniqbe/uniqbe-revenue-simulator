import Decimal from "decimal.js";
import { r2, assertBreakdownSums } from "./money";
import { ukModule } from "./markets/uk";
import { auModule } from "./markets/au";
import type { MarketModule } from "./markets/registry";
import { computeAmazonFees } from "./platforms/amazon";
import { computeEbayFees } from "./platforms/ebay";
import { computeShopifyFees } from "./platforms/shopify";
import { computeOtherFees } from "./platforms/other";
import { verdict } from "./verdict";
import { emitWarnings } from "./warnings";
import type { FxInput, SimulationInput, SimulationResult, BreakdownLine } from "./types";
import type { MarketRulesType } from "../lib/schemas";

const MARKET_MODULES: Record<SimulationInput["market"], MarketModule> = {
  UK: ukModule,
  AU: auModule,
};

// Compute unrounded platform fee subtotal for accurate tax calculation
function getUnroundedPlatformFeeSubtotal(
  input: SimulationInput,
  sellingPriceGross: Decimal,
  referralFeePct: Decimal,
  marketRules: MarketRulesType[SimulationInput["market"]],
): Decimal {
  switch (input.platform) {
    case "amazon": {
      const rawReferral = sellingPriceGross.times(referralFeePct).div(100);
      const minFee = new Decimal(marketRules.platforms.amazon.minReferralFee ?? 0);
      let subtotal = rawReferral.lt(minFee) ? minFee : rawReferral;
      if (input.amazonPlan === "individual") {
        subtotal = subtotal.plus(new Decimal(marketRules.platforms.amazon.individualPerItemFee));
      }
      return subtotal;
    }
    case "ebay": {
      // eBay has tiered referral fees and optional per-order fees
      if (input.market === "AU" && input.ebayFreeTier) {
        return new Decimal(0); // Free tier in AU means no referral fee
      }
      let referralFee: Decimal;
      if (
        marketRules.platforms.ebay.tieredAbove &&
        sellingPriceGross.gt(marketRules.platforms.ebay.tieredAbove.thresholdLocal)
      ) {
        const base = new Decimal(marketRules.platforms.ebay.tieredAbove.thresholdLocal);
        const excess = sellingPriceGross.minus(base);
        referralFee = base
          .times(referralFeePct)
          .div(100)
          .plus(excess.times(marketRules.platforms.ebay.tieredAbove.pctAbove).div(100));
      } else {
        referralFee = sellingPriceGross.times(referralFeePct).div(100);
      }
      let subtotal = referralFee;
      if (marketRules.platforms.ebay.regulatoryFeePct > 0) {
        subtotal = subtotal.plus(
          sellingPriceGross.times(marketRules.platforms.ebay.regulatoryFeePct).div(100),
        );
      }
      // Per-order fees are fixed amounts, not percentage-based, so add them
      const perOrderAmount = sellingPriceGross.lte(
        marketRules.platforms.ebay.perOrderFee.thresholdLocal,
      )
        ? marketRules.platforms.ebay.perOrderFee.low
        : marketRules.platforms.ebay.perOrderFee.high;
      if (perOrderAmount > 0) {
        subtotal = subtotal.plus(new Decimal(perOrderAmount));
      }
      return subtotal;
    }
    case "shopify": {
      // Shopify payment fee: percentage + fixed fee per plan
      const planFee = marketRules.platforms.shopify.payments[input.shopifyPlan];
      const percentageFee = sellingPriceGross.times(planFee.pct).div(100);
      const fixedFee = new Decimal(planFee.fixed);
      return percentageFee.plus(fixedFee);
    }
    case "other":
      return new Decimal(0);
  }
}

export function calculate(
  input: SimulationInput,
  fx: FxInput,
  rules: MarketRulesType,
): SimulationResult {
  const market = MARKET_MODULES[input.market];
  const marketRules = rules[input.market];

  const fxRate = new Decimal(fx.rate);
  const goods = r2(new Decimal(input.usd).times(fxRate));
  const shipping = r2(input.inboundShippingLocal);
  const dutyPct = new Decimal(input.dutyPct);
  const duty = market.computeDuty(goods, dutyPct);

  const above = market.isAboveThreshold(goods, shipping);
  const importTax = market.computeImportTax(goods, shipping, duty, above);

  const landed = input.taxRegistered
    ? goods.plus(shipping).plus(duty)
    : goods.plus(shipping).plus(duty).plus(importTax);

  const sellingPriceGross = r2(input.sellingPriceLocal);
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
    case "other":
      platformFees = computeOtherFees();
      break;
  }

  const platformFeeSubtotal = Object.values(platformFees).reduce((sum, v) => {
    return sum.plus(new Decimal(v));
  }, new Decimal("0")) as Decimal;

  // For tax calculation, use unrounded fees to avoid rounding accumulation that can violate monotonicity
  const unroundedFeesForTax = getUnroundedPlatformFeeSubtotal(
    input,
    sellingPriceGross,
    referralFeePct,
    marketRules,
  );
  const feeTaxBase = unroundedFeesForTax.gt(0) ? unroundedFeesForTax : platformFeeSubtotal;
  const feeTax = input._planParityDisableFeeTax
    ? r2("0")
    : r2(feeTaxBase.times(market.taxRatePct).div(100));
  const feeTaxCost = input.taxRegistered ? r2("0") : feeTax;

  const otherCosts = r2(input.packagingLocal).plus(r2(input.adSpendLocal));

  // Use rounded values for net profit calculation to ensure breakdown sums exactly
  const netProfit = netRevenue
    .minus(landed)
    .minus(platformFeeSubtotal)
    .minus(feeTaxCost)
    .minus(otherCosts);

  const marginPct = r2(netProfit.div(sellingPriceGross).times(100));

  const breakdown: BreakdownLine[] = [
    { label: "Gross selling price", amount: sellingPriceGross.toFixed(2) },
    { label: `Output ${market.taxName}`, amount: `-${outputTax.toFixed(2)}` },
    { label: "Goods cost", amount: `-${goods.toFixed(2)}` },
    { label: "Shipping", amount: `-${shipping.toFixed(2)}` },
    { label: "Import duty", amount: `-${duty.toFixed(2)}` },
    {
      label: `Import ${market.taxName}`,
      amount: input.taxRegistered ? "0.00" : `-${importTax.toFixed(2)}`,
    },
    ...Object.entries(platformFees).map(([label, amount]) => ({
      label,
      amount: `-${amount}`,
    })),
    { label: `${market.taxName} on fees`, amount: `-${feeTaxCost.toFixed(2)}` },
    { label: "Other costs", amount: `-${otherCosts.toFixed(2)}` },
  ];

  assertBreakdownSums(
    breakdown.map((l) => l.amount),
    netProfit.toFixed(2),
  );

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
    warnings: emitWarnings({
      market: input.market,
      goods,
      shipping,
      duty,
      above: input.market === "AU" ? above : null,
      importTax,
      registered: input.taxRegistered,
      platform: input.platform,
      adSpend: r2(input.adSpendLocal),
      shopifyHasAbn: input.shopifyHasAbn,
    }),
  };

  return result;
}

const MAX_NUDGE_STEPS = 25;
const NUDGE_STEP = new Decimal("0.01");

export function suggestPrice(
  input: Omit<SimulationInput, "sellingPriceLocal">,
  fx: FxInput,
  rules: MarketRulesType,
  targetMarginPct: number,
): { price: string; steps: number } | null {
  const market = MARKET_MODULES[input.market];
  const marketRules = rules[input.market];
  const fxRate = new Decimal(fx.rate);
  const goods = r2(new Decimal(input.usd).times(fxRate));
  const shipping = r2(input.inboundShippingLocal);
  const dutyPct = new Decimal(input.dutyPct);
  const duty = market.computeDuty(goods, dutyPct);
  const above = market.isAboveThreshold(goods, shipping);
  const importTax = market.computeImportTax(goods, shipping, duty, above);
  const landed = input.taxRegistered
    ? goods.plus(shipping).plus(duty)
    : goods.plus(shipping).plus(duty).plus(importTax);

  const k = input.taxRegistered ? new Decimal(1).div(1 + market.taxRatePct / 100) : new Decimal(1);

  const referralFeePct = new Decimal(input.referralFeePct).div(100);
  const feeTaxRate = input.taxRegistered ? new Decimal(0) : new Decimal(market.taxRatePct).div(100);
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
      const rate = input.ebayFreeTier ? new Decimal(0) : referralFeePct;
      fEff = rate.times(new Decimal(1).plus(feeTaxRate));
      const regFee =
        eb.regulatoryFeePct > 0 && !input.ebayFreeTier
          ? new Decimal(eb.regulatoryFeePct).div(100)
          : new Decimal(0);
      fEff = fEff.plus(regFee.times(new Decimal(1).plus(feeTaxRate)));
      fixedCosts = new Decimal(0);
      break;
    }
    case "shopify": {
      const plan = marketRules.platforms.shopify.payments[input.shopifyPlan];
      fEff = new Decimal(plan.pct).div(100).times(new Decimal(1).plus(feeTaxRate));
      fixedCosts = new Decimal(plan.fixed)
        .plus(r2(input.packagingLocal))
        .plus(r2(input.adSpendLocal));
      break;
    }
    case "other":
      fEff = new Decimal(0);
      fixedCosts = r2(input.packagingLocal).plus(r2(input.adSpendLocal));
      break;
  }

  if (input.platform !== "shopify") {
    fixedCosts = fixedCosts.plus(r2(input.packagingLocal)).plus(r2(input.adSpendLocal));
  }

  const m = new Decimal(targetMarginPct).div(100);
  const denominator = k.minus(fEff).minus(m);

  if (denominator.lte(0)) {
    return null;
  }

  let price = r2(fixedCosts.plus(landed).div(denominator));
  let steps = 0;

  while (steps < MAX_NUDGE_STEPS) {
    const result = calculate({ ...input, sellingPriceLocal: price.toFixed(2) }, fx, rules);
    const marginOk = new Decimal(result.marginPct).gte(targetMarginPct);
    const profitOk = new Decimal(result.netProfit).gte(0);
    if (marginOk && profitOk) {
      return { price: price.toFixed(2), steps };
    }
    price = price.plus(NUDGE_STEP);
    steps += 1;
  }

  return null;
}

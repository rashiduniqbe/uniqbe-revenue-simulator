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

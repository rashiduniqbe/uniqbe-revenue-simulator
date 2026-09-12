import Decimal from "decimal.js";
import type { EngineContext } from "./markets/registry";
import type { EngineWarning } from "./types";

const AU_DE_MINIMIS = new Decimal(1000);
const AU_NEAR_THRESHOLD_BAND_PCT = 5;

export function emitWarnings(ctx: EngineContext): EngineWarning[] {
  const warnings: EngineWarning[] = [];

  if (ctx.market === "AU" && ctx.above === false) {
    warnings.push({ code: "AU_BELOW_THRESHOLD" });
    const band = AU_DE_MINIMIS.times(AU_NEAR_THRESHOLD_BAND_PCT).div(100);
    if (ctx.goods.gte(AU_DE_MINIMIS.minus(band))) {
      warnings.push({ code: "AU_NEAR_THRESHOLD" });
    }
  }

  if (ctx.registered && ctx.importTax.gt(0)) {
    warnings.push({ code: "IMPORT_TAX_CASHFLOW" });
  }

  warnings.push({ code: "CUSTOMS_DECLARED_VALUE_UNCONFIRMED" });

  if (ctx.importTax.gt(0) || ctx.duty.gt(0)) {
    warnings.push({ code: "DOORSTEP_LIABILITY" });
  }

  if (ctx.platform === "shopify" && ctx.adSpend.eq(0)) {
    warnings.push({ code: "SHOPIFY_NO_AUDIENCE" });
  }

  if (ctx.market === "AU" && ctx.platform === "shopify" && !ctx.shopifyHasAbn) {
    warnings.push({ code: "SHOPIFY_AU_GST_ON_SUB" });
  }

  warnings.push({ code: "NOT_TAX_ADVICE" });

  return warnings;
}

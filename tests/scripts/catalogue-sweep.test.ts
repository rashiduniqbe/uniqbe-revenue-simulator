import { describe, expect, it } from "vitest";
import catalogueRaw from "../../src/data/catalogue.json";
import rulesRaw from "../../src/data/market-rules.json";
import fxSeedRaw from "../../src/data/fx-seed.json";
import { Catalogue, FxRawSnapshot, MarketRules } from "../../src/lib/schemas";
import { toFxSnapshot } from "../../src/fx/store";
import { calculate, suggestPrice } from "../../src/engine";
import { buildMarketInput, fxInputFor } from "../../src/lib/compare";
import type { Market, Platform, SimulationInput } from "../../src/engine/types";

const catalogue = Catalogue.parse(catalogueRaw);
const rules = MarketRules.parse(rulesRaw);
const fx = toFxSnapshot(FxRawSnapshot.parse(fxSeedRaw), new Date("2026-08-25T12:00:00.000Z"));

const MARKETS: Market[] = ["UK", "AU"];
const PLATFORMS: Platform[] = ["amazon", "ebay", "shopify", "other"];
const FREIGHTS = ["0.00", "20.00", "50.00"];
const REGISTERED = [false, true];
const TARGET_MARGIN_PCT = 20;
const FALLBACK_PRICE_MULTIPLE = 3;
const BAD_VALUE = /NaN|Infinity|"-0\.00"/;

function withoutPrice(input: SimulationInput): Omit<SimulationInput, "sellingPriceLocal"> {
  const {
    market,
    productCode,
    usd,
    category,
    platform,
    taxRegistered,
    inboundShippingLocal,
    packagingLocal,
    adSpendLocal,
    dutyPct,
    referralFeePct,
    amazonPlan,
    shopifyPlan,
    shopifyHasAbn,
    ebayFreeTier,
    _planParityDisableFeeTax,
  } = input;
  return {
    market,
    productCode,
    usd,
    category,
    platform,
    taxRegistered,
    inboundShippingLocal,
    packagingLocal,
    adSpendLocal,
    dutyPct,
    referralFeePct,
    amazonPlan,
    shopifyPlan,
    shopifyHasAbn,
    ebayFreeTier,
    _planParityDisableFeeTax,
  };
}

// Iterates whatever the current catalogue contains — never asserts a count (AGENTS 3b).
describe("full-catalogue sweep (T-34)", () => {
  it("every product x market x platform x freight x registration calculates cleanly", () => {
    const failures: string[] = [];
    for (const item of catalogue.items) {
      for (const market of MARKETS) {
        const fxInput = fxInputFor(fx, market);
        for (const platform of PLATFORMS) {
          for (const freight of FREIGHTS) {
            for (const taxRegistered of REGISTERED) {
              const where = `${item.code}/${market}/${platform}/freight=${freight}/reg=${taxRegistered}`;
              try {
                const base: SimulationInput = {
                  ...buildMarketInput(item, market, platform, "1.00", rules),
                  inboundShippingLocal: freight,
                  taxRegistered,
                };
                const suggested = suggestPrice(
                  withoutPrice(base),
                  fxInput,
                  rules,
                  TARGET_MARGIN_PCT,
                );
                const price =
                  suggested?.price ??
                  (item.usd * Number(fxInput.rate) * FALLBACK_PRICE_MULTIPLE).toFixed(2);
                const result = calculate({ ...base, sellingPriceLocal: price }, fxInput, rules);

                if (BAD_VALUE.test(JSON.stringify(result))) failures.push(`${where}: bad value`);
                if (market === "AU") {
                  if (result.auAboveThreshold === null) {
                    failures.push(`${where}: AU result has no threshold branch`);
                  }
                  const below = result.warnings.some((w) => w.code === "AU_BELOW_THRESHOLD");
                  if (below !== (result.auAboveThreshold === false)) {
                    failures.push(`${where}: threshold warning disagrees with branch`);
                  }
                } else if (result.auAboveThreshold !== null) {
                  failures.push(`${where}: UK result carries an AU threshold branch`);
                }
              } catch (err) {
                failures.push(`${where}: threw ${(err as Error).message}`);
              }
            }
          }
        }
      }
    }
    expect(failures).toEqual([]);
  }, 180_000);
});

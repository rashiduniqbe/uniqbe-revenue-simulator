import { describe, expect, it } from "vitest";
import catalogueRaw from "../../../src/data/catalogue.json";
import rulesRaw from "../../../src/data/market-rules.json";
import { Catalogue, MarketRules } from "../../../src/lib/schemas";
import { calculate } from "../../../src/engine";
import { buildPrototypeInput } from "../../../src/lib/prototype-input";
import { toDisplay, type DisplayCurrency } from "../../../src/lib/display-currency";
import { decodeScenario } from "../../../src/lib/url-state";
import {
  SIM_PLATFORMS,
  simulateProduct,
  type SimContext,
  type SimSettings,
} from "../../../src/lib/simulation/simulate";
import { checkRowQuery, resolveView } from "../../../src/lib/simulation/view-state";

const catalogue = Catalogue.parse(catalogueRaw);
const rules = MarketRules.parse(rulesRaw);
const rates = { AUD: 1.4579, HKD: 7.845 };
const ctx: SimContext = {
  rules,
  fx: { rate: String(rates.AUD), asOf: "2026-11-11", degraded: false },
  rates,
};

const settings = (over: Partial<SimSettings> = {}): SimSettings => ({
  targetMarginPct: 8,
  taxRegistered: true,
  currency: "AUD",
  inboundShipping: "12.00",
  packaging: "2.50",
  adSpend: "30.00",
  ...over,
});

// Writes the query the way nuqs would (every value as a string) over a URL
// that already carries leftovers from an earlier calculator session.
function urlAfterCheck(query: Record<string, string | boolean>): URLSearchParams {
  const params = new URLSearchParams(
    "m=UK&du=7&rf=15&ap=individual&shp=grow&abn=true&et=true&cc=999&dv=1",
  );
  for (const [key, value] of Object.entries(query)) {
    if (value === "") params.delete(key);
    else params.set(key, String(value));
  }
  return params;
}

describe("checkRowQuery", () => {
  it("switches to the calculator with the row's product, platform and price", () => {
    const q = checkRowQuery("AP00001", settings(), "ebay", "1234.56");
    expect(q).toMatchObject({ v: "calc", m: "AU", p: "AP00001", pl: "ebay", sp: "1234.56" });
  });

  it("carries ad spend only to Shopify and WooCommerce", () => {
    expect(checkRowQuery("AP00001", settings(), "amazon", "10").ad).toBe("0.00");
    expect(checkRowQuery("AP00001", settings(), "woocommerce", "10").ad).toBe("30.00");
  });

  it("clears overrides and plan choices the simulation does not use", () => {
    expect(checkRowQuery("AP00001", settings(), "amazon", "10")).toMatchObject({
      du: "",
      rf: "",
      cc: "",
      dv: "",
      ap: "professional",
      shp: "basic",
      abn: false,
      et: false,
    });
  });

  const currencies: DisplayCurrency[] = ["AUD", "USD", "HKD"];
  for (const currency of currencies) {
    it(`reopens in the calculator with the cell's profit to the cent (${currency})`, () => {
      const item = catalogue.items[0];
      if (!item) throw new Error("catalogue has no items");
      const s = settings({ currency });
      const row = simulateProduct(item, s, ctx);
      for (const platform of SIM_PLATFORMS) {
        const cell = row.cells[platform];
        if (!cell) throw new Error(`no cell for ${platform}`);
        const url = urlAfterCheck(checkRowQuery(item.code, s, platform, cell.price));
        expect(resolveView(url)).toBe("calc");
        const scenario = { ...decodeScenario(url), market: "AU" as const };
        const overrides = { customCost: url.get("cc") ?? "", declaredValue: url.get("dv") ?? "" };
        const input = buildPrototypeInput(scenario, item, rules, currency, rates, overrides);
        const r = calculate(input!, ctx.fx, rules);
        expect(toDisplay(r.netProfit, rates, currency)).toBe(cell.netProfit);
        expect(r.marginPct).toBe(cell.marginPct);
      }
    });
  }
});

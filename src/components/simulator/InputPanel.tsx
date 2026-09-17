"use client";

import type { ScenarioParams } from "../../lib/url-state";
import type { MarketRulesType, CategorySlugType } from "../../lib/schemas";

interface InputPanelProps {
  scenario: ScenarioParams;
  onChange: (next: ScenarioParams) => void;
  rules: MarketRulesType;
  category: CategorySlugType | null;
}

export function InputPanel({ scenario, onChange, rules, category }: InputPanelProps) {
  const marketRules = rules[scenario.market];

  function set<K extends keyof ScenarioParams>(key: K, value: ScenarioParams[K]) {
    onChange({ ...scenario, [key]: value });
  }

  function onPlatformChange(platform: ScenarioParams["platform"]) {
    const platformFees = marketRules.platforms[platform];
    let referralDefault = scenario.referralFeePct;
    if (category && "referralFeePctByCategory" in platformFees) {
      referralDefault = String(platformFees.referralFeePctByCategory[category]);
    } else if ("referralFeePctDefault" in platformFees) {
      referralDefault = String(platformFees.referralFeePctDefault);
    }
    // Ad spend is only ever shown/editable on Shopify, but calculate()
    // deducts it unconditionally regardless of platform. Reset it so a
    // value entered on Shopify doesn't silently keep costing profit after
    // switching away to a platform with no visible field for it.
    const adSpendLocal = platform === "shopify" ? scenario.adSpendLocal : "0.00";
    onChange({ ...scenario, platform, referralFeePct: referralDefault, adSpendLocal });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor="platform" className="text-sm font-medium">
          Platform
        </label>
        <select
          id="platform"
          className="block rounded border border-neutral-300 px-3 py-2 text-sm"
          value={scenario.platform}
          onChange={(event) => onPlatformChange(event.target.value as ScenarioParams["platform"])}
        >
          <option value="amazon">Amazon</option>
          <option value="ebay">eBay</option>
          <option value="shopify">Shopify</option>
          <option value="other">Other</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={scenario.taxRegistered}
          onChange={(event) => set("taxRegistered", event.target.checked)}
        />
        {marketRules.consumptionTaxName}-registered?
      </label>

      <div>
        <label htmlFor="selling-price" className="text-sm font-medium">
          Selling price
        </label>
        <input
          id="selling-price"
          type="text"
          inputMode="decimal"
          className="block rounded border border-neutral-300 px-3 py-2 text-sm font-mono"
          value={scenario.sellingPriceLocal}
          onChange={(event) => set("sellingPriceLocal", event.target.value)}
        />
      </div>

      <div>
        <label htmlFor="shipping" className="text-sm font-medium">
          Shipping
        </label>
        <input
          id="shipping"
          type="text"
          inputMode="decimal"
          className="block rounded border border-neutral-300 px-3 py-2 text-sm font-mono"
          value={scenario.inboundShippingLocal}
          onChange={(event) => set("inboundShippingLocal", event.target.value)}
        />
      </div>

      <div>
        <label htmlFor="packaging" className="text-sm font-medium">
          Packaging
        </label>
        <input
          id="packaging"
          type="text"
          inputMode="decimal"
          className="block rounded border border-neutral-300 px-3 py-2 text-sm font-mono"
          value={scenario.packagingLocal}
          onChange={(event) => set("packagingLocal", event.target.value)}
        />
      </div>

      {scenario.platform === "shopify" && (
        <div>
          <label htmlFor="ad-spend" className="text-sm font-medium">
            Ad spend
          </label>
          <input
            id="ad-spend"
            type="text"
            inputMode="decimal"
            className="block rounded border border-neutral-300 px-3 py-2 text-sm font-mono"
            value={scenario.adSpendLocal}
            onChange={(event) => set("adSpendLocal", event.target.value)}
          />
        </div>
      )}

      <div>
        <label htmlFor="duty-pct" className="text-sm font-medium">
          Duty %
        </label>
        <input
          id="duty-pct"
          type="text"
          inputMode="decimal"
          className="block rounded border border-neutral-300 px-3 py-2 text-sm font-mono"
          value={scenario.dutyPct}
          onChange={(event) => set("dutyPct", event.target.value)}
        />
      </div>

      <div>
        <label htmlFor="referral-fee-pct" className="text-sm font-medium">
          Referral fee %
        </label>
        <input
          id="referral-fee-pct"
          type="text"
          inputMode="decimal"
          className="block rounded border border-neutral-300 px-3 py-2 text-sm font-mono"
          value={scenario.referralFeePct}
          onChange={(event) => set("referralFeePct", event.target.value)}
        />
      </div>
    </div>
  );
}

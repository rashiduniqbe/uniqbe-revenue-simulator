"use client";

import { useRef } from "react";
import type { ScenarioParams } from "../../lib/url-state";
import type { MarketRulesType, CategorySlugType } from "../../lib/schemas";
import { deriveReferralFeeDefault } from "../../lib/scenario-defaults";
import { useAdoptTypedValues } from "./useAdoptTypedValues";

interface InputPanelProps {
  scenario: ScenarioParams;
  onChange: (next: ScenarioParams) => void;
  rules: MarketRulesType;
  category: CategorySlugType | null;
}

export function InputPanel({ scenario, onChange, rules, category }: InputPanelProps) {
  const marketRules = rules[scenario.market];
  const textRefs = {
    sellingPriceLocal: useRef<HTMLInputElement>(null),
    inboundShippingLocal: useRef<HTMLInputElement>(null),
    packagingLocal: useRef<HTMLInputElement>(null),
    adSpendLocal: useRef<HTMLInputElement>(null),
    dutyPct: useRef<HTMLInputElement>(null),
    referralFeePct: useRef<HTMLInputElement>(null),
  };
  useAdoptTypedValues(
    textRefs,
    {
      sellingPriceLocal: scenario.sellingPriceLocal,
      inboundShippingLocal: scenario.inboundShippingLocal,
      packagingLocal: scenario.packagingLocal,
      adSpendLocal: scenario.adSpendLocal,
      dutyPct: scenario.dutyPct,
      referralFeePct: scenario.referralFeePct,
    },
    (typed) => onChange({ ...scenario, ...typed }),
  );

  function set<K extends keyof ScenarioParams>(key: K, value: ScenarioParams[K]) {
    onChange({ ...scenario, [key]: value });
  }

  function onPlatformChange(platform: ScenarioParams["platform"]) {
    const referralDefault = category
      ? deriveReferralFeeDefault(rules, scenario.market, platform, category)
      : scenario.referralFeePct;
    // calculate() deducts adSpendLocal unconditionally regardless of platform, and
    // ebayFreeTier/shopifyHasAbn only apply on their own platform — so a value left
    // over from a previous platform would silently keep affecting the result (e.g.
    // ad spend entered on Shopify still costing profit after switching to Amazon).
    // Reset all three whenever they no longer apply to the newly selected platform.
    const adSpendLocal = platform === "shopify" ? scenario.adSpendLocal : "0.00";
    const ebayFreeTier = platform === "ebay" ? scenario.ebayFreeTier : false;
    const shopifyHasAbn = platform === "shopify" ? scenario.shopifyHasAbn : false;
    onChange({
      ...scenario,
      platform,
      referralFeePct: referralDefault,
      adSpendLocal,
      ebayFreeTier,
      shopifyHasAbn,
    });
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
          ref={textRefs.sellingPriceLocal}
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
          ref={textRefs.inboundShippingLocal}
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
          ref={textRefs.packagingLocal}
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
            ref={textRefs.adSpendLocal}
            type="text"
            inputMode="decimal"
            className="block rounded border border-neutral-300 px-3 py-2 text-sm font-mono"
            value={scenario.adSpendLocal}
            onChange={(event) => set("adSpendLocal", event.target.value)}
          />
        </div>
      )}

      {scenario.market === "AU" && scenario.platform === "ebay" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={scenario.ebayFreeTier}
            onChange={(event) => set("ebayFreeTier", event.target.checked)}
          />
          eBay free tier (trailing sales ≤ A$25,000)?
        </label>
      )}

      {scenario.market === "AU" && scenario.platform === "shopify" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={scenario.shopifyHasAbn}
            onChange={(event) => set("shopifyHasAbn", event.target.checked)}
          />
          Have an ABN on file?
        </label>
      )}

      <div>
        <label htmlFor="duty-pct" className="text-sm font-medium">
          Duty %
        </label>
        <input
          id="duty-pct"
          ref={textRefs.dutyPct}
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
          ref={textRefs.referralFeePct}
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

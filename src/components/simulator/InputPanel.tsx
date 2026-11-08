"use client";

import { useRef } from "react";
import type { ScenarioParams } from "../../lib/url-state";
import type { MarketRulesType, CategorySlugType } from "../../lib/schemas";
import { deriveReferralFeeDefault } from "../../lib/scenario-defaults";
import { useAdoptTypedValues } from "./useAdoptTypedValues";
import { MONO_INPUT_CLASS, TEXT_INPUT_CLASS } from "./control-classes";

interface InputPanelProps {
  scenario: ScenarioParams;
  onChange: (next: ScenarioParams) => void;
  rules: MarketRulesType;
  category: CategorySlugType | null;
}

const LABEL_CLASS = "text-sm font-medium";
const CHECKBOX_ROW_CLASS = "flex min-h-11 items-center justify-center gap-2 text-sm sm:col-span-2";

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
    <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="flex min-w-0 flex-col gap-1 text-center">
        <label htmlFor="selling-price" className={LABEL_CLASS}>
          Selling price
        </label>
        <input
          id="selling-price"
          ref={textRefs.sellingPriceLocal}
          type="text"
          inputMode="decimal"
          className={`${MONO_INPUT_CLASS} text-center`}
          value={scenario.sellingPriceLocal}
          onChange={(event) => set("sellingPriceLocal", event.target.value)}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1 text-center">
        <label htmlFor="shipping" className={LABEL_CLASS}>
          Shipping
        </label>
        <input
          id="shipping"
          ref={textRefs.inboundShippingLocal}
          type="text"
          inputMode="decimal"
          className={`${MONO_INPUT_CLASS} text-center`}
          value={scenario.inboundShippingLocal}
          onChange={(event) => set("inboundShippingLocal", event.target.value)}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1 text-center">
        <label htmlFor="packaging" className={LABEL_CLASS}>
          Packaging
        </label>
        <input
          id="packaging"
          ref={textRefs.packagingLocal}
          type="text"
          inputMode="decimal"
          className={`${MONO_INPUT_CLASS} text-center`}
          value={scenario.packagingLocal}
          onChange={(event) => set("packagingLocal", event.target.value)}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1 text-center">
        <label htmlFor="duty-pct" className={LABEL_CLASS}>
          Duty %
        </label>
        <input
          id="duty-pct"
          ref={textRefs.dutyPct}
          type="text"
          inputMode="decimal"
          className={`${MONO_INPUT_CLASS} text-center`}
          value={scenario.dutyPct}
          onChange={(event) => set("dutyPct", event.target.value)}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1 text-center">
        <label htmlFor="platform" className={LABEL_CLASS}>
          Platform
        </label>
        <select
          id="platform"
          className={`${TEXT_INPUT_CLASS} text-center`}
          value={scenario.platform}
          onChange={(event) => onPlatformChange(event.target.value as ScenarioParams["platform"])}
        >
          <option value="amazon">Amazon</option>
          <option value="ebay">eBay</option>
          <option value="shopify">Shopify</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="flex min-w-0 flex-col gap-1 text-center">
        <label htmlFor="referral-fee-pct" className={LABEL_CLASS}>
          Referral fee %
        </label>
        <input
          id="referral-fee-pct"
          ref={textRefs.referralFeePct}
          type="text"
          inputMode="decimal"
          className={`${MONO_INPUT_CLASS} text-center`}
          value={scenario.referralFeePct}
          onChange={(event) => set("referralFeePct", event.target.value)}
        />
      </div>
      {scenario.platform === "shopify" && (
        <div className="flex min-w-0 flex-col gap-1 text-center">
          <label htmlFor="ad-spend" className={LABEL_CLASS}>
            Ad spend
          </label>
          <input
            id="ad-spend"
            ref={textRefs.adSpendLocal}
            type="text"
            inputMode="decimal"
            className={`${MONO_INPUT_CLASS} text-center`}
            value={scenario.adSpendLocal}
            onChange={(event) => set("adSpendLocal", event.target.value)}
          />
        </div>
      )}
      <label className={CHECKBOX_ROW_CLASS}>
        <input
          type="checkbox"
          className="size-5"
          checked={scenario.taxRegistered}
          onChange={(event) => set("taxRegistered", event.target.checked)}
        />
        {marketRules.consumptionTaxName}-registered?
      </label>
      {scenario.market === "AU" && scenario.platform === "ebay" && (
        <label className={CHECKBOX_ROW_CLASS}>
          <input
            type="checkbox"
            className="size-5"
            checked={scenario.ebayFreeTier}
            onChange={(event) => set("ebayFreeTier", event.target.checked)}
          />
          eBay free tier (trailing sales ≤ A$25,000)?
        </label>
      )}
      {scenario.market === "AU" && scenario.platform === "shopify" && (
        <label className={CHECKBOX_ROW_CLASS}>
          <input
            type="checkbox"
            className="size-5"
            checked={scenario.shopifyHasAbn}
            onChange={(event) => set("shopifyHasAbn", event.target.checked)}
          />
          Have an ABN on file?
        </label>
      )}
    </div>
  );
}

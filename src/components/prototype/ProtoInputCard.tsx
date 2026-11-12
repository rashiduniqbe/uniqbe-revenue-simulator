"use client";

import { useMemo, useRef, useState } from "react";
import type { Platform } from "../../engine/types";
import type { LiveItemType, MarketRulesType } from "../../lib/schemas";
import type { ScenarioParams } from "../../lib/url-state";
import { filterProducts } from "../../lib/search";
import {
  deriveDutyPctDefault,
  deriveReferralFeeDefault,
  withPlatform,
} from "../../lib/scenario-defaults";
import { formatMoney, toAud, toDisplay, type DisplayCurrency } from "../../lib/display-currency";
import { useAdoptTypedValues } from "../simulator/useAdoptTypedValues";
import { MoneyField, Segmented } from "./controls";
import styles from "./proto.module.css";

export interface CostOverrides {
  customCost: string;
  declaredValue: string;
}

// Long lists make the dropdown sluggish to scroll; refine the query instead.
const MAX_RESULTS = 50;

const PLATFORM_OPTIONS = [
  { value: "amazon", label: "Amazon" },
  { value: "ebay", label: "eBay" },
  { value: "shopify", label: "Shopify" },
  { value: "other", label: "Other" },
] as const;

const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] as const;

const toYesNo = (flag: boolean) => (flag ? "yes" : "no");

interface ProtoInputCardProps {
  items: LiveItemType[];
  selectedItem: LiveItemType | null;
  onSelectProduct: (code: string) => void;
  scenario: ScenarioParams;
  onChange: (next: ScenarioParams) => void;
  rules: MarketRulesType;
  currency: DisplayCurrency;
  rates: { AUD: number; HKD?: number };
  overrides: CostOverrides;
  onOverridesChange: (next: Partial<CostOverrides>) => void;
}

export function ProtoInputCard({
  items,
  selectedItem,
  onSelectProduct,
  scenario,
  onChange,
  rules,
  currency,
  rates,
  overrides,
  onOverridesChange,
}: ProtoInputCardProps) {
  // The storeprice dropship price (USD) expressed in the chosen currency, 2 dp.
  const storeCost = selectedItem
    ? (toDisplay(toAud(String(selectedItem.usd), rates, "USD") ?? "0", rates, currency) ?? null)
    : null;
  const overrideRefs = {
    customCost: useRef<HTMLInputElement>(null),
    declaredValue: useRef<HTMLInputElement>(null),
  };
  useAdoptTypedValues(overrideRefs, overrides, onOverridesChange);
  const refs = {
    sellingPriceLocal: useRef<HTMLInputElement>(null),
    inboundShippingLocal: useRef<HTMLInputElement>(null),
    packagingLocal: useRef<HTMLInputElement>(null),
    adSpendLocal: useRef<HTMLInputElement>(null),
    dutyPct: useRef<HTMLInputElement>(null),
    referralFeePct: useRef<HTMLInputElement>(null),
  };
  useAdoptTypedValues(
    refs,
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

  return (
    <aside className={styles.card} aria-label="Calculator inputs">
      <div className={styles.section}>
        <ProductSearch
          items={items}
          selectedItem={selectedItem}
          onSelect={onSelectProduct}
          storeCostText={
            storeCost !== null && currency !== "USD" ? formatMoney(storeCost, currency) : null
          }
        />
        {selectedItem && (
          <MoneyField
            id="proto-custom-cost"
            label={`Custom product price (${currency})`}
            placeholder={storeCost ?? undefined}
            hint="Your cost per unit. Leave blank to use the Uniqbe dropship price."
            inputRef={overrideRefs.customCost}
            value={overrides.customCost}
            onChange={(v) => onOverridesChange({ customCost: v })}
          />
        )}
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Selling</h2>
        <Segmented
          label="Platform"
          options={PLATFORM_OPTIONS}
          value={scenario.platform}
          onChange={(platform: Platform) =>
            onChange(withPlatform(scenario, platform, rules, selectedItem?.category ?? null))
          }
        />
        <MoneyField
          id="proto-selling-price"
          label={`Selling price (${currency}, incl. GST)`}
          placeholder="0.00"
          inputRef={refs.sellingPriceLocal}
          value={scenario.sellingPriceLocal}
          onChange={(v) => set("sellingPriceLocal", v)}
        />
        <div className={styles.pair}>
          <MoneyField
            id="proto-shipping"
            label={`Shipping (${currency})`}
            inputRef={refs.inboundShippingLocal}
            value={scenario.inboundShippingLocal}
            onChange={(v) => set("inboundShippingLocal", v)}
          />
          <MoneyField
            id="proto-packaging"
            label={`Packaging (${currency})`}
            inputRef={refs.packagingLocal}
            value={scenario.packagingLocal}
            onChange={(v) => set("packagingLocal", v)}
          />
        </div>
        {scenario.platform === "shopify" && (
          <MoneyField
            id="proto-ad-spend"
            label={`Ad spend per sale (${currency})`}
            inputRef={refs.adSpendLocal}
            value={scenario.adSpendLocal}
            onChange={(v) => set("adSpendLocal", v)}
          />
        )}
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Tax and fees</h2>
        <div className={styles.pair}>
          <MoneyField
            id="proto-duty"
            label="Duty %"
            placeholder={
              selectedItem ? deriveDutyPctDefault(rules, "AU", selectedItem.category) : undefined
            }
            inputRef={refs.dutyPct}
            value={scenario.dutyPct}
            onChange={(v) => set("dutyPct", v)}
          />
          <MoneyField
            id="proto-referral"
            label="Referral fee %"
            placeholder={
              selectedItem
                ? deriveReferralFeeDefault(rules, "AU", scenario.platform, selectedItem.category)
                : undefined
            }
            inputRef={refs.referralFeePct}
            value={scenario.referralFeePct}
            onChange={(v) => set("referralFeePct", v)}
          />
        </div>
        <MoneyField
          id="proto-declared-value"
          label={`Customs declared value (${currency})`}
          placeholder="Same as product price"
          hint="Value declared to customs. The A$1,000 GST test, duty and import GST use it. Leave blank to use your product price."
          inputRef={overrideRefs.declaredValue}
          value={overrides.declaredValue}
          onChange={(v) => onOverridesChange({ declaredValue: v })}
        />
        <Segmented
          label="GST registered"
          options={YES_NO}
          value={toYesNo(scenario.taxRegistered)}
          onChange={(v) => set("taxRegistered", v === "yes")}
        />
        {scenario.platform === "ebay" && (
          <Segmented
            label="eBay free tier (sales ≤ A$25,000)"
            options={YES_NO}
            value={toYesNo(scenario.ebayFreeTier)}
            onChange={(v) => set("ebayFreeTier", v === "yes")}
          />
        )}
        {scenario.platform === "shopify" && (
          <Segmented
            label="ABN on file"
            options={YES_NO}
            value={toYesNo(scenario.shopifyHasAbn)}
            onChange={(v) => set("shopifyHasAbn", v === "yes")}
          />
        )}
      </div>
    </aside>
  );
}

interface ProductSearchProps {
  items: LiveItemType[];
  selectedItem: LiveItemType | null;
  onSelect: (code: string) => void;
  storeCostText: string | null;
}

function ProductSearch({ items, selectedItem, onSelect, storeCostText }: ProductSearchProps) {
  const [query, setQuery] = useState("");
  const queryRef = useRef<HTMLInputElement>(null);
  useAdoptTypedValues({ query: queryRef }, { query }, (typed) => {
    if (typed.query !== undefined) setQuery(typed.query);
  });
  const matches = useMemo(() => filterProducts(items, query), [items, query]);
  const shown = matches.slice(0, MAX_RESULTS);
  const hasQuery = query.trim() !== "";
  const status = !hasQuery
    ? ""
    : matches.length === 0
      ? "No products match."
      : `${matches.length} ${matches.length === 1 ? "product matches" : "products match"}.`;

  return (
    <div className={styles.field}>
      <label htmlFor="proto-product" className={styles.label}>
        Product
      </label>
      <input
        id="proto-product"
        ref={queryRef}
        type="search"
        autoComplete="off"
        className={styles.input}
        placeholder="Search by name or SKU"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <p aria-live="polite" className="sr-only" data-testid="proto-product-status">
        {status}
      </p>
      {hasQuery && (
        <ul className={styles.results}>
          {shown.length === 0 ? (
            <li className={styles.option}>No products match &ldquo;{query}&rdquo;.</li>
          ) : (
            shown.map((item) => (
              <li key={item.code}>
                <button
                  type="button"
                  className={styles.option}
                  onClick={() => {
                    onSelect(item.code);
                    setQuery("");
                  }}
                >
                  <span>{item.name}</span>
                  <span className={`${styles.optionMeta} ${styles.mono}`}>
                    {item.code} · {formatMoney(String(item.usd), "USD")}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {selectedItem && (
        <div className={styles.selected} data-testid="proto-selected-product">
          <div>{selectedItem.name}</div>
          <div className={`${styles.optionMeta} ${styles.mono}`}>
            {selectedItem.code} · {selectedItem.categoryLabel} · dropship{" "}
            {formatMoney(String(selectedItem.usd), "USD")}
            {storeCostText && ` ≈ ${storeCostText}`}
          </div>
        </div>
      )}
    </div>
  );
}

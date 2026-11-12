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
import { formatMoney } from "../../lib/display-currency";
import { useAdoptTypedValues } from "../simulator/useAdoptTypedValues";
import { MoneyField, Segmented } from "./controls";
import styles from "./proto.module.css";

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
}

export function ProtoInputCard({
  items,
  selectedItem,
  onSelectProduct,
  scenario,
  onChange,
  rules,
}: ProtoInputCardProps) {
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
        <ProductSearch items={items} selectedItem={selectedItem} onSelect={onSelectProduct} />
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
          label="Selling price (AUD, incl. GST)"
          placeholder="0.00"
          inputRef={refs.sellingPriceLocal}
          value={scenario.sellingPriceLocal}
          onChange={(v) => set("sellingPriceLocal", v)}
        />
        <div className={styles.pair}>
          <MoneyField
            id="proto-shipping"
            label="Shipping (AUD)"
            inputRef={refs.inboundShippingLocal}
            value={scenario.inboundShippingLocal}
            onChange={(v) => set("inboundShippingLocal", v)}
          />
          <MoneyField
            id="proto-packaging"
            label="Packaging (AUD)"
            inputRef={refs.packagingLocal}
            value={scenario.packagingLocal}
            onChange={(v) => set("packagingLocal", v)}
          />
        </div>
        {scenario.platform === "shopify" && (
          <MoneyField
            id="proto-ad-spend"
            label="Ad spend per sale (AUD)"
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
}

function ProductSearch({ items, selectedItem, onSelect }: ProductSearchProps) {
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
          </div>
        </div>
      )}
    </div>
  );
}

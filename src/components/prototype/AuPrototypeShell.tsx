"use client";

import { parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";
import type { FxSnapshotType, LiveItemType, MarketRulesType } from "../../lib/schemas";
import type { SkippedRow } from "../../lib/storeprice/parse";
import { DEFAULT_SCENARIO, useScenario, type ScenarioParams } from "../../lib/url-state";
import { deriveDutyPctDefault, deriveReferralFeeDefault } from "../../lib/scenario-defaults";
import { fxInputFor } from "../../lib/compare";
import { formatFxBadgeText } from "../../lib/fx-format";
import {
  DISPLAY_CURRENCIES,
  convertAmount,
  type DisplayCurrency,
} from "../../lib/display-currency";
import { buildPrototypeInput } from "../../lib/prototype-input";
import { calculate } from "../../engine";
import { Segmented } from "./controls";
import { ProtoInputCard, type CostOverrides } from "./ProtoInputCard";
import { ProtoResultCard } from "./ProtoResultCard";
import styles from "./proto.module.css";

// Prototype-only URL state: the page currency (every money field and result is
// in it; default USD), the custom product price and the customs declared value.
const prototypeParsers = {
  cur: parseAsStringEnum(["USD", "AUD", "HKD"] as const).withDefault("USD"),
  cc: parseAsString.withDefault(""),
  dv: parseAsString.withDefault(""),
};

interface AuPrototypeShellProps {
  items: LiveItemType[];
  skipped: SkippedRow[];
  fetchedAt: string;
  rules: MarketRulesType;
  fx: FxSnapshotType;
}

// The prototype is AU-only: whatever the URL says, the market is pinned.
function pinAu(scenario: ScenarioParams): ScenarioParams {
  return { ...scenario, market: "AU" };
}

export function AuPrototypeShell({ items, skipped, fetchedAt, rules, fx }: AuPrototypeShellProps) {
  const [rawScenario, setRawScenario] = useScenario();
  const scenario = pinAu(rawScenario);
  const setScenario = (next: ScenarioParams) => setRawScenario(pinAu(next));
  const [extra, setExtra] = useQueryStates(prototypeParsers);
  // An HKD link opened while no HKD rate is available falls back to USD.
  const currency: DisplayCurrency =
    extra.cur === "HKD" && fx.rates.HKD === undefined ? "USD" : extra.cur;
  const overrides: CostOverrides = { customCost: extra.cc, declaredValue: extra.dv };

  const selectedItem = items.find((item) => item.code === scenario.productCode) ?? null;
  const input = selectedItem
    ? buildPrototypeInput(scenario, selectedItem, rules, currency, fx.rates, overrides)
    : null;
  const result = input ? calculate(input, fxInputFor(fx, "AU"), rules) : null;

  function selectProduct(code: string) {
    const item = items.find((i) => i.code === code);
    if (!item) return;
    setScenario({
      ...scenario,
      productCode: code,
      dutyPct: deriveDutyPctDefault(rules, "AU", item.category),
      referralFeePct: deriveReferralFeeDefault(rules, "AU", scenario.platform, item.category),
    });
    // A custom price or declared value belongs to the product it was typed for.
    void setExtra({ cc: "", dv: "" });
  }

  // Keep what the partner typed worth the same when they switch currency.
  function changeCurrency(next: DisplayCurrency) {
    const convert = (value: string) => convertAmount(value, fx.rates, currency, next);
    setScenario({
      ...scenario,
      sellingPriceLocal: convert(scenario.sellingPriceLocal),
      inboundShippingLocal: convert(scenario.inboundShippingLocal),
      packagingLocal: convert(scenario.packagingLocal),
      adSpendLocal: convert(scenario.adSpendLocal),
    });
    void setExtra({ cur: next, cc: convert(extra.cc), dv: convert(extra.dv) });
  }

  return (
    <div className={styles.root}>
      <div className={styles.wrap}>
        <ProtoHeader
          fx={fx}
          fetchedAt={fetchedAt}
          skipped={skipped}
          currency={currency}
          onCurrencyChange={changeCurrency}
        />
        <div className={styles.layout}>
          <ProtoInputCard
            items={items}
            selectedItem={selectedItem}
            onSelectProduct={selectProduct}
            scenario={scenario}
            onChange={setScenario}
            rules={rules}
            currency={currency}
            rates={fx.rates}
            overrides={overrides}
            onOverridesChange={(next) =>
              void setExtra({
                ...(next.customCost === undefined ? {} : { cc: next.customCost }),
                ...(next.declaredValue === undefined ? {} : { dv: next.declaredValue }),
              })
            }
          />
          <ProtoResultCard
            result={result}
            currency={currency}
            rates={fx.rates}
            thresholdLocal={rules.AU.deMinimisLocal}
            onReset={() => {
              setScenario({ ...DEFAULT_SCENARIO, market: "AU" });
              void setExtra({ cc: "", dv: "" });
            }}
          />
        </div>
      </div>
      <ProtoDisclaimer />
    </div>
  );
}

function fxBadgeText(fx: FxSnapshotType): string {
  // "1 USD = 1.3950 AUD · rate as of 25 Aug 2026" → add HKD after the AUD rate.
  const [audPart, asOfPart] = formatFxBadgeText(fx.rates.AUD, "AUD", fx.asOf).split(" · ");
  const hkdPart = fx.rates.HKD === undefined ? null : `${fx.rates.HKD.toFixed(4)} HKD`;
  return [audPart, hkdPart, asOfPart].filter(Boolean).join(" · ");
}

function ProtoHeader({
  fx,
  fetchedAt,
  skipped,
  currency,
  onCurrencyChange,
}: {
  fx: FxSnapshotType;
  fetchedAt: string;
  skipped: SkippedRow[];
  currency: DisplayCurrency;
  onCurrencyChange: (currency: DisplayCurrency) => void;
}) {
  const currencyOptions = DISPLAY_CURRENCIES.map((value) => ({
    value,
    label: value,
    disabledReason:
      value === "HKD" && fx.rates.HKD === undefined ? "No HKD rate available right now" : undefined,
  }));
  const skippedReasons = [...new Set(skipped.map((row) => row.reason))].join("; ");
  // Fixed UTC text, not toLocaleString: server and browser time zones would differ.
  const fetchedText = `${fetchedAt.slice(0, 16).replace("T", " ")} UTC`;
  return (
    <header className={styles.head}>
      <h1 className={styles.title}>Dropship revenue calculator</h1>
      <span className={styles.subtitle}>
        AU market · Uniqbe dropship prices from storeprice.uniqbe.com, fetched {fetchedText}
        {skipped.length > 0 && ` · ${skipped.length} not listed (${skippedReasons})`}
      </span>
      <div className={styles.headControls}>
        <span className={`${styles.badge} ${styles.mono}`} data-testid="proto-fx-badge">
          {fxBadgeText(fx)}
          {fx.degraded && " · may be out of date"}
        </span>
        <Segmented
          label="Currency for all prices"
          hideLabel
          className={styles.currencySeg}
          options={currencyOptions}
          value={currency}
          onChange={onCurrencyChange}
        />
      </div>
    </header>
  );
}

function ProtoDisclaimer() {
  return (
    <div className={styles.disclaimer} role="note">
      Final price is confirmed on Uniqbe&rsquo;s invoice, not by this tool. Estimate only — not tax
      advice.
    </div>
  );
}

export function PrototypeError() {
  return (
    <div className={styles.root}>
      <div className={`${styles.card} ${styles.errorCard}`} role="alert">
        <h1 className={styles.title}>Price list unavailable</h1>
        <p>Couldn&rsquo;t load the price list from storeprice.uniqbe.com. Try again in a minute.</p>
        <a className={styles.link} href="/prototype/au">
          Reload
        </a>
      </div>
      <ProtoDisclaimer />
    </div>
  );
}

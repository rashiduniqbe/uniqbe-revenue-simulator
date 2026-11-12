"use client";

import { useState } from "react";
import type { FxSnapshotType, LiveItemType, MarketRulesType } from "../../lib/schemas";
import type { SkippedRow } from "../../lib/storeprice/parse";
import { DEFAULT_SCENARIO, useScenario, type ScenarioParams } from "../../lib/url-state";
import { resolveSimulationInput } from "../../lib/simulate-input";
import { deriveDutyPctDefault, deriveReferralFeeDefault } from "../../lib/scenario-defaults";
import { fxInputFor } from "../../lib/compare";
import { formatFxBadgeText } from "../../lib/fx-format";
import type { DisplayCurrency } from "../../lib/display-currency";
import { calculate } from "../../engine";
import { ProtoInputCard } from "./ProtoInputCard";
import { ProtoResultCard } from "./ProtoResultCard";
import styles from "./proto.module.css";

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
  const [currency, setCurrency] = useState<DisplayCurrency>("AUD");

  const selectedItem = items.find((item) => item.code === scenario.productCode) ?? null;
  const resolved = selectedItem ? resolveSimulationInput(scenario, selectedItem, rules) : null;
  const result = resolved ? calculate(resolved, fxInputFor(fx, "AU"), rules) : null;

  function selectProduct(code: string) {
    const item = items.find((i) => i.code === code);
    if (!item) return;
    setScenario({
      ...scenario,
      productCode: code,
      dutyPct: deriveDutyPctDefault(rules, "AU", item.category),
      referralFeePct: deriveReferralFeeDefault(rules, "AU", scenario.platform, item.category),
    });
  }

  return (
    <div className={styles.root}>
      <div className={styles.wrap}>
        <ProtoHeader fx={fx} fetchedAt={fetchedAt} skipped={skipped} />
        <div className={styles.layout}>
          <ProtoInputCard
            items={items}
            selectedItem={selectedItem}
            onSelectProduct={selectProduct}
            scenario={scenario}
            onChange={setScenario}
            rules={rules}
          />
          <ProtoResultCard
            result={result}
            currency={currency}
            onCurrencyChange={setCurrency}
            rates={fx.rates}
            thresholdLocal={rules.AU.deMinimisLocal}
            onReset={() => setScenario({ ...DEFAULT_SCENARIO, market: "AU" })}
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
}: {
  fx: FxSnapshotType;
  fetchedAt: string;
  skipped: SkippedRow[];
}) {
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
      <span className={`${styles.badge} ${styles.mono}`} data-testid="proto-fx-badge">
        {fxBadgeText(fx)}
        {fx.degraded && " · may be out of date"}
      </span>
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

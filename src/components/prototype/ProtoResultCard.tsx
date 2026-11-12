"use client";

import Decimal from "decimal.js";
import type { SimulationResult } from "../../engine/types";
import { platformFeeLabel } from "../../lib/breakdown-format";
import {
  DISPLAY_CURRENCIES,
  formatMoney,
  toDisplay,
  type DisplayCurrency,
} from "../../lib/display-currency";
import { thresholdBannerText } from "../../lib/threshold-copy";
import { WARNING_COPY, sortWarningsByPriority } from "../../lib/warnings-copy";
import { Segmented } from "./controls";
import styles from "./proto.module.css";

const VERDICT_LABEL: Record<SimulationResult["verdict"], string> = {
  profitable: "Profitable",
  marginal: "Marginal",
  "loss-making": "Loss-making",
};

interface ProtoResultCardProps {
  result: SimulationResult | null;
  currency: DisplayCurrency;
  onCurrencyChange: (currency: DisplayCurrency) => void;
  rates: { AUD: number; HKD?: number };
  thresholdLocal: number | null;
  onReset: () => void;
}

export function ProtoResultCard({
  result,
  currency,
  onCurrencyChange,
  rates,
  thresholdLocal,
  onReset,
}: ProtoResultCardProps) {
  const options = DISPLAY_CURRENCIES.map((value) => ({
    value,
    label: value,
    disabledReason:
      value === "HKD" && rates.HKD === undefined ? "No HKD rate available right now" : undefined,
  }));
  // Engine output is AUD; anything shown in another currency is converted for display only.
  const money = (amountAud: string) =>
    formatMoney(toDisplay(amountAud, rates, currency) ?? amountAud, currency);

  return (
    <section className={styles.resultCol} aria-label="Result">
      <div className={`${styles.card} ${styles.total}`}>
        <div className={styles.totalHead}>
          <h2 className={styles.totalTitle}>Net profit per unit</h2>
          <Segmented
            label="Show amounts in"
            hideLabel
            className={styles.currencySeg}
            options={options}
            value={currency}
            onChange={onCurrencyChange}
          />
          <button type="button" className={styles.ghostButton} onClick={onReset}>
            Reset
          </button>
        </div>
        {result ? (
          <Tiles result={result} money={money} />
        ) : (
          <p className={styles.empty}>
            Pick a product and enter a selling price to see your profit.
          </p>
        )}
      </div>

      {result && <Notices result={result} thresholdLocal={thresholdLocal} />}
      {result && <Breakdown result={result} money={money} />}

      <p className={styles.footnote}>
        Estimate only. Final price confirmed on Uniqbe&rsquo;s invoice.
      </p>
    </section>
  );
}

function Tiles({ result, money }: { result: SimulationResult; money: (aud: string) => string }) {
  const profit = new Decimal(result.netProfit);
  const tone = profit.isNegative() ? styles.negative : styles.positive;
  return (
    <div className={styles.tiles}>
      <div className={styles.tile}>
        <span className={styles.label}>Selling price</span>
        <span className={styles.tileValue} data-testid="proto-tile-price">
          {money(result.sellingPriceGross)}
        </span>
        <span className={styles.tileNote}>incl. GST</span>
      </div>
      <div className={styles.tile}>
        <span className={styles.label}>Landed cost</span>
        <span className={styles.tileValue} data-testid="proto-tile-landed">
          {money(result.landedCost)}
        </span>
        <span className={styles.tileNote}>goods, shipping, duty, import GST</span>
      </div>
      <div className={`${styles.tile} ${styles.tileStrong}`}>
        <span className={styles.label}>Net profit</span>
        <span className={`${styles.tileValue} ${tone}`} data-testid="proto-tile-profit">
          {money(result.netProfit)}
        </span>
        <span className={styles.tileNote}>
          {result.marginPct}% margin · {VERDICT_LABEL[result.verdict]}
        </span>
      </div>
    </div>
  );
}

function Notices({
  result,
  thresholdLocal,
}: {
  result: SimulationResult;
  thresholdLocal: number | null;
}) {
  const warnings = sortWarningsByPriority(
    result.auAboveThreshold === false
      ? result.warnings.filter((w) => w.code !== "AU_BELOW_THRESHOLD")
      : result.warnings,
  );
  const showThreshold = result.auAboveThreshold !== null && thresholdLocal !== null;
  if (!showThreshold && warnings.length === 0) return null;
  return (
    <ul className={styles.notices}>
      {showThreshold && result.auAboveThreshold !== null && thresholdLocal !== null && (
        <li className={styles.notice} role="status">
          {thresholdBannerText(result.auAboveThreshold, thresholdLocal)}
        </li>
      )}
      {warnings.map((warning) => (
        <li key={warning.code} className={styles.notice}>
          {WARNING_COPY[warning.code].message}
        </li>
      ))}
    </ul>
  );
}

function Breakdown({
  result,
  money,
}: {
  result: SimulationResult;
  money: (aud: string) => string;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>How it&rsquo;s worked out</h2>
        <ul className={styles.rows}>
          {result.breakdown.map((line) => (
            <li key={line.label} className={styles.row} data-testid={`proto-row-${line.label}`}>
              <span>{platformFeeLabel(line.label)}</span>
              <span className={styles.mono}>{money(line.amount)}</span>
            </li>
          ))}
          <li className={`${styles.row} ${styles.rowTotal}`}>
            <span>Net profit</span>
            <span className={styles.mono}>{money(result.netProfit)}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

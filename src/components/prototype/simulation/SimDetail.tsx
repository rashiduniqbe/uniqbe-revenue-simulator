"use client";

import { calculate } from "../../../engine";
import { formatMoney, toDisplay, type DisplayCurrency } from "../../../lib/display-currency";
import {
  SIM_PLATFORMS,
  cellInput,
  type SimContext,
  type SimItem,
  type SimPlatform,
  type SimRow,
  type SimSettings,
} from "../../../lib/simulation/simulate";
import { Segmented } from "../controls";
import { Breakdown, Notices } from "../ProtoResultCard";
import proto from "../proto.module.css";
import { PLATFORM_LABEL } from "./labels";
import styles from "./simulation.module.css";

interface SimDetailProps {
  row: SimRow;
  item: SimItem;
  platform: SimPlatform;
  // The settings the row was solved with (the cell's price belongs to them).
  settings: SimSettings;
  ctx: SimContext;
  thresholdLocal: number | null;
  onPlatformChange: (platform: SimPlatform) => void;
  onClose?: () => void;
  onCheck: () => void;
}

const PLATFORM_OPTIONS = SIM_PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABEL[p] }));

/** The full calculator breakdown for one row at its solved price. No verdict chip: every target is under the 12% "profitable" line. */
export function SimDetail({
  row,
  item,
  platform,
  settings,
  ctx,
  thresholdLocal,
  onPlatformChange,
  onClose,
  onCheck,
}: SimDetailProps) {
  const currency: DisplayCurrency = settings.currency;
  const cell = row.cells[platform];
  const input = cell ? cellInput(item, settings, platform, cell.price, ctx) : null;
  const result = input ? calculate(input, ctx.fx, ctx.rules) : null;
  const money = (aud: string) => formatMoney(toDisplay(aud, ctx.rates, currency) ?? aud, currency);
  const thresholdEquivalent =
    thresholdLocal !== null && currency !== "AUD" ? money(String(thresholdLocal)) : null;

  return (
    <section className={`${proto.card} ${styles.detail}`} aria-label="Selected product">
      <div className={proto.section}>
        <div className={styles.detailHead}>
          <div>
            <h2 className={proto.sectionTitle}>{row.name}</h2>
            <span className={`${proto.optionMeta} ${proto.mono}`}>
              {row.code} · {row.categoryLabel}
            </span>
          </div>
          {onClose && (
            <button
              type="button"
              className={`${proto.ghostButton} ${proto.pushRight}`}
              onClick={onClose}
            >
              Close
            </button>
          )}
        </div>
        <Segmented
          label="Platform"
          hideLabel
          className={styles.detailTabs}
          options={PLATFORM_OPTIONS}
          value={platform}
          onChange={onPlatformChange}
        />
        {cell && result ? (
          <div className={proto.tiles}>
            <div className={proto.tile}>
              <span className={proto.label}>Selling price</span>
              <span className={`${proto.tileValue} ${proto.mono}`} data-testid="sim-detail-price">
                {formatMoney(cell.price, currency)}
              </span>
              <span className={proto.tileNote}>incl. GST</span>
            </div>
            <div className={`${proto.tile} ${proto.tileStrong}`}>
              <span className={proto.label}>Net profit</span>
              <span className={`${proto.tileValue} ${proto.mono}`} data-testid="sim-detail-profit">
                {money(result.netProfit)}
              </span>
              <span className={proto.tileNote} data-testid="sim-detail-margin">
                {result.marginPct}% net margin
              </span>
            </div>
          </div>
        ) : (
          <p className={proto.empty}>
            No price reaches a {settings.targetMarginPct}% margin on {PLATFORM_LABEL[platform]}.
          </p>
        )}
        {cell && (
          <button type="button" className={styles.primaryButton} onClick={onCheck}>
            Check this row in the calculator
          </button>
        )}
      </div>
      {result && (
        <div className={proto.section}>
          <Notices
            result={result}
            thresholdLocal={thresholdLocal}
            thresholdEquivalent={thresholdEquivalent}
          />
        </div>
      )}
      {result && <Breakdown result={result} money={money} />}
    </section>
  );
}

"use client";

import type { ReactNode } from "react";
import { formatMoney, type DisplayCurrency } from "../../../lib/display-currency";
import {
  SIM_PLATFORMS,
  type SimCell,
  type SimPlatform,
  type SimRow,
} from "../../../lib/simulation/simulate";
import proto from "../proto.module.css";
import { PLATFORM_LABEL } from "./labels";
import styles from "./simulation.module.css";

export type Selection = { code: string; platform: SimPlatform };

interface SimTableProps {
  rows: SimRow[];
  currency: DisplayCurrency;
  targetMarginPct: number;
  thresholdText: string;
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
  compact: boolean;
  stale: boolean;
  // The phone layout shows the detail as a drawer under the selected card.
  renderDrawer: (row: SimRow) => ReactNode;
}

export function SimTable(props: SimTableProps) {
  const { rows, compact, stale } = props;
  return (
    <div className={stale ? styles.stale : undefined} aria-busy={stale}>
      {compact ? (
        <ul className={styles.cards} aria-label="Products">
          {rows.map((row) => (
            <ProductCard key={row.code} row={row} {...props} />
          ))}
        </ul>
      ) : (
        <ProductTable {...props} />
      )}
    </div>
  );
}

function ProductTable({
  rows,
  currency,
  targetMarginPct,
  thresholdText,
  selection,
  onSelect,
}: SimTableProps) {
  return (
    <div className={`${proto.card} ${styles.tableWrap}`}>
      <table className={styles.table}>
        <caption className="sr-only">
          Selling price needed for a {targetMarginPct}% net margin, by platform
        </caption>
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Uniqbe dropship</th>
            <th scope="col">Landed cost</th>
            {SIM_PLATFORMS.map((p) => (
              <th key={p} scope="col">
                {PLATFORM_LABEL[p]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSelected = selection?.code === row.code;
            return (
              <tr
                key={row.code}
                className={isSelected ? styles.selectedRow : undefined}
                data-testid={`sim-row-${row.code}`}
              >
                <th scope="row" className={styles.productCell}>
                  <button
                    type="button"
                    className={styles.productButton}
                    onClick={() =>
                      onSelect({ code: row.code, platform: selection?.platform ?? "amazon" })
                    }
                  >
                    {row.name}
                  </button>
                  <span className={`${proto.optionMeta} ${proto.mono}`}>
                    {row.code} · {row.categoryLabel}
                  </span>
                  <Badges row={row} thresholdText={thresholdText} />
                </th>
                <td className={proto.mono}>
                  <DropshipPrice row={row} currency={currency} />
                </td>
                <td className={proto.mono}>
                  <LandedCost row={row} currency={currency} />
                </td>
                {SIM_PLATFORMS.map((p) => (
                  <td key={p}>
                    <CellButton
                      row={row}
                      platform={p}
                      cell={row.cells[p]}
                      currency={currency}
                      targetMarginPct={targetMarginPct}
                      pressed={isSelected && selection?.platform === p}
                      onSelect={onSelect}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProductCard({
  row,
  currency,
  targetMarginPct,
  thresholdText,
  selection,
  onSelect,
  renderDrawer,
}: SimTableProps & { row: SimRow }) {
  const isSelected = selection?.code === row.code;
  return (
    <li
      className={`${proto.card} ${styles.productCard} ${isSelected ? styles.selectedRow : ""}`}
      data-testid={`sim-card-${row.code}`}
    >
      <div className={styles.cardHead}>
        <span className={styles.cardName}>{row.name}</span>
        <span className={`${proto.optionMeta} ${proto.mono}`}>
          {row.code} · landed <LandedCost row={row} currency={currency} />
        </span>
        <Badges row={row} thresholdText={thresholdText} />
      </div>
      <div className={styles.cardGrid}>
        {SIM_PLATFORMS.map((p) => (
          <CellButton
            key={p}
            row={row}
            platform={p}
            cell={row.cells[p]}
            currency={currency}
            targetMarginPct={targetMarginPct}
            pressed={isSelected && selection?.platform === p}
            onSelect={onSelect}
            showPlatform
          />
        ))}
      </div>
      {isSelected && renderDrawer(row)}
    </li>
  );
}

function CellButton({
  row,
  platform,
  cell,
  currency,
  targetMarginPct,
  pressed,
  onSelect,
  showPlatform = false,
}: {
  row: SimRow;
  platform: SimPlatform;
  cell: SimCell | null;
  currency: DisplayCurrency;
  targetMarginPct: number;
  pressed: boolean;
  onSelect: (selection: Selection) => void;
  showPlatform?: boolean;
}) {
  return (
    <button
      type="button"
      className={styles.cellButton}
      aria-pressed={pressed}
      aria-label={`${row.name} on ${PLATFORM_LABEL[platform]}`}
      data-testid={`sim-cell-${row.code}-${platform}`}
      onClick={() => onSelect({ code: row.code, platform })}
    >
      {showPlatform && <span className={proto.label}>{PLATFORM_LABEL[platform]}</span>}
      {cell ? (
        <>
          <span className={`${styles.cellPrice} ${proto.mono}`} data-testid="sim-cell-price">
            {formatMoney(cell.price, currency)}
          </span>
          <span className={`${styles.cellKeeps} ${proto.mono}`} data-testid="sim-cell-profit">
            keeps {formatMoney(cell.netProfit, currency)}
          </span>
        </>
      ) : (
        <span className={styles.cellNone}>No price reaches {targetMarginPct}%</span>
      )}
    </button>
  );
}

function Badges({ row, thresholdText }: { row: SimRow; thresholdText: string }) {
  if (row.auAboveThreshold) return <span className={styles.badge}>GST at border</span>;
  if (row.nearThreshold) return <span className={styles.badge}>Near {thresholdText}</span>;
  return null;
}

function DropshipPrice({ row, currency }: { row: SimRow; currency: DisplayCurrency }) {
  return (
    <>
      {formatMoney(String(row.usd), "USD")}
      {currency !== "USD" && (
        <span className={styles.sub}>≈ {formatMoney(row.goodsCost, currency)}</span>
      )}
    </>
  );
}

function LandedCost({ row, currency }: { row: SimRow; currency: DisplayCurrency }) {
  const hasImportTax = Number(row.importTax) > 0;
  return (
    <>
      {formatMoney(row.landedCost, currency)}
      {hasImportTax && (
        <span className={styles.sub}>incl. import GST {formatMoney(row.importTax, currency)}</span>
      )}
    </>
  );
}

interface PagerProps {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}

export function Pager({ page, pageCount, onPage }: PagerProps) {
  if (pageCount <= 1) return null;
  return (
    <nav className={styles.pager} aria-label="Pages">
      <button
        type="button"
        className={proto.ghostButton}
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      <span className={proto.mono} aria-live="polite">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        className={proto.ghostButton}
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

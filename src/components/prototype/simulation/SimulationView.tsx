"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { FxSnapshotType, LiveItemType, MarketRulesType } from "../../../lib/schemas";
import type { ScenarioParams } from "../../../lib/url-state";
import { fxInputFor } from "../../../lib/compare";
import { formatMoney, type DisplayCurrency } from "../../../lib/display-currency";
import type { SimContext, SimRow, SimSettings } from "../../../lib/simulation/simulate";
import {
  categoryOptions,
  filterRows,
  paginate,
  sortRows,
  summarize,
} from "../../../lib/simulation/table";
import type { SimState } from "../../../lib/simulation/view-state";
import proto from "../proto.module.css";
import { SimDetail } from "./SimDetail";
import { SimFilters, type FilterPatch } from "./SimFilters";
import { SimSettingsBar, type CostPatch } from "./SimSettingsBar";
import { SimSummary } from "./SimSummary";
import { Pager, SimTable, type Selection } from "./SimTable";
import { useSimulationRows } from "./useSimulationRows";
import styles from "./simulation.module.css";

interface SimulationViewProps {
  items: LiveItemType[];
  rules: MarketRulesType;
  fx: FxSnapshotType;
  rates: { AUD: number; HKD?: number };
  currency: DisplayCurrency;
  scenario: ScenarioParams;
  onScenarioChange: (next: ScenarioParams) => void;
  sim: SimState;
  onSimChange: (patch: Partial<SimState>) => void;
}

// Phones get a card list and an in-place drawer instead of the table and side panel.
const COMPACT_QUERY = "(max-width: 640px)";

function useIsCompact(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(COMPACT_QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(COMPACT_QUERY).matches,
    () => false,
  );
}

export function SimulationView({
  items,
  rules,
  fx,
  rates,
  currency,
  scenario,
  onScenarioChange,
  sim,
  onSimChange,
}: SimulationViewProps) {
  const compact = useIsCompact();
  const { AUD, HKD } = rates;
  const ctx: SimContext = useMemo(
    () => ({ rules, fx: fxInputFor(fx, "AU"), rates: { AUD, HKD } }),
    [rules, fx, AUD, HKD],
  );
  const settings: SimSettings = useMemo(
    () => ({
      targetMarginPct: sim.targetMarginPct,
      taxRegistered: scenario.taxRegistered,
      currency,
      inboundShipping: scenario.inboundShippingLocal,
      packaging: scenario.packagingLocal,
      adSpend: scenario.adSpendLocal,
    }),
    [
      sim.targetMarginPct,
      scenario.taxRegistered,
      currency,
      scenario.inboundShippingLocal,
      scenario.packagingLocal,
      scenario.adSpendLocal,
    ],
  );
  const run = useSimulationRows(items, settings, ctx);
  const allRows = useMemo(() => run.rows ?? [], [run.rows]);

  const shown = useMemo(
    () =>
      sortRows(
        filterRows(allRows, { query: sim.query, category: sim.category, gst: sim.gst }),
        sim.sort,
      ),
    [allRows, sim.query, sim.category, sim.gst, sim.sort],
  );
  const summary = useMemo(() => summarize(shown), [shown]);
  const categories = useMemo(() => categoryOptions(allRows), [allRows]);
  const page = paginate(shown, sim.page);
  const thresholdText =
    rules.AU.deMinimisLocal === null
      ? "the GST line"
      : formatMoney(String(rules.AU.deMinimisLocal), "AUD").replace(/\.00$/, "");

  const selectedRow = allRows.find((r) => r.code === sim.row) ?? null;
  const selectedItem = items.find((i) => i.code === sim.row) ?? null;
  const selection: Selection | null = selectedRow
    ? { code: selectedRow.code, platform: sim.rowPlatform }
    : null;

  const changeCosts = (patch: CostPatch) =>
    onScenarioChange({
      ...scenario,
      ...(patch.taxRegistered === undefined ? {} : { taxRegistered: patch.taxRegistered }),
      ...(patch.inboundShipping === undefined
        ? {}
        : { inboundShippingLocal: patch.inboundShipping }),
      ...(patch.packaging === undefined ? {} : { packagingLocal: patch.packaging }),
      ...(patch.adSpend === undefined ? {} : { adSpendLocal: patch.adSpend }),
    });
  const changeFilters = (patch: FilterPatch) => onSimChange({ ...patch, page: 1 });
  const clearFilters = () => onSimChange({ query: "", category: "all", gst: "all", page: 1 });

  const detail = (row: SimRow, onClose?: () => void) =>
    selectedItem && run.settings ? (
      <SimDetail
        row={row}
        item={selectedItem}
        platform={sim.rowPlatform}
        settings={run.settings}
        ctx={ctx}
        thresholdLocal={rules.AU.deMinimisLocal}
        onPlatformChange={(rowPlatform) => onSimChange({ rowPlatform })}
        onClose={onClose}
      />
    ) : null;

  return (
    <div className={styles.layout} data-testid="sim-view">
      <div className={styles.main}>
        <SimSettingsBar
          values={settings}
          currency={currency}
          invalid={run.invalid}
          onTargetChange={(targetMarginPct) => onSimChange({ targetMarginPct })}
          onCostsChange={changeCosts}
        />
        {run.failed && (
          <p className={proto.notice} role="alert">
            The prices could not be worked out. Reload the page to try again.
          </p>
        )}
        {run.rows === null ? (
          <TableSkeleton count={items.length} />
        ) : (
          <>
            <SimSummary
              summary={summary}
              shown={shown.length}
              currency={currency}
              thresholdText={thresholdText}
            />
            <SimFilters
              query={sim.query}
              category={sim.category}
              gst={sim.gst}
              sort={sim.sort}
              categories={categories}
              total={allRows.length}
              thresholdText={thresholdText}
              onChange={changeFilters}
            />
            {shown.length === 0 ? (
              <div className={`${proto.card} ${styles.noMatch}`}>
                <p>No products match these filters.</p>
                <button type="button" className={proto.ghostButton} onClick={clearFilters}>
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <SimTable
                  rows={page.rows}
                  currency={currency}
                  targetMarginPct={run.settings?.targetMarginPct ?? sim.targetMarginPct}
                  thresholdText={thresholdText}
                  selection={selection}
                  onSelect={({ code, platform }) =>
                    onSimChange({ row: code, rowPlatform: platform })
                  }
                  compact={compact}
                  stale={run.pending}
                  renderDrawer={(row) => detail(row, () => onSimChange({ row: "" }))}
                />
                <Pager
                  page={page.page}
                  pageCount={page.pageCount}
                  onPage={(next) => onSimChange({ page: next })}
                />
              </>
            )}
          </>
        )}
      </div>
      {!compact && (
        <aside className={styles.side} aria-label="Selected product detail">
          {selectedRow ? (
            detail(selectedRow)
          ) : (
            <div className={`${proto.card} ${styles.detailEmpty}`}>
              <p className={proto.empty}>Pick a price in the table to see how it is worked out.</p>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

function TableSkeleton({ count }: { count: number }) {
  return (
    <div className={`${proto.card} ${styles.skeleton}`} aria-busy="true" role="status">
      <p className={proto.empty}>
        Working out prices for {count} {count === 1 ? "product" : "products"}…
      </p>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={styles.skeletonRow} />
      ))}
    </div>
  );
}

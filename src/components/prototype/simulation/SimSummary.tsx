import { formatMoney, type DisplayCurrency } from "../../../lib/display-currency";
import { SIM_PLATFORMS } from "../../../lib/simulation/simulate";
import type { SimSummary as Summary } from "../../../lib/simulation/table";
import proto from "../proto.module.css";
import { PLATFORM_LABEL } from "./labels";
import styles from "./simulation.module.css";

interface SimSummaryProps {
  summary: Summary;
  shown: number;
  currency: DisplayCurrency;
  thresholdText: string;
}

export function SimSummary({ summary, shown, currency, thresholdText }: SimSummaryProps) {
  return (
    <section aria-label="Summary" className={styles.summary}>
      <div className={styles.summaryTiles}>
        {SIM_PLATFORMS.map((platform) => {
          const s = summary.platforms[platform];
          return (
            <div key={platform} className={proto.tile} data-testid={`sim-summary-${platform}`}>
              <span className={proto.label}>{PLATFORM_LABEL[platform]}</span>
              <span className={`${proto.tileValue} ${proto.mono}`}>
                {s.medianMarkupPct === null ? "—" : `+${s.medianMarkupPct}%`}
              </span>
              <span className={proto.tileNote}>
                median markup over the Uniqbe price
                {s.medianProfit !== null && ` · keeps ${formatMoney(s.medianProfit, currency)}`}
              </span>
            </div>
          );
        })}
      </div>
      <p className={styles.summaryNote}>
        For the {shown} {shown === 1 ? "product" : "products"} shown: {summary.aboveThreshold} at or
        over {thresholdText}, {summary.nearThreshold} within 5% of it.
      </p>
    </section>
  );
}

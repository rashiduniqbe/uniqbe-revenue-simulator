import { VERDICT_MARGIN_THRESHOLD_PCT } from "../../engine/verdict";
import { CURRENCY_SYMBOL } from "../../lib/breakdown-format";
import type { ResultHeadline } from "../../lib/result-headline";
import { BUTTON_TARGET_CLASS } from "./control-classes";

interface ResultBlockProps {
  headline: ResultHeadline | null;
  currency: "GBP" | "AUD";
  onReset: () => void;
}

const EMPTY = "—";

const VERDICT_LABEL: Record<ResultHeadline["verdict"], string> = {
  profitable: "PROFITABLE",
  marginal: "MARGINAL",
  "loss-making": "LOSS-MAKING",
};

// Text colours match VerdictCard (still used by compare); the label text itself carries the meaning.
const VERDICT_COLOR: Record<ResultHeadline["verdict"], string> = {
  profitable: "text-[#0F766E]",
  marginal: "text-[#B45309]",
  "loss-making": "text-[#B91C1C]",
};

// The engine's decimal strings are never parsed: a leading "-" is moved ahead of the
// currency symbol by string handling only, so a loss reads "-£12.34", not "£-12.34".
function formatAmount(symbol: string, amount: string): string {
  return amount.startsWith("-") ? `-${symbol}${amount.slice(1)}` : `${symbol}${amount}`;
}

// Renders as two card-level siblings (`contents` wrapper) so the headline can be
// sticky against the whole card on a phone while the fees and Reset button stay put.
// On md+ both parts move to the end of the card, Flyp-style.
export function ResultBlock({ headline, currency, onReset }: ResultBlockProps) {
  const symbol = CURRENCY_SYMBOL[currency];
  const isLoss = headline !== null && headline.netProfit.startsWith("-");
  const profitColor = isLoss ? "text-red-700" : "text-green-700";

  return (
    <div data-testid="result-block" className="contents">
      <div
        {...(headline ? { "data-testid": "verdict-slot" } : {})}
        className={`order-first flex flex-col gap-1 md:order-last ${
          headline
            ? "sticky top-0 z-10 -mx-4 border-b border-neutral-200 bg-white px-4 py-2 sm:-mx-6 sm:px-6 md:static md:mx-0 md:border-b-0 md:p-0"
            : ""
        }`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p
            className={`text-sm font-bold tracking-wide ${headline ? VERDICT_COLOR[headline.verdict] : ""}`}
          >
            {headline ? VERDICT_LABEL[headline.verdict] : EMPTY}
          </p>
          <p className="text-sm text-neutral-600">
            Profit margin{" "}
            <span className="font-mono [font-variant-numeric:tabular-nums]">
              {headline ? `${headline.marginPct}%` : EMPTY}
            </span>
          </p>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold">Net profit</p>
          <p
            data-testid="net-profit"
            className={`font-mono text-xl font-bold [font-variant-numeric:tabular-nums] ${
              headline ? profitColor : "text-neutral-500"
            }`}
          >
            {headline ? formatAmount(symbol, headline.netProfit) : EMPTY}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:order-last">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold">Platform fees</p>
            <p
              className={`font-mono text-base font-bold [font-variant-numeric:tabular-nums] ${
                headline ? "text-red-700" : "text-neutral-500"
              }`}
            >
              {headline ? formatAmount(symbol, headline.platformFees) : EMPTY}
            </p>
          </div>
          {headline && headline.feeBreakdownLine !== "" && (
            <p className="mt-1 text-xs text-neutral-600">{headline.feeBreakdownLine}</p>
          )}
          {headline?.verdict === "marginal" && (
            <p className="mt-1 text-xs text-neutral-600">
              Below the {VERDICT_MARGIN_THRESHOLD_PCT}% margin Uniqbe considers healthy.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onReset}
          className={`${BUTTON_TARGET_CLASS} w-full rounded-md bg-black font-semibold text-white hover:bg-neutral-800`}
        >
          Reset calculator
        </button>
        <p className="text-center text-xs text-neutral-600">In {currency}.</p>
      </div>
    </div>
  );
}

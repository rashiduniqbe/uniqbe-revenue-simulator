import { VERDICT_MARGIN_THRESHOLD_PCT } from "../../engine/verdict";

interface VerdictCardProps {
  verdict: "profitable" | "marginal" | "loss-making";
  netProfit: string;
  marginPct: string;
  currency: "GBP" | "AUD";
}

const VERDICT_STYLE: Record<VerdictCardProps["verdict"], { label: string; color: string }> = {
  profitable: { label: "PROFITABLE", color: "#0F766E" },
  marginal: { label: "MARGINAL", color: "#B45309" },
  "loss-making": { label: "LOSS-MAKING", color: "#B91C1C" },
};

const CURRENCY_SYMBOL: Record<"GBP" | "AUD", string> = { GBP: "£", AUD: "A$" };

export function VerdictCard({ verdict, netProfit, marginPct, currency }: VerdictCardProps) {
  const style = VERDICT_STYLE[verdict];
  return (
    <div
      className="rounded-md border border-neutral-200 bg-white p-4"
      style={{ borderLeft: `4px solid ${style.color}` }}
    >
      <p className="text-sm font-bold tracking-wide" style={{ color: style.color }}>
        {style.label}
      </p>
      <p className="mt-1 font-mono text-lg [font-variant-numeric:tabular-nums]">
        {CURRENCY_SYMBOL[currency]}
        {netProfit} per unit · {marginPct}%
      </p>
      {verdict === "marginal" && (
        <p className="mt-1 text-xs text-neutral-500">
          Below the {VERDICT_MARGIN_THRESHOLD_PCT}% margin Uniqbe considers healthy.
        </p>
      )}
    </div>
  );
}

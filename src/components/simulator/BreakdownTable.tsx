import type { BreakdownLine } from "../../engine/types";
import { CURRENCY_SYMBOL, platformFeeLabel } from "../../lib/breakdown-format";

interface BreakdownTableProps {
  lines: BreakdownLine[];
  netProfit: string;
  currency: "GBP" | "AUD";
  hoveredLabel: string | null;
  onHoverLabel: (label: string | null) => void;
}

// The 100%-reference line — computeWaterfallSegments (src/lib/waterfall.ts)
// deliberately excludes it from the waterfall, so it has no matching segment
// to highlight. No hover/focus handlers are attached to its row.
const GROSS_SELLING_PRICE_LABEL = "Gross selling price";

export function BreakdownTable({
  lines,
  netProfit,
  currency,
  hoveredLabel,
  onHoverLabel,
}: BreakdownTableProps) {
  const symbol = CURRENCY_SYMBOL[currency];
  return (
    <table className="w-full border-collapse font-mono text-sm [font-variant-numeric:tabular-nums]">
      <tbody>
        {lines.map((line) => {
          const isInteractive = line.label !== GROSS_SELLING_PRICE_LABEL;
          return (
            <tr
              key={line.label}
              data-testid={`breakdown-row-${line.label}`}
              tabIndex={isInteractive ? 0 : undefined}
              onMouseEnter={isInteractive ? () => onHoverLabel(line.label) : undefined}
              onMouseLeave={isInteractive ? () => onHoverLabel(null) : undefined}
              onFocus={isInteractive ? () => onHoverLabel(line.label) : undefined}
              onBlur={isInteractive ? () => onHoverLabel(null) : undefined}
              style={{ opacity: hoveredLabel === null || hoveredLabel === line.label ? 1 : 0.5 }}
            >
              <td className="py-1 pr-4 text-neutral-700">{platformFeeLabel(line.label)}</td>
              <td className="py-1 text-right">
                {symbol}
                {line.amount}
              </td>
            </tr>
          );
        })}
        <tr
          className="border-t border-neutral-300 font-semibold"
          tabIndex={0}
          onMouseEnter={() => onHoverLabel("Net profit")}
          onMouseLeave={() => onHoverLabel(null)}
          onFocus={() => onHoverLabel("Net profit")}
          onBlur={() => onHoverLabel(null)}
          style={{ opacity: hoveredLabel === null || hoveredLabel === "Net profit" ? 1 : 0.5 }}
        >
          <td className="py-2 pr-4">Net profit</td>
          <td className="py-2 text-right">
            {symbol}
            {netProfit}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

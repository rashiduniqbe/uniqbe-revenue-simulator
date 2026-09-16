import type { BreakdownLine } from "../../engine/types";
import { alignedAmount } from "../../lib/breakdown-format";

const AMOUNT_COLUMN_WIDTH = 12;

interface BreakdownTableProps {
  lines: BreakdownLine[];
  netProfit: string;
  currency: "GBP" | "AUD";
}

const CURRENCY_SYMBOL: Record<"GBP" | "AUD", string> = { GBP: "£", AUD: "A$" };

export function BreakdownTable({ lines, netProfit, currency }: BreakdownTableProps) {
  const symbol = CURRENCY_SYMBOL[currency];
  return (
    <table className="w-full border-collapse font-mono text-sm [font-variant-numeric:tabular-nums]">
      <tbody>
        {lines.map((line) => (
          <tr key={line.label} data-testid={`breakdown-row-${line.label}`}>
            <td className="py-1 pr-4 text-neutral-700">{line.label}</td>
            <td className="py-1 text-right">
              {symbol}
              {alignedAmount(line.amount, AMOUNT_COLUMN_WIDTH)}
            </td>
          </tr>
        ))}
        <tr className="border-t border-neutral-300 font-semibold">
          <td className="py-2 pr-4">Net profit</td>
          <td className="py-2 text-right">
            {symbol}
            {alignedAmount(netProfit, AMOUNT_COLUMN_WIDTH)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

import type { BreakdownLine } from "../engine/types";

export interface WaterfallSegment {
  label: string;
  widthPct: number;
  negative: boolean;
}

const GROSS_SELLING_PRICE_LABEL = "Gross selling price";

export function computeWaterfallSegments(
  lines: BreakdownLine[],
  netProfit: string,
): WaterfallSegment[] {
  const grossLine = lines.find((line) => line.label === GROSS_SELLING_PRICE_LABEL);
  const gross = Math.abs(Number(grossLine?.amount ?? "0"));

  const deductionSegments = lines
    .filter((line) => line.label !== GROSS_SELLING_PRICE_LABEL)
    .map((line) => {
      const value = Number(line.amount);
      return {
        label: line.label,
        widthPct: gross === 0 ? 0 : (Math.abs(value) / gross) * 100,
        negative: value < 0,
      };
    });

  const profitValue = Number(netProfit);
  const profitSegment: WaterfallSegment = {
    label: "Net profit",
    widthPct: gross === 0 ? 0 : (Math.abs(profitValue) / gross) * 100,
    negative: profitValue < 0,
  };

  return [...deductionSegments, profitSegment];
}

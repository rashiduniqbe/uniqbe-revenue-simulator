import type { BreakdownLine } from "../../engine/types";
import { computeWaterfallSegments } from "../../lib/waterfall";

interface CostWaterfallProps {
  lines: BreakdownLine[];
  netProfit: string;
  hoveredLabel: string | null;
  onHoverLabel: (label: string | null) => void;
}

const SEGMENT_COLORS = [
  "#0F766E",
  "#B45309",
  "#B91C1C",
  "#0891B2",
  "#7C3AED",
  "#DB2777",
  "#65A30D",
  "#EA580C",
];

export function CostWaterfall({
  lines,
  netProfit,
  hoveredLabel,
  onHoverLabel,
}: CostWaterfallProps) {
  const segments = computeWaterfallSegments(lines, netProfit);
  return (
    <div
      className="flex h-6 w-full overflow-hidden rounded"
      role="img"
      aria-label="Cost waterfall from gross selling price to net profit"
    >
      {segments.map((segment, index) => (
        <div
          key={segment.label}
          className="h-full transition-opacity"
          style={{
            width: `${segment.widthPct}%`,
            backgroundColor: segment.negative
              ? "#B91C1C"
              : SEGMENT_COLORS[index % SEGMENT_COLORS.length],
            opacity: hoveredLabel === null || hoveredLabel === segment.label ? 1 : 0.35,
          }}
          onMouseEnter={() => onHoverLabel(segment.label)}
          onMouseLeave={() => onHoverLabel(null)}
          title={segment.label}
        />
      ))}
    </div>
  );
}

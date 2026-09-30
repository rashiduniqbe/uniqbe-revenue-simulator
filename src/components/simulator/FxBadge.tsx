import { formatFxBadgeText } from "../../lib/fx-format";

interface FxBadgeProps {
  rate: number;
  currency: "GBP" | "AUD";
  asOf: string;
}

export function FxBadge({ rate, currency, asOf }: FxBadgeProps) {
  return (
    <p className="text-sm text-neutral-600" data-testid="fx-badge">
      {formatFxBadgeText(rate, currency, asOf)}
    </p>
  );
}

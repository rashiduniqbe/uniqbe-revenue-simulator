import { thresholdBannerText } from "../../lib/threshold-copy";

interface ThresholdBannerProps {
  aboveThreshold: boolean;
  thresholdLocal: number;
}

export function ThresholdBanner({ aboveThreshold, thresholdLocal }: ThresholdBannerProps) {
  return (
    <div
      className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
      role="status"
    >
      {thresholdBannerText(aboveThreshold, thresholdLocal)}
    </div>
  );
}

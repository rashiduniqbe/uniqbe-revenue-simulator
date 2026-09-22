interface ThresholdBannerProps {
  aboveThreshold: boolean;
}

export function ThresholdBanner({ aboveThreshold }: ThresholdBannerProps) {
  return (
    <div
      className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
      role="status"
    >
      {aboveThreshold
        ? "Over A$1,000 — GST of 10% applies at the border and is included below."
        : "Under A$1,000 — no GST charged today. This reflects Uniqbe's current policy, not a permanent rule."}
    </div>
  );
}

const AUD_WHOLE = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });

export function thresholdBannerText(aboveThreshold: boolean, thresholdLocal: number): string {
  const amount = `A$${AUD_WHOLE.format(thresholdLocal)}`;
  return aboveThreshold
    ? `Over ${amount} — GST of 10% applies at the border and is included below.`
    : `Under ${amount} — no GST charged today. This reflects Uniqbe's current policy, not a permanent rule.`;
}

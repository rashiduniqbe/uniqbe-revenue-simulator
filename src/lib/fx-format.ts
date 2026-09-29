const MONTH_ABBREVIATIONS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatFxBadgeText(rate: number, currency: "GBP" | "AUD", asOf: string): string {
  const parts = asOf.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];

  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Invalid date format: ${asOf}`);
  }

  const monthAbbreviation = MONTH_ABBREVIATIONS[month - 1];
  return `1 USD = ${rate.toFixed(4)} ${currency} · rate as of ${day} ${monthAbbreviation} ${year}`;
}

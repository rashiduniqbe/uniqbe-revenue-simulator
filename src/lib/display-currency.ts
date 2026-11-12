import Decimal from "decimal.js";

// Display-only conversion of engine output (always AUD for the AU market).
// The engine never sees these currencies; tax maths stays in AUD.
export type DisplayCurrency = "AUD" | "USD" | "HKD";

export const DISPLAY_CURRENCIES: readonly DisplayCurrency[] = ["AUD", "USD", "HKD"];

const SYMBOL: Record<DisplayCurrency, string> = { AUD: "A$", USD: "US$", HKD: "HK$" };

type DisplayRates = { AUD: number; HKD?: number };

/** Converts an AUD decimal string to `target`, 2 dp, or null when the rate is missing. */
export function toDisplay(
  amountAud: string,
  rates: DisplayRates,
  target: DisplayCurrency,
): string | null {
  const aud = new Decimal(amountAud);
  let converted: Decimal;
  if (target === "AUD") {
    converted = aud;
  } else {
    const usd = aud.div(new Decimal(rates.AUD));
    if (target === "USD") {
      converted = usd;
    } else {
      if (rates.HKD === undefined) return null;
      converted = usd.mul(new Decimal(rates.HKD));
    }
  }
  return converted.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

/** "A$2,499.00", "−US$12.30" — grouping done on the string, never via Number. */
export function formatMoney(amount: string, currency: DisplayCurrency): string {
  const fixed = new Decimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const negative = fixed.isNegative() && !fixed.isZero();
  const [whole = "0", cents = "00"] = fixed.abs().toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "−" : ""}${SYMBOL[currency]}${grouped}.${cents}`;
}

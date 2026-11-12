import Decimal from "decimal.js";
import { isValidDecimalString } from "./decimal-validation";

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

// Enough precision that a typed amount survives AUD and back at 2 dp.
const AUD_INPUT_DP = 6;

/** Converts a typed amount in `from` to an AUD decimal string for the engine, or null when the rate is missing. */
export function toAud(amount: string, rates: DisplayRates, from: DisplayCurrency): string | null {
  const value = new Decimal(amount);
  let aud: Decimal;
  if (from === "AUD") {
    aud = value;
  } else {
    let usd = value;
    if (from === "HKD") {
      if (rates.HKD === undefined) return null;
      usd = value.div(new Decimal(rates.HKD));
    }
    aud = usd.mul(new Decimal(rates.AUD));
  }
  // toFixed() without an argument never uses exponent notation, which the
  // input validators (plain decimals only) would reject.
  return aud.toDecimalPlaces(AUD_INPUT_DP, Decimal.ROUND_HALF_UP).toFixed();
}

/** Re-expresses typed text in another currency at 2 dp; blank, malformed or unconvertible text is returned unchanged. */
export function convertAmount(
  amount: string,
  rates: DisplayRates,
  from: DisplayCurrency,
  to: DisplayCurrency,
): string {
  if (!isValidDecimalString(amount)) return amount;
  const aud = toAud(amount.trim(), rates, from);
  if (aud === null) return amount;
  return toDisplay(aud, rates, to) ?? amount;
}

/** "A$2,499.00", "−US$12.30" — grouping done on the string, never via Number. */
export function formatMoney(amount: string, currency: DisplayCurrency): string {
  const fixed = new Decimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const negative = fixed.isNegative() && !fixed.isZero();
  const [whole = "0", cents = "00"] = fixed.abs().toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "−" : ""}${SYMBOL[currency]}${grouped}.${cents}`;
}

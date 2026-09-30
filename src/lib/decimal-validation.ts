// Matches a plain decimal number: an optional leading "-", one or more
// digits, and an optional "." followed by one or more digits. No thousands
// separators, no leading/trailing decimal point with no digits, no scientific
// notation — deliberately stricter than `new Decimal()` accepts, so anything
// this passes is guaranteed parseable.
const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

// Returns true only for strings that `new Decimal()` can parse AND that
// represent a plain, unambiguous decimal number a user could type into a
// numeric field. Used to gate calculate()/suggestPrice() calls so an empty,
// blank, or malformed field never reaches decimal.js and throws.
export function isValidDecimalString(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  return DECIMAL_PATTERN.test(trimmed);
}

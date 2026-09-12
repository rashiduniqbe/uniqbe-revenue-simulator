import Decimal from "decimal.js";

export const Money = Decimal.clone({
  precision: 30,
  rounding: Decimal.ROUND_HALF_UP,
});
export type MoneyType = InstanceType<typeof Money>;

export function r2(value: Decimal.Value): MoneyType {
  const rounded = new Money(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return rounded.isZero() ? new Money(0) : rounded;
}

export function assertBreakdownSums(lines: string[], total: string): void {
  const actual = lines.reduce((sum, line) => sum.plus(new Money(line)), new Money(0));
  const expected = new Money(total);
  if (!actual.equals(expected)) {
    throw new Error(
      `Breakdown lines sum to ${actual.toFixed(2)} but expected total is ${expected.toFixed(2)}.`,
    );
  }
}

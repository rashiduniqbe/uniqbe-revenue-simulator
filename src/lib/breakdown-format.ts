export function alignedAmount(amount: string, width: number): string {
  return amount.length >= width ? amount : amount.padStart(width, " ");
}

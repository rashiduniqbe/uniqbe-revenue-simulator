import Decimal from "decimal.js";

export type MarginBand = "<0" | "0-10" | "10-20" | "20-30" | "30+";

// Band edges approved by Uniqbe on 2026-09-30. Lower edge inclusive.
// Analytics only ever sees the band, never the margin (spec §13).
const BAND_FLOORS: readonly { floor: number; band: MarginBand }[] = [
  { floor: 30, band: "30+" },
  { floor: 20, band: "20-30" },
  { floor: 10, band: "10-20" },
  { floor: 0, band: "0-10" },
];

export function marginBand(pct: string): MarginBand {
  const value = new Decimal(pct);
  for (const { floor, band } of BAND_FLOORS) {
    if (value.gte(floor)) return band;
  }
  return "<0";
}

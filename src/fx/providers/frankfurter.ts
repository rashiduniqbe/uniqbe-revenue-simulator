import { FxRawSnapshot, type FxRawSnapshotType } from "../../lib/schemas";

const DEFAULT_FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest";

type FrankfurterResponse = {
  date: string;
  rates: Record<string, number>;
};

export async function fetchFrankfurterSnapshot(
  fetchImpl: typeof fetch = fetch,
  baseUrl: string = process.env.FX_PRIMARY_URL ?? DEFAULT_FRANKFURTER_URL,
): Promise<FxRawSnapshotType> {
  const url = `${baseUrl}?from=USD&to=GBP,AUD`;
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Frankfurter request failed: ${response.status}`);
  }
  const body = (await response.json()) as FrankfurterResponse;
  const gbp = body.rates.GBP;
  const aud = body.rates.AUD;
  if (typeof gbp !== "number" || typeof aud !== "number") {
    throw new Error("Frankfurter response missing GBP/AUD rate");
  }
  return FxRawSnapshot.parse({
    base: "USD",
    rates: { GBP: gbp, AUD: aud },
    asOf: body.date,
    fetchedAt: new Date().toISOString(),
    provider: "frankfurter",
  });
}

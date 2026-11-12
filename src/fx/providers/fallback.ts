import { FxRawSnapshot, type FxRawSnapshotType } from "../../lib/schemas";

type FallbackResponse = {
  date: string;
  rates: Record<string, number>;
};

export async function fetchFallbackSnapshot(
  fetchImpl: typeof fetch = fetch,
  url: string | undefined = process.env.FX_FALLBACK_URL,
  apiKey: string | undefined = process.env.FX_FALLBACK_API_KEY,
): Promise<FxRawSnapshotType> {
  if (!url) {
    throw new Error("FX_FALLBACK_URL is not configured");
  }
  const response = await fetchImpl(url, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
  });
  if (!response.ok) {
    throw new Error(`Fallback FX request failed: ${response.status}`);
  }
  const body = (await response.json()) as FallbackResponse;
  const gbp = body.rates.GBP;
  const aud = body.rates.AUD;
  if (typeof gbp !== "number" || typeof aud !== "number") {
    throw new Error("Fallback response missing GBP/AUD rate");
  }
  return FxRawSnapshot.parse({
    base: "USD",
    rates: { GBP: gbp, AUD: aud },
    asOf: body.date,
    fetchedAt: new Date().toISOString(),
    provider: "fallback",
  });
}

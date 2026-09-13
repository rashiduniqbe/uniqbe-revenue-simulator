export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { fetchFrankfurterSnapshot } from "../../../../fx/providers/frankfurter";
import { fetchFallbackSnapshot } from "../../../../fx/providers/fallback";
import { writeFxSnapshot } from "../../../../fx/store";

export async function POST(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const snapshot = await fetchFrankfurterSnapshot();
    await writeFxSnapshot(snapshot);
    return NextResponse.json({ ok: true, provider: snapshot.provider });
  } catch (primaryError: unknown) {
    try {
      const snapshot = await fetchFallbackSnapshot();
      await writeFxSnapshot(snapshot);
      return NextResponse.json({ ok: true, provider: snapshot.provider });
    } catch (fallbackError: unknown) {
      console.error("fx-refresh: both providers failed, leaving existing key untouched", {
        primaryError,
        fallbackError,
      });
      return NextResponse.json({ ok: false, error: "both providers failed" }, { status: 502 });
    }
  }
}

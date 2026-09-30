export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { fetchFrankfurterSnapshot } from "../../../../fx/providers/frankfurter";
import { fetchFallbackSnapshot } from "../../../../fx/providers/fallback";
import { writeFxSnapshot } from "../../../../fx/store";
import type { FxRawSnapshotType } from "../../../../lib/schemas";

async function refreshFxSnapshot(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let snapshot: FxRawSnapshotType;
  try {
    snapshot = await fetchFrankfurterSnapshot();
  } catch (primaryError: unknown) {
    try {
      snapshot = await fetchFallbackSnapshot();
    } catch (fallbackError: unknown) {
      console.error("fx-refresh: both providers failed, leaving existing key untouched", {
        primaryError,
        fallbackError,
      });
      return NextResponse.json({ ok: false, error: "both providers failed" }, { status: 502 });
    }
  }

  try {
    await writeFxSnapshot(snapshot);
  } catch (writeError: unknown) {
    console.error("fx-refresh: fetch succeeded but the store write failed", { writeError });
    return NextResponse.json({ ok: false, error: "store write failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, provider: snapshot.provider });
}

export async function GET(request: Request): Promise<Response> {
  return refreshFxSnapshot(request);
}

export async function POST(request: Request): Promise<Response> {
  return refreshFxSnapshot(request);
}

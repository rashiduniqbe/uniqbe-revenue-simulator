import type { LiveItemType } from "../schemas";
import { parseStorepriceHtml, type SkippedRow, type StorepriceFailure } from "./parse";

export const DEFAULT_STOREPRICE_URL = "https://storeprice.uniqbe.com/";
// Fetched on every request: the page that calls this is force-dynamic (live FX),
// which makes Next skip the fetch cache, so prices are always current. The
// timeout bounds how long a slow storeprice can hold up a render.
const FETCH_TIMEOUT_MS = 5000;

export type StorepriceLoadResult =
  | { ok: true; items: LiveItemType[]; skipped: SkippedRow[]; fetchedAt: string }
  | { ok: false; reason: StorepriceFailure | "unreachable" | "http-error" };

type LoadOptions = {
  fetchImpl?: typeof fetch;
  url?: string;
  now?: Date;
};

// Server-side only: storeprice sends no CORS headers, so a browser fetch would fail.
export async function loadStorepriceCatalogue({
  fetchImpl = fetch,
  url = process.env.STOREPRICE_URL || DEFAULT_STOREPRICE_URL,
  now = new Date(),
}: LoadOptions = {}): Promise<StorepriceLoadResult> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  if (!response.ok) return { ok: false, reason: "http-error" };

  let html: string;
  try {
    html = await response.text();
  } catch {
    return { ok: false, reason: "unreachable" };
  }

  const parsed = parseStorepriceHtml(html);
  if (!parsed.ok) return parsed;
  return { ...parsed, fetchedAt: now.toISOString() };
}

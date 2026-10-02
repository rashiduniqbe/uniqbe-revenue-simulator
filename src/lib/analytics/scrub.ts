// The app keeps the whole scenario — including the partner's selling price —
// in the URL (spec §9.4). PostHog attaches URL-valued properties
// ($current_url, $referrer, $initial_*) to every event, so every one of them
// loses its query and hash here.
export interface CaptureLike {
  properties: Record<string, unknown>;
  $set?: Record<string, unknown>;
  $set_once?: Record<string, unknown>;
}

export function stripUrl(value: string): string {
  if (!/^https?:\/\//i.test(value)) return value;
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value;
  }
}

function scrubRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      typeof value === "string" ? stripUrl(value) : value,
    ]),
  );
}

export function scrubCapture<T extends CaptureLike>(cr: T | null): T | null {
  if (cr === null) return null;
  return {
    ...cr,
    properties: scrubRecord(cr.properties),
    ...(cr.$set ? { $set: scrubRecord(cr.$set) } : {}),
    ...(cr.$set_once ? { $set_once: scrubRecord(cr.$set_once) } : {}),
  };
}

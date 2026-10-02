import { useEffect, useRef } from "react";
import { track } from "../../lib/analytics/client";
import type { AnalyticsEvent } from "../../lib/analytics/events";
import { createSettledEmitter, type SettledEmitter } from "../../lib/analytics/settle";

// A result must stay on screen this long to count as "shown" (spec §13 core metric).
export const CALCULATION_SETTLE_MS = 1000;

// Tracks `event` once it has stopped changing for `delayMs`. Pass null when
// there's nothing to track (no result yet); that also cancels a pending send.
export function useSettledTrack(event: AnalyticsEvent | null, delayMs: number): void {
  const emitterRef = useRef<SettledEmitter<AnalyticsEvent> | null>(null);
  if (emitterRef.current === null) {
    emitterRef.current = createSettledEmitter(delayMs, track, (e) => JSON.stringify(e));
  }
  const latest = useRef(event);
  latest.current = event;
  const key = event === null ? null : JSON.stringify(event);

  useEffect(() => {
    emitterRef.current?.push(latest.current);
  }, [key]);

  useEffect(() => () => emitterRef.current?.cancel(), []);
}

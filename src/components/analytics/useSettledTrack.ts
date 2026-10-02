import { useEffect, useRef } from "react";
import { track } from "../../lib/analytics/client";
import type { AnalyticsEvent } from "../../lib/analytics/events";
import { createSettledEmitter, type SettledEmitter } from "../../lib/analytics/settle";

// A result must stay on screen this long to count as "shown" (spec §13 core metric).
export const CALCULATION_SETTLE_MS = 1000;

interface Pending {
  event: AnalyticsEvent;
  key: string;
}

// Tracks `event` once `dedupeKey` has stopped changing for `delayMs`. The key
// identifies the result the partner actually saw (e.g. the resolved scenario,
// price included) and never leaves the browser; only `event` is sent. Two
// different prices with the same banded payload are two results shown.
// Pass null for either to track nothing (no result yet), which also cancels a
// pending send.
export function useSettledTrack(
  event: AnalyticsEvent | null,
  dedupeKey: string | null,
  delayMs: number,
): void {
  const emitterRef = useRef<SettledEmitter<Pending> | null>(null);
  if (emitterRef.current === null) {
    emitterRef.current = createSettledEmitter<Pending>(
      delayMs,
      (pending) => track(pending.event),
      (pending) => pending.key,
    );
  }
  const latest = useRef<Pending | null>(null);
  latest.current = event === null || dedupeKey === null ? null : { event, key: dedupeKey };

  useEffect(() => {
    emitterRef.current?.push(latest.current);
  }, [dedupeKey, event === null]);

  useEffect(() => () => emitterRef.current?.cancel(), []);
}

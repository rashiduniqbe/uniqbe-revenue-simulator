"use client";

import { useEffect, useRef, useState } from "react";
import {
  areSettingsUsable,
  simulateCatalogue,
  type SimContext,
  type SimItem,
  type SimRow,
  type SimSettings,
} from "../../../lib/simulation/simulate";
import type { SimRequest, SimResponse } from "./sim.worker";

// Typing in a cost field should not start a full run on every keystroke.
const SETTINGS_DEBOUNCE_MS = 250;

export type SimulationRows = {
  rows: SimRow[] | null;
  // The settings the rows were solved with.
  settings: SimSettings | null;
  pending: boolean;
  invalid: boolean;
  failed: boolean;
};

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Simulates the catalogue in a Web Worker whenever the settings settle. The
 * previous rows stay on screen (pending: true) until the new ones arrive, and
 * unusable settings keep them too (invalid: true).
 */
export function useSimulationRows(
  items: readonly SimItem[],
  settings: SimSettings,
  ctx: SimContext,
): SimulationRows {
  const settingsKey = useDebounced(JSON.stringify(settings), SETTINGS_DEBOUNCE_MS);
  const [state, setState] = useState<SimulationRows>({
    rows: null,
    settings: null,
    pending: true,
    invalid: false,
    failed: false,
  });
  const workerRef = useRef<Worker | null>(null);
  const latestId = useRef(0);
  const requested = useRef<SimSettings | null>(null);

  useEffect(() => {
    if (typeof Worker === "undefined") return;
    const worker = new Worker(new URL("./sim.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<SimResponse>) => {
      const reply = event.data;
      if (reply.id !== latestId.current) return;
      setState((prev) =>
        reply.ok
          ? reply.rows === null
            ? { ...prev, pending: false, invalid: true }
            : {
                rows: reply.rows,
                settings: requested.current,
                pending: false,
                invalid: false,
                failed: false,
              }
          : { ...prev, pending: false, failed: true },
      );
    };
    worker.onerror = () => setState((prev) => ({ ...prev, pending: false, failed: true }));
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const next = JSON.parse(settingsKey) as SimSettings;
    if (!areSettingsUsable(next)) {
      setState((prev) => ({ ...prev, pending: false, invalid: true }));
      return;
    }
    latestId.current += 1;
    const id = latestId.current;
    requested.current = next;
    setState((prev) => ({ ...prev, pending: true, invalid: false }));
    const worker = workerRef.current;
    if (worker) {
      const request: SimRequest = { id, items: [...items], settings: next, ctx };
      worker.postMessage(request);
      return;
    }
    // No worker support: compute on the main thread, after this paint.
    const timer = setTimeout(() => {
      if (id !== latestId.current) return;
      const rows = simulateCatalogue(items, next, ctx);
      setState((prev) =>
        rows === null
          ? { ...prev, pending: false, invalid: true }
          : { rows, settings: next, pending: false, invalid: false, failed: false },
      );
    }, 0);
    return () => clearTimeout(timer);
  }, [settingsKey, items, ctx]);

  return state;
}

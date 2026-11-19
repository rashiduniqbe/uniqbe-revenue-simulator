"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import {
  areSettingsUsable,
  simulateCatalogue,
  type SimContext,
  type SimItem,
  type SimSettings,
} from "../../../lib/simulation/simulate";
import { INITIAL_RUN, simRunReducer, type RunState } from "../../../lib/simulation/run-state";
import type { SimRequest, SimResponse } from "./sim.worker";

// Typing in a cost field should not start a full run on every keystroke.
const SETTINGS_DEBOUNCE_MS = 250;

export type SimulationRows = RunState;

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

type Job = { id: number; settings: SimSettings };

/**
 * Simulates the catalogue in a Web Worker whenever the settings settle. The
 * previous rows stay on screen (pending: true) until the new ones arrive, and
 * unusable settings keep them too (invalid: true). If the worker cannot run,
 * the work moves to the main thread instead of leaving the table waiting.
 */
export function useSimulationRows(
  items: readonly SimItem[],
  settings: SimSettings,
  ctx: SimContext,
): SimulationRows {
  const settingsKey = useDebounced(JSON.stringify(settings), SETTINGS_DEBOUNCE_MS);
  const [state, dispatch] = useReducer(simRunReducer, INITIAL_RUN);
  const workerRef = useRef<Worker | null>(null);
  // Every request or invalid entry gets the next id; only its reply may land.
  const nextId = useRef(0);
  const latestJob = useRef<Job | null>(null);
  const inputs = useRef({ items, ctx });
  inputs.current = { items, ctx };

  // Main-thread run, after this paint: no worker support, or the worker failed.
  const runOnMainThread = useRef((job: Job): (() => void) => {
    const timer = setTimeout(() => {
      try {
        const rows = simulateCatalogue(inputs.current.items, job.settings, inputs.current.ctx);
        dispatch(
          rows === null ? { type: "invalid", id: job.id } : { type: "result", id: job.id, rows },
        );
      } catch {
        dispatch({ type: "failed", id: job.id });
      }
    }, 0);
    return () => clearTimeout(timer);
  }).current;

  useEffect(() => {
    if (typeof Worker === "undefined") return;
    const worker = new Worker(new URL("./sim.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<SimResponse>) => {
      const reply = event.data;
      if (!reply.ok) dispatch({ type: "failed", id: reply.id });
      else if (reply.rows === null) dispatch({ type: "invalid", id: reply.id });
      else dispatch({ type: "result", id: reply.id, rows: reply.rows });
    };
    // The worker could not load or crashed: drop it and finish on the main thread.
    worker.onerror = () => {
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      if (latestJob.current) runOnMainThread(latestJob.current);
    };
    workerRef.current = worker;
    return () => {
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
  }, [runOnMainThread]);

  useEffect(() => {
    const next = JSON.parse(settingsKey) as SimSettings;
    nextId.current += 1;
    const id = nextId.current;
    if (!areSettingsUsable(next)) {
      latestJob.current = null;
      dispatch({ type: "invalid", id });
      return;
    }
    dispatch({ type: "request", id, settings: next });
    const job: Job = { id, settings: next };
    latestJob.current = job;
    const worker = workerRef.current;
    if (!worker) return runOnMainThread(job);
    const request: SimRequest = { id, items: [...items], settings: next, ctx };
    worker.postMessage(request);
  }, [settingsKey, items, ctx, runOnMainThread]);

  return state;
}

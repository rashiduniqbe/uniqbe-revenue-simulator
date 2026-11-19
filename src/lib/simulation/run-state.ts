import type { DisplayCurrency } from "../display-currency";
import type { SimRow, SimSettings } from "./simulate";

/** The state of the simulation's background runs, as shown on screen. */
export type RunState = {
  rows: SimRow[] | null;
  // The settings the rows on screen were solved with.
  settings: SimSettings | null;
  // The settings of the run in flight (becomes `settings` when it lands).
  requested: SimSettings | null;
  pending: boolean;
  invalid: boolean;
  failed: boolean;
  // Only a reply to this run id may change the rows. The caller numbers runs.
  latestId: number;
};

export type RunEvent =
  | { type: "request"; id: number; settings: SimSettings }
  | { type: "invalid"; id: number }
  | { type: "result"; id: number; rows: SimRow[] }
  | { type: "failed"; id: number };

export const INITIAL_RUN: RunState = {
  rows: null,
  settings: null,
  requested: null,
  pending: true,
  invalid: false,
  failed: false,
  latestId: 0,
};

export function simRunReducer(state: RunState, event: RunEvent): RunState {
  switch (event.type) {
    case "request":
      return {
        ...state,
        requested: event.settings,
        pending: true,
        invalid: false,
        failed: false,
        latestId: event.id,
      };
    case "invalid":
      // A new id, so a run still in flight cannot clear the flag when it lands.
      if (event.id < state.latestId) return state;
      return { ...state, pending: false, invalid: true, latestId: event.id };
    case "result":
      if (event.id !== state.latestId) return state;
      return {
        ...state,
        rows: event.rows,
        settings: state.requested,
        pending: false,
        invalid: false,
        failed: false,
      };
    case "failed":
      if (event.id !== state.latestId) return state;
      return { ...state, pending: false, failed: true };
  }
}

/** The currency the rows on screen are in: the one they were solved in. */
export function rowsCurrency(state: RunState, pageCurrency: DisplayCurrency): DisplayCurrency {
  return state.settings?.currency ?? pageCurrency;
}

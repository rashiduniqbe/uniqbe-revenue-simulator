import { describe, expect, it } from "vitest";
import {
  INITIAL_RUN,
  rowsCurrency,
  simRunReducer,
  type RunState,
} from "../../../src/lib/simulation/run-state";
import type { SimRow, SimSettings } from "../../../src/lib/simulation/simulate";

const settings = (over: Partial<SimSettings> = {}): SimSettings => ({
  targetMarginPct: 5,
  taxRegistered: false,
  currency: "USD",
  inboundShipping: "0",
  packaging: "0",
  adSpend: "0",
  ...over,
});
const rows = [] as SimRow[];

function requested(state: RunState, s = settings()): RunState {
  return simRunReducer(state, { type: "request", id: state.latestId + 1, settings: s });
}

describe("simRunReducer", () => {
  it("shows a reply only for the latest request", () => {
    const first = requested(INITIAL_RUN);
    const second = requested(first);
    const stale = simRunReducer(second, { type: "result", id: first.latestId, rows });
    expect(stale).toBe(second);
    const fresh = simRunReducer(second, { type: "result", id: second.latestId, rows });
    expect(fresh).toMatchObject({ rows, pending: false, invalid: false });
  });

  it("keeps the invalid flag when an earlier run replies after the settings turned invalid", () => {
    const running = requested(INITIAL_RUN);
    const invalid = simRunReducer(running, { type: "invalid", id: running.latestId + 1 });
    const late = simRunReducer(invalid, { type: "result", id: running.latestId, rows });
    expect(late.invalid).toBe(true);
    expect(late.rows).toBeNull();
  });

  it("clears an earlier failure when a new run starts", () => {
    const running = requested(INITIAL_RUN);
    const failed = simRunReducer(running, { type: "failed", id: running.latestId });
    expect(failed).toMatchObject({ failed: true, pending: false });
    expect(requested(failed).failed).toBe(false);
  });

  it("records the settings a run was solved with, not the latest typed ones", () => {
    const hkd = requested(INITIAL_RUN, settings({ currency: "HKD" }));
    const done = simRunReducer(hkd, { type: "result", id: hkd.latestId, rows });
    const switched = requested(done, settings({ currency: "AUD" }));
    expect(switched.settings?.currency).toBe("HKD");
  });
});

describe("rowsCurrency", () => {
  it("labels rows in the currency they were solved in", () => {
    const hkd = requested(INITIAL_RUN, settings({ currency: "HKD" }));
    const done = simRunReducer(hkd, { type: "result", id: hkd.latestId, rows });
    expect(rowsCurrency(done, "AUD")).toBe("HKD");
  });

  it("falls back to the page currency before any rows exist", () => {
    expect(rowsCurrency(INITIAL_RUN, "AUD")).toBe("AUD");
  });
});

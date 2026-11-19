import {
  simulateCatalogue,
  type SimContext,
  type SimItem,
  type SimRow,
  type SimSettings,
} from "../../../lib/simulation/simulate";

export type SimRequest = { id: number; items: SimItem[]; settings: SimSettings; ctx: SimContext };
export type SimResponse =
  { id: number; ok: true; rows: SimRow[] | null } | { id: number; ok: false; message: string };

// A full-catalogue run takes a few hundred ms of Decimal maths: off the main thread.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<SimRequest>) => void) | null;
  postMessage: (message: SimResponse) => void;
};

scope.onmessage = (event) => {
  const { id, items, settings, ctx } = event.data;
  try {
    scope.postMessage({ id, ok: true, rows: simulateCatalogue(items, settings, ctx) });
  } catch (error) {
    scope.postMessage({
      id,
      ok: false,
      message: error instanceof Error ? error.message : "simulation failed",
    });
  }
};

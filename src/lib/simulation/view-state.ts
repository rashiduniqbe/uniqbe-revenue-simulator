import {
  parseAsInteger,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";
import {
  SIM_PLATFORMS,
  TARGET_MARGINS,
  cellScenario,
  type SimPlatform,
  type SimSettings,
  type TargetMarginPct,
} from "./simulate";

export const VIEWS = ["sim", "calc"] as const;
export type View = (typeof VIEWS)[number];

export const SORTS = ["cost-desc", "cost-asc", "name", "profit-desc"] as const;
export type SimSort = (typeof SORTS)[number];

export const GST_FILTERS = ["all", "above", "below"] as const;
export type GstFilter = (typeof GST_FILTERS)[number];

export const DEFAULT_TARGET_MARGIN: TargetMarginPct = 5;

// The simulation's own URL keys. reg, sh, pk, ad and cur are shared with the
// calculator (url-state.ts and AuPrototypeShell), so its settings carry over.
export const simParsers = {
  v: parseAsStringLiteral(VIEWS),
  tm: parseAsNumberLiteral(TARGET_MARGINS).withDefault(DEFAULT_TARGET_MARGIN),
  cat: parseAsString.withDefault("all"),
  q: parseAsString.withDefault(""),
  sort: parseAsStringLiteral(SORTS).withDefault("cost-desc"),
  pg: parseAsInteger.withDefault(1),
  gst: parseAsStringLiteral(GST_FILTERS).withDefault("all"),
  row: parseAsString.withDefault(""),
  rpl: parseAsStringLiteral(SIM_PLATFORMS).withDefault("amazon"),
};

export type SimState = {
  targetMarginPct: TargetMarginPct;
  category: string;
  query: string;
  sort: SimSort;
  page: number;
  gst: GstFilter;
  row: string;
  rowPlatform: SimPlatform;
};

type SimShorts = ReturnType<typeof useQueryStates<typeof simParsers>>[0];
type SimKeyShorts = Omit<SimShorts, "v">;

/**
 * Which view a URL opens. An explicit v wins. Without one, a link that names a
 * product or a selling price predates the simulation, so it keeps opening the
 * calculator; anything else opens the simulation.
 */
export function resolveView(params: URLSearchParams): View {
  const v = simParsers.v.parseServerSide(params.get("v") ?? undefined);
  if (v !== null) return v;
  const hasCalculatorKey = ["p", "sp"].some((key) => (params.get(key) ?? "").trim() !== "");
  return hasCalculatorKey ? "calc" : "sim";
}

function fromShorts(shorts: SimKeyShorts): SimState {
  return {
    targetMarginPct: shorts.tm,
    category: shorts.cat,
    query: shorts.q,
    sort: shorts.sort,
    page: Math.max(1, shorts.pg),
    gst: shorts.gst,
    row: shorts.row,
    rowPlatform: shorts.rpl,
  };
}

export function decodeSimState(params: URLSearchParams): SimState {
  const get = (key: string) => params.get(key) ?? undefined;
  return fromShorts({
    tm: simParsers.tm.parseServerSide(get("tm")),
    cat: simParsers.cat.parseServerSide(get("cat")),
    q: simParsers.q.parseServerSide(get("q")),
    sort: simParsers.sort.parseServerSide(get("sort")),
    pg: simParsers.pg.parseServerSide(get("pg")),
    gst: simParsers.gst.parseServerSide(get("gst")),
    row: simParsers.row.parseServerSide(get("row")),
    rpl: simParsers.rpl.parseServerSide(get("rpl")),
  });
}

function toShorts(patch: Partial<SimState>): Partial<SimKeyShorts> {
  return {
    ...(patch.targetMarginPct === undefined ? {} : { tm: patch.targetMarginPct }),
    ...(patch.category === undefined ? {} : { cat: patch.category }),
    ...(patch.query === undefined ? {} : { q: patch.query }),
    ...(patch.sort === undefined ? {} : { sort: patch.sort }),
    ...(patch.page === undefined ? {} : { pg: patch.page }),
    ...(patch.gst === undefined ? {} : { gst: patch.gst }),
    ...(patch.row === undefined ? {} : { row: patch.row }),
    ...(patch.rowPlatform === undefined ? {} : { rpl: patch.rowPlatform }),
  };
}

/**
 * The view and the simulation's own state, from the URL. `calculatorKeys` are
 * the current p and sp (from useScenario), for links without v. Switching view pushes
 * a history entry, so Back means "previous view"; settings and filters replace
 * the current entry, so Back never steps through keystrokes.
 */
export function useSimUrlState(calculatorKeys: { p: string; sp: string }): {
  view: View;
  sim: SimState;
  setView: (view: View) => void;
  setSim: (patch: Partial<SimState>) => void;
} {
  const [shorts, setShorts] = useQueryStates(simParsers);
  const { v, ...rest } = shorts;
  return {
    view: v ?? resolveView(new URLSearchParams(calculatorKeys)),
    sim: fromShorts(rest),
    setView: (next) => void setShorts({ v: next }, { history: "push" }),
    setSim: (patch) => void setShorts(toShorts(patch), { history: "replace" }),
  };
}

/** The URL keys "Check this row in the calculator" writes, in one history push. */
export type CheckRowQuery = {
  v: "calc";
  m: "AU";
  p: string;
  pl: SimPlatform;
  sp: string;
  reg: boolean;
  sh: string;
  pk: string;
  ad: string;
  du: "";
  rf: "";
  ap: "professional";
  shp: "basic";
  abn: false;
  et: false;
  cc: "";
  dv: "";
  cur: SimSettings["currency"];
};

/**
 * Opens the calculator on a simulated cell. The scenario is the cell's own
 * (cellScenario), so the calculator rebuilds the same input and shows the
 * same profit to the cent. Leftovers from an earlier calculator session —
 * typed duty or referral fee, a custom cost or declared value, other plans —
 * are cleared, because the simulation did not use them. cur is the currency
 * the row was solved in, which may lag the page just after a currency switch.
 */
export function checkRowQuery(
  code: string,
  settings: SimSettings,
  platform: SimPlatform,
  price: string,
): CheckRowQuery {
  const scenario = cellScenario({ code }, settings, platform, price);
  return {
    v: "calc",
    m: "AU",
    p: scenario.productCode,
    pl: platform,
    sp: scenario.sellingPriceLocal,
    reg: scenario.taxRegistered,
    sh: scenario.inboundShippingLocal,
    pk: scenario.packagingLocal,
    ad: scenario.adSpendLocal,
    du: "",
    rf: "",
    ap: "professional",
    shp: "basic",
    abn: false,
    et: false,
    cc: "",
    dv: "",
    cur: settings.currency,
  };
}

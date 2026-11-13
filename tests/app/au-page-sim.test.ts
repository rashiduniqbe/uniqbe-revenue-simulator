import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const loadStorepriceCatalogue = vi.fn();

vi.mock("../../src/lib/storeprice/fetch", () => ({
  loadStorepriceCatalogue: () => loadStorepriceCatalogue(),
}));
vi.mock("../../src/fx/store", () => ({
  readFxSnapshot: () =>
    Promise.resolve({
      base: "USD",
      rates: { GBP: 0.74, AUD: 1.4 },
      asOf: "2026-08-25",
      fetchedAt: "2026-08-25T06:00:00.000Z",
      provider: "seed",
      degraded: false,
      ageDays: 0,
    }),
}));
// One state object serves every useQueryStates call: scenario, prototype and
// simulation keys, with no v (a bare "/" link).
vi.mock("nuqs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("nuqs")>()),
  useQueryStates: () => [
    {
      m: "AU",
      p: "",
      pl: "amazon",
      reg: false,
      sp: "",
      sh: "0.00",
      pk: "0.00",
      ad: "0.00",
      du: "",
      rf: "",
      ap: "professional",
      shp: "basic",
      abn: false,
      et: false,
      cur: "USD",
      cc: "",
      dv: "",
      v: null,
      tm: 5,
      cat: "all",
      q: "",
      sort: "cost-desc",
      pg: 1,
      gst: "all",
      row: "",
      rpl: "amazon",
    },
    () => undefined,
  ],
}));

const { default: AuPage } = await import("../../src/app/(au)/page");

describe("/ with no keys (simulation view)", () => {
  it("opens the simulation with the FX badge, the invoice disclaimer and a loading table", async () => {
    loadStorepriceCatalogue.mockResolvedValue({
      ok: true,
      items: [
        {
          code: "TT00001",
          name: "Test Phone 128GB",
          categoryRaw: "Mobile Phone",
          category: "mobile-phone",
          categoryLabel: "Mobile Phone",
          usd: 480,
          storageGb: 128,
          search: "test phone 128gb mobile phone",
        },
      ],
      skipped: [],
      fetchedAt: "2026-11-12T04:00:00.000Z",
    });
    const html = renderToStaticMarkup(await AuPage());
    expect(html).toContain('data-testid="sim-view"');
    expect(html).toContain('aria-pressed="true">Simulation</button>');
    expect(html).toContain("1 USD = 1.4000 AUD · 7.8450 HKD (fixed) · rate as of 25 Aug 2026");
    expect(html).toContain("Final price is confirmed on Uniqbe");
    expect(html).toContain("Working out prices for 1 product…");
    expect(html).not.toContain("Net profit per unit");
  });
});

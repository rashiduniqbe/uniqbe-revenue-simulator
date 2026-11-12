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
      rates: { GBP: 0.74, AUD: 1.4, HKD: 7.8 },
      asOf: "2026-08-25",
      fetchedAt: "2026-08-25T06:00:00.000Z",
      provider: "seed",
      degraded: true,
      ageDays: 0,
    }),
}));
vi.mock("nuqs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("nuqs")>()),
  useQueryStates: () => [
    {
      m: "UK",
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
      // Prototype-only keys (currency, custom price, declared value).
      cur: "USD",
      cc: "",
      dv: "",
    },
    () => undefined,
  ],
}));

const { default: AuPrototypePage } = await import("../../src/app/prototype/au/page");

async function render(): Promise<string> {
  return renderToStaticMarkup(await AuPrototypePage());
}

describe("/prototype/au page", () => {
  it("shows an error card, not a fallback list, when storeprice cannot be loaded", async () => {
    loadStorepriceCatalogue.mockResolvedValue({ ok: false, reason: "unreachable" });
    const html = await render();
    expect(html).toContain("Price list unavailable");
    expect(html).toContain("not by this tool");
    expect(html).not.toContain("Net profit per unit");
  });

  it("renders the calculator with the FX badge and invoice disclaimer when prices load", async () => {
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
    const html = await render();
    expect(html).toContain("Net profit per unit");
    expect(html).toContain("1 USD = 1.4000 AUD · 7.8000 HKD · rate as of 25 Aug 2026");
    expect(html).toContain("Final price is confirmed on Uniqbe");
    expect(html).toContain('aria-label="Currency for all prices"');
    expect(html).toContain("in USD");
  });
});

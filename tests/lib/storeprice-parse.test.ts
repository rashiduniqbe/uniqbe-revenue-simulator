import { describe, expect, it } from "vitest";
import { parseStorepriceHtml } from "../../src/lib/storeprice/parse";

type Row = Record<string, unknown>;

const row = (overrides: Row = {}): Row => ({
  sku: "TT00001",
  name: "Test Phone Pro 256GB (Blue)",
  cat: "Mobile Phone",
  priceNum: 1100,
  dsNum: 1050,
  prevPriceNum: 1120,
  refPriceNum: 1120,
  refDate: "23 Oct 2026",
  ...overrides,
});

const page = (rows: Row[]): string =>
  `<!doctype html><html><body><table></table>\n<script>\nconst P = ${JSON.stringify(rows)};\nconst HAS_PREV = true;\n</script></body></html>`;

describe("parseStorepriceHtml", () => {
  it("maps a row onto a live item using the dropship price as USD cost", () => {
    const result = parseStorepriceHtml(page([row()]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toEqual([
      {
        code: "TT00001",
        name: "Test Phone Pro 256GB (Blue)",
        categoryRaw: "Mobile Phone",
        category: "mobile-phone",
        categoryLabel: "Mobile Phone",
        usd: 1050,
        storageGb: 256,
        search: "test phone pro 256gb (blue) mobile phone",
      },
    ]);
    expect(result.skipped).toEqual([]);
  });

  it("maps categories case-insensitively through the shared category map", () => {
    const result = parseStorepriceHtml(page([row({ cat: "Gaming And Consoles" })]));
    expect(result.ok && result.items[0]?.category).toBe("gaming");
  });

  it("skips rows whose category has no duty mapping and reports them", () => {
    const result = parseStorepriceHtml(
      page([row(), row({ sku: "TT00002", cat: "Fitness Tracker" })]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items.map((i) => i.code)).toEqual(["TT00001"]);
    expect(result.skipped).toEqual([
      { code: "TT00002", reason: 'no duty mapping for "Fitness Tracker"' },
    ]);
  });

  it("fails when the page has no product array", () => {
    const result = parseStorepriceHtml("<html><body>maintenance</body></html>");
    expect(result).toEqual({ ok: false, reason: "no-product-array" });
  });

  it("fails when the product array is not valid JSON", () => {
    const result = parseStorepriceHtml("<script>const P = [{sku: oops}];</script>");
    expect(result).toEqual({ ok: false, reason: "invalid-json" });
  });

  it("fails when no row matches the expected shape", () => {
    const result = parseStorepriceHtml(page([row({ dsNum: "75" })]));
    expect(result).toEqual({ ok: false, reason: "invalid-rows" });
  });

  it("skips a malformed row instead of failing the whole list", () => {
    const result = parseStorepriceHtml(
      page([row(), row({ sku: "TT00002", dsNum: 0 }), row({ sku: "bad", dsNum: 10 })]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items.map((i) => i.code)).toEqual(["TT00001"]);
    expect(result.skipped).toEqual([
      { code: "TT00002", reason: "invalid row" },
      { code: "bad", reason: "invalid row" },
    ]);
  });

  it("does not require the unused non-dropship price", () => {
    const withoutPrice = { ...row(), priceNum: undefined };
    const result = parseStorepriceHtml(page([withoutPrice]));
    expect(result.ok).toBe(true);
  });

  it("fails when no row survives category mapping", () => {
    const result = parseStorepriceHtml(page([row({ cat: "Speaker" })]));
    expect(result).toEqual({ ok: false, reason: "no-usable-items" });
  });

  it("rejects a non-positive dropship price", () => {
    const result = parseStorepriceHtml(page([row({ dsNum: 0 })]));
    expect(result).toEqual({ ok: false, reason: "invalid-rows" });
  });
});

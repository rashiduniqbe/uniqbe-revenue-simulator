import { describe, expect, it, vi } from "vitest";
import { loadStorepriceCatalogue } from "../../src/lib/storeprice/fetch";

const html = `<script>const P = [{"sku":"TT00001","name":"Test Phone 128GB","cat":"Mobile Phone","priceNum":500,"dsNum":480}];</script>`;

const okFetch = (body: string, status = 200) =>
  vi.fn().mockResolvedValue({ ok: status < 400, status, text: () => Promise.resolve(body) });

const NOW = new Date("2026-11-12T04:00:00.000Z");

describe("loadStorepriceCatalogue", () => {
  it("requests the given URL and returns parsed items with the fetch time", async () => {
    const fetchImpl = okFetch(html);
    const result = await loadStorepriceCatalogue({
      fetchImpl,
      url: "https://example.test/",
      now: NOW,
    });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://example.test/");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items[0]?.usd).toBe(480);
    expect(result.fetchedAt).toBe("2026-11-12T04:00:00.000Z");
  });

  it("fails with http-error on a non-2xx response", async () => {
    const result = await loadStorepriceCatalogue({
      fetchImpl: okFetch("", 503),
      url: "https://example.test/",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "http-error" });
  });

  it("fails with unreachable when the request throws", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ENOTFOUND"));
    const result = await loadStorepriceCatalogue({
      fetchImpl,
      url: "https://example.test/",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "unreachable" });
  });

  it("passes parse failures through", async () => {
    const result = await loadStorepriceCatalogue({
      fetchImpl: okFetch("<html>down for maintenance</html>"),
      url: "https://example.test/",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "no-product-array" });
  });
});

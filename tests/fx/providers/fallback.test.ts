import { describe, expect, it, vi } from "vitest";
import { fetchFallbackSnapshot } from "../../../src/fx/providers/fallback";

describe("fetchFallbackSnapshot", () => {
  it("throws immediately when no URL is configured", async () => {
    const fetchImpl = vi.fn();
    await expect(fetchFallbackSnapshot(fetchImpl, undefined, undefined)).rejects.toThrow(
      /FX_FALLBACK_URL/,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("parses a successful response and sends the API key as a Bearer token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ date: "2026-08-25", rates: { GBP: 0.75, AUD: 1.4 } }),
    }) as unknown as typeof fetch;
    const snapshot = await fetchFallbackSnapshot(
      fetchImpl,
      "https://backup.test/rates",
      "secret-key",
    );
    expect(snapshot).toEqual({
      base: "USD",
      rates: { GBP: 0.75, AUD: 1.4 },
      asOf: "2026-08-25",
      fetchedAt: snapshot.fetchedAt,
      provider: "fallback",
    });
    expect(fetchImpl).toHaveBeenCalledWith("https://backup.test/rates", {
      headers: { Authorization: "Bearer secret-key" },
    });
  });

  it("omits the Authorization header when no API key is configured", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ date: "2026-08-25", rates: { GBP: 0.75, AUD: 1.4 } }),
    }) as unknown as typeof fetch;
    await fetchFallbackSnapshot(fetchImpl, "https://backup.test/rates", undefined);
    expect(fetchImpl).toHaveBeenCalledWith("https://backup.test/rates", { headers: undefined });
  });

  it("throws when the response is not ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({}),
    }) as unknown as typeof fetch;
    await expect(
      fetchFallbackSnapshot(fetchImpl, "https://backup.test/rates", undefined),
    ).rejects.toThrow(/503/);
  });

  it("throws when the response is missing GBP or AUD", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ date: "2026-08-25", rates: { GBP: 0.75 } }),
    }) as unknown as typeof fetch;
    await expect(
      fetchFallbackSnapshot(fetchImpl, "https://backup.test/rates", undefined),
    ).rejects.toThrow(/GBP\/AUD/);
  });
});

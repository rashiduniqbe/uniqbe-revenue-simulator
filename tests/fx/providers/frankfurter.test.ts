import { describe, expect, it, vi } from "vitest";
import { fetchFrankfurterSnapshot } from "../../../src/fx/providers/frankfurter";

function mockFetch(body: unknown, ok = true, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

describe("fetchFrankfurterSnapshot", () => {
  it("parses a successful Frankfurter response into an FxRawSnapshotType", async () => {
    const fetchImpl = mockFetch({
      amount: 1,
      base: "USD",
      date: "2026-08-25",
      rates: { GBP: 0.7424, AUD: 1.395 },
    });
    const snapshot = await fetchFrankfurterSnapshot(fetchImpl, "https://example.test/latest");
    expect(snapshot).toEqual({
      base: "USD",
      rates: { GBP: 0.7424, AUD: 1.395 },
      asOf: "2026-08-25",
      fetchedAt: snapshot.fetchedAt,
      provider: "frankfurter",
    });
    expect(new Date(snapshot.fetchedAt).toString()).not.toBe("Invalid Date");
  });

  it("calls the given base URL with from=USD&to=GBP,AUD", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ date: "2026-08-25", rates: { GBP: 0.74, AUD: 1.4 } }),
    }) as unknown as typeof fetch;
    await fetchFrankfurterSnapshot(fetchImpl, "https://example.test/latest");
    expect(fetchImpl).toHaveBeenCalledWith("https://example.test/latest?from=USD&to=GBP,AUD");
  });

  it("throws when the response is not ok", async () => {
    const fetchImpl = mockFetch({}, false, 500);
    await expect(
      fetchFrankfurterSnapshot(fetchImpl, "https://example.test/latest"),
    ).rejects.toThrow(/500/);
  });

  it("throws when the response is missing GBP or AUD", async () => {
    const fetchImpl = mockFetch({ date: "2026-08-25", rates: { GBP: 0.74 } });
    await expect(
      fetchFrankfurterSnapshot(fetchImpl, "https://example.test/latest"),
    ).rejects.toThrow(/GBP\/AUD/);
  });
});

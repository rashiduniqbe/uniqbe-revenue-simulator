import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/fx/store", () => ({
  readFxSnapshot: vi.fn().mockResolvedValue({
    base: "USD",
    rates: { GBP: 0.7424, AUD: 1.395 },
    asOf: "2026-08-25",
    fetchedAt: "2026-08-25T06:00:00.000Z",
    provider: "frankfurter",
    ageDays: 0,
    degraded: false,
  }),
}));

import { GET } from "../../../src/app/api/fx/route";

describe("GET /api/fx", () => {
  it("returns the current FX snapshot as JSON", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      base: "USD",
      rates: { GBP: 0.7424, AUD: 1.395 },
      asOf: "2026-08-25",
      fetchedAt: "2026-08-25T06:00:00.000Z",
      provider: "frankfurter",
      ageDays: 0,
      degraded: false,
    });
  });
});

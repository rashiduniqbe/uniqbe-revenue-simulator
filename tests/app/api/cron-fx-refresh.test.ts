import { afterEach, describe, expect, it, vi } from "vitest";

const fetchFrankfurterSnapshot = vi.fn();
const fetchFallbackSnapshot = vi.fn();
const writeFxSnapshot = vi.fn();

vi.mock("../../../src/fx/providers/frankfurter", () => ({
  fetchFrankfurterSnapshot: (...args: unknown[]) => fetchFrankfurterSnapshot(...args),
}));
vi.mock("../../../src/fx/providers/fallback", () => ({
  fetchFallbackSnapshot: (...args: unknown[]) => fetchFallbackSnapshot(...args),
}));
vi.mock("../../../src/fx/store", () => ({
  writeFxSnapshot: (...args: unknown[]) => writeFxSnapshot(...args),
}));

import { GET, POST } from "../../../src/app/api/cron/fx-refresh/route";

const frankfurterSnapshot = {
  base: "USD" as const,
  rates: { GBP: 0.7424, AUD: 1.395 },
  asOf: "2026-08-25",
  fetchedAt: "2026-08-25T06:00:00.000Z",
  provider: "frankfurter" as const,
};
const fallbackSnapshot = { ...frankfurterSnapshot, provider: "fallback" as const };

function request(authHeader?: string): Request {
  return new Request("https://example.test/api/cron/fx-refresh", {
    method: "POST",
    headers: authHeader ? { authorization: authHeader } : undefined,
  });
}

describe("POST /api/cron/fx-refresh", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns 401 with no Authorization header", async () => {
    vi.stubEnv("CRON_SECRET", "the-real-secret");
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(fetchFrankfurterSnapshot).not.toHaveBeenCalled();
  });

  it("returns 401 with the wrong bearer token", async () => {
    vi.stubEnv("CRON_SECRET", "the-real-secret");
    const response = await POST(request("Bearer wrong-token"));
    expect(response.status).toBe(401);
    expect(fetchFrankfurterSnapshot).not.toHaveBeenCalled();
  });

  it("returns 401 when CRON_SECRET itself is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await POST(request("Bearer anything"));
    expect(response.status).toBe(401);
  });

  it("writes the Frankfurter snapshot on success", async () => {
    vi.stubEnv("CRON_SECRET", "the-real-secret");
    fetchFrankfurterSnapshot.mockResolvedValue(frankfurterSnapshot);
    const response = await POST(request("Bearer the-real-secret"));
    expect(response.status).toBe(200);
    expect(writeFxSnapshot).toHaveBeenCalledWith(frankfurterSnapshot);
    expect(fetchFallbackSnapshot).not.toHaveBeenCalled();
  });

  it("falls back to the fallback provider when Frankfurter fails, and writes its result", async () => {
    vi.stubEnv("CRON_SECRET", "the-real-secret");
    fetchFrankfurterSnapshot.mockRejectedValue(new Error("frankfurter down"));
    fetchFallbackSnapshot.mockResolvedValue(fallbackSnapshot);
    const response = await POST(request("Bearer the-real-secret"));
    expect(response.status).toBe(200);
    expect(writeFxSnapshot).toHaveBeenCalledWith(fallbackSnapshot);
  });

  it("writes nothing and returns 502 when both providers fail", async () => {
    vi.stubEnv("CRON_SECRET", "the-real-secret");
    fetchFrankfurterSnapshot.mockRejectedValue(new Error("frankfurter down"));
    fetchFallbackSnapshot.mockRejectedValue(new Error("fallback down"));
    const response = await POST(request("Bearer the-real-secret"));
    expect(response.status).toBe(502);
    expect(writeFxSnapshot).not.toHaveBeenCalled();
  });

  it("GET with a valid bearer token successfully triggers a refresh", async () => {
    vi.stubEnv("CRON_SECRET", "the-real-secret");
    fetchFrankfurterSnapshot.mockResolvedValue(frankfurterSnapshot);
    const response = await GET(request("Bearer the-real-secret"));
    expect(response.status).toBe(200);
    expect(writeFxSnapshot).toHaveBeenCalledWith(frankfurterSnapshot);
    expect(fetchFallbackSnapshot).not.toHaveBeenCalled();
  });

  it("GET without a valid token returns 401", async () => {
    vi.stubEnv("CRON_SECRET", "the-real-secret");
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(fetchFrankfurterSnapshot).not.toHaveBeenCalled();
  });

  it("returns 401 for a malformed/non-Bearer Authorization header", async () => {
    vi.stubEnv("CRON_SECRET", "the-real-secret");
    const response = await POST(request("Basic abc"));
    expect(response.status).toBe(401);
    expect(fetchFrankfurterSnapshot).not.toHaveBeenCalled();
  });

  it("returns 500 and does not call the fallback provider when the store write fails", async () => {
    vi.stubEnv("CRON_SECRET", "the-real-secret");
    fetchFrankfurterSnapshot.mockResolvedValue(frankfurterSnapshot);
    writeFxSnapshot.mockRejectedValue(new Error("upstash down"));
    const response = await POST(request("Bearer the-real-secret"));
    expect(response.status).toBe(500);
    expect(fetchFallbackSnapshot).not.toHaveBeenCalled();
    expect(writeFxSnapshot).toHaveBeenCalledTimes(1);
  });
});

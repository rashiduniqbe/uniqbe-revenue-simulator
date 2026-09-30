import { describe, expect, it, vi } from "vitest";
import {
  computeAgeDays,
  toFxSnapshot,
  readFxSnapshot,
  writeFxSnapshot,
  redisFromEnv,
} from "../../src/fx/store";
import type { FxRawSnapshotType } from "../../src/lib/schemas";

const rawFrankfurter: FxRawSnapshotType = {
  base: "USD",
  rates: { GBP: 0.7424, AUD: 1.395 },
  asOf: "2026-08-25",
  fetchedAt: "2026-08-25T06:00:00.000Z",
  provider: "frankfurter",
};

describe("computeAgeDays", () => {
  it("returns 0 for the same day", () => {
    expect(computeAgeDays("2026-08-25", new Date("2026-08-25T18:00:00.000Z"))).toBe(0);
  });

  it("returns 3 exactly three days later", () => {
    expect(computeAgeDays("2026-08-25", new Date("2026-08-28T00:00:00.000Z"))).toBe(3);
  });

  it("returns 14 two weeks later", () => {
    expect(computeAgeDays("2026-08-25", new Date("2026-09-08T00:00:00.000Z"))).toBe(14);
  });
});

describe("toFxSnapshot", () => {
  it("is not degraded when fresh and from frankfurter", () => {
    const snapshot = toFxSnapshot(rawFrankfurter, new Date("2026-08-25T12:00:00.000Z"));
    expect(snapshot.ageDays).toBe(0);
    expect(snapshot.degraded).toBe(false);
  });

  it("is not degraded when fresh and from the fallback provider", () => {
    const raw: FxRawSnapshotType = { ...rawFrankfurter, provider: "fallback" };
    const snapshot = toFxSnapshot(raw, new Date("2026-08-25T12:00:00.000Z"));
    expect(snapshot.degraded).toBe(false);
  });

  it("is not degraded at exactly ageDays === 3", () => {
    const snapshot = toFxSnapshot(rawFrankfurter, new Date("2026-08-28T00:00:00.000Z"));
    expect(snapshot.ageDays).toBe(3);
    expect(snapshot.degraded).toBe(false);
  });

  it("becomes degraded once ageDays exceeds 3", () => {
    const snapshot = toFxSnapshot(rawFrankfurter, new Date("2026-08-30T00:00:00.000Z"));
    expect(snapshot.ageDays).toBe(5);
    expect(snapshot.degraded).toBe(true);
  });

  it("is always degraded when the provider is seed, even if fresh", () => {
    const raw: FxRawSnapshotType = { ...rawFrankfurter, provider: "seed" };
    const snapshot = toFxSnapshot(raw, new Date("2026-08-25T12:00:00.000Z"));
    expect(snapshot.ageDays).toBe(0);
    expect(snapshot.degraded).toBe(true);
  });
});

describe("readFxSnapshot", () => {
  it("returns the parsed Redis value when present", async () => {
    const redis = { get: vi.fn().mockResolvedValue(rawFrankfurter), set: vi.fn() };
    const snapshot = await readFxSnapshot(redis, new Date("2026-08-25T12:00:00.000Z"));
    expect(snapshot.provider).toBe("frankfurter");
    expect(snapshot.rates.GBP).toBe(0.7424);
    expect(snapshot.degraded).toBe(false);
  });

  it("falls back to the seed file when the Redis key is missing", async () => {
    const redis = { get: vi.fn().mockResolvedValue(null), set: vi.fn() };
    const snapshot = await readFxSnapshot(redis, new Date("2026-08-25T12:00:00.000Z"));
    expect(snapshot.provider).toBe("seed");
    expect(snapshot.degraded).toBe(true);
  });

  it("falls back to the seed file when Redis throws", async () => {
    const redis = { get: vi.fn().mockRejectedValue(new Error("connection refused")), set: vi.fn() };
    const snapshot = await readFxSnapshot(redis, new Date("2026-08-25T12:00:00.000Z"));
    expect(snapshot.provider).toBe("seed");
    expect(snapshot.degraded).toBe(true);
  });
});

describe("writeFxSnapshot", () => {
  it("writes the raw snapshot (no ageDays/degraded) to the Redis key", async () => {
    const redis = { get: vi.fn(), set: vi.fn().mockResolvedValue("OK") };
    await writeFxSnapshot(rawFrankfurter, redis);
    expect(redis.set).toHaveBeenCalledWith("fx:snapshot", rawFrankfurter);
  });
});

describe("redisFromEnv", () => {
  it("returns null when URL or token is missing, so reads never wait on retries", () => {
    expect(redisFromEnv({})).toBeNull();
    expect(redisFromEnv({ UPSTASH_REDIS_REST_URL: "https://x.upstash.io" })).toBeNull();
    expect(redisFromEnv({ UPSTASH_REDIS_REST_TOKEN: "t" })).toBeNull();
    expect(redisFromEnv({ UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "" })).toBeNull();
  });

  it("returns a client when both are set (either naming convention)", () => {
    expect(
      redisFromEnv({
        UPSTASH_REDIS_REST_URL: "https://x.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "t",
      }),
    ).not.toBeNull();
    expect(
      redisFromEnv({ KV_REST_API_URL: "https://x.upstash.io", KV_REST_API_TOKEN: "t" }),
    ).not.toBeNull();
  });
});

describe("readFxSnapshot / writeFxSnapshot with no Redis configured", () => {
  it("read serves the degraded seed immediately", async () => {
    const snapshot = await readFxSnapshot(null, new Date("2026-08-25T12:00:00.000Z"));
    expect(snapshot.provider).toBe("seed");
    expect(snapshot.degraded).toBe(true);
  });

  it("write throws so the cron route reports the failure", async () => {
    await expect(writeFxSnapshot(rawFrankfurter, null)).rejects.toThrow(/not configured/);
  });
});

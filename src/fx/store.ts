import { Redis } from "@upstash/redis";
import fxSeedRaw from "../data/fx-seed.json";
import { FxRawSnapshot, type FxRawSnapshotType, type FxSnapshotType } from "../lib/schemas";

const FX_REDIS_KEY = "fx:snapshot";
const DEGRADED_AGE_DAYS_THRESHOLD = 3;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

type RedisLike = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<unknown>;
};

// Returns null when Redis isn't configured, so reads fall straight to the seed
// instead of waiting out @upstash/redis's retry backoff on an empty URL
// (spec §11.4: "Kill Redis → app serves seed rates … no crash").
export function redisFromEnv(
  env: Record<string, string | undefined> = process.env,
): RedisLike | null {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function computeAgeDays(asOf: string, now: Date = new Date()): number {
  const asOfDate = new Date(`${asOf}T00:00:00.000Z`);
  const diffMs = now.getTime() - asOfDate.getTime();
  return Math.floor(diffMs / MS_PER_DAY);
}

export function toFxSnapshot(raw: FxRawSnapshotType, now: Date = new Date()): FxSnapshotType {
  const ageDays = computeAgeDays(raw.asOf, now);
  const degraded = raw.provider === "seed" || ageDays > DEGRADED_AGE_DAYS_THRESHOLD;
  return { ...raw, ageDays, degraded };
}

function seedSnapshot(now: Date): FxSnapshotType {
  return toFxSnapshot(FxRawSnapshot.parse(fxSeedRaw), now);
}

export async function readFxSnapshot(
  redis: RedisLike | null = redisFromEnv(),
  now: Date = new Date(),
): Promise<FxSnapshotType> {
  if (redis === null) return seedSnapshot(now);
  try {
    const stored = await redis.get(FX_REDIS_KEY);
    if (stored === null || stored === undefined) {
      return seedSnapshot(now);
    }
    return toFxSnapshot(FxRawSnapshot.parse(stored), now);
  } catch {
    return seedSnapshot(now);
  }
}

export async function writeFxSnapshot(
  raw: FxRawSnapshotType,
  redis: RedisLike | null = redisFromEnv(),
): Promise<void> {
  if (redis === null) throw new Error("Redis is not configured (UPSTASH_REDIS_REST_URL/TOKEN)");
  await redis.set(FX_REDIS_KEY, raw);
}

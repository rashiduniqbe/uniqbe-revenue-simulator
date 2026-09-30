import { Redis } from "@upstash/redis";
import fxSeedRaw from "../data/fx-seed.json";
import { FxRawSnapshot, type FxRawSnapshotType, type FxSnapshotType } from "../lib/schemas";

const FX_REDIS_KEY = "fx:snapshot";
const DEGRADED_AGE_DAYS_THRESHOLD = 3;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
// Upper bound on a Redis read before falling back to the seed, so an
// unreachable or blackholed host never stalls a page render.
const FX_READ_TIMEOUT_MS = 1500;
const REDIS_RETRY_COUNT = 1;
const REDIS_RETRY_BACKOFF_MS = 100;

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
  try {
    return new Redis({
      url,
      token,
      retry: { retries: REDIS_RETRY_COUNT, backoff: () => REDIS_RETRY_BACKOFF_MS },
    });
  } catch {
    // A malformed URL makes the client constructor throw; treat it as "not configured".
    return null;
  }
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
  timeoutMs: number = FX_READ_TIMEOUT_MS,
): Promise<FxSnapshotType> {
  if (redis === null) return seedSnapshot(now);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Redis read timed out")), timeoutMs);
    });
    const stored = await Promise.race([redis.get(FX_REDIS_KEY), timeout]);
    if (stored === null || stored === undefined) {
      return seedSnapshot(now);
    }
    return toFxSnapshot(FxRawSnapshot.parse(stored), now);
  } catch {
    return seedSnapshot(now);
  } finally {
    clearTimeout(timer);
  }
}

export async function writeFxSnapshot(
  raw: FxRawSnapshotType,
  redis: RedisLike | null = redisFromEnv(),
): Promise<void> {
  if (redis === null) throw new Error("Redis is not configured (UPSTASH_REDIS_REST_URL/TOKEN)");
  await redis.set(FX_REDIS_KEY, raw);
}

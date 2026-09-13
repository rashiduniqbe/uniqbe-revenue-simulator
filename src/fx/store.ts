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

function defaultRedisClient(): RedisLike {
  return Redis.fromEnv();
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
  redis: RedisLike = defaultRedisClient(),
  now: Date = new Date(),
): Promise<FxSnapshotType> {
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
  redis: RedisLike = defaultRedisClient(),
): Promise<void> {
  await redis.set(FX_REDIS_KEY, raw);
}

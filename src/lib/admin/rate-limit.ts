import { upstashFromEnv } from "../../fx/store";

export const LOGIN_MAX_ATTEMPTS = 10;
export const LOGIN_GLOBAL_MAX_ATTEMPTS = 100;
export const LOGIN_WINDOW_SECONDS = 15 * 60;
const MAX_MEMORY_KEYS = 5000;
const GLOBAL_KEY = "admin:login:global";

export type CounterStore = {
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<unknown>;
};

export type MemoryCounterStore = CounterStore & { size: () => number };

export type LoginAttemptResult = { allowed: boolean; retryAfterSeconds: number };

export function createMemoryCounterStore(
  now: () => number = Date.now,
  maxKeys: number = MAX_MEMORY_KEYS,
): MemoryCounterStore {
  const counters = new Map<string, { count: number; expiresAt: number }>();
  const sweepExpired = () => {
    for (const [key, entry] of counters) if (entry.expiresAt <= now()) counters.delete(key);
  };
  const evictOldest = () => {
    while (counters.size >= maxKeys) {
      const oldest = counters.keys().next().value;
      if (oldest === undefined) return;
      counters.delete(oldest);
    }
  };
  return {
    size: () => counters.size,
    incr: async (key) => {
      if (counters.size >= maxKeys) sweepExpired();
      const existing = counters.get(key);
      if (existing && existing.expiresAt > now()) {
        existing.count += 1;
        return existing.count;
      }
      evictOldest();
      counters.set(key, { count: 1, expiresAt: Number.POSITIVE_INFINITY });
      return 1;
    },
    expire: async (key, seconds) => {
      const entry = counters.get(key);
      if (entry) entry.expiresAt = now() + seconds * 1000;
    },
  };
}

let memoryStore = createMemoryCounterStore();

export function resetMemoryLoginStore(): void {
  memoryStore = createMemoryCounterStore();
}

/**
 * Redis when configured (shared across serverless instances). Outside production a
 * per-instance memory store is used. In production there is no fallback: a per-instance
 * counter would not bound brute force across serverless instances, so the caller must deny.
 */
export function getLoginStore(
  env: Record<string, string | undefined> = process.env,
): CounterStore | null {
  const redis = upstashFromEnv(env);
  if (redis) return redis;
  return env.NODE_ENV === "production" ? null : memoryStore;
}

async function countAttempt(store: CounterStore, key: string): Promise<number> {
  const count = await store.incr(key);
  if (count === 1) await store.expire(key, LOGIN_WINDOW_SECONDS);
  return count;
}

/**
 * Counts login attempts per client, plus a global cap because there is one shared password.
 * Blocked clients do not consume the global budget, so one client cannot lock everyone out
 * by hammering. A store failure denies the attempt (fails closed).
 */
export async function checkLoginAttempt(
  store: CounterStore,
  clientId: string,
): Promise<LoginAttemptResult> {
  try {
    const clientCount = await countAttempt(store, `admin:login:${clientId}`);
    if (clientCount > LOGIN_MAX_ATTEMPTS) {
      return { allowed: false, retryAfterSeconds: LOGIN_WINDOW_SECONDS };
    }
    const globalCount = await countAttempt(store, GLOBAL_KEY);
    return {
      allowed: globalCount <= LOGIN_GLOBAL_MAX_ATTEMPTS,
      retryAfterSeconds: LOGIN_WINDOW_SECONDS,
    };
  } catch (error: unknown) {
    console.error("admin login: rate limit store failed, denying attempt", error);
    return { allowed: false, retryAfterSeconds: LOGIN_WINDOW_SECONDS };
  }
}

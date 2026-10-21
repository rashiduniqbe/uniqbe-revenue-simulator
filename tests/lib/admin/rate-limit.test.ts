import { describe, expect, it, vi } from "vitest";
import {
  LOGIN_GLOBAL_MAX_ATTEMPTS,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_WINDOW_SECONDS,
  checkLoginAttempt,
  createMemoryCounterStore,
  type CounterStore,
} from "../../../src/lib/admin/rate-limit";

const START_MS = 1_800_000_000_000;

function fakeClock() {
  let now = START_MS;
  return { now: () => now, advanceSeconds: (s: number) => (now += s * 1000) };
}

describe("checkLoginAttempt", () => {
  it("allows up to the maximum attempts then blocks", async () => {
    const store = createMemoryCounterStore(fakeClock().now);
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) {
      expect((await checkLoginAttempt(store, "1.2.3.4")).allowed).toBe(true);
    }
    const blocked = await checkLoginAttempt(store, "1.2.3.4");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(LOGIN_WINDOW_SECONDS);
  });

  it("tracks each client separately", async () => {
    const store = createMemoryCounterStore(fakeClock().now);
    for (let i = 0; i <= LOGIN_MAX_ATTEMPTS; i++) await checkLoginAttempt(store, "1.1.1.1");
    expect((await checkLoginAttempt(store, "2.2.2.2")).allowed).toBe(true);
  });

  it("allows again after the window has passed", async () => {
    const clock = fakeClock();
    const store = createMemoryCounterStore(clock.now);
    for (let i = 0; i <= LOGIN_MAX_ATTEMPTS; i++) await checkLoginAttempt(store, "1.1.1.1");
    expect((await checkLoginAttempt(store, "1.1.1.1")).allowed).toBe(false);
    clock.advanceSeconds(LOGIN_WINDOW_SECONDS + 1);
    expect((await checkLoginAttempt(store, "1.1.1.1")).allowed).toBe(true);
  });

  it("sets the expiry on the first attempt only", async () => {
    const incr = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const expire = vi.fn().mockResolvedValue(1);
    const store: CounterStore = { incr, expire };
    await checkLoginAttempt(store, "1.1.1.1");
    await checkLoginAttempt(store, "1.1.1.1");
    expect(expire).toHaveBeenCalledTimes(1);
    expect(expire).toHaveBeenCalledWith(expect.stringContaining("1.1.1.1"), LOGIN_WINDOW_SECONDS);
  });

  it("caps the global attempt count across all clients", async () => {
    const store = createMemoryCounterStore(fakeClock().now);
    let blockedAt = -1;
    for (let i = 0; i < LOGIN_GLOBAL_MAX_ATTEMPTS + 5; i++) {
      const result = await checkLoginAttempt(store, `10.0.${Math.floor(i / 250)}.${i % 250}`);
      if (!result.allowed && blockedAt === -1) blockedAt = i;
    }
    expect(blockedAt).toBe(LOGIN_GLOBAL_MAX_ATTEMPTS);
  });

  it("never grows the memory store past its cap", async () => {
    const store = createMemoryCounterStore(fakeClock().now, 50);
    for (let i = 0; i < 500; i++) await store.incr(`k${i}`);
    expect(store.size()).toBeLessThanOrEqual(50);
  });

  it("fails closed when the store throws", async () => {
    const store: CounterStore = {
      incr: () => Promise.reject(new Error("redis down")),
      expire: () => Promise.resolve(1),
    };
    const result = await checkLoginAttempt(store, "1.1.1.1");
    expect(result.allowed).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSettledEmitter } from "../../../src/lib/analytics/settle";

describe("createSettledEmitter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("a burst of pushes sends only the last value, once, after the delay", () => {
    const send = vi.fn();
    const emitter = createSettledEmitter<string>(1000, send, (v) => v);
    emitter.push("9");
    vi.advanceTimersByTime(300);
    emitter.push("99");
    vi.advanceTimersByTime(300);
    emitter.push("9999.00");
    vi.advanceTimersByTime(999);
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("9999.00");
  });

  it("never sends the same key twice in a row", () => {
    const send = vi.fn();
    const emitter = createSettledEmitter<string>(1000, send, (v) => v);
    emitter.push("a");
    vi.advanceTimersByTime(1000);
    emitter.push("a");
    vi.advanceTimersByTime(1000);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("null cancels a pending send", () => {
    const send = vi.fn();
    const emitter = createSettledEmitter<string>(1000, send, (v) => v);
    emitter.push("a");
    emitter.push(null);
    vi.advanceTimersByTime(5000);
    expect(send).not.toHaveBeenCalled();
  });

  it("cancel() drops a pending send", () => {
    const send = vi.fn();
    const emitter = createSettledEmitter<string>(1000, send, (v) => v);
    emitter.push("a");
    emitter.cancel();
    vi.advanceTimersByTime(5000);
    expect(send).not.toHaveBeenCalled();
  });
});

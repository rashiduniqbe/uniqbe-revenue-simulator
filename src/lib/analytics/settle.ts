// Sends a value only once it has stopped changing for `delayMs`, and never the
// same key twice in a row. Turns a keystroke-by-keystroke stream of results
// into one `calculation_run` per settled result (spec §13 core metric).
export interface SettledEmitter<T> {
  push(value: T | null): void;
  cancel(): void;
}

export function createSettledEmitter<T>(
  delayMs: number,
  send: (value: T) => void,
  keyOf: (value: T) => string,
): SettledEmitter<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSentKey: string | null = null;

  function cancel(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return {
    push(value) {
      cancel();
      if (value === null) return;
      const key = keyOf(value);
      if (key === lastSentKey) return;
      timer = setTimeout(() => {
        timer = null;
        lastSentKey = key;
        send(value);
      }, delayMs);
    },
    cancel,
  };
}

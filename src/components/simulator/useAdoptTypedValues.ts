"use client";

import { useEffect, type RefObject } from "react";
import { typedBeforeHydration } from "../../lib/prehydration";

// Once, right after hydration, hands any text typed before hydration to
// onAdopt in a single call. One call, not one per field: useScenario's setter
// writes the whole scenario, so per-field updates would overwrite each other.
// After this, React owns the inputs and onChange handles everything.
export function useAdoptTypedValues<K extends string>(
  refs: Readonly<Record<K, RefObject<HTMLInputElement | null>>>,
  values: Readonly<Record<K, string>>,
  onAdopt: (typed: Partial<Record<K, string>>) => void,
): void {
  useEffect(() => {
    const keys = Object.keys(refs) as K[];
    const domValues = Object.fromEntries(
      keys.map((key) => [key, refs[key].current?.value]),
    ) as Record<K, string | undefined>;
    const typed = typedBeforeHydration(values, domValues);
    if (Object.keys(typed).length > 0) onAdopt(typed);
  }, []);
}

// Text a visitor typed into a server-rendered input before React hydrated.
// React 19 keeps that text in the DOM but not in state, and its change tracker
// then treats the DOM value as already seen, so typing the same text again
// never fires onChange. Returns the fields whose DOM value differs from state;
// a field with no DOM node (not rendered) is skipped. Values pass through as
// the exact strings typed — they are validated downstream like any input.
export function typedBeforeHydration<K extends string>(
  values: Readonly<Record<K, string>>,
  domValues: Readonly<Record<K, string | undefined>>,
): Partial<Record<K, string>> {
  const keys = Object.keys(values) as K[];
  return Object.fromEntries(
    keys.flatMap((key) => {
      const dom = domValues[key];
      return dom === undefined || dom === values[key] ? [] : [[key, dom]];
    }),
  ) as Partial<Record<K, string>>;
}

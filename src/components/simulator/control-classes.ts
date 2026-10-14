// One 44px floor for every touch control. WCAG 2.5.8 requires only 24px; spec §9.1 says
// partners use this on a phone, so we use the common platform minimum (min-h-11 = 44px).
export const TEXT_INPUT_CLASS =
  "block min-h-11 rounded border border-neutral-300 px-3 py-2 text-sm";
export const MONO_INPUT_CLASS = `${TEXT_INPUT_CLASS} font-mono`;
export const TEXT_LINK_CLASS = "inline-flex min-h-11 items-center text-sm underline";
export const BUTTON_TARGET_CLASS = "min-h-11 px-4 text-sm";

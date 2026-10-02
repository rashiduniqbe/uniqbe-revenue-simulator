export interface ClipboardLike {
  writeText(text: string): Promise<void>;
}

// True only when the link really is on the clipboard. Callers show
// "Link copied" and record scenario_shared only on true.
export async function copyLink(
  clipboard: ClipboardLike | undefined,
  href: string,
): Promise<boolean> {
  if (clipboard === undefined) return false;
  try {
    await clipboard.writeText(href);
    return true;
  } catch {
    return false;
  }
}

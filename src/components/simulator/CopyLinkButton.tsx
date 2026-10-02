"use client";

import { useEffect, useState } from "react";
import { copyLink, type ClipboardLike } from "../../lib/copy-link";
import { track } from "../../lib/analytics/client";
import { scenarioShared } from "../../lib/analytics/events";

const COPIED_MESSAGE_MS = 2000;

// The confirmation uses aria-live without role="status": the threshold banner
// already owns that role and specs locate it with getByRole("status").
export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleClick() {
    const clipboard = navigator.clipboard as ClipboardLike | undefined;
    const ok = await copyLink(clipboard, window.location.href);
    if (!ok) return;
    setCopied(true);
    track(scenarioShared());
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" className="text-sm underline" onClick={handleClick}>
        Copy link
      </button>
      <span aria-live="polite" className="text-sm text-neutral-700">
        {copied ? "Link copied" : ""}
      </span>
    </div>
  );
}

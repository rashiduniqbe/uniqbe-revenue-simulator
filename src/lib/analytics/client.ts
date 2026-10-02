import posthog from "posthog-js";
import { POSTHOG_PRIVACY_OPTIONS, analyticsConfigFromEnv } from "./config";
import type { AnalyticsEvent } from "./events";

// Literal process.env access so Next inlines NEXT_PUBLIC_* into the client bundle.
const config = analyticsConfigFromEnv(
  process.env.NEXT_PUBLIC_POSTHOG_KEY,
  process.env.NEXT_PUBLIC_POSTHOG_HOST,
);

let state: "idle" | "started" | "failed" = "idle";

// Lazy start on the first event: avoids a mount-order race where a child's
// effect (simulator_viewed) runs before a parent's would have initialised PostHog.
function ensureStarted(): boolean {
  if (config === null || typeof window === "undefined" || state === "failed") return false;
  if (state === "started") return true;
  try {
    posthog.init(config.key, { api_host: config.host, ...POSTHOG_PRIVACY_OPTIONS });
    state = "started";
    return true;
  } catch (err) {
    state = "failed";
    console.warn("Analytics disabled: PostHog failed to start", err);
    return false;
  }
}

// Analytics must never break the simulator (spec §13 is measurement, not function).
export function track(event: AnalyticsEvent): void {
  if (!ensureStarted()) return;
  try {
    posthog.capture(event.name, event.properties);
  } catch (err) {
    console.warn(`Analytics event ${event.name} dropped`, err);
  }
}

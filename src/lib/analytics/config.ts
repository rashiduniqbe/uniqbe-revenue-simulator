import { scrubCapture } from "./scrub";

export const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";

export interface AnalyticsConfig {
  key: string;
  host: string;
}

// Spec §4: both env vars optional; an empty key means analytics is off.
export function analyticsConfigFromEnv(
  key: string | undefined,
  host: string | undefined,
): AnalyticsConfig | null {
  const trimmedKey = key?.trim() ?? "";
  if (trimmedKey === "") return null;
  const trimmedHost = host?.trim() ?? "";
  return { key: trimmedKey, host: trimmedHost === "" ? DEFAULT_POSTHOG_HOST : trimmedHost };
}

// Spec §13: EU cloud, identified_only, no session recording. Cookieless
// (memory persistence) approved by the human 2026-09-30. Nothing is captured
// automatically — every event goes through track() with a typed payload.
// disable_compression keeps payloads readable so the E2E privacy check (and
// anyone at Uniqbe with devtools open) can see exactly what is sent.
export const POSTHOG_PRIVACY_OPTIONS = {
  person_profiles: "identified_only",
  persistence: "memory",
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  capture_dead_clicks: false,
  capture_heatmaps: false,
  capture_exceptions: false,
  capture_performance: false,
  rageclick: false,
  disable_session_recording: true,
  disable_surveys: true,
  // Privacy-load-bearing: also disables remote config, which could otherwise
  // switch on autocapture features (e.g. web vitals) from the PostHog project.
  advanced_disable_flags: true,
  save_referrer: false,
  disable_compression: true,
  before_send: scrubCapture,
} as const;

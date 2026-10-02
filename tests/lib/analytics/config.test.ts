import { describe, expect, it } from "vitest";
import {
  DEFAULT_POSTHOG_HOST,
  POSTHOG_PRIVACY_OPTIONS,
  analyticsConfigFromEnv,
} from "../../../src/lib/analytics/config";
import { scrubCapture } from "../../../src/lib/analytics/scrub";

describe("analyticsConfigFromEnv", () => {
  it("returns null when the key is missing, empty or blank (analytics off)", () => {
    expect(analyticsConfigFromEnv(undefined, undefined)).toBeNull();
    expect(analyticsConfigFromEnv("", "https://eu.i.posthog.com")).toBeNull();
    expect(analyticsConfigFromEnv("   ", undefined)).toBeNull();
  });
  it("defaults the host to PostHog EU cloud", () => {
    expect(analyticsConfigFromEnv("phc_x", undefined)).toEqual({
      key: "phc_x",
      host: DEFAULT_POSTHOG_HOST,
    });
    expect(analyticsConfigFromEnv("phc_x", "")).toEqual({
      key: "phc_x",
      host: DEFAULT_POSTHOG_HOST,
    });
    expect(DEFAULT_POSTHOG_HOST).toBe("https://eu.i.posthog.com");
  });
  it("trims both values", () => {
    expect(analyticsConfigFromEnv(" phc_x ", " http://127.0.0.1:3999 ")).toEqual({
      key: "phc_x",
      host: "http://127.0.0.1:3999",
    });
  });
});

describe("POSTHOG_PRIVACY_OPTIONS (spec §13 + approved cookieless decision)", () => {
  it("locks the privacy-relevant options", () => {
    expect(POSTHOG_PRIVACY_OPTIONS).toMatchObject({
      person_profiles: "identified_only",
      persistence: "memory",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      disable_surveys: true,
    });
    expect(POSTHOG_PRIVACY_OPTIONS.before_send).toBe(scrubCapture);
  });
});

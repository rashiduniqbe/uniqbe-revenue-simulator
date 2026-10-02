import { describe, expect, it } from "vitest";
import { scrubCapture, stripUrl } from "../../../src/lib/analytics/scrub";

describe("stripUrl", () => {
  it("drops the query and hash from http(s) URLs", () => {
    expect(stripUrl("https://sim.uniqbe.com/?p=AB12345&sp=599.99#x")).toBe(
      "https://sim.uniqbe.com/",
    );
    expect(stripUrl("http://localhost:3100/compare?sp_uk=1&sp_au=2")).toBe(
      "http://localhost:3100/compare",
    );
  });
  it("leaves non-URL strings untouched", () => {
    expect(stripUrl("UK")).toBe("UK");
    expect(stripUrl("0-10")).toBe("0-10");
    expect(stripUrl("")).toBe("");
  });
});

describe("scrubCapture", () => {
  it("strips every URL-valued property, including $set and $set_once", () => {
    const scrubbed = scrubCapture({
      event: "calculation_run",
      properties: {
        $current_url: "https://sim.uniqbe.com/?sp=599.99",
        $referrer: "https://sim.uniqbe.com/compare?sp_uk=599.99",
        market: "UK",
        count: 3,
      },
      $set: { $initial_current_url: "https://sim.uniqbe.com/?sp=1.00" },
      $set_once: { $initial_referrer: "https://x.com/?q=599.99" },
    });
    expect(JSON.stringify(scrubbed)).not.toContain("599.99");
    expect(JSON.stringify(scrubbed)).not.toContain("sp=");
    expect(scrubbed?.properties.market).toBe("UK");
    expect(scrubbed?.properties.count).toBe(3);
  });
  it("passes null through (an event PostHog already dropped)", () => {
    expect(scrubCapture(null)).toBeNull();
  });
});

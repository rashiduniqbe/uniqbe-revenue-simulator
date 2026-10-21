import { describe, expect, it } from "vitest";
import { formatPrDetails, summarizeDiff } from "../../../src/lib/admin/pr-body";

const item = (code: string, name: string, usd = 100) => ({
  code,
  brand: "B",
  name,
  categoryRaw: "Tablet",
  category: "tablet" as const,
  categoryLabel: "Tablet",
  usd,
  hkdRef: usd * 8,
  storageGb: null,
  search: "",
});

const preview = (overrides: Partial<Parameters<typeof formatPrDetails>[0]> = {}) => ({
  diff: { added: [], removed: [], repriced: [] },
  warnings: [],
  largeChanges: [],
  ...overrides,
});

describe("summarizeDiff", () => {
  it("counts each kind of change", () => {
    const diff = {
      added: [item("AA00001", "a")],
      removed: [],
      repriced: [
        { code: "AA00002", oldUsd: 1, newUsd: 2, pctChange: 100 },
        { code: "AA00003", oldUsd: 1, newUsd: 2, pctChange: 100 },
      ],
    };
    expect(summarizeDiff(diff)).toBe("1 added, 0 removed, 2 repriced");
  });
});

describe("formatPrDetails", () => {
  it("lists added, removed and repriced items inside one fenced block", () => {
    const text = formatPrDetails(
      preview({
        diff: {
          added: [item("AA00001", "New thing", 120)],
          removed: [item("AA00002", "Old thing")],
          repriced: [{ code: "AA00003", oldUsd: 100, newUsd: 110, pctChange: 10 }],
        },
      }),
    );
    expect(text).toContain("+ AA00001 B New thing ($120)");
    expect(text).toContain("- AA00002 B Old thing");
    expect(text).toContain("~ AA00003 $100 -> $110 (+10%)");
    expect(text.match(/```/g)).toHaveLength(2);
  });

  it("cannot be broken out of its fence by spreadsheet text", () => {
    const hostile = "x```\n@everyone [click](http://evil.test)\n```";
    const text = formatPrDetails(
      preview({ diff: { added: [item("AA00001", hostile)], removed: [], repriced: [] } }),
    );
    expect(text.match(/```/g)).toHaveLength(2);
    expect(text.split("\n").filter((line) => line.startsWith("@everyone"))).toEqual([]);
  });

  it("also cleans repriced codes, so it does not rely on upstream validation", () => {
    const text = formatPrDetails(
      preview({
        diff: {
          added: [],
          removed: [],
          repriced: [{ code: "A`B\n```", oldUsd: 1, newUsd: 2, pctChange: 100 }],
        },
      }),
    );
    expect(text.match(/```/g)).toHaveLength(2);
  });

  it("includes warnings and large changes only when there are some", () => {
    expect(formatPrDetails(preview())).not.toMatch(/Warnings|Large changes/);
    const text = formatPrDetails(
      preview({
        warnings: ["AA00001 has HKD/USD ratio 9.000, outside the expected peg band."],
        largeChanges: [{ code: "AA00001", oldUsd: 100, newUsd: 150, pctChange: 50 }],
      }),
    );
    expect(text).toMatch(/Warnings/);
    expect(text).toMatch(/Large changes/);
    expect(text).toContain("AA00001");
  });
});

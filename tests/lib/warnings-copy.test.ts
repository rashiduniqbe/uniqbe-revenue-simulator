import { describe, expect, it } from "vitest";
import { WARNING_COPY, sortWarningsByPriority } from "../../src/lib/warnings-copy";
import type { EngineWarning, WarningCode } from "../../src/engine/types";

const ALL_CODES: WarningCode[] = [
  "AU_BELOW_THRESHOLD",
  "AU_NEAR_THRESHOLD",
  "IMPORT_TAX_CASHFLOW",
  "FX_DEGRADED",
  "CUSTOMS_DECLARED_VALUE_UNCONFIRMED",
  "DOORSTEP_LIABILITY",
  "SHOPIFY_NO_AUDIENCE",
  "SHOPIFY_AU_GST_ON_SUB",
  "NOT_TAX_ADVICE",
];

describe("WARNING_COPY", () => {
  it("has a message for all 9 warning codes", () => {
    for (const code of ALL_CODES) {
      expect(WARNING_COPY[code].message.length).toBeGreaterThan(0);
    }
  });

  it("marks exactly NOT_TAX_ADVICE and DOORSTEP_LIABILITY as always visible", () => {
    const alwaysVisible = ALL_CODES.filter((code) => WARNING_COPY[code].alwaysVisible);
    expect(alwaysVisible.sort()).toEqual(["DOORSTEP_LIABILITY", "NOT_TAX_ADVICE"]);
  });
});

describe("sortWarningsByPriority", () => {
  it("puts FX_DEGRADED first when present", () => {
    const warnings: EngineWarning[] = [
      { code: "NOT_TAX_ADVICE" },
      { code: "FX_DEGRADED" },
      { code: "DOORSTEP_LIABILITY" },
    ];
    expect(sortWarningsByPriority(warnings)[0]!.code).toBe("FX_DEGRADED");
  });

  it("always places NOT_TAX_ADVICE last among a full set", () => {
    const warnings: EngineWarning[] = ALL_CODES.map((code) => ({ code }));
    const sorted = sortWarningsByPriority(warnings);
    expect(sorted[sorted.length - 1]!.code).toBe("NOT_TAX_ADVICE");
  });

  it("does not drop or duplicate any warning", () => {
    const warnings: EngineWarning[] = ALL_CODES.map((code) => ({ code }));
    const sorted = sortWarningsByPriority(warnings);
    expect(sorted.map((w) => w.code).sort()).toEqual([...ALL_CODES].sort());
  });
});

// tests/scripts/build-catalogue.test.ts
import { describe, expect, it, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import {
  mapCategory,
  deriveStorageGb,
  buildSearchHaystack,
  computeChecksum,
  parsePriceListDate,
} from "../../scripts/build-catalogue";
import { Catalogue } from "../../src/lib/schemas";

describe("mapCategory", () => {
  it("maps every known raw category, case-insensitively", () => {
    expect(mapCategory("Mobile Phone").slug).toBe("mobile-phone");
    expect(mapCategory("Earphones").slug).toBe("audio");
    expect(mapCategory("Smart Wearables").slug).toBe("wearable");
    expect(mapCategory("Tablet").slug).toBe("tablet");
    expect(mapCategory("Gaming and Consoles").slug).toBe("gaming");
    expect(mapCategory("Camera").slug).toBe("camera");
    expect(mapCategory("Smart Speaker").slug).toBe("smart-home");
    expect(mapCategory("smart speaker").slug).toBe("smart-home");
    expect(mapCategory("smart living").slug).toBe("smart-home");
    expect(mapCategory("Keyboard").slug).toBe("computer-accessory");
    expect(mapCategory("SmartTag").slug).toBe("computer-accessory");
    expect(mapCategory("Accessories").slug).toBe("computer-accessory");
    expect(mapCategory("Vacuumn Cleaners").slug).toBe("home-appliance");
  });

  it("throws with a fix instruction on an unmapped category", () => {
    expect(() => mapCategory("Drones")).toThrowError(/Unmapped category "Drones"/);
    expect(() => mapCategory("Drones")).toThrowError(/CATEGORY_MAP/);
  });
});

describe("deriveStorageGb", () => {
  it("parses GB", () => {
    expect(deriveStorageGb("Galaxy S25 256GB")).toBe(256);
  });
  it("parses TB as GB x 1024", () => {
    expect(deriveStorageGb("iPhone 17 Pro 1TB")).toBe(1024);
  });
  it("returns null when absent", () => {
    expect(deriveStorageGb("Echo Dot 5th Generation (Charcoal)")).toBeNull();
  });
});

describe("buildSearchHaystack", () => {
  it("lowercases and joins brand, name, category label", () => {
    expect(buildSearchHaystack("Amazon", "Echo Spot 2024 (Black)", "Smart Home")).toBe(
      "amazon echo spot 2024 (black) smart home",
    );
  });
});

describe("computeChecksum", () => {
  it("is deterministic for the same items", () => {
    const items = [{ code: "AA00001" }];
    expect(computeChecksum(items as never)).toBe(computeChecksum(items as never));
  });
  it("changes when items change", () => {
    const a = computeChecksum([{ code: "AA00001" }] as never);
    const b = computeChecksum([{ code: "AA00002" }] as never);
    expect(a).not.toBe(b);
  });
});

describe("parsePriceListDate", () => {
  it("extracts YYYY-MM-DD from a filename with spaces", () => {
    expect(parsePriceListDate("Uniqbe Reseller Quotation 20260826.xlsx")).toBe("2026-08-26");
  });
  it("throws when no date is present", () => {
    expect(() => parsePriceListDate("pricelist.xlsx")).toThrow();
  });
});

describe("build-catalogue CLI, run against the real price list", () => {
  const outputPath = "src/data/catalogue.json";
  let before: string;

  beforeAll(() => {
    before = readFileSync(outputPath, "utf-8");
    execSync("pnpm tsx scripts/build-catalogue.ts", { stdio: "pipe" });
  });

  it("produces a schema-valid catalogue", () => {
    const raw = JSON.parse(readFileSync(outputPath, "utf-8"));
    expect(() => Catalogue.parse(raw)).not.toThrow();
  });

  it("has no duplicate product codes", () => {
    const raw = JSON.parse(readFileSync(outputPath, "utf-8"));
    const codes = raw.items.map((i: { code: string }) => i.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("--verify exits 0 against its own freshly-built output", () => {
    expect(() =>
      execSync("pnpm tsx scripts/build-catalogue.ts --verify", { stdio: "pipe" }),
    ).not.toThrow();
  });

  it("--verify exits non-zero when the committed file is stale", () => {
    const raw = JSON.parse(readFileSync(outputPath, "utf-8"));
    raw.checksum = "0000000000000000";
    writeFileSync(outputPath, JSON.stringify(raw, null, 1));
    expect(() =>
      execSync("pnpm tsx scripts/build-catalogue.ts --verify", { stdio: "pipe" }),
    ).toThrow();
    // restore
    writeFileSync(outputPath, before);
  });
});

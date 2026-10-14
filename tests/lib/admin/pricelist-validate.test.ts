import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, validateUploadMeta } from "../../../src/lib/admin/pricelist-validate";

const ZIP_MAGIC = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]);
const GOOD_NAME = "Uniqbe Reseller Quotation 20261110.xlsx";

describe("validateUploadMeta", () => {
  it("accepts a correctly named, zip-signed, in-size file", () => {
    expect(validateUploadMeta({ name: GOOD_NAME, size: 1000, header: ZIP_MAGIC })).toEqual([]);
  });

  it.each([
    "Uniqbe Reseller Quotation 20261110.xls",
    "Uniqbe Reseller Quotation 20261110.xlsx.exe",
    "quotation.xlsx",
    "Uniqbe Reseller Quotation 2026-11-10.xlsx",
    "../Uniqbe Reseller Quotation 20261110.xlsx",
    "Uniqbe Reseller Quotation 20261110 (1).xlsx",
  ])("rejects the filename %j", (name) => {
    const errors = validateUploadMeta({ name, size: 1000, header: ZIP_MAGIC });
    expect(errors.join(" ")).toMatch(/Uniqbe Reseller Quotation YYYYMMDD\.xlsx/);
  });

  it.each(["20261345", "20260230", "20260000"])("rejects the impossible date %s", (date) => {
    const errors = validateUploadMeta({
      name: `Uniqbe Reseller Quotation ${date}.xlsx`,
      size: 1000,
      header: ZIP_MAGIC,
    });
    expect(errors.join(" ")).toMatch(/not a valid calendar date/);
  });

  it("rejects an empty file and an oversized file", () => {
    expect(validateUploadMeta({ name: GOOD_NAME, size: 0, header: ZIP_MAGIC }).join(" ")).toMatch(
      /empty/,
    );
    expect(
      validateUploadMeta({ name: GOOD_NAME, size: MAX_UPLOAD_BYTES + 1, header: ZIP_MAGIC }).join(
        " ",
      ),
    ).toMatch(/larger than/);
  });

  it("rejects content that is not a zip container even if named .xlsx", () => {
    const header = new TextEncoder().encode("MZ\x90\x00 not a zip");
    const errors = validateUploadMeta({ name: GOOD_NAME, size: 1000, header });
    expect(errors.join(" ")).toMatch(/not a valid \.xlsx/);
  });

  it("reports every problem at once", () => {
    const errors = validateUploadMeta({ name: "bad.txt", size: 0, header: new Uint8Array() });
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

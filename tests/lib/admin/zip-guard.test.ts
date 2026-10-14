import { describe, expect, it } from "vitest";
import {
  MAX_UNCOMPRESSED_BYTES,
  MAX_ZIP_ENTRIES,
  inspectXlsxZip,
} from "../../../src/lib/admin/zip-guard";
import { makeWorkbook, validRow } from "../../helpers/make-workbook";

type Entry = { name: string; compressed: number; uncompressed: number };

// Builds just a central directory plus end record, which is all the inspector reads.
function fakeZip(entries: Entry[]): Buffer {
  const parts: Buffer[] = [];
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt32LE(entry.compressed, 20);
    header.writeUInt32LE(entry.uncompressed, 24);
    header.writeUInt16LE(name.length, 28);
    parts.push(header, name);
  }
  const directory = Buffer.concat(parts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(0, 16);
  return Buffer.concat([directory, end]);
}

describe("inspectXlsxZip", () => {
  it("accepts a real workbook", async () => {
    const buffer = await makeWorkbook([validRow("AA00001")]);
    expect(inspectXlsxZip(buffer)).toEqual([]);
  });

  it("accepts a small, ordinary archive", () => {
    const zip = fakeZip([{ name: "xl/sheet1.xml", compressed: 2_000, uncompressed: 20_000 }]);
    expect(inspectXlsxZip(zip)).toEqual([]);
  });

  it("rejects an archive whose total uncompressed size is too large", () => {
    const zip = fakeZip(
      Array.from({ length: 4 }, (_, i) => ({
        name: `part${i}.xml`,
        compressed: 5_000_000,
        uncompressed: MAX_UNCOMPRESSED_BYTES,
      })),
    );
    expect(inspectXlsxZip(zip).join(" ")).toMatch(/uncompressed/i);
  });

  it("rejects a highly compressed entry even when the total is under the cap", () => {
    const zip = fakeZip([{ name: "xl/bomb.xml", compressed: 1_000, uncompressed: 5_000_000 }]);
    expect(inspectXlsxZip(zip).join(" ")).toMatch(/compress/i);
  });

  it("rejects an archive with too many entries", () => {
    const zip = fakeZip(
      Array.from({ length: MAX_ZIP_ENTRIES + 1 }, (_, i) => ({
        name: `f${i}`,
        compressed: 10,
        uncompressed: 10,
      })),
    );
    expect(inspectXlsxZip(zip).join(" ")).toMatch(/entries/i);
  });

  it("rejects zip64 size markers instead of trusting them", () => {
    const zip = fakeZip([{ name: "big", compressed: 0xffffffff, uncompressed: 0xffffffff }]);
    expect(inspectXlsxZip(zip).join(" ")).toMatch(/zip64|too large/i);
  });

  it("rejects data with no zip end record", () => {
    expect(inspectXlsxZip(Buffer.from("PK\x03\x04 truncated, no directory")).join(" ")).toMatch(
      /valid \.xlsx/,
    );
  });
});

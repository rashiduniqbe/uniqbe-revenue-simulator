// Reads only the zip central directory, before any decompression, so a small upload that
// would inflate to gigabytes (a zip bomb) is rejected without being parsed.

export const MAX_ZIP_ENTRIES = 200;
export const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 100;
const RATIO_CHECK_MIN_BYTES = 64 * 1024;

const END_RECORD_SIGNATURE = 0x06054b50;
const DIRECTORY_ENTRY_SIGNATURE = 0x02014b50;
const END_RECORD_BYTES = 22;
const DIRECTORY_ENTRY_BYTES = 46;
const MAX_END_COMMENT_BYTES = 0xffff;
const ZIP64_MARKER_16 = 0xffff;
const ZIP64_MARKER_32 = 0xffffffff;

const UNREADABLE = "The file is not a valid .xlsx workbook (unreadable zip structure).";
const ZIP64 = "The workbook uses zip64 sizes, which are not accepted (too large).";

function findEndRecord(buffer: Buffer): number {
  const lowest = Math.max(0, buffer.length - END_RECORD_BYTES - MAX_END_COMMENT_BYTES);
  for (let i = buffer.length - END_RECORD_BYTES; i >= lowest; i--) {
    if (buffer.readUInt32LE(i) === END_RECORD_SIGNATURE) return i;
  }
  return -1;
}

/** Returns the reasons this archive is unsafe to unpack, or an empty list. */
export function inspectXlsxZip(buffer: Buffer): string[] {
  const end = findEndRecord(buffer);
  if (end === -1) return [UNREADABLE];

  const entryCount = buffer.readUInt16LE(end + 10);
  const directorySize = buffer.readUInt32LE(end + 12);
  const directoryOffset = buffer.readUInt32LE(end + 16);
  if (
    entryCount === ZIP64_MARKER_16 ||
    directorySize === ZIP64_MARKER_32 ||
    directoryOffset === ZIP64_MARKER_32
  ) {
    return [ZIP64];
  }
  if (entryCount > MAX_ZIP_ENTRIES) {
    return [`The workbook contains more than ${MAX_ZIP_ENTRIES} entries.`];
  }
  if (directoryOffset + directorySize > buffer.length) return [UNREADABLE];

  let position = directoryOffset;
  let totalUncompressed = 0;
  for (let i = 0; i < entryCount; i++) {
    if (
      position + DIRECTORY_ENTRY_BYTES > buffer.length ||
      buffer.readUInt32LE(position) !== DIRECTORY_ENTRY_SIGNATURE
    ) {
      return [UNREADABLE];
    }
    const compressed = buffer.readUInt32LE(position + 20);
    const uncompressed = buffer.readUInt32LE(position + 24);
    if (compressed === ZIP64_MARKER_32 || uncompressed === ZIP64_MARKER_32) return [ZIP64];

    totalUncompressed += uncompressed;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
      return [
        `The workbook expands to more than ${MAX_UNCOMPRESSED_BYTES / (1024 * 1024)} MB uncompressed.`,
      ];
    }
    if (
      uncompressed >= RATIO_CHECK_MIN_BYTES &&
      uncompressed > Math.max(compressed, 1) * MAX_COMPRESSION_RATIO
    ) {
      return ["The workbook contains an entry with a suspiciously high compression ratio."];
    }

    const nameLength = buffer.readUInt16LE(position + 28);
    const extraLength = buffer.readUInt16LE(position + 30);
    const commentLength = buffer.readUInt16LE(position + 32);
    position += DIRECTORY_ENTRY_BYTES + nameLength + extraLength + commentLength;
  }
  return [];
}

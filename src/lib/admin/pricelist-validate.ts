export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const FILENAME_PATTERN = /^Uniqbe Reseller Quotation (\d{4})(\d{2})(\d{2})\.xlsx$/;
const FILENAME_HINT = "Uniqbe Reseller Quotation YYYYMMDD.xlsx";
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

export type UploadMeta = { name: string; size: number; header: Uint8Array };

function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Cheap, content-free checks run before the workbook is parsed. Returns every problem found. */
export function validateUploadMeta({ name, size, header }: UploadMeta): string[] {
  const errors: string[] = [];

  const match = FILENAME_PATTERN.exec(name);
  if (!match) {
    errors.push(`The file must be named exactly like "${FILENAME_HINT}".`);
  } else if (!isRealDate(Number(match[1]), Number(match[2]), Number(match[3]))) {
    errors.push(
      `The date in the filename (${match[1]}${match[2]}${match[3]}) is not a valid calendar date.`,
    );
  }

  if (size === 0) errors.push("The file is empty.");
  if (size > MAX_UPLOAD_BYTES) {
    errors.push(`The file is larger than ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`);
  }

  if (!ZIP_MAGIC.every((byte, i) => header[i] === byte)) {
    errors.push("The file is not a valid .xlsx workbook (missing zip signature).");
  }

  return errors;
}

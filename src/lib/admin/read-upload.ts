import { NextResponse } from "next/server";
import { MAX_UPLOAD_BYTES, validateUploadMeta } from "./pricelist-validate";

// Multipart framing adds a little to the file itself.
const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;
const MAGIC_BYTES_TO_READ = 8;

export const failure = (errors: string[], status: number): Response =>
  NextResponse.json({ ok: false, errors }, { status });

export type PricelistUpload =
  { ok: true; file: File; buffer: Buffer; allowOlder: boolean } | { ok: false; response: Response };

/** Reads and cheaply validates a price-list upload. Shared by the preview and publish routes. */
export async function readPricelistUpload(request: Request): Promise<PricelistUpload> {
  // formData() buffers the whole body, so the size must be declared and within the cap first.
  // The server enforces that the body matches the declared length.
  const declared = request.headers.get("content-length");
  const declaredLength = declared === null ? Number.NaN : Number(declared);
  if (!Number.isInteger(declaredLength) || declaredLength < 0) {
    return { ok: false, response: failure(["A Content-Length header is required."], 411) };
  }
  if (declaredLength > MAX_REQUEST_BYTES) {
    return { ok: false, response: failure(["The upload is too large."], 413) };
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { ok: false, response: failure(["The upload could not be read as a form."], 400) };
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return { ok: false, response: failure(["No file was uploaded."], 400) };
  }

  const header = new Uint8Array(await file.slice(0, MAGIC_BYTES_TO_READ).arrayBuffer());
  const metaErrors = validateUploadMeta({ name: file.name, size: file.size, header });
  if (metaErrors.length > 0) return { ok: false, response: failure(metaErrors, 400) };

  return {
    ok: true,
    file,
    buffer: Buffer.from(await file.arrayBuffer()),
    allowOlder: form.get("allowOlder") === "true",
  };
}

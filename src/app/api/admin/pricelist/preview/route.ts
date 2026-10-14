export const runtime = "nodejs";

import { NextResponse } from "next/server";
import catalogueData from "../../../../../data/catalogue.json";
import { requireAdminSession } from "../../../../../lib/admin/guard";
import { previewPricelist } from "../../../../../lib/admin/pricelist-preview";
import { MAX_UPLOAD_BYTES, validateUploadMeta } from "../../../../../lib/admin/pricelist-validate";
import { Catalogue } from "../../../../../lib/schemas";

const CURRENT_CATALOGUE = Catalogue.parse(catalogueData);
// Multipart framing adds a little to the file itself.
const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;
const MAGIC_BYTES_TO_READ = 8;

const failure = (errors: string[], status: number) =>
  NextResponse.json({ ok: false, errors }, { status });

export async function POST(request: Request): Promise<Response> {
  const denied = await requireAdminSession(request);
  if (denied) return denied;

  // formData() buffers the whole body, so the size must be declared and within the cap first.
  // The server enforces that the body matches the declared length.
  const declared = request.headers.get("content-length");
  const declaredLength = declared === null ? Number.NaN : Number(declared);
  if (!Number.isInteger(declaredLength) || declaredLength < 0) {
    return failure(["A Content-Length header is required."], 411);
  }
  if (declaredLength > MAX_REQUEST_BYTES) return failure(["The upload is too large."], 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return failure(["The upload could not be read as a form."], 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return failure(["No file was uploaded."], 400);

  const header = new Uint8Array(await file.slice(0, MAGIC_BYTES_TO_READ).arrayBuffer());
  const metaErrors = validateUploadMeta({ name: file.name, size: file.size, header });
  if (metaErrors.length > 0) return failure(metaErrors, 400);

  const result = await previewPricelist(
    Buffer.from(await file.arrayBuffer()),
    file.name,
    CURRENT_CATALOGUE,
    { allowOlder: form.get("allowOlder") === "true" },
  );
  return result.ok ? NextResponse.json(result) : failure(result.errors, 400);
}

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { CURRENT_CATALOGUE } from "../../../../../lib/admin/current-catalogue";
import { requireAdminSession } from "../../../../../lib/admin/guard";
import { previewPricelist } from "../../../../../lib/admin/pricelist-preview";
import { failure, readPricelistUpload } from "../../../../../lib/admin/read-upload";

export async function POST(request: Request): Promise<Response> {
  const denied = await requireAdminSession(request);
  if (denied) return denied;

  const upload = await readPricelistUpload(request);
  if (!upload.ok) return upload.response;

  const result = await previewPricelist(upload.buffer, upload.file.name, CURRENT_CATALOGUE, {
    allowOlder: upload.allowOlder,
  });
  if (!result.ok) return failure(result.errors, 400);

  // The full built catalogue stays on the server; the browser only needs the summary.
  // (undefined properties are omitted when the response is serialized.)
  return NextResponse.json({ ...result, catalogue: undefined });
}

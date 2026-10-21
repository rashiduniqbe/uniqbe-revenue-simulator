import { ADMIN_SESSION_COOKIE, createSessionToken } from "../../src/lib/admin/session";
import { makeWorkbook, quotationName, validRow } from "./make-workbook";

export const SESSION_SECRET = "test-session-secret-0123456789abcdef";
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
// Far-future date so it is newer than whatever price list is currently committed.
export const NEWER_FILE_NAME = quotationName("29991231");

export type UploadOptions = {
  path?: string;
  name?: string;
  bytes?: BlobPart;
  field?: string;
  allowOlder?: boolean;
  auth?: boolean;
  contentLength?: number | null;
};

/** A multipart price-list upload as a browser would send it, with a signed admin session. */
export async function uploadRequest(options: UploadOptions = {}): Promise<Request> {
  const form = new FormData();
  const bytes = options.bytes ?? (await makeWorkbook([validRow("ZZ99901", 150)]));
  form.set(
    options.field ?? "file",
    new File([bytes], options.name ?? NEWER_FILE_NAME, { type: XLSX_TYPE }),
  );
  if (options.allowOlder) form.set("allowOlder", "true");

  const headers: Record<string, string> = {};
  if (options.auth !== false) {
    const token = await createSessionToken(SESSION_SECRET, Date.now());
    headers.cookie = `${ADMIN_SESSION_COOKIE}=${token}`;
  }
  // Browsers send Content-Length for form uploads; Request() does not add it by itself.
  const encoded = new Request("https://example.test/", { method: "POST", body: form });
  const body = await encoded.blob();
  headers["content-type"] = encoded.headers.get("content-type") ?? "";
  if (options.contentLength !== null) {
    headers["content-length"] = String(options.contentLength ?? body.size);
  }
  return new Request(`https://example.test${options.path ?? "/api/admin/pricelist/preview"}`, {
    method: "POST",
    headers,
    body,
  });
}

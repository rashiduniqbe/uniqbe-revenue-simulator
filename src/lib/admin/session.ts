// Signed, short-lived admin session tokens. Web Crypto only, so it runs in both
// the Edge middleware and Node route handlers.

export const ADMIN_SESSION_COOKIE = "admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 2 * 60 * 60;
export const MIN_SECRET_LENGTH = 32;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function isUsableSecret(secret: string | undefined): secret is string {
  return typeof secret === "string" && secret.length >= MIN_SECRET_LENGTH;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

export async function createSessionToken(secret: string, nowMs: number): Promise<string> {
  if (!isUsableSecret(secret)) {
    throw new Error(`Admin session secret must be at least ${MIN_SECRET_LENGTH} characters.`);
  }
  const payload = toBase64Url(
    encoder.encode(JSON.stringify({ exp: nowMs + ADMIN_SESSION_TTL_SECONDS * 1000 })),
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret, "sign"),
    encoder.encode(payload),
  );
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string | undefined,
  nowMs: number,
): Promise<boolean> {
  if (!token || !isUsableSecret(secret)) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  if (!payload || !signature) return false;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret, "verify"),
      fromBase64Url(signature),
      encoder.encode(payload),
    );
    if (!valid) return false;
    const { exp } = JSON.parse(decoder.decode(fromBase64Url(payload))) as { exp?: unknown };
    return typeof exp === "number" && Number.isFinite(exp) && nowMs <= exp;
  } catch {
    return false;
  }
}

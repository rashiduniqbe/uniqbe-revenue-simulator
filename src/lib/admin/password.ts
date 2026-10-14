const encoder = new TextEncoder();

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

/**
 * Constant-time password check. Both sides are hashed first so the comparison runs over
 * fixed-length digests and leaks neither the password length nor a matching prefix.
 */
export async function passwordMatches(
  input: string,
  expected: string | undefined,
): Promise<boolean> {
  if (!expected) return false;
  const [inputDigest, expectedDigest] = await Promise.all([sha256(input), sha256(expected)]);
  let difference = 0;
  for (let i = 0; i < expectedDigest.length; i++) {
    difference |= (inputDigest[i] ?? 0) ^ (expectedDigest[i] ?? 0);
  }
  return difference === 0;
}

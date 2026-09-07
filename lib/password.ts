const ALGORITHM = "PBKDF2";
const DIGEST = "SHA-256";
const ITERATIONS = 600_000;
const KEY_BYTES = 32;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), ALGORITHM, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: ALGORITHM, hash: DIGEST, salt, iterations }, material, KEY_BYTES * 8);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2-sha256$${ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [scheme, iterationText, saltText, hashText, extra] = encoded.split("$");
  const iterations = Number(iterationText);
  if (scheme !== "pbkdf2-sha256" || extra !== undefined || !Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) return false;
  try {
    const salt = fromBase64Url(saltText);
    const expected = fromBase64Url(hashText);
    if (salt.length < 16 || expected.length !== KEY_BYTES) return false;
    const actual = await derive(password, salt, iterations);
    let difference = 0;
    for (let index = 0; index < expected.length; index += 1) difference |= expected[index] ^ actual[index];
    return difference === 0;
  } catch {
    return false;
  }
}

export async function burnPasswordVerificationTime(password: string): Promise<void> {
  const salt = new Uint8Array([42, 81, 19, 77, 201, 6, 144, 55, 9, 37, 111, 212, 13, 98, 70, 33]);
  await derive(password, salt, ITERATIONS);
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function createCsrfToken(
  userId: string,
  secret: string,
  ttlSeconds = 3600,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  const expires = nowSeconds + ttlSeconds;
  const payload = `${userId}.${expires}`;
  return `${expires}.${await hmac(payload, secret)}`;
}

export async function verifyCsrfToken(
  token: string,
  userId: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const [expiresRaw, supplied, extra] = token.split(".");
  const expires = Number(expiresRaw);
  if (extra !== undefined || !supplied || !Number.isInteger(expires)) return false;
  if (expires < nowSeconds || expires > nowSeconds + 7200) return false;
  const expected = await hmac(`${userId}.${expires}`, secret);
  return safeEqual(supplied, expected);
}

export function isSameOriginMutation(requestUrl: string, origin: string | null): boolean {
  if (!origin) return true;
  try {
    return new URL(requestUrl).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}

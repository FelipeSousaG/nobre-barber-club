import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getD1, getRuntimeValue } from "@/db";
import { hashPassword } from "@/lib/password";
import type { AuthUser } from "@/lib/types";

export const SESSION_COOKIE = "nobre_session";
const SESSION_DAYS = 7;

function parseCookie(cookieHeader: string | null, name: string): string | null {
  for (const part of (cookieHeader ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function randomToken(bytes = 32): string {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function safeReturnPath(value: string | null | undefined, fallback = "/conta"): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local" || url.pathname.startsWith("/api/")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export async function getCurrentUser(requestHeaders?: Headers): Promise<AuthUser | null> {
  const source = requestHeaders ?? new Headers(await headers());
  const token = parseCookie(source.get("cookie"), SESSION_COOKIE);
  if (!token) return null;
  const sessionId = await sha256(token);
  const now = new Date().toISOString();
  const row = await getD1().prepare(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, s.last_seen_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ? AND u.password_hash IS NOT NULL LIMIT 1`,
  ).bind(sessionId, now).first<{
    id: string; email: string; first_name: string | null; last_name: string | null;
    role: "client" | "admin"; last_seen_at: string;
  }>();
  if (!row) return null;
  if (Date.now() - new Date(row.last_seen_at).valueOf() > 15 * 60_000) {
    await getD1().prepare(`UPDATE sessions SET last_seen_at = ? WHERE id = ?`).bind(now, sessionId).run();
  }
  const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ");
  return { id: row.id, email: row.email, displayName: fullName || row.email.split("@")[0], role: row.role };
}

export async function requireUser(returnTo: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (user) return user;
  redirect(`/entrar?retorno=${encodeURIComponent(safeReturnPath(returnTo))}`);
}

export async function createSession(userId: string): Promise<{ token: string; maxAge: number }> {
  const token = randomToken();
  const id = await sha256(token);
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.valueOf() + SESSION_DAYS * 86_400_000);
  const db = getD1();
  await db.batch([
    db.prepare(`DELETE FROM sessions WHERE expires_at <= ?`).bind(createdAt.toISOString()),
    db.prepare(`INSERT INTO sessions (id, user_id, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(id, userId, expiresAt.toISOString(), createdAt.toISOString(), createdAt.toISOString()),
  ]);
  return { token, maxAge: SESSION_DAYS * 86_400 };
}

export function sessionCookie(token: string, maxAge: number, secure: boolean): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

export async function deleteSessionFromHeaders(requestHeaders: Headers): Promise<void> {
  const token = parseCookie(requestHeaders.get("cookie"), SESSION_COOKIE);
  if (token) await getD1().prepare(`DELETE FROM sessions WHERE id = ?`).bind(await sha256(token)).run();
}

export async function registerUser(input: {
  firstName: string; lastName: string; phone: string; email: string; password: string;
}): Promise<{ ok: true; user: AuthUser } | { ok: false }> {
  const db = getD1();
  const email = normalizeEmail(input.email);
  const existing = await db.prepare(`SELECT id, password_hash FROM users WHERE email = ? LIMIT 1`).bind(email).first<{ id: string; password_hash: string | null }>();
  if (existing) return { ok: false };
  const passwordHash = await hashPassword(input.password);
  const timestamp = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO users (id, email, first_name, last_name, phone, password_hash, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'client', ?, ?)`,
  ).bind(id, email, input.firstName, input.lastName, input.phone, passwordHash, timestamp, timestamp).run();
  return { ok: true, user: { id, email, displayName: `${input.firstName} ${input.lastName}`, role: "client" } };
}

export async function setupFirstAdmin(input: {
  firstName: string; lastName: string; phone: string; email: string; password: string; setupCode: string;
}): Promise<{ ok: true; user: AuthUser } | { ok: false; reason: "disabled" | "code" | "email" }> {
  const expected = getRuntimeValue("ADMIN_SETUP_SECRET");
  if (!expected || expected.length < 32 || await sha256(input.setupCode) !== await sha256(expected)) return { ok: false, reason: "code" };
  const db = getD1();
  const configured = await db.prepare(`SELECT 1 AS found FROM users WHERE role = 'admin' AND password_hash IS NOT NULL LIMIT 1`).first<{ found: number }>();
  if (configured) return { ok: false, reason: "disabled" };
  const email = normalizeEmail(input.email);
  const existing = await db.prepare(`SELECT id, password_hash FROM users WHERE email = ? LIMIT 1`).bind(email).first<{ id: string; password_hash: string | null }>();
  if (existing?.password_hash) return { ok: false, reason: "email" };
  const passwordHash = await hashPassword(input.password);
  const now = new Date().toISOString();
  const id = existing?.id ?? crypto.randomUUID();
  if (existing) {
    await db.prepare(`UPDATE users SET first_name = ?, last_name = ?, phone = ?, password_hash = ?, role = 'admin', updated_at = ? WHERE id = ? AND password_hash IS NULL`)
      .bind(input.firstName, input.lastName, input.phone, passwordHash, now, id).run();
  } else {
    await db.prepare(`INSERT INTO users (id, email, first_name, last_name, phone, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'admin', ?, ?)`)
      .bind(id, email, input.firstName, input.lastName, input.phone, passwordHash, now, now).run();
  }
  return { ok: true, user: { id, email, displayName: `${input.firstName} ${input.lastName}`, role: "admin" } };
}

export async function createPasswordReset(userId: string): Promise<string> {
  const token = randomToken();
  const id = await sha256(token);
  const now = new Date();
  await getD1().batch([
    getD1().prepare(`UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL`).bind(now.toISOString(), userId),
    getD1().prepare(`INSERT INTO password_reset_tokens (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`)
      .bind(id, userId, new Date(now.valueOf() + 30 * 60_000).toISOString(), now.toISOString()),
  ]);
  return token;
}

export async function resetPassword(token: string, password: string): Promise<boolean> {
  if (token.length < 32 || token.length > 128) return false;
  const id = await sha256(token);
  const now = new Date().toISOString();
  const row = await getD1().prepare(
    `SELECT user_id FROM password_reset_tokens WHERE id = ? AND used_at IS NULL AND expires_at > ? LIMIT 1`,
  ).bind(id, now).first<{ user_id: string }>();
  if (!row) return false;
  const passwordHash = await hashPassword(password);
  await getD1().batch([
    getD1().prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`).bind(passwordHash, now, row.user_id),
    getD1().prepare(`UPDATE password_reset_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL`).bind(now, id),
    getD1().prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(row.user_id),
  ]);
  return true;
}

export async function clientRateLimitKey(request: Request, scope: string, subject = ""): Promise<string> {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return `${scope}:${await sha256(`${ip}|${normalizeEmail(subject)}`)}`;
}

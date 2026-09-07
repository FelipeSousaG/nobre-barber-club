import { getCurrentUser } from "@/lib/server/auth";
import type { AuthUser } from "@/lib/types";
import { getD1, getRuntimeValue } from "@/db";
import { createCsrfToken, isSameOriginMutation, verifyCsrfToken } from "@/lib/security-core";

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function apiError(message: string, status: number): Response {
  return json({ error: message }, { status });
}

export async function readJson(request: Request, maxBytes = 16_384): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new RequestInputError("Tipo de conteúdo não aceito", 415);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > maxBytes) throw new RequestInputError("Corpo da requisição muito grande", 413);
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new RequestInputError("Corpo da requisição muito grande", 413);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new RequestInputError("JSON inválido", 400);
  }
}

export class RequestInputError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export function requirePublicMutation(request: Request): Response | null {
  if (!isSameOriginMutation(request.url, request.headers.get("origin"))) return apiError("Origem não permitida", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site") return apiError("Origem não permitida", 403);
  return null;
}

export async function requireApiUser(): Promise<AuthUser | Response> {
  const user = await getCurrentUser();
  return user ?? apiError("Autenticação necessária", 401);
}

export function isAdmin(user: AuthUser): boolean {
  return user.role === "admin";
}

export async function requireAdmin(): Promise<AuthUser | Response> {
  const user = await getCurrentUser();
  if (!user) return apiError("Autenticação necessária", 401);
  if (!isAdmin(user)) {
    console.warn(JSON.stringify({ event: "admin_access_denied" }));
    return apiError("Acesso não autorizado", 403);
  }
  return user;
}

export async function requireSafeMutation(request: Request, user: AuthUser): Promise<Response | null> {
  const originError = requirePublicMutation(request);
  if (originError) return originError;
  const secret = getRuntimeValue("CSRF_SECRET");
  if (!secret || secret.length < 32) {
    console.error(JSON.stringify({ event: "csrf_configuration_missing" }));
    return apiError("Operação temporariamente indisponível", 503);
  }
  const token = request.headers.get("x-csrf-token") ?? "";
  if (!(await verifyCsrfToken(token, user.id, secret))) return apiError("Sessão expirada. Atualize a página.", 403);
  return null;
}

export async function csrfFor(user: AuthUser): Promise<string | null> {
  const secret = getRuntimeValue("CSRF_SECRET");
  if (!secret || secret.length < 32) return null;
  return createCsrfToken(user.id, secret);
}

export async function enforceRateLimit(
  scope: string,
  userId: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const key = `${scope}:${userId}:${windowStart}`;
  const row = await getD1().prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET count = count + 1
     RETURNING count`,
  ).bind(key, windowStart).first<{ count: number }>();
  if (row?.count === 1) {
    await getD1().prepare(`DELETE FROM rate_limits WHERE window_start < ?`).bind(now - 86_400).run();
  }
  return Boolean(row && row.count <= limit);
}

export async function withApiErrors(action: () => Promise<Response>): Promise<Response> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof RequestInputError) return apiError(error.message, error.status);
    console.error(JSON.stringify({ event: "api_unhandled_error", kind: error instanceof Error ? error.name : "unknown" }));
    return apiError("Não foi possível concluir a operação", 500);
  }
}

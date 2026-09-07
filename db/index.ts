import { env } from "cloudflare:workers";

export function getD1(): D1Database {
  if (!env.DB) throw new Error("Database binding is unavailable");
  return env.DB;
}

export function getRuntimeValue(name: "CSRF_SECRET" | "ADMIN_SETUP_SECRET" | "RESEND_API_KEY" | "MAIL_FROM" | "APP_ORIGIN"): string | undefined {
  const value = (env as unknown as Record<string, unknown>)[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

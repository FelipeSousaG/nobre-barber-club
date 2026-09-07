import { getD1 } from "@/db";
import { burnPasswordVerificationTime, verifyPassword } from "@/lib/password";
import { clientRateLimitKey, createSession, normalizeEmail, safeReturnPath, sessionCookie, sha256 } from "@/lib/server/auth";
import { audit } from "@/lib/server/data";
import { apiError, enforceRateLimit, json, readJson, requirePublicMutation, withApiErrors } from "@/lib/server/security";
import { loginSchema } from "@/lib/validators";

export async function POST(request: Request): Promise<Response> {
  return withApiErrors(async () => {
    const unsafe = requirePublicMutation(request);
    if (unsafe) return unsafe;
    const parsed = loginSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError("E-mail ou senha inválidos", 401);
    const email = normalizeEmail(parsed.data.email);
    const key = await clientRateLimitKey(request, "login", email);
    if (!(await enforceRateLimit("auth", key, 8, 900))) return apiError("Muitas tentativas. Aguarde 15 minutos.", 429);
    if (!(await enforceRateLimit("auth-account", await sha256(email), 30, 3600))) return apiError("Muitas tentativas. Aguarde antes de tentar novamente.", 429);
    const user = await getD1().prepare(
      `SELECT id, password_hash, role FROM users WHERE email = ? LIMIT 1`,
    ).bind(email).first<{ id: string; password_hash: string | null; role: "client" | "admin" }>();
    const valid = user?.password_hash
      ? await verifyPassword(parsed.data.password, user.password_hash)
      : (await burnPasswordVerificationTime(parsed.data.password), false);
    if (!user || !valid) {
      console.warn(JSON.stringify({ event: "auth_login_failed", key }));
      return apiError("E-mail ou senha inválidos", 401);
    }
    const session = await createSession(user.id);
    await audit(user.id, "auth.login", "user", user.id);
    const requested = safeReturnPath(new URL(request.url).searchParams.get("retorno"));
    const redirectTo = user.role === "admin" && requested === "/conta" ? "/admin" : requested;
    return json(
      { message: "Login realizado", redirectTo },
      { headers: { "set-cookie": sessionCookie(session.token, session.maxAge, new URL(request.url).protocol === "https:") } },
    );
  });
}

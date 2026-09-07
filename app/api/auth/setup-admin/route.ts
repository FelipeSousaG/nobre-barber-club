import { clientRateLimitKey, createSession, sessionCookie, setupFirstAdmin } from "@/lib/server/auth";
import { audit } from "@/lib/server/data";
import { apiError, enforceRateLimit, json, readJson, requirePublicMutation, withApiErrors } from "@/lib/server/security";
import { adminSetupSchema } from "@/lib/validators";

export async function POST(request: Request): Promise<Response> {
  return withApiErrors(async () => {
    const unsafe = requirePublicMutation(request);
    if (unsafe) return unsafe;
    const key = await clientRateLimitKey(request, "admin-setup");
    if (!(await enforceRateLimit("auth", key, 5, 3600))) return apiError("Muitas tentativas. Aguarde antes de tentar novamente.", 429);
    const parsed = adminSetupSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Dados inválidos", 422);
    const result = await setupFirstAdmin(parsed.data);
    if (!result.ok && result.reason === "disabled") return apiError("A conta administrativa inicial já foi configurada", 409);
    if (!result.ok) return apiError("Não foi possível configurar a conta administrativa", 403);
    const session = await createSession(result.user.id);
    await audit(result.user.id, "auth.admin_bootstrapped", "user", result.user.id);
    return json({ message: "Administrador configurado", redirectTo: "/admin" }, {
      status: 201,
      headers: { "set-cookie": sessionCookie(session.token, session.maxAge, new URL(request.url).protocol === "https:") },
    });
  });
}

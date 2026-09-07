import { registrationSchema } from "@/lib/validators";
import { clientRateLimitKey, createSession, registerUser, sessionCookie } from "@/lib/server/auth";
import { audit } from "@/lib/server/data";
import { apiError, enforceRateLimit, json, readJson, requirePublicMutation, withApiErrors } from "@/lib/server/security";

export async function POST(request: Request): Promise<Response> {
  return withApiErrors(async () => {
    const unsafe = requirePublicMutation(request);
    if (unsafe) return unsafe;
    const parsed = registrationSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Dados inválidos", 422);
    const key = await clientRateLimitKey(request, "register", parsed.data.email);
    if (!(await enforceRateLimit("auth", key, 5, 3600))) return apiError("Muitas tentativas. Aguarde antes de tentar novamente.", 429);
    const result = await registerUser(parsed.data);
    if (!result.ok) return apiError("Não foi possível criar a conta com esses dados", 409);
    const session = await createSession(result.user.id);
    await audit(result.user.id, "auth.registered", "user", result.user.id);
    return json(
      { message: "Conta criada", redirectTo: result.user.role === "admin" ? "/admin" : "/conta" },
      { status: 201, headers: { "set-cookie": sessionCookie(session.token, session.maxAge, new URL(request.url).protocol === "https:") } },
    );
  });
}

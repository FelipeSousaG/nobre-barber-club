import { clientRateLimitKey, resetPassword } from "@/lib/server/auth";
import { apiError, enforceRateLimit, json, readJson, requirePublicMutation, withApiErrors } from "@/lib/server/security";
import { resetPasswordSchema } from "@/lib/validators";

export async function POST(request: Request): Promise<Response> {
  return withApiErrors(async () => {
    const unsafe = requirePublicMutation(request);
    if (unsafe) return unsafe;
    const parsed = resetPasswordSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Dados inválidos", 422);
    const key = await clientRateLimitKey(request, "reset", parsed.data.token.slice(0, 16));
    if (!(await enforceRateLimit("auth", key, 10, 900))) return apiError("Muitas tentativas. Aguarde antes de tentar novamente.", 429);
    if (!(await resetPassword(parsed.data.token, parsed.data.password))) return apiError("Este link é inválido ou expirou", 400);
    return json({ message: "Senha alterada. Entre novamente." });
  });
}

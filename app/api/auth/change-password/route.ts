import { getD1 } from "@/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { clearSessionCookie } from "@/lib/server/auth";
import { audit } from "@/lib/server/data";
import { apiError, enforceRateLimit, json, readJson, requireApiUser, requireSafeMutation, withApiErrors } from "@/lib/server/security";
import { changePasswordSchema } from "@/lib/validators";

export async function POST(request: Request): Promise<Response> {
  return withApiErrors(async () => {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const unsafe = await requireSafeMutation(request, user);
    if (unsafe) return unsafe;
    if (!(await enforceRateLimit("password-change", user.id, 5, 3600))) return apiError("Muitas tentativas. Aguarde antes de tentar novamente.", 429);
    const parsed = changePasswordSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Dados inválidos", 422);
    const row = await getD1().prepare(`SELECT password_hash FROM users WHERE id = ? LIMIT 1`).bind(user.id).first<{ password_hash: string | null }>();
    if (!row?.password_hash || !(await verifyPassword(parsed.data.currentPassword, row.password_hash))) return apiError("Senha atual incorreta", 401);
    const passwordHash = await hashPassword(parsed.data.password);
    const now = new Date().toISOString();
    await getD1().batch([
      getD1().prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`).bind(passwordHash, now, user.id),
      getD1().prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(user.id),
    ]);
    await audit(user.id, "auth.password_changed", "user", user.id);
    return json({ message: "Senha alterada. Entre novamente." }, {
      headers: { "set-cookie": clearSessionCookie(new URL(request.url).protocol === "https:") },
    });
  });
}

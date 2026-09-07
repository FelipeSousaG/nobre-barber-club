import { getD1, getRuntimeValue } from "@/db";
import { clientRateLimitKey, createPasswordReset, normalizeEmail, sha256 } from "@/lib/server/auth";
import { apiError, enforceRateLimit, json, readJson, requirePublicMutation, withApiErrors } from "@/lib/server/security";
import { forgotPasswordSchema } from "@/lib/validators";

async function sendResetEmail(email: string, resetUrl: string): Promise<void> {
  const apiKey = getRuntimeValue("RESEND_API_KEY");
  const from = getRuntimeValue("MAIL_FROM");
  if (!apiKey || !from) {
    console.error(JSON.stringify({ event: "password_reset_email_not_configured" }));
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Redefinição de senha — Nobre Barber Club",
      html: `<p>Recebemos uma solicitação para redefinir sua senha.</p><p><a href="${resetUrl}">Criar uma nova senha</a></p><p>O link expira em 30 minutos. Se você não fez essa solicitação, ignore esta mensagem.</p>`,
    }),
  });
  if (!response.ok) console.error(JSON.stringify({ event: "password_reset_email_failed", status: response.status }));
}

export async function POST(request: Request): Promise<Response> {
  return withApiErrors(async () => {
    const unsafe = requirePublicMutation(request);
    if (unsafe) return unsafe;
    const parsed = forgotPasswordSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError("Informe um e-mail válido", 422);
    const email = normalizeEmail(parsed.data.email);
    const key = await clientRateLimitKey(request, "forgot", email);
    if (!(await enforceRateLimit("auth", key, 4, 3600))) return apiError("Muitas solicitações. Aguarde antes de tentar novamente.", 429);
    if (!(await enforceRateLimit("auth-account", await sha256(email), 6, 3600))) return apiError("Muitas solicitações. Aguarde antes de tentar novamente.", 429);
    const user = await getD1().prepare(`SELECT id FROM users WHERE email = ? AND password_hash IS NOT NULL LIMIT 1`).bind(email).first<{ id: string }>();
    if (user) {
      const token = await createPasswordReset(user.id);
      const configuredOrigin = getRuntimeValue("APP_ORIGIN");
      const origin = configuredOrigin && /^https:\/\/[^/]+$/.test(configuredOrigin) ? configuredOrigin : new URL(request.url).origin;
      await sendResetEmail(email, `${origin}/redefinir-senha?token=${encodeURIComponent(token)}`);
    }
    return json({ message: "Se o e-mail estiver cadastrado, você receberá as instruções em alguns minutos." });
  });
}

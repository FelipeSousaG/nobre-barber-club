import { clearSessionCookie, deleteSessionFromHeaders, getCurrentUser } from "@/lib/server/auth";
import { audit } from "@/lib/server/data";
import { apiError, json, requireSafeMutation, withApiErrors } from "@/lib/server/security";

export async function POST(request: Request): Promise<Response> {
  return withApiErrors(async () => {
    const user = await getCurrentUser(request.headers);
    if (!user) return apiError("Sessão não encontrada", 401);
    const unsafe = await requireSafeMutation(request, user);
    if (unsafe) return unsafe;
    await deleteSessionFromHeaders(request.headers);
    await audit(user.id, "auth.logout", "user", user.id);
    return json({ message: "Sessão encerrada" }, {
      headers: { "set-cookie": clearSessionCookie(new URL(request.url).protocol === "https:") },
    });
  });
}

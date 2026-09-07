import { deleteBlockedSlot } from "@/lib/server/admin";
import {
  apiError, enforceRateLimit, json, requireAdmin, requireSafeMutation, withApiErrors,
} from "@/lib/server/security";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return withApiErrors(async () => {
    const user = await requireAdmin();
    if (user instanceof Response) return user;
    const unsafe = await requireSafeMutation(request, user);
    if (unsafe) return unsafe;
    if (!(await enforceRateLimit("admin-unblock", user.id, 60, 900))) return apiError("Limite de alterações atingido", 429);
    const { id } = await context.params;
    if (!(await deleteBlockedSlot(user.id, id))) return apiError("Bloqueio não encontrado", 404);
    return json({ message: "Bloqueio removido" });
  });
}

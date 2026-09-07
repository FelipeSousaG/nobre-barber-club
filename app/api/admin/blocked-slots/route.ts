import { createBlockedSlots } from "@/lib/server/admin";
import {
  apiError, enforceRateLimit, json, readJson, requireAdmin, requireSafeMutation, withApiErrors,
} from "@/lib/server/security";
import { blockedSlotSchema } from "@/lib/validators";

export async function POST(request: Request): Promise<Response> {
  return withApiErrors(async () => {
    const user = await requireAdmin();
    if (user instanceof Response) return user;
    const unsafe = await requireSafeMutation(request, user);
    if (unsafe) return unsafe;
    if (!(await enforceRateLimit("admin-block", user.id, 60, 900))) return apiError("Limite de alterações atingido", 429);
    const parsed = blockedSlotSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError("Bloqueio de agenda inválido", 422);
    const result = await createBlockedSlots(user.id, parsed.data);
    if (!result.ok) return apiError("Não foi possível bloquear: horário inválido ou já ocupado", 409);
    return json({ ids: result.ids, message: "Agenda bloqueada" }, { status: 201 });
  });
}

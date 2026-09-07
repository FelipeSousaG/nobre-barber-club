import { updateAppointmentStatus } from "@/lib/server/admin";
import {
  apiError, enforceRateLimit, json, readJson, requireAdmin, requireSafeMutation, withApiErrors,
} from "@/lib/server/security";
import { appointmentStatusSchema } from "@/lib/validators";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return withApiErrors(async () => {
    const user = await requireAdmin();
    if (user instanceof Response) return user;
    const unsafe = await requireSafeMutation(request, user);
    if (unsafe) return unsafe;
    if (!(await enforceRateLimit("admin-appointment", user.id, 80, 900))) return apiError("Limite de alterações atingido", 429);
    const parsed = appointmentStatusSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError("Status inválido", 422);
    const { id } = await context.params;
    const result = await updateAppointmentStatus(user.id, id, parsed.data.status);
    if (result === "not_found") return apiError("Agendamento não encontrado", 404);
    if (result === "invalid_transition") return apiError("Este agendamento já foi encerrado", 409);
    return json({ message: "Agendamento atualizado" });
  });
}

import { cancelUserAppointment } from "@/lib/server/appointments";
import {
  apiError, enforceRateLimit, json, requireApiUser, requireSafeMutation, withApiErrors,
} from "@/lib/server/security";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return withApiErrors(async () => {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const unsafe = await requireSafeMutation(request, user);
    if (unsafe) return unsafe;
    if (!(await enforceRateLimit("cancel", user.id, 12, 900))) return apiError("Muitas tentativas. Aguarde alguns minutos.", 429);
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return apiError("Agendamento não encontrado", 404);
    const result = await cancelUserAppointment(user.id, id);
    if (result === "not_found") return apiError("Agendamento não encontrado", 404);
    if (result === "too_late") return apiError("Cancelamentos online encerram 12 horas antes", 409);
    return json({ message: "Agendamento cancelado" });
  });
}

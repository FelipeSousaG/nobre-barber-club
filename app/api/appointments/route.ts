import { createAppointment, listUserAppointments } from "@/lib/server/appointments";
import {
  apiError, enforceRateLimit, json, readJson, requireApiUser, requireSafeMutation, withApiErrors,
} from "@/lib/server/security";
import { appointmentSchema } from "@/lib/validators";

export async function GET(): Promise<Response> {
  return withApiErrors(async () => {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    return json({ appointments: await listUserAppointments(user.id) });
  });
}

export async function POST(request: Request): Promise<Response> {
  return withApiErrors(async () => {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const unsafe = await requireSafeMutation(request, user);
    if (unsafe) return unsafe;
    if (!(await enforceRateLimit("booking", user.id, 12, 900))) return apiError("Muitas tentativas. Aguarde alguns minutos.", 429);
    const parsed = appointmentSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError("Dados do agendamento inválidos", 422);
    const result = await createAppointment(user.id, parsed.data);
    if (!result.ok && result.reason === "profile") return apiError("Complete seu perfil antes de reservar", 409);
    if (!result.ok) return apiError("Este horário acabou de ficar indisponível", 409);
    return json({ appointmentId: result.appointmentId, message: "Horário confirmado" }, { status: 201 });
  });
}

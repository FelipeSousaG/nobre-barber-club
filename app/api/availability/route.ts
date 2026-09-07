import { availability } from "@/lib/server/appointments";
import { apiError, json, withApiErrors } from "@/lib/server/security";
import { availabilitySchema } from "@/lib/validators";

export async function GET(request: Request): Promise<Response> {
  return withApiErrors(async () => {
    const url = new URL(request.url);
    const parsed = availabilitySchema.safeParse({
      serviceId: url.searchParams.get("serviceId"),
      barberId: url.searchParams.get("barberId"),
      date: url.searchParams.get("date"),
    });
    if (!parsed.success) return apiError("Consulta de agenda inválida", 422);
    return json({ slots: await availability(parsed.data.serviceId, parsed.data.barberId, parsed.data.date) });
  });
}

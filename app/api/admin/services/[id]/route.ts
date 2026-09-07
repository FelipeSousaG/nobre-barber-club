import { updateService } from "@/lib/server/admin";
import {
  apiError, enforceRateLimit, json, readJson, requireAdmin, requireSafeMutation, withApiErrors,
} from "@/lib/server/security";
import { serviceAdminSchema } from "@/lib/validators";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return withApiErrors(async () => {
    const user = await requireAdmin();
    if (user instanceof Response) return user;
    const unsafe = await requireSafeMutation(request, user);
    if (unsafe) return unsafe;
    if (!(await enforceRateLimit("admin-service", user.id, 60, 900))) return apiError("Limite de alterações atingido", 429);
    const parsed = serviceAdminSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError("Alteração de serviço inválida", 422);
    const { id } = await context.params;
    if (!(await updateService(user.id, id, parsed.data))) return apiError("Serviço não encontrado", 404);
    return json({ message: "Serviço atualizado" });
  });
}

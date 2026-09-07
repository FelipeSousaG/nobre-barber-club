import { getAdminOverview } from "@/lib/server/admin";
import { json, requireAdmin, withApiErrors } from "@/lib/server/security";

export async function GET(): Promise<Response> {
  return withApiErrors(async () => {
    const user = await requireAdmin();
    if (user instanceof Response) return user;
    return json(await getAdminOverview());
  });
}

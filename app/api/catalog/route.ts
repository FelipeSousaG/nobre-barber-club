import { listCatalog } from "@/lib/server/data";
import { json, withApiErrors } from "@/lib/server/security";

export async function GET(): Promise<Response> {
  return withApiErrors(async () => json(await listCatalog()));
}

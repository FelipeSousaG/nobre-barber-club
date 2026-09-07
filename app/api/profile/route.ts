import { profileSchema } from "@/lib/validators";
import { getProfile, isProfileComplete, updateProfile } from "@/lib/server/data";
import {
  apiError, enforceRateLimit, json, readJson, requireApiUser, requireSafeMutation, withApiErrors,
} from "@/lib/server/security";

export async function GET(): Promise<Response> {
  return withApiErrors(async () => {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const profile = await getProfile(user.id);
    return json({ profile, profileComplete: isProfileComplete(profile) });
  });
}

export async function PUT(request: Request): Promise<Response> {
  return withApiErrors(async () => {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const unsafe = await requireSafeMutation(request, user);
    if (unsafe) return unsafe;
    if (!(await enforceRateLimit("profile", user.id, 20, 900))) return apiError("Muitas alterações. Tente novamente mais tarde.", 429);
    const parsed = profileSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Dados inválidos", 422);
    const profile = await updateProfile(user.id, parsed.data.firstName, parsed.data.lastName, parsed.data.phone);
    return json({ profile, profileComplete: true });
  });
}

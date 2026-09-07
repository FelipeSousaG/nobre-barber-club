import { getCurrentUser } from "@/lib/server/auth";
import { csrfFor, json, withApiErrors } from "@/lib/server/security";
import { getProfile, isProfileComplete } from "@/lib/server/data";

export async function GET(): Promise<Response> {
  return withApiErrors(async () => {
    const identity = await getCurrentUser();
    if (!identity) return json({ authenticated: false, csrfToken: null, profile: null, isAdmin: false });
    const profile = await getProfile(identity.id);
    return json({
      authenticated: true,
      csrfToken: await csrfFor(identity),
      profile,
      profileComplete: isProfileComplete(profile),
      isAdmin: identity.role === "admin",
    });
  });
}

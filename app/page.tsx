import { getCurrentUser } from "@/lib/server/auth";
import HomeExperience from "./home-experience";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const identity = await getCurrentUser();
  return <HomeExperience initialIdentity={identity ? { displayName: identity.displayName } : null} />;
}

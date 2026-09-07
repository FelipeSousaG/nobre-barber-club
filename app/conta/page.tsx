import type { Metadata } from "next";
import { requireUser } from "@/lib/server/auth";
import CustomerDashboard from "./customer-dashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Minha conta", robots: { index: false, follow: false } };

async function AccountGate() {
  const user = await requireUser("/conta");
  return <CustomerDashboard displayName={user.displayName} />;
}

export default function AccountPage() {
  return <AccountGate />;
}

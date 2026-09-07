import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server/auth";
import AdminDashboard from "./admin-dashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Administração", robots: { index: false, follow: false } };

async function AdminGate() {
  const user = await requireUser("/admin");
  if (user.role !== "admin") redirect("/conta");
  return <AdminDashboard displayName={user.displayName} />;
}

export default function AdminPage() {
  return <AdminGate />;
}

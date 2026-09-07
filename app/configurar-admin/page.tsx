import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminSetupForm } from "@/app/auth-forms";
import { getCurrentUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Configuração administrativa", robots: { index: false, follow: false } };

export default async function AdminSetupPage() {
  const user = await getCurrentUser();
  if (user?.role === "admin") redirect("/admin");
  return <main className="auth-page auth-page--registration"><Link className="auth-brand" href="/"><span>N</span><b>Nobre Barber Club</b></Link><section className="registration-sheet"><header><p className="eyebrow">Operations desk / configuração única</p><h1>Crie a conta proprietária.</h1><p>Esta etapa funciona apenas enquanto nenhum administrador com senha própria tiver sido criado.</p></header><AdminSetupForm /><aside><span>OWNER / BOOTSTRAP</span><h2>Acesso restrito</h2><p>O código vem do ambiente protegido do servidor. Depois da primeira configuração, este formulário é bloqueado permanentemente pelo banco.</p><Link href="/entrar">Voltar ao login ↗</Link></aside></section></main>;
}

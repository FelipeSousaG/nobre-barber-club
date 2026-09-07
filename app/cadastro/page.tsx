import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegistrationForm } from "@/app/auth-forms";
import { getCurrentUser, safeReturnPath } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Criar conta", robots: { index: false, follow: false } };

export default async function RegistrationPage({ searchParams }: { searchParams: Promise<{ retorno?: string }> }) {
  const { retorno } = await searchParams;
  const returnTo = safeReturnPath(retorno);
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : returnTo);
  return <main className="auth-page auth-page--registration"><Link className="auth-brand" href="/"><span>N</span><b>Nobre Barber Club</b></Link><section className="registration-sheet"><header><p className="eyebrow">Client file / cadastro</p><h1>Seu registro começa pelo essencial.</h1><p>Crie sua conta para reservar horários e manter seu histórico de atendimento.</p></header><RegistrationForm returnTo={returnTo} /><aside><span>ACCOUNT / PRIVATE</span><h2>Sobre a senha</h2><p>Sua senha nunca é armazenada em texto puro. Não reutilize credenciais do seu e-mail, banco ou redes sociais.</p><Link href="/entrar">Já tenho uma conta ↗</Link></aside></section></main>;
}

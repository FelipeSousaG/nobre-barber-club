import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/auth-forms";
import { getCurrentUser, safeReturnPath } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ retorno?: string }> }) {
  const { retorno } = await searchParams;
  const returnTo = safeReturnPath(retorno);
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : returnTo);
  return <main className="auth-page"><Link className="auth-brand" href="/"><span>N</span><b>Nobre Barber Club</b></Link><section className="auth-panel"><div className="auth-visual" aria-hidden="true"><span>CLIENT FILE</span><strong>19</strong><p>Cadeira reservada.<br />Histórico preservado.<br />Dados sob controle.</p></div><div className="auth-copy"><p className="eyebrow">Conta do cliente / acesso seguro</p><h1>Seu horário continua daqui.</h1><p>Entre com seu e-mail e senha para acessar agendamentos, histórico e preferências.</p><LoginForm returnTo={returnTo} /><dl className="auth-assurance"><div><dt>Senha</dt><dd>protegida por derivação criptográfica</dd></div><div><dt>Sessão</dt><dd>cookie seguro e inacessível ao JavaScript</dd></div><div><dt>Privacidade</dt><dd>dados usados somente no atendimento</dd></div></dl><Link className="auth-back" href="/">← Voltar para a edição</Link></div></section></main>;
}

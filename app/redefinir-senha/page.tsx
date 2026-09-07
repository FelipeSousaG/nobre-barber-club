import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/app/auth-forms";

export const metadata: Metadata = { title: "Criar nova senha", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <main className="auth-page"><Link className="auth-brand" href="/"><span>N</span><b>Nobre Barber Club</b></Link><section className="auth-panel"><div className="auth-visual" aria-hidden="true"><span>NEW CREDENTIAL</span><strong>01</strong><p>Uma senha nova.<br />Sessões anteriores<br />encerradas.</p></div><div className="auth-copy"><p className="eyebrow">Conta / segurança</p><h1>Crie uma nova senha.</h1>{token ? <ResetPasswordForm token={token} /> : <p className="form-message">O link está incompleto. Solicite uma nova recuperação.</p>}<Link className="auth-back" href="/recuperar-senha">Solicitar outro link</Link></div></section></main>;
}

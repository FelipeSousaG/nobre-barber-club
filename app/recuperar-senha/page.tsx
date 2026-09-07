import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/app/auth-forms";

export const metadata: Metadata = { title: "Recuperar senha", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return <main className="auth-page"><Link className="auth-brand" href="/"><span>N</span><b>Nobre Barber Club</b></Link><section className="auth-panel"><div className="auth-visual" aria-hidden="true"><span>ACCOUNT RECOVERY</span><strong>30</strong><p>Link único.<br />Prazo curto.<br />Nova credencial.</p></div><div className="auth-copy"><p className="eyebrow">Conta / recuperação</p><h1>Recupere o acesso.</h1><p>Informe o e-mail cadastrado. Se a conta existir, enviaremos um link válido por 30 minutos.</p><ForgotPasswordForm /></div></section></main>;
}

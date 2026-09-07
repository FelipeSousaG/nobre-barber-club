"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

type ApiResult = { error?: string; message?: string; redirectTo?: string };

async function postJson(url: string, body: unknown): Promise<ApiResult> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json() as ApiResult;
  if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir");
  return data;
}

export function LoginForm({ returnTo }: { returnTo: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const data = await postJson(`/api/auth/login?retorno=${encodeURIComponent(returnTo)}`, { email, password });
      window.location.assign(data.redirectTo ?? "/conta");
    } catch (error) { setBusy(false); setMessage(error instanceof Error ? error.message : "Não foi possível entrar"); }
  }
  return <form className="auth-form" onSubmit={submit} noValidate>
    <label><span>E-mail</span><input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label><span>Senha</span><input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    <div className="auth-form-links"><Link href="/recuperar-senha">Esqueci minha senha</Link><Link href="/cadastro">Criar conta</Link></div>
    <button className="auth-primary" type="submit" disabled={busy}>{busy ? "Entrando…" : "Entrar"}<span aria-hidden="true">↗</span></button>
    <p className="form-message" role="status">{message}</p>
  </form>;
}

export function RegistrationForm({ returnTo }: { returnTo: string }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", password: "", confirmPassword: "", privacyAccepted: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  function field(name: keyof typeof form, value: string | boolean) { setForm((current) => ({ ...current, [name]: value })); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const data = await postJson("/api/auth/register", form);
      const target = data.redirectTo ?? returnTo;
      window.location.assign(target === "/conta" && returnTo !== "/conta" ? returnTo : target);
    } catch (error) { setBusy(false); setMessage(error instanceof Error ? error.message : "Não foi possível criar a conta"); }
  }
  return <form className="profile-form auth-form" onSubmit={submit} noValidate>
    <div className="field-pair"><label><span>Nome</span><input autoComplete="given-name" required minLength={2} maxLength={50} value={form.firstName} onChange={(event) => field("firstName", event.target.value)} /></label><label><span>Sobrenome</span><input autoComplete="family-name" required minLength={2} maxLength={50} value={form.lastName} onChange={(event) => field("lastName", event.target.value)} /></label></div>
    <label><span>Telefone / WhatsApp</span><input type="tel" autoComplete="tel" inputMode="tel" required maxLength={20} placeholder="(11) 99999-9999" value={form.phone} onChange={(event) => field("phone", event.target.value)} /></label>
    <label><span>E-mail</span><input type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={(event) => field("email", event.target.value)} /></label>
    <div className="field-pair"><label><span>Senha</span><input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={form.password} onChange={(event) => field("password", event.target.value)} /></label><label><span>Confirmar senha</span><input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={form.confirmPassword} onChange={(event) => field("confirmPassword", event.target.value)} /></label></div>
    <p className="field-note">Use pelo menos 12 caracteres. Não reutilize a senha do seu e-mail ou banco.</p>
    <label className="privacy-check"><input type="checkbox" required checked={form.privacyAccepted} onChange={(event) => field("privacyAccepted", event.target.checked)} /><span>Autorizo o uso destes dados exclusivamente para atendimento e gestão dos meus horários.</span></label>
    <button className="auth-primary" type="submit" disabled={busy}>{busy ? "Criando conta…" : "Criar minha conta"}<span aria-hidden="true">↗</span></button>
    <p className="form-message" role="status">{message}</p>
    <p className="auth-switch">Já possui conta? <Link href={`/entrar?retorno=${encodeURIComponent(returnTo)}`}>Entrar</Link></p>
  </form>;
}

export function AdminSetupForm() {
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", password: "", confirmPassword: "", setupCode: "", privacyAccepted: true });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  function field(name: keyof typeof form, value: string) { setForm((current) => ({ ...current, [name]: value })); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try { const data = await postJson("/api/auth/setup-admin", form); window.location.assign(data.redirectTo ?? "/admin"); }
    catch (error) { setBusy(false); setMessage(error instanceof Error ? error.message : "Não foi possível configurar"); }
  }
  return <form className="profile-form auth-form" onSubmit={submit} noValidate><div className="field-pair"><label><span>Nome</span><input required minLength={2} maxLength={50} autoComplete="given-name" value={form.firstName} onChange={(event) => field("firstName", event.target.value)} /></label><label><span>Sobrenome</span><input required minLength={2} maxLength={50} autoComplete="family-name" value={form.lastName} onChange={(event) => field("lastName", event.target.value)} /></label></div><label><span>Telefone</span><input type="tel" required maxLength={20} autoComplete="tel" value={form.phone} onChange={(event) => field("phone", event.target.value)} /></label><label><span>E-mail administrativo</span><input type="email" required maxLength={254} autoComplete="email" value={form.email} onChange={(event) => field("email", event.target.value)} /></label><div className="field-pair"><label><span>Senha</span><input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={form.password} onChange={(event) => field("password", event.target.value)} /></label><label><span>Confirmar senha</span><input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={form.confirmPassword} onChange={(event) => field("confirmPassword", event.target.value)} /></label></div><label><span>Código único de configuração</span><input type="password" required minLength={32} maxLength={256} autoComplete="off" value={form.setupCode} onChange={(event) => field("setupCode", event.target.value)} /></label><button className="auth-primary" type="submit" disabled={busy}>{busy ? "Configurando…" : "Criar administrador"}<span aria-hidden="true">↗</span></button><p className="form-message" role="status">{message}</p></form>;
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setMessage(""); try { const data = await postJson("/api/auth/forgot-password", { email }); setMessage(data.message ?? "Verifique seu e-mail."); } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível enviar"); } finally { setBusy(false); } }
  return <form className="auth-form" onSubmit={submit}><label><span>E-mail cadastrado</span><input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label><button className="auth-primary" type="submit" disabled={busy}>{busy ? "Enviando…" : "Enviar instruções"}<span aria-hidden="true">↗</span></button><p className="form-message" role="status">{message}</p><p className="auth-switch"><Link href="/entrar">Voltar ao login</Link></p></form>;
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setMessage(""); try { const data = await postJson("/api/auth/reset-password", { token, password, confirmPassword }); setMessage(data.message ?? "Senha alterada"); setTimeout(() => window.location.assign("/entrar"), 900); } catch (error) { setBusy(false); setMessage(error instanceof Error ? error.message : "Não foi possível alterar"); } }
  return <form className="auth-form" onSubmit={submit}><label><span>Nova senha</span><input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label><label><span>Confirmar nova senha</span><input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label><p className="field-note">Use pelo menos 12 caracteres.</p><button className="auth-primary" type="submit" disabled={busy}>{busy ? "Alterando…" : "Salvar nova senha"}<span aria-hidden="true">↗</span></button><p className="form-message" role="status">{message}</p></form>;
}

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const session = await fetch("/api/session", { credentials: "same-origin" }).then((response) => response.json() as Promise<{ csrfToken: string | null }>);
      if (!session.csrfToken) throw new Error("Sessão indisponível");
      const response = await fetch("/api/auth/change-password", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": session.csrfToken },
        body: JSON.stringify({ currentPassword, password, confirmPassword }),
      });
      const data = await response.json() as ApiResult;
      if (!response.ok) throw new Error(data.error ?? "Não foi possível alterar a senha");
      setMessage(data.message ?? "Senha alterada");
      setTimeout(() => window.location.assign("/entrar"), 900);
    } catch (error) { setBusy(false); setMessage(error instanceof Error ? error.message : "Não foi possível alterar a senha"); }
  }
  return <form className="change-password" onSubmit={submit}><span>SEGURANÇA / ALTERAR SENHA</span><div><label><span>Senha atual</span><input type="password" autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label><span>Nova senha</span><input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label><label><span>Confirmar nova senha</span><input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label></div><button type="submit" disabled={busy}>{busy ? "Alterando…" : "Alterar senha"}</button><p className="form-message" role="status">{message}</p></form>;
}

export function LogoutButton({ className = "" }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      const session = await fetch("/api/session", { credentials: "same-origin" }).then((response) => response.json() as Promise<{ csrfToken: string | null }>);
      if (!session.csrfToken) throw new Error("Sessão indisponível");
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: { "x-csrf-token": session.csrfToken } });
      window.location.assign("/");
    } catch { setBusy(false); }
  }
  return <button className={className} type="button" disabled={busy} onClick={() => void logout()}>{busy ? "Saindo…" : "Sair ↗"}</button>;
}

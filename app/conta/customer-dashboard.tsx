"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChangePasswordForm, LogoutButton } from "@/app/auth-forms";
import { BUSINESS } from "@/lib/business";
import { formatMoney } from "@/lib/catalog";

type Profile = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
};

type Appointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "confirmed" | "completed" | "canceled" | "no_show";
  canCancel: boolean;
  service: { name: string; priceCents: number; durationMinutes: number };
  barber: { id: string; name: string };
};

const STATUS_LABEL: Record<Appointment["status"], string> = {
  confirmed: "Confirmado",
  completed: "Concluído",
  canceled: "Cancelado",
  no_show: "Não compareceu",
};

function appointmentDate(iso: string, format: "short" | "long" = "long"): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    ...(format === "short" ? { day: "2-digit", month: "short" } : { weekday: "long", day: "2-digit", month: "long" }),
  }).format(new Date(iso));
}

function appointmentTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

export default function CustomerDashboard({ displayName }: { displayName: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [activeView, setActiveView] = useState<"agenda" | "historico" | "perfil">("agenda");
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [openedAt] = useState(() => Date.now());

  const load = useCallback(async () => {
    setState("loading");
    try {
      const [sessionResponse, appointmentsResponse] = await Promise.all([
        fetch("/api/session", { credentials: "same-origin" }),
        fetch("/api/appointments", { credentials: "same-origin" }),
      ]);
      if (!sessionResponse.ok || !appointmentsResponse.ok) throw new Error("load");
      const session = await sessionResponse.json() as { csrfToken: string | null; profile: Profile; profileComplete: boolean };
      const schedule = await appointmentsResponse.json() as { appointments: Appointment[] };
      setProfile(session.profile);
      setProfileComplete(session.profileComplete);
      setCsrfToken(session.csrfToken);
      setAppointments(schedule.appointments);
      setFirstName(session.profile.firstName ?? "");
      setLastName(session.profile.lastName ?? "");
      setPhone(session.profile.phone ?? "");
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const upcoming = useMemo(() => appointments
    .filter((item) => item.status === "confirmed" && new Date(item.startsAt).valueOf() >= openedAt)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [appointments, openedAt]);
  const history = useMemo(() => appointments.filter((item) => !upcoming.some((next) => next.id === item.id)), [appointments, upcoming]);
  const favoriteBarber = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    appointments.filter((item) => item.status === "completed" || item.status === "confirmed").forEach((item) => {
      const current = counts.get(item.barber.id) ?? { name: item.barber.name, count: 0 };
      counts.set(item.barber.id, { ...current, count: current.count + 1 });
    });
    return [...counts.values()].sort((a, b) => b.count - a.count)[0] ?? null;
  }, [appointments]);

  async function cancelAppointment() {
    if (!cancelTarget || !csrfToken) return;
    setMessage("");
    try {
      const response = await fetch(`/api/appointments/${cancelTarget.id}/cancel`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "x-csrf-token": csrfToken },
      });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível cancelar");
      setCancelTarget(null);
      setMessage(data.message ?? "Agendamento cancelado");
      await load();
    } catch (error) {
      setCancelTarget(null);
      setMessage(error instanceof Error ? error.message : "Não foi possível cancelar");
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!csrfToken) return;
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ firstName, lastName, phone }),
      });
      const data = await response.json() as { error?: string; profile?: Profile };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível salvar");
      if (data.profile) setProfile(data.profile);
      setProfileComplete(true);
      setEditing(false);
      setMessage("Dados atualizados");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar");
    }
  }

  const firstNameDisplay = profile?.firstName ?? displayName.split(" ")[0];

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Link className="dashboard-brand" href="/"><span>N</span><b>{BUSINESS.shortName}</b><small>Client file</small></Link>
        <div><Link href="/#agenda">Novo horário</Link><LogoutButton /></div>
      </header>
      <aside className="dashboard-rail">
        <div><span>CLIENT</span><strong>{firstNameDisplay?.slice(0, 2).toUpperCase()}</strong></div>
        <nav aria-label="Área do cliente">
          <button type="button" aria-current={activeView === "agenda"} onClick={() => setActiveView("agenda")}><span>01</span>Agenda</button>
          <button type="button" aria-current={activeView === "historico"} onClick={() => setActiveView("historico")}><span>02</span>Histórico</button>
          <button type="button" aria-current={activeView === "perfil"} onClick={() => setActiveView("perfil")}><span>03</span>Perfil</button>
        </nav>
      </aside>
      <section className="dashboard-content">
        <header className="dashboard-title"><p className="eyebrow">Arquivo particular / {new Date().getFullYear()}</p><h1>Olá, {firstNameDisplay}.</h1><p>Seu histórico de cadeira, sem ruído.</p></header>
        {!profileComplete && <div className="dashboard-alert"><strong>Seu perfil ainda está incompleto.</strong><span>Complete telefone e nome antes de confirmar um horário.</span><Link href="/cadastro">Completar agora →</Link></div>}
        <p className="dashboard-message" role="status">{message}</p>
        {state === "loading" && <div className="dashboard-loading">Abrindo seu arquivo…</div>}
        {state === "error" && <div className="dashboard-loading">Não foi possível abrir seus dados. <button type="button" onClick={() => void load()}>Tentar novamente</button></div>}

        {state === "ready" && activeView === "agenda" && (
          <div className="dashboard-view">
            <div className="view-heading"><span>01</span><div><h2>Próximas cadeiras</h2><p>{upcoming.length ? `${upcoming.length} horário${upcoming.length > 1 ? "s" : ""} confirmado${upcoming.length > 1 ? "s" : ""}` : "Agenda livre"}</p></div></div>
            {upcoming.length === 0 ? <div className="empty-file"><strong>—</strong><h3>Nenhum horário marcado.</h3><p>Escolha o corte, a mão e o momento.</p><Link href="/#agenda">Reservar uma cadeira ↗</Link></div> : (
              <div className="appointment-stack">
                {upcoming.map((appointment, index) => (
                  <article className="appointment-ticket" key={appointment.id}>
                    <div className="appointment-date"><small>{String(index + 1).padStart(2, "0")}</small><strong>{appointmentDate(appointment.startsAt, "short")}</strong><span>{appointmentTime(appointment.startsAt)}</span></div>
                    <div><span className="status-mark">{STATUS_LABEL[appointment.status]}</span><h3>{appointment.service.name}</h3><p>com {appointment.barber.name} · {appointment.service.durationMinutes} min</p></div>
                    <strong>{formatMoney(appointment.service.priceCents)}</strong>
                    {appointment.canCancel ? <button type="button" onClick={() => setCancelTarget(appointment)}>Cancelar</button> : <small>Cancelamento online encerrado</small>}
                  </article>
                ))}
              </div>
            )}
            <div className="client-insights"><article><span>BARBEIRO MAIS ESCOLHIDO</span><strong>{favoriteBarber?.name ?? "Seu histórico começa no primeiro corte"}</strong><small>{favoriteBarber ? `${favoriteBarber.count} registro${favoriteBarber.count > 1 ? "s" : ""}` : "—"}</small></article><article><span>PRÓXIMO PASSO</span><strong>{upcoming[0] ? appointmentDate(upcoming[0].startsAt) : "Conhecer o lookbook"}</strong><Link href={upcoming[0] ? "/#agenda" : "/#lookbook"}>{upcoming[0] ? "Adicionar outro horário" : "Abrir arquivo"} ↗</Link></article></div>
          </div>
        )}

        {state === "ready" && activeView === "historico" && (
          <div className="dashboard-view">
            <div className="view-heading"><span>02</span><div><h2>Histórico</h2><p>Serviços realizados e registros encerrados.</p></div></div>
            {history.length === 0 ? <div className="empty-file"><strong>00</strong><h3>Ainda sem registros.</h3><p>Depois do primeiro atendimento, ele aparece aqui.</p></div> : <div className="history-table"><div className="history-head"><span>Data</span><span>Serviço</span><span>Profissional</span><span>Status</span><span>Valor</span></div>{history.map((item) => <article key={item.id}><time>{appointmentDate(item.startsAt, "short")} · {appointmentTime(item.startsAt)}</time><strong>{item.service.name}</strong><span>{item.barber.name}</span><span data-status={item.status}>{STATUS_LABEL[item.status]}</span><span>{formatMoney(item.service.priceCents)}</span></article>)}</div>}
          </div>
        )}

        {state === "ready" && activeView === "perfil" && profile && (
          <div className="dashboard-view profile-view">
            <div className="view-heading"><span>03</span><div><h2>Dados pessoais</h2><p>Somente o necessário para atender você.</p></div></div>
            {!editing ? <div className="profile-record"><dl><div><dt>Nome</dt><dd>{profile.firstName} {profile.lastName}</dd></div><div><dt>Telefone</dt><dd>{profile.phone ?? "Não informado"}</dd></div><div><dt>E-mail</dt><dd>{profile.email}</dd></div><div><dt>Senha</dt><dd>Protegida e nunca recuperável em texto original</dd></div></dl><button type="button" onClick={() => setEditing(true)}>Editar dados →</button></div> : (
              <form className="dashboard-profile-form" onSubmit={saveProfile}><div><label><span>Nome</span><input value={firstName} required minLength={2} maxLength={50} onChange={(event) => setFirstName(event.target.value)} /></label><label><span>Sobrenome</span><input value={lastName} required minLength={2} maxLength={50} onChange={(event) => setLastName(event.target.value)} /></label></div><label><span>Telefone</span><input type="tel" value={phone} required onChange={(event) => setPhone(event.target.value)} /></label><label><span>E-mail verificado</span><input value={profile.email} readOnly /></label><div className="profile-actions"><button type="button" onClick={() => setEditing(false)}>Descartar</button><button type="submit">Salvar alterações</button></div></form>
            )}
            <ChangePasswordForm />
            <aside className="privacy-note"><span>PRIVACIDADE / LGPD</span><p>Estes dados servem exclusivamente à identificação, contato e execução dos agendamentos. A senha é armazenada apenas como derivação criptográfica e nunca é exibida para clientes ou administradores.</p></aside>
          </div>
        )}
      </section>

      {cancelTarget && <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="cancel-title"><div><span>CONFIRMAR / CANCELAMENTO</span><h2 id="cancel-title">Liberar este horário?</h2><p>{cancelTarget.service.name} com {cancelTarget.barber.name}, em {appointmentDate(cancelTarget.startsAt)} às {appointmentTime(cancelTarget.startsAt)}.</p><small>A vaga volta imediatamente para a agenda.</small><div><button type="button" autoFocus onClick={() => setCancelTarget(null)}>Manter horário</button><button type="button" onClick={() => void cancelAppointment()}>Sim, cancelar</button></div></div></div>}
    </main>
  );
}

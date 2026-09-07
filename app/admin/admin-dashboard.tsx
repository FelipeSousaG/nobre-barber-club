"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { type FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LogoutButton } from "@/app/auth-forms";
import { BUSINESS } from "@/lib/business";
import { formatMoney } from "@/lib/catalog";
import type { Barber } from "@/lib/types";

type Overview = {
  metrics: { clients: number; upcoming: number; completed: number; revenueCents: number };
  appointments: Array<{ id: string; startsAt: string; status: string; clientName: string; serviceName: string; barberName: string; priceCents: number }>;
  recurringClients: Array<{ clientName: string; visits: number }>;
  services: Array<{ id: string; name: string; priceCents: number; durationMinutes: number; active: boolean }>;
  blockedSlots: Array<{ id: string; barberId: string; barberName: string; slotStart: string; reason: string | null }>;
};

function dateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

function ServiceEditor({ service, csrfToken, afterSave }: { service: Overview["services"][number]; csrfToken: string; afterSave: (message: string) => void }) {
  const [price, setPrice] = useState((service.priceCents / 100).toFixed(2).replace(".", ","));
  const [active, setActive] = useState(service.active);
  const [saving, setSaving] = useState(false);

  async function save() {
    const normalized = Number(price.replace(",", "."));
    if (!Number.isFinite(normalized) || normalized < 0) return afterSave("Informe um preço válido");
    setSaving(true);
    const response = await fetch(`/api/admin/services/${service.id}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify({ priceCents: Math.round(normalized * 100), active }),
    });
    const data = await response.json() as { error?: string; message?: string };
    setSaving(false);
    afterSave(response.ok ? (data.message ?? "Serviço atualizado") : (data.error ?? "Não foi possível atualizar"));
  }

  return <article className="admin-service-row"><div><strong>{service.name}</strong><small>{service.durationMinutes} min</small></div><label><span>Preço (R$)</span><input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} /></label><label className="admin-switch"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /><span>{active ? "Ativo" : "Oculto"}</span></label><button type="button" disabled={saving} onClick={() => void save()}>{saving ? "Salvando…" : "Salvar"}</button></article>;
}

export default function AdminDashboard({ displayName }: { displayName: string }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [view, setView] = useState<"visao" | "agenda" | "servicos" | "bloqueios">("visao");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [blockBarber, setBlockBarber] = useState("");
  const [blockStart, setBlockStart] = useState("");
  const [blockDuration, setBlockDuration] = useState(60);
  const [blockReason, setBlockReason] = useState("");
  const [openedAt] = useState(() => Date.now());

  const load = useCallback(async () => {
    setState("loading");
    try {
      const [overviewResponse, sessionResponse, catalogResponse] = await Promise.all([
        fetch("/api/admin/overview", { credentials: "same-origin" }),
        fetch("/api/session", { credentials: "same-origin" }),
        fetch("/api/catalog"),
      ]);
      if (!overviewResponse.ok || !sessionResponse.ok || !catalogResponse.ok) throw new Error("load");
      const nextOverview = await overviewResponse.json() as Overview;
      const session = await sessionResponse.json() as { csrfToken: string | null };
      const catalog = await catalogResponse.json() as { barbers: Barber[] };
      setOverview(nextOverview);
      setCsrfToken(session.csrfToken);
      setBarbers(catalog.barbers);
      setBlockBarber((current) => current || catalog.barbers[0]?.id || "");
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function setAppointmentStatus(id: string, status: "completed" | "canceled" | "no_show") {
    if (!csrfToken) return;
    const response = await fetch(`/api/admin/appointments/${id}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify({ status }),
    });
    const data = await response.json() as { error?: string; message?: string };
    setMessage(response.ok ? (data.message ?? "Agenda atualizada") : (data.error ?? "Não foi possível atualizar"));
    if (response.ok) await load();
  }

  async function createBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!csrfToken || !blockStart) return;
    const startsAt = new Date(`${blockStart}:00-03:00`).toISOString();
    const response = await fetch("/api/admin/blocked-slots", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify({ barberId: blockBarber, startsAt, durationMinutes: blockDuration, reason: blockReason }),
    });
    const data = await response.json() as { error?: string; message?: string };
    setMessage(response.ok ? (data.message ?? "Agenda bloqueada") : (data.error ?? "Não foi possível bloquear"));
    if (response.ok) {
      setBlockStart("");
      setBlockReason("");
      await load();
    }
  }

  async function removeBlock(id: string) {
    if (!csrfToken) return;
    const response = await fetch(`/api/admin/blocked-slots/${id}`, { method: "DELETE", credentials: "same-origin", headers: { "x-csrf-token": csrfToken } });
    const data = await response.json() as { error?: string; message?: string };
    setMessage(response.ok ? (data.message ?? "Bloqueio removido") : (data.error ?? "Não foi possível remover"));
    if (response.ok) await load();
  }

  return (
    <main className="admin-page">
      <header className="admin-header"><Link href="/"><span>N</span><b>{BUSINESS.shortName}</b><small>Operations desk</small></Link><div><p>Administrador <strong>{displayName}</strong></p><Link href="/conta">Conta do cliente</Link><LogoutButton /></div></header>
      <aside className="admin-nav"><span>DESK / 19</span><nav aria-label="Administração"><button type="button" aria-current={view === "visao"} onClick={() => setView("visao")}><i>01</i>Visão geral</button><button type="button" aria-current={view === "agenda"} onClick={() => setView("agenda")}><i>02</i>Agenda</button><button type="button" aria-current={view === "servicos"} onClick={() => setView("servicos")}><i>03</i>Serviços</button><button type="button" aria-current={view === "bloqueios"} onClick={() => setView("bloqueios")}><i>04</i>Bloqueios</button></nav><Link href="/">Abrir site ↗</Link></aside>
      <section className="admin-content">
        <header><p className="eyebrow">Painel operacional / dados reais</p><h1>Controle sem atalhos.</h1><p>As ações desta área são verificadas novamente no servidor e registradas em auditoria.</p></header>
        <div className="admin-toolbar"><span role="status">{message}</span><button type="button" onClick={() => void load()}>Atualizar dados ↻</button></div>
        {state === "loading" && <div className="admin-loading">Sincronizando operação…</div>}
        {state === "error" && <div className="admin-loading">Não foi possível carregar. <button type="button" onClick={() => void load()}>Tentar novamente</button></div>}
        {state === "ready" && overview && view === "visao" && <div className="admin-view"><div className="admin-metrics"><article><span>Clientes ativos</span><strong>{overview.metrics.clients}</strong><small>perfis completos</small></article><article><span>Próximos horários</span><strong>{overview.metrics.upcoming}</strong><small>confirmados</small></article><article><span>Atendimentos</span><strong>{overview.metrics.completed}</strong><small>concluídos</small></article><article><span>Faturamento</span><strong>{formatMoney(overview.metrics.revenueCents)}</strong><small>serviços concluídos</small></article></div><div className="admin-columns"><section><div className="admin-section-title"><span>AGENDA / PRÓXIMOS</span><h2>Na cadeira.</h2></div><div className="compact-list">{overview.appointments.filter((item) => item.status === "confirmed" && new Date(item.startsAt).valueOf() >= openedAt).slice(0, 8).map((item) => <article key={item.id}><time>{dateTime(item.startsAt)}</time><div><strong>{item.clientName}</strong><span>{item.serviceName} · {item.barberName}</span></div><b>{formatMoney(item.priceCents)}</b></article>)}{overview.metrics.upcoming === 0 && <p>Nenhum horário futuro.</p>}</div></section><aside><div className="admin-section-title"><span>RECORRÊNCIA</span><h2>Quem volta.</h2></div>{overview.recurringClients.length ? <ol className="recurring-list">{overview.recurringClients.map((client) => <li key={client.clientName}><span>{client.clientName}</span><strong>{client.visits} visitas</strong></li>)}</ol> : <p>A recorrência aparecerá após os primeiros retornos.</p>}</aside></div></div>}
        {state === "ready" && overview && view === "agenda" && <div className="admin-view"><div className="admin-section-title"><span>02 / AGENDA</span><h2>Atendimentos.</h2><p>Somente agendamentos confirmados podem ser encerrados ou cancelados.</p></div><div className="admin-appointment-table"><div><span>Data</span><span>Cliente / serviço</span><span>Profissional</span><span>Valor</span><span>Status / ação</span></div>{overview.appointments.map((item) => <article key={item.id}><time>{dateTime(item.startsAt)}</time><div><strong>{item.clientName}</strong><small>{item.serviceName}</small></div><span>{item.barberName}</span><span>{formatMoney(item.priceCents)}</span>{item.status === "confirmed" ? <select aria-label={`Atualizar ${item.clientName}`} defaultValue="" onChange={(event) => event.target.value && void setAppointmentStatus(item.id, event.target.value as "completed" | "canceled" | "no_show")}><option value="" disabled>Confirmado</option><option value="completed">Concluir</option><option value="no_show">Não compareceu</option><option value="canceled">Cancelar</option></select> : <b data-status={item.status}>{item.status}</b>}</article>)}</div></div>}
        {state === "ready" && overview && view === "servicos" && csrfToken && <div className="admin-view"><div className="admin-section-title"><span>03 / SERVIÇOS</span><h2>Menu e preços.</h2><p>Alterações entram na experiência pública e na agenda.</p></div><div className="admin-service-list">{overview.services.map((service) => <ServiceEditor key={service.id} service={service} csrfToken={csrfToken} afterSave={(nextMessage) => { setMessage(nextMessage); void load(); }} />)}</div></div>}
        {state === "ready" && overview && view === "bloqueios" && <div className="admin-view"><div className="admin-section-title"><span>04 / BLOQUEIOS</span><h2>Fechar a cadeira.</h2><p>Reserve intervalos para pausa, ausência ou manutenção. Slots já ocupados nunca são sobrescritos.</p></div><div className="block-layout"><form className="block-form" onSubmit={createBlock}><label><span>Profissional</span><select value={blockBarber} onChange={(event) => setBlockBarber(event.target.value)} required>{barbers.map((barber) => <option value={barber.id} key={barber.id}>{barber.name}</option>)}</select></label><label><span>Início</span><input type="datetime-local" step="1800" value={blockStart} onChange={(event) => setBlockStart(event.target.value)} required /></label><label><span>Duração</span><select value={blockDuration} onChange={(event) => setBlockDuration(Number(event.target.value))}><option value={30}>30 min</option><option value={60}>1 hora</option><option value={90}>1h30</option><option value={120}>2 horas</option><option value={240}>4 horas</option><option value={480}>Dia / 8h</option></select></label><label><span>Motivo interno</span><input value={blockReason} minLength={2} maxLength={120} onChange={(event) => setBlockReason(event.target.value)} required placeholder="Ex.: almoço, curso, manutenção" /></label><button type="submit">Bloquear agenda ↗</button></form><section><h3>Próximos bloqueios</h3>{overview.blockedSlots.length ? <div className="blocked-list">{overview.blockedSlots.map((item) => <article key={item.id}><div><time>{dateTime(item.slotStart)}</time><strong>{item.barberName}</strong><small>{item.reason}</small></div><button type="button" onClick={() => void removeBlock(item.id)}>Remover</button></article>)}</div> : <p>Nenhum bloqueio futuro.</p>}</section></div></div>}
      </section>
    </main>
  );
}

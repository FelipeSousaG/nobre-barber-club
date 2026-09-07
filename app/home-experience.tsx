"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Image from "next/image";
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";
import { addCalendarDays, dateInBusinessZone, localDateLabel } from "@/lib/booking-rules";
import { BARBERS, formatMoney, LOOKS, SERVICES } from "@/lib/catalog";
import { BUSINESS, whatsappUrl } from "@/lib/business";
import type { Barber, Look, Service } from "@/lib/types";

type SessionState = {
  authenticated: boolean;
  csrfToken: string | null;
  profileComplete?: boolean;
  isAdmin?: boolean;
  profile?: { firstName: string | null } | null;
};

type Slot = { startsAt: string; label: string };

const CATEGORIES = ["Todos", "Fade", "Classic", "Beard", "Modern", "Texture"] as const;
const TESTIMONIALS = [
  { quote: "É o primeiro corte que continua bom depois de duas semanas. O cuidado está no desenho, não só no acabamento.", name: "André M.", detail: "cliente desde 2021" },
  { quote: "O horário é respeitado e o corte conversa com o meu trabalho. Não preciso explicar tudo de novo a cada visita.", name: "Marcos L.", detail: "18 visitas" },
  { quote: "Caio entendeu a barba que eu queria antes de mim. Serviço preciso, ambiente excelente e nenhuma pressa.", name: "Renato C.", detail: "avaliação 5,0" },
];

function useEditorialMotion() {
  useEffect(() => {
    const items = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("is-visible")),
      { threshold: 0.14, rootMargin: "0px 0px -6%" },
    );
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);
}

export default function HomeExperience({ initialIdentity }: { initialIdentity: { displayName: string } | null }) {
  useEditorialMotion();
  const [navOpen, setNavOpen] = useState(false);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Todos");
  const [selectedLook, setSelectedLook] = useState<Look | null>(null);
  const [selectedBarberDetail, setSelectedBarberDetail] = useState<Barber | null>(null);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [services, setServices] = useState<Service[]>(SERVICES);
  const [barbers, setBarbers] = useState<Barber[]>(BARBERS);
  const [serviceId, setServiceId] = useState(SERVICES[1].id);
  const [barberId, setBarberId] = useState(BARBERS[0].id);
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [availabilityState, setAvailabilityState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [notes, setNotes] = useState("");
  const [session, setSession] = useState<SessionState>({ authenticated: Boolean(initialIdentity), csrfToken: null });
  const [bookingState, setBookingState] = useState<"idle" | "sending" | "success">("idle");
  const [bookingMessage, setBookingMessage] = useState("");
  const cursorRef = useRef<HTMLDivElement>(null);
  const modalReturnFocusRef = useRef<HTMLElement | null>(null);

  const filteredLooks = category === "Todos" ? LOOKS : LOOKS.filter((look) => look.category === category);
  const selectedService = services.find((service) => service.id === serviceId) ?? null;
  const selectedBarber = barbers.find((barber) => barber.id === barberId) ?? null;
  const today = dateInBusinessZone();
  const maxDate = addCalendarDays(today, 60);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/session", { signal: controller.signal, credentials: "same-origin" }).then((response) => response.json() as Promise<SessionState>),
      fetch("/api/catalog", { signal: controller.signal }).then((response) => response.json() as Promise<{ services: Service[]; barbers: Barber[] }>),
    ]).then(([sessionData, catalog]) => {
      setSession(sessionData);
      if (Array.isArray(catalog.services)) {
        setServices(catalog.services);
        setServiceId((current) => catalog.services.some((item) => item.id === current) ? current : (catalog.services[0]?.id ?? ""));
      }
      if (Array.isArray(catalog.barbers)) {
        setBarbers(catalog.barbers);
        setBarberId((current) => catalog.barbers.some((item) => item.id === current) ? current : (catalog.barbers[0]?.id ?? ""));
      }
    }).catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!serviceId || !barberId || !date) {
      setSlots([]);
      setSlot("");
      setAvailabilityState("idle");
      return;
    }
    const controller = new AbortController();
    setAvailabilityState("loading");
    setSlot("");
    fetch(`/api/availability?serviceId=${encodeURIComponent(serviceId)}&barberId=${encodeURIComponent(barberId)}&date=${encodeURIComponent(date)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("availability");
        return response.json() as Promise<{ slots: Slot[] }>;
      })
      .then((data) => {
        setSlots(data.slots);
        setAvailabilityState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSlots([]);
        setAvailabilityState("error");
      });
    return () => controller.abort();
  }, [barberId, date, serviceId]);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;
    const timer = window.setInterval(() => setQuoteIndex((current) => (current + 1) % TESTIMONIALS.length), 7000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const modalOpen = Boolean(selectedLook || selectedBarberDetail);
    document.body.classList.toggle("modal-open", modalOpen);
    if (!modalOpen && modalReturnFocusRef.current) {
      modalReturnFocusRef.current.focus();
      modalReturnFocusRef.current = null;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedLook(null);
        setSelectedBarberDetail(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedBarberDetail, selectedLook]);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches || !cursorRef.current) return;
    const cursor = cursorRef.current;
    const move = (event: MouseEvent) => {
      cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      const target = (event.target as Element | null)?.closest<HTMLElement>("[data-cursor]");
      cursor.dataset.active = target ? "true" : "false";
      const label = cursor.querySelector("span");
      if (label) label.textContent = target?.dataset.cursor ?? "";
    };
    window.addEventListener("mousemove", move, { passive: true });
    return () => window.removeEventListener("mousemove", move);
  }, []);

  const bookingReady = Boolean(serviceId && barberId && date && slot);
  const bookingStep = !serviceId ? 1 : !barberId ? 2 : !date || !slot ? 3 : 4;

  function sendToBooking(nextServiceId: string, nextBarberId?: string) {
    setServiceId(nextServiceId);
    if (nextBarberId) setBarberId(nextBarberId);
    setSelectedLook(null);
    setSelectedBarberDetail(null);
    window.setTimeout(() => document.getElementById("agenda")?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  function trapModalFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function submitBooking() {
    setBookingMessage("");
    if (!session.authenticated) {
      window.location.assign("/entrar?retorno=%2F%23agenda");
      return;
    }
    if (!session.profileComplete) {
      window.location.assign("/conta");
      return;
    }
    if (!bookingReady || !session.csrfToken) {
      setBookingMessage("Revise as escolhas ou atualize a página para renovar sua sessão.");
      return;
    }
    setBookingState("sending");
    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": session.csrfToken },
        body: JSON.stringify({ serviceId, barberId, startsAt: slot, notes }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível reservar");
      setBookingState("success");
      setBookingMessage("Reserva confirmada. Ela já está na sua área de cliente.");
      setSlot("");
      setSlots([]);
    } catch (error) {
      setBookingState("idle");
      setBookingMessage(error instanceof Error ? error.message : "Não foi possível reservar");
    }
  }

  const lookService = selectedLook ? services.find((service) => service.slug === selectedLook.serviceSlug) : null;
  const lookBarber = selectedLook ? barbers.find((barber) => barber.id === selectedLook.barberId) : null;

  return (
    <>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label={`${BUSINESS.name}, início`}>
          <span className="brand-mark">N</span>
          <span className="brand-copy"><b>{BUSINESS.shortName}</b><small>Barber Club / Est. {BUSINESS.founded}</small></span>
        </a>
        <button className="nav-toggle" type="button" aria-expanded={navOpen} aria-controls="site-nav" onClick={() => setNavOpen((open) => !open)}>
          <span>{navOpen ? "Fechar" : "Menu"}</span><i aria-hidden="true" />
        </button>
        <nav id="site-nav" className={navOpen ? "site-nav is-open" : "site-nav"} aria-label="Navegação principal">
          {[ ["Manifesto", "#manifesto"], ["Lookbook", "#lookbook"], ["Serviços", "#servicos"], ["Artistas", "#artistas"], ["Agenda", "#agenda"], ["Visite", "#visite"] ].map(([label, href], index) => (
            <a key={href} href={href} onClick={() => setNavOpen(false)}><span>0{index + 1}</span>{label}</a>
          ))}
          <a className="nav-account" href={initialIdentity ? "/conta" : "/entrar"}>{initialIdentity ? "Minha conta" : "Entrar"}<span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <main id="conteudo">
        <section className="hero" id="inicio" aria-labelledby="hero-title">
          <div className="hero-rail" aria-hidden="true">
            <span>ISSUE 06</span><span>SP / BR</span><span>MMXXVI</span>
          </div>
          <div className="hero-visual">
            <Image
              src="https://images.unsplash.com/photo-1653875700329-a7c8aca94c95?auto=format&fit=crop&w=1800&q=90"
              alt="Barbeiro trabalhando com precisão em um corte masculino"
              fill priority sizes="(max-width: 760px) 100vw, 58vw"
            />
            <div className="hero-caption"><span>Fotografia / ofício</span><span>Pinheiros, São Paulo</span></div>
          </div>
          <div className="hero-copy">
            <p className="eyebrow">Grooming journal · edição permanente</p>
            <h1 id="hero-title"><span>Nobre</span><em>corte é</em><span>linguagem.</span></h1>
            <div className="hero-intro">
              <p>Barbearia autoral para quem entende que imagem não é vaidade. É presença.</p>
              <a className="action-link action-link--dark" href="#agenda">Reservar horário <span aria-hidden="true">↘</span></a>
            </div>
          </div>
          <div className="hero-data">
            <div><small>Ateliê</small><strong>{BUSINESS.neighborhood}<br />São Paulo</strong></div>
            <div><small>Agenda</small><strong>Ter — Sáb<br />com hora marcada</strong></div>
            <div><small>Nota</small><strong>4,9 / 5<br />+2.400 atendimentos</strong></div>
          </div>
          <a className="hero-scroll" href="#manifesto"><span>Leia a edição</span><i aria-hidden="true" /></a>
        </section>

        <div className="moving-line" aria-hidden="true"><span>PRECISÃO &nbsp;—&nbsp; PRESENÇA &nbsp;—&nbsp; IDENTIDADE &nbsp;—&nbsp; SEM FÓRMULAS &nbsp;—&nbsp; </span><span>PRECISÃO &nbsp;—&nbsp; PRESENÇA &nbsp;—&nbsp; IDENTIDADE &nbsp;—&nbsp; SEM FÓRMULAS &nbsp;—&nbsp; </span></div>

        <section className="manifesto editorial-section" id="manifesto">
          <header className="chapter" data-reveal><span>Capítulo 01</span><p>Manifesto</p></header>
          <div className="manifesto-lead" data-reveal>
            <p className="dropcap">Um bom corte não chega antes de você.</p>
            <h2>Ele entra junto.</h2>
          </div>
          <div className="manifesto-copy" data-reveal>
            <p>A Nobre nasceu em 2019 para tratar o corte como construção de identidade — não como tendência descartável. Antes da máquina, existe escuta. Antes da navalha, leitura de rosto, rotina e intenção.</p>
            <p>O resultado é técnico, mas nunca mecânico. Cada visita registra o que funcionou para que o próximo corte evolua em vez de recomeçar.</p>
          </div>
          <div className="manifesto-stamp" data-reveal aria-label="Desde 2019, mais de 2400 atendimentos"><span>EST.</span><strong>19</strong><small>2.4K / cortes registrados</small></div>
          <div className="manifesto-note" data-reveal><span>Princípio n.º 01</span><p>Menos pose.<br />Mais presença.</p></div>
        </section>

        <section className="lookbook editorial-section" id="lookbook" aria-labelledby="lookbook-title">
          <header className="section-heading" data-reveal>
            <div className="chapter"><span>Capítulo 02</span><p>Arquivo de cortes</p></div>
            <div><p className="eyebrow">Coleção / 2026</p><h2 id="lookbook-title">Look&shy;book</h2></div>
            <p>Referências reais para começar uma conversa. Abra um corte, entenda o desenho e leve a escolha direto para a agenda.</p>
          </header>
          <div className="lookbook-filters" role="toolbar" aria-label="Filtrar cortes" data-reveal>
            {CATEGORIES.map((item) => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
          </div>
          <div className="lookbook-grid">
            {filteredLooks.map((look, index) => (
              <button className="look-card" type="button" key={look.id} onClick={(event) => { modalReturnFocusRef.current = event.currentTarget; setSelectedLook(look); }} data-cursor="VER" data-reveal>
                <span className="look-image"><Image src={look.imageUrl} alt={look.imageAlt} fill loading="lazy" sizes="(max-width: 760px) 92vw, 38vw" /></span>
                <span className="look-meta"><i>{String(index + 1).padStart(2, "0")}</i><b>{look.name}</b><small>{look.category}</small></span>
              </button>
            ))}
          </div>
        </section>

        <section className="services editorial-section" id="servicos" aria-labelledby="services-title">
          <header className="services-intro" data-reveal>
            <div className="chapter"><span>Capítulo 03</span><p>Menu de ofícios</p></div>
            <div><p className="eyebrow">Tempo, técnica, preço claro</p><h2 id="services-title">O que fazemos — e por quê.</h2></div>
          </header>
          <div className="service-ledger">
            {services.map((service, index) => (
              <article className="service-line" key={service.id} data-reveal>
                <span className="service-number">{String(index + 1).padStart(2, "0")}</span>
                <div><h3>{service.name}</h3><p>{service.description}</p></div>
                <span className="service-duration">{service.durationMinutes} min</span>
                <strong>{formatMoney(service.priceCents)}</strong>
                <button type="button" onClick={() => sendToBooking(service.id)} aria-label={`Agendar ${service.name}`}>Escolher <span aria-hidden="true">↘</span></button>
              </article>
            ))}
          </div>
          <p className="services-footnote">* Valores editoriais de exemplo. Substitua pelos preços reais no painel administrativo.</p>
        </section>

        <section className="artists editorial-section" id="artistas" aria-labelledby="artists-title">
          <header className="section-heading section-heading--inverse" data-reveal>
            <div className="chapter"><span>Capítulo 04</span><p>Os artistas</p></div>
            <div><p className="eyebrow">Três repertórios. Nenhum piloto automático.</p><h2 id="artists-title">Escolha pela mão.</h2></div>
            <p>Cada profissional tem técnica, linguagem e agenda próprias. Conheça o repertório antes de sentar na cadeira.</p>
          </header>
          <div className="artist-list">
            {barbers.map((barber, index) => (
              <article className="artist" key={barber.id} data-reveal>
                <button className="artist-photo" type="button" onClick={(event) => { modalReturnFocusRef.current = event.currentTarget; setSelectedBarberDetail(barber); }} data-cursor="PERFIL">
                  <Image src={barber.photoUrl} alt={`Retrato profissional de ${barber.name}`} fill loading="lazy" sizes="(max-width: 760px) 92vw, 32vw" />
                  <span>Perfil completo ↗</span>
                </button>
                <div className="artist-title"><span>0{index + 1}</span><h3>{barber.name}</h3></div>
                <p>{barber.specialty}</p>
                <dl><div><dt>Experiência</dt><dd>{barber.yearsExperience} anos</dd></div><div><dt>Avaliação</dt><dd>{barber.rating.toFixed(1)} / 5</dd></div><div><dt>Atende</dt><dd>{barber.availability}</dd></div></dl>
                <button className="text-button" type="button" onClick={() => sendToBooking(serviceId, barber.id)}>Agendar com {barber.name.split(" ")[0]} <span aria-hidden="true">↘</span></button>
              </article>
            ))}
          </div>
        </section>

        <section className="proof editorial-section" aria-labelledby="proof-title">
          <div className="proof-index" aria-hidden="true">05</div>
          <div className="proof-copy" data-reveal>
            <p className="eyebrow">Notas de quem volta</p>
            <h2 id="proof-title">“{TESTIMONIALS[quoteIndex].quote}”</h2>
            <p><strong>{TESTIMONIALS[quoteIndex].name}</strong> — {TESTIMONIALS[quoteIndex].detail}</p>
          </div>
          <div className="proof-controls" aria-label="Selecionar depoimento">
            {TESTIMONIALS.map((item, index) => <button type="button" key={item.name} aria-label={`Depoimento ${index + 1}`} aria-current={quoteIndex === index} onClick={() => setQuoteIndex(index)}>0{index + 1}</button>)}
          </div>
          <aside data-reveal><strong>92%</strong><p>dos clientes retornam em até 45 dias.</p><small>Dado demonstrativo para edição.</small></aside>
        </section>

        <section className="booking editorial-section" id="agenda" aria-labelledby="booking-title">
          <header className="booking-heading" data-reveal>
            <div className="chapter"><span>Capítulo 06</span><p>Reserva de cadeira</p></div>
            <p className="eyebrow">Agenda real · confirmação imediata</p>
            <h2 id="booking-title">Seu próximo corte começa aqui.</h2>
            <p>Escolha em quatro movimentos. O horário só é ocupado depois da confirmação no servidor.</p>
          </header>
          <div className="booking-progress" aria-label={`Etapa ${bookingStep} de 4`}><span style={{ width: `${bookingStep * 25}%` }} /><p>0{bookingStep} / 04</p></div>
          <div className="booking-workspace">
            <div className="booking-steps">
              <fieldset className="booking-step" data-reveal>
                <legend><span>01</span> Escolha o ofício</legend>
                <div className="choice-list">
                  {services.map((service) => <button type="button" className={serviceId === service.id ? "is-selected" : ""} aria-pressed={serviceId === service.id} key={service.id} onClick={() => setServiceId(service.id)}><span>{service.name}<small>{service.durationMinutes} min</small></span><strong>{formatMoney(service.priceCents)}</strong><i aria-hidden="true" /></button>)}
                </div>
              </fieldset>
              <fieldset className="booking-step" data-reveal>
                <legend><span>02</span> Escolha a mão</legend>
                <div className="barber-choices">
                  {barbers.map((barber) => <button type="button" className={barberId === barber.id ? "is-selected" : ""} aria-pressed={barberId === barber.id} key={barber.id} onClick={() => setBarberId(barber.id)}><span className="mini-portrait"><Image src={barber.photoUrl} alt="" fill sizes="72px" /></span><span><b>{barber.name}</b><small>{barber.specialty}</small></span><i aria-hidden="true" /></button>)}
                </div>
              </fieldset>
              <fieldset className="booking-step" data-reveal>
                <legend><span>03</span> Data e horário</legend>
                <label className="date-field"><span>Data da visita</span><input type="date" value={date} min={today} max={maxDate} onChange={(event) => setDate(event.target.value)} /></label>
                <div className="slot-grid" aria-live="polite">
                  {!date && <p className="empty-slots">Escolha uma data. Atendemos de terça a sábado.</p>}
                  {availabilityState === "loading" && <p className="empty-slots">Consultando a agenda…</p>}
                  {availabilityState === "error" && <p className="empty-slots">A agenda não respondeu. Tente novamente.</p>}
                  {availabilityState === "ready" && slots.length === 0 && <p className="empty-slots">Sem horários livres nessa data. Experimente outro dia.</p>}
                  {slots.map((item) => <button type="button" key={item.startsAt} className={slot === item.startsAt ? "is-selected" : ""} aria-pressed={slot === item.startsAt} onClick={() => setSlot(item.startsAt)}>{item.label}</button>)}
                </div>
                <label className="notes-field"><span>Observação <small>opcional</small></span><textarea value={notes} maxLength={280} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: quero preservar o comprimento no topo" /></label>
              </fieldset>
            </div>
            <aside className="booking-ticket" data-reveal>
              <div className="ticket-top"><span>N / 19</span><small>RESERVA DE CADEIRA</small></div>
              <div className="ticket-code" aria-hidden="true">||||| || |||| |||</div>
              <dl>
                <div><dt>Serviço</dt><dd>{selectedService?.name ?? "—"}</dd></div>
                <div><dt>Artista</dt><dd>{selectedBarber?.name ?? "—"}</dd></div>
                <div><dt>Data</dt><dd>{date ? localDateLabel(date) : "—"}</dd></div>
                <div><dt>Hora</dt><dd>{slots.find((item) => item.startsAt === slot)?.label ?? "—"}</dd></div>
                <div><dt>Duração</dt><dd>{selectedService ? `${selectedService.durationMinutes} min` : "—"}</dd></div>
              </dl>
              <div className="ticket-total"><span>Total</span><strong>{selectedService ? formatMoney(selectedService.priceCents) : "—"}</strong></div>
              <button type="button" className="confirm-button" disabled={!bookingReady || bookingState === "sending"} onClick={submitBooking} data-cursor="AGENDAR">
                {bookingState === "sending" ? "Confirmando…" : session.authenticated ? "Confirmar reserva" : "Entrar e confirmar"}<span aria-hidden="true">↗</span>
              </button>
              <p className={bookingState === "success" ? "booking-feedback is-success" : "booking-feedback"} aria-live="polite">{bookingMessage}</p>
              {bookingState === "success" && <a className="ticket-account" href="/conta">Abrir minha conta →</a>}
              <small className="ticket-policy">Cancelamento online até 12h antes. Ao confirmar, você concorda com a política de agenda.</small>
            </aside>
          </div>
        </section>

        <section className="visit" id="visite" aria-labelledby="visit-title">
          <div className="visit-map"><iframe src={BUSINESS.mapsUrl} title={`Mapa para ${BUSINESS.name}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div>
          <div className="visit-copy" data-reveal>
            <div className="chapter"><span>Epílogo</span><p>Faça uma visita</p></div>
            <p className="eyebrow">São Paulo / SP</p><h2 id="visit-title">Entre sem pressa.<br />Saia diferente.</h2>
            <address>{BUSINESS.address}</address>
            <div className="hours">{BUSINESS.openingHours.map((item) => <p key={item.label}><span>{item.label}</span><strong>{item.value}</strong></p>)}</div>
            <div className="visit-actions"><a href={whatsappUrl()} target="_blank" rel="noreferrer">WhatsApp ↗</a><a href={BUSINESS.instagramUrl} target="_blank" rel="noreferrer">{BUSINESS.instagram} ↗</a></div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-word">NOBRE</div>
        <div className="footer-grid"><p>Corte é linguagem.<br />Pinheiros — São Paulo.</p><nav aria-label="Links do rodapé"><a href="#lookbook">Lookbook</a><a href="#servicos">Serviços</a><a href="#artistas">Artistas</a><a href="#agenda">Agenda</a></nav><div><a href={initialIdentity ? "/conta" : "/entrar"}>{initialIdentity ? "Minha conta" : "Conta do cliente"} ↗</a><a href="/admin">Administração ↗</a></div></div>
        <div className="footer-base"><span>© {new Date().getFullYear()} {BUSINESS.name}</span><span>Dados demonstrativos · personalize antes de publicar</span><a href="#inicio">Voltar ao topo ↑</a></div>
      </footer>

      <a className="whatsapp-float" href={whatsappUrl()} target="_blank" rel="noreferrer" aria-label="Falar com a barbearia pelo WhatsApp"><span>WA</span><i>Falar agora</i></a>
      <div className="context-cursor" ref={cursorRef} aria-hidden="true"><span /></div>

      {selectedLook && (
        <div className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="look-modal-title" onKeyDown={trapModalFocus} onMouseDown={(event) => event.target === event.currentTarget && setSelectedLook(null)}>
          <article>
            <button className="modal-close" type="button" autoFocus onClick={() => setSelectedLook(null)} aria-label="Fechar detalhes">Fechar ×</button>
            <div className="modal-image"><Image src={selectedLook.imageUrl} alt={selectedLook.imageAlt} fill sizes="(max-width: 760px) 100vw, 48vw" /></div>
            <div className="modal-copy"><p className="eyebrow">Lookbook / {selectedLook.category}</p><h2 id="look-modal-title">{selectedLook.name}</h2><p>{selectedLook.description}</p><dl><div><dt>Tempo</dt><dd>{lookService?.durationMinutes ?? 60} min</dd></div><div><dt>Especialista</dt><dd>{lookBarber?.name ?? "Equipe Nobre"}</dd></div><div><dt>A partir de</dt><dd>{lookService ? formatMoney(lookService.priceCents) : "indisponível"}</dd></div></dl><button type="button" disabled={!lookService} className="action-link action-link--dark" onClick={() => lookService && sendToBooking(lookService.id, selectedLook.barberId)}>{lookService ? "Quero este corte" : "Serviço temporariamente indisponível"} <span aria-hidden="true">↘</span></button></div>
          </article>
        </div>
      )}

      {selectedBarberDetail && (
        <div className="detail-modal detail-modal--barber" role="dialog" aria-modal="true" aria-labelledby="barber-modal-title" onKeyDown={trapModalFocus} onMouseDown={(event) => event.target === event.currentTarget && setSelectedBarberDetail(null)}>
          <article>
            <button className="modal-close" type="button" autoFocus onClick={() => setSelectedBarberDetail(null)} aria-label="Fechar perfil">Fechar ×</button>
            <div className="modal-image"><Image src={selectedBarberDetail.photoUrl} alt={`Retrato de ${selectedBarberDetail.name}`} fill sizes="(max-width: 760px) 100vw, 48vw" /></div>
            <div className="modal-copy"><p className="eyebrow">Dossiê / artista</p><h2 id="barber-modal-title">{selectedBarberDetail.name}</h2><p>{selectedBarberDetail.bio}</p><dl><div><dt>Especialidade</dt><dd>{selectedBarberDetail.specialty}</dd></div><div><dt>Repertório</dt><dd>{selectedBarberDetail.favoriteStyles}</dd></div><div><dt>Experiência</dt><dd>{selectedBarberDetail.yearsExperience} anos</dd></div><div><dt>Avaliação</dt><dd>★ {selectedBarberDetail.rating.toFixed(1)}</dd></div><div><dt>Agenda</dt><dd>{selectedBarberDetail.availability}</dd></div></dl><button type="button" className="action-link action-link--dark" onClick={() => sendToBooking(serviceId, selectedBarberDetail.id)}>Agendar com {selectedBarberDetail.name.split(" ")[0]} <span aria-hidden="true">↘</span></button></div>
          </article>
        </div>
      )}
    </>
  );
}

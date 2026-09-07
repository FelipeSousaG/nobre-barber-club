import { getD1 } from "@/db";
import { appointmentSlotStarts, dateInBusinessZone, isBookableDate } from "@/lib/booking-rules";
import { audit, ensureCatalog } from "./data";

export type AdminOverview = {
  metrics: { clients: number; upcoming: number; completed: number; revenueCents: number };
  appointments: Array<{
    id: string; startsAt: string; status: string; clientName: string; serviceName: string; barberName: string; priceCents: number;
  }>;
  recurringClients: Array<{ clientName: string; visits: number }>;
  services: Array<{ id: string; name: string; priceCents: number; durationMinutes: number; active: boolean }>;
  blockedSlots: Array<{ id: string; barberId: string; barberName: string; slotStart: string; reason: string | null }>;
};

export async function getAdminOverview(): Promise<AdminOverview> {
  await ensureCatalog();
  const db = getD1();
  const now = new Date().toISOString();
  const [metrics, appointmentRows, recurringRows, serviceRows, blockedRows] = await Promise.all([
    db.prepare(
      `SELECT
         (SELECT count(*) FROM users WHERE first_name IS NOT NULL) AS clients,
         (SELECT count(*) FROM appointments WHERE status = 'confirmed' AND starts_at >= ?) AS upcoming,
         (SELECT count(*) FROM appointments WHERE status = 'completed') AS completed,
         (SELECT coalesce(sum(s.price_cents), 0) FROM appointments a JOIN services s ON s.id = a.service_id WHERE a.status = 'completed') AS revenue_cents`,
    ).bind(now).first<{ clients: number; upcoming: number; completed: number; revenue_cents: number }>(),
    db.prepare(
      `SELECT a.id, a.starts_at, a.status, coalesce(u.first_name || ' ' || u.last_name, 'Cliente') AS client_name,
              s.name AS service_name, b.name AS barber_name, s.price_cents
       FROM appointments a JOIN users u ON u.id = a.user_id JOIN services s ON s.id = a.service_id JOIN barbers b ON b.id = a.barber_id
       ORDER BY CASE WHEN a.starts_at >= ? THEN 0 ELSE 1 END, a.starts_at ASC LIMIT 80`,
    ).bind(now).all<{ id: string; starts_at: string; status: string; client_name: string; service_name: string; barber_name: string; price_cents: number }>(),
    db.prepare(
      `SELECT coalesce(u.first_name || ' ' || u.last_name, 'Cliente') AS client_name, count(*) AS visits
       FROM appointments a JOIN users u ON u.id = a.user_id
       WHERE a.status IN ('completed', 'confirmed') GROUP BY a.user_id HAVING count(*) >= 2 ORDER BY visits DESC LIMIT 12`,
    ).all<{ client_name: string; visits: number }>(),
    db.prepare(`SELECT id, name, price_cents, duration_minutes, active FROM services ORDER BY rowid`).all<{
      id: string; name: string; price_cents: number; duration_minutes: number; active: number;
    }>(),
    db.prepare(
      `SELECT ss.id, ss.barber_id, b.name AS barber_name, ss.slot_start, ss.reason
       FROM schedule_slots ss JOIN barbers b ON b.id = ss.barber_id
       WHERE ss.kind = 'blocked' AND ss.slot_start >= ? ORDER BY ss.slot_start ASC LIMIT 80`,
    ).bind(now).all<{ id: string; barber_id: string; barber_name: string; slot_start: string; reason: string | null }>(),
  ]);

  return {
    metrics: {
      clients: metrics?.clients ?? 0,
      upcoming: metrics?.upcoming ?? 0,
      completed: metrics?.completed ?? 0,
      revenueCents: metrics?.revenue_cents ?? 0,
    },
    appointments: appointmentRows.results.map((row) => ({
      id: row.id, startsAt: row.starts_at, status: row.status, clientName: row.client_name,
      serviceName: row.service_name, barberName: row.barber_name, priceCents: row.price_cents,
    })),
    recurringClients: recurringRows.results.map((row) => ({ clientName: row.client_name, visits: row.visits })),
    services: serviceRows.results.map((row) => ({
      id: row.id, name: row.name, priceCents: row.price_cents, durationMinutes: row.duration_minutes, active: Boolean(row.active),
    })),
    blockedSlots: blockedRows.results.map((row) => ({
      id: row.id, barberId: row.barber_id, barberName: row.barber_name, slotStart: row.slot_start, reason: row.reason,
    })),
  };
}

export async function updateService(
  actorId: string,
  serviceId: string,
  values: { priceCents?: number; active?: boolean },
): Promise<boolean> {
  const db = getD1();
  const current = await db.prepare(`SELECT id FROM services WHERE id = ? LIMIT 1`).bind(serviceId).first<{ id: string }>();
  if (!current) return false;
  if (values.priceCents !== undefined) {
    await db.prepare(`UPDATE services SET price_cents = ? WHERE id = ?`).bind(values.priceCents, serviceId).run();
  }
  if (values.active !== undefined) {
    await db.prepare(`UPDATE services SET active = ? WHERE id = ?`).bind(values.active ? 1 : 0, serviceId).run();
  }
  await audit(actorId, "admin.service.updated", "service", serviceId, {
    ...(values.priceCents !== undefined ? { priceCents: values.priceCents } : {}),
    ...(values.active !== undefined ? { active: values.active } : {}),
  });
  return true;
}

export async function updateAppointmentStatus(
  actorId: string,
  appointmentId: string,
  status: "confirmed" | "completed" | "canceled" | "no_show",
): Promise<"updated" | "not_found" | "invalid_transition"> {
  const db = getD1();
  const current = await db.prepare(`SELECT id, status FROM appointments WHERE id = ? LIMIT 1`).bind(appointmentId).first<{ id: string; status: string }>();
  if (!current) return "not_found";
  if (current.status !== "confirmed" && current.status !== status) return "invalid_transition";
  if (status === "confirmed") return "updated";
  await db.batch([
    db.prepare(`UPDATE appointments SET status = ?, canceled_at = CASE WHEN ? = 'canceled' THEN ? ELSE canceled_at END WHERE id = ? AND status = 'confirmed'`)
      .bind(status, status, new Date().toISOString(), appointmentId),
    ...(status === "canceled" ? [db.prepare(`DELETE FROM schedule_slots WHERE appointment_id = ?`).bind(appointmentId)] : []),
  ]);
  await audit(actorId, `admin.appointment.${status}`, "appointment", appointmentId);
  return "updated";
}

export async function createBlockedSlots(
  actorId: string,
  input: { barberId: string; startsAt: string; durationMinutes: number; reason: string },
): Promise<{ ok: true; ids: string[] } | { ok: false }> {
  const db = getD1();
  const barber = await db.prepare(`SELECT id, active FROM barbers WHERE id = ? LIMIT 1`).bind(input.barberId).first<{ id: string; active: number }>();
  const start = new Date(input.startsAt);
  const localDate = dateInBusinessZone(start);
  if (!barber || barber.active !== 1 || start.valueOf() <= Date.now() || !isBookableDate(localDate) || ![0, 30].includes(start.getUTCMinutes())) {
    return { ok: false };
  }
  const starts = appointmentSlotStarts(start.toISOString(), input.durationMinutes);
  const ids = starts.map(() => crypto.randomUUID());
  const createdAt = new Date().toISOString();
  try {
    await db.batch(starts.map((slot, index) => db.prepare(
      `INSERT INTO schedule_slots (id, barber_id, slot_start, kind, created_by, reason, created_at)
       VALUES (?, ?, ?, 'blocked', ?, ?, ?)`,
    ).bind(ids[index], input.barberId, slot, actorId, input.reason, createdAt)));
  } catch {
    return { ok: false };
  }
  await audit(actorId, "admin.schedule.blocked", "barber", input.barberId, { slots: starts.length });
  return { ok: true, ids };
}

export async function deleteBlockedSlot(actorId: string, slotId: string): Promise<boolean> {
  const row = await getD1().prepare(`SELECT id FROM schedule_slots WHERE id = ? AND kind = 'blocked' LIMIT 1`).bind(slotId).first<{ id: string }>();
  if (!row) return false;
  await getD1().prepare(`DELETE FROM schedule_slots WHERE id = ? AND kind = 'blocked'`).bind(slotId).run();
  await audit(actorId, "admin.schedule.unblocked", "schedule_slot", slotId);
  return true;
}

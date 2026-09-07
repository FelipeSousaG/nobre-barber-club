import { getD1 } from "@/db";
import {
  appointmentSlotStarts,
  availableSlots,
  canCancelAppointment,
  dateInBusinessZone,
  isBookableDate,
  localSlotToIso,
  weekDayForDate,
} from "@/lib/booking-rules";
import { audit, ensureCatalog, getProfile, isProfileComplete } from "./data";

type CatalogService = { id: string; name: string; duration_minutes: number; price_cents: number; active: number };
type CatalogBarber = { id: string; name: string; active: number; work_days: string };

export type AppointmentView = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "confirmed" | "completed" | "canceled" | "no_show";
  notes: string | null;
  service: { id: string; name: string; priceCents: number; durationMinutes: number };
  barber: { id: string; name: string };
  canCancel: boolean;
};

async function catalogItems(serviceId: string, barberId: string): Promise<{ service: CatalogService; barber: CatalogBarber } | null> {
  await ensureCatalog();
  const db = getD1();
  const [service, barber] = await Promise.all([
    db.prepare(`SELECT id, name, duration_minutes, price_cents, active FROM services WHERE id = ? LIMIT 1`).bind(serviceId).first<CatalogService>(),
    db.prepare(`SELECT id, name, active, work_days FROM barbers WHERE id = ? LIMIT 1`).bind(barberId).first<CatalogBarber>(),
  ]);
  return service && barber && service.active === 1 && barber.active === 1 ? { service, barber } : null;
}

export async function availability(serviceId: string, barberId: string, date: string): Promise<Array<{ startsAt: string; label: string }>> {
  const catalog = await catalogItems(serviceId, barberId);
  if (!catalog || !isBookableDate(date)) return [];
  const workDays = JSON.parse(catalog.barber.work_days) as number[];
  if (!workDays.includes(weekDayForDate(date))) return [];
  const start = localSlotToIso(date, 0);
  const end = localSlotToIso(date, 24 * 60);
  const rows = await getD1().prepare(
    `SELECT slot_start FROM schedule_slots WHERE barber_id = ? AND slot_start >= ? AND slot_start < ?`,
  ).bind(barberId, start, end).all<{ slot_start: string }>();
  return availableSlots(date, catalog.service.duration_minutes, new Set(rows.results.map((row) => row.slot_start)));
}

export async function createAppointment(
  userId: string,
  input: { serviceId: string; barberId: string; startsAt: string; notes?: string },
): Promise<{ ok: true; appointmentId: string } | { ok: false; reason: "profile" | "unavailable" }> {
  const profile = await getProfile(userId);
  if (!isProfileComplete(profile)) return { ok: false, reason: "profile" };
  const catalog = await catalogItems(input.serviceId, input.barberId);
  if (!catalog) return { ok: false, reason: "unavailable" };
  const startsAt = new Date(input.startsAt).toISOString();
  const localDate = dateInBusinessZone(new Date(startsAt));
  const openSlots = await availability(input.serviceId, input.barberId, localDate);
  if (!openSlots.some((slot) => slot.startsAt === startsAt)) return { ok: false, reason: "unavailable" };

  const appointmentId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const endsAt = new Date(new Date(startsAt).valueOf() + catalog.service.duration_minutes * 60_000).toISOString();
  const slots = appointmentSlotStarts(startsAt, catalog.service.duration_minutes);
  const db = getD1();
  const statements = [
    db.prepare(
      `INSERT INTO appointments
       (id, user_id, barber_id, service_id, starts_at, ends_at, status, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)`,
    ).bind(appointmentId, userId, input.barberId, input.serviceId, startsAt, endsAt, input.notes || null, createdAt),
    ...slots.map((slot) => db.prepare(
      `INSERT INTO schedule_slots (id, barber_id, slot_start, appointment_id, kind, created_at)
       VALUES (?, ?, ?, ?, 'appointment', ?)`,
    ).bind(crypto.randomUUID(), input.barberId, slot, appointmentId, createdAt)),
  ];

  try {
    await db.batch(statements);
  } catch (error) {
    const conflict = await db.prepare(
      `SELECT 1 AS found FROM schedule_slots WHERE barber_id = ? AND slot_start IN (${slots.map(() => "?").join(",")}) LIMIT 1`,
    ).bind(input.barberId, ...slots).first<{ found: number }>();
    if (conflict) {
      await audit(userId, "appointment.conflict", "appointment", null, { barberId: input.barberId });
      return { ok: false, reason: "unavailable" };
    }
    throw error;
  }
  await audit(userId, "appointment.created", "appointment", appointmentId, { barberId: input.barberId, serviceId: input.serviceId });
  return { ok: true, appointmentId };
}

export async function listUserAppointments(userId: string): Promise<AppointmentView[]> {
  const rows = await getD1().prepare(
    `SELECT a.id, a.starts_at, a.ends_at, a.status, a.notes,
            s.id AS service_id, s.name AS service_name, s.price_cents, s.duration_minutes,
            b.id AS barber_id, b.name AS barber_name
     FROM appointments a
     JOIN services s ON s.id = a.service_id
     JOIN barbers b ON b.id = a.barber_id
     WHERE a.user_id = ? ORDER BY a.starts_at DESC LIMIT 100`,
  ).bind(userId).all<{
    id: string; starts_at: string; ends_at: string; status: AppointmentView["status"]; notes: string | null;
    service_id: string; service_name: string; price_cents: number; duration_minutes: number;
    barber_id: string; barber_name: string;
  }>();
  return rows.results.map((row) => ({
    id: row.id, startsAt: row.starts_at, endsAt: row.ends_at, status: row.status, notes: row.notes,
    service: { id: row.service_id, name: row.service_name, priceCents: row.price_cents, durationMinutes: row.duration_minutes },
    barber: { id: row.barber_id, name: row.barber_name },
    canCancel: row.status === "confirmed" && canCancelAppointment(row.starts_at),
  }));
}

export async function cancelUserAppointment(userId: string, appointmentId: string): Promise<"canceled" | "not_found" | "too_late"> {
  const db = getD1();
  const row = await db.prepare(
    `SELECT id, starts_at, status FROM appointments WHERE id = ? AND user_id = ? LIMIT 1`,
  ).bind(appointmentId, userId).first<{ id: string; starts_at: string; status: string }>();
  if (!row || row.status !== "confirmed") return "not_found";
  if (!canCancelAppointment(row.starts_at)) return "too_late";
  const timestamp = new Date().toISOString();
  await db.batch([
    db.prepare(`UPDATE appointments SET status = 'canceled', canceled_at = ? WHERE id = ? AND user_id = ? AND status = 'confirmed'`).bind(timestamp, appointmentId, userId),
    db.prepare(`DELETE FROM schedule_slots WHERE appointment_id = ?`).bind(appointmentId),
  ]);
  await audit(userId, "appointment.canceled", "appointment", appointmentId);
  return "canceled";
}

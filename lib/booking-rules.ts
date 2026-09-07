export const BUSINESS_TIME_ZONE = "America/Sao_Paulo";
export const BUSINESS_UTC_OFFSET = "-03:00";
export const BOOKING_HORIZON_DAYS = 60;
export const CANCELLATION_NOTICE_HOURS = 12;

type DaySchedule = { opens: number; closes: number } | null;

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function dateInBusinessZone(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

export function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function scheduleForDate(date: string): DaySchedule {
  if (!isIsoDate(date)) return null;
  const day = new Date(`${date}T12:00:00${BUSINESS_UTC_OFFSET}`).getUTCDay();
  if (day >= 2 && day <= 5) return { opens: 9 * 60, closes: 20 * 60 };
  if (day === 6) return { opens: 8 * 60, closes: 18 * 60 };
  return null;
}

export function weekDayForDate(date: string): number {
  if (!isIsoDate(date)) return -1;
  return new Date(`${date}T12:00:00${BUSINESS_UTC_OFFSET}`).getUTCDay();
}

export function isBookableDate(date: string, now = new Date()): boolean {
  if (!scheduleForDate(date)) return false;
  const today = dateInBusinessZone(now);
  return date >= today && date <= addCalendarDays(today, BOOKING_HORIZON_DAYS);
}

export function localSlotToIso(date: string, minutes: number): string {
  const hour = Math.floor(minutes / 60).toString().padStart(2, "0");
  const minute = (minutes % 60).toString().padStart(2, "0");
  return new Date(`${date}T${hour}:${minute}:00${BUSINESS_UTC_OFFSET}`).toISOString();
}

export function localDateLabel(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function slotLabel(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function appointmentSlotStarts(startsAt: string, durationMinutes: number): string[] {
  const start = new Date(startsAt).valueOf();
  const end = start + durationMinutes * 60_000;
  const slots: string[] = [];
  for (let cursor = start; cursor < end; cursor += 30 * 60_000) slots.push(new Date(cursor).toISOString());
  return slots;
}

export function availableSlots(
  date: string,
  durationMinutes: number,
  occupied: ReadonlySet<string>,
  now = new Date(),
): Array<{ startsAt: string; label: string }> {
  if (!isBookableDate(date, now) || durationMinutes < 15 || durationMinutes > 240) return [];
  const schedule = scheduleForDate(date);
  if (!schedule) return [];
  const result: Array<{ startsAt: string; label: string }> = [];
  const earliest = now.valueOf() + 2 * 60 * 60_000;
  for (let minute = schedule.opens; minute + durationMinutes <= schedule.closes; minute += 30) {
    const startsAt = localSlotToIso(date, minute);
    if (new Date(startsAt).valueOf() < earliest) continue;
    const needed = appointmentSlotStarts(startsAt, durationMinutes);
    if (needed.every((slot) => !occupied.has(slot))) result.push({ startsAt, label: slotLabel(startsAt) });
  }
  return result;
}

export function canCancelAppointment(startsAt: string, now = new Date()): boolean {
  return new Date(startsAt).valueOf() - now.valueOf() >= CANCELLATION_NOTICE_HOURS * 60 * 60_000;
}

import test from "node:test";
import assert from "node:assert/strict";
import {
  addCalendarDays,
  appointmentSlotStarts,
  availableSlots,
  canCancelAppointment,
  dateInBusinessZone,
  isBookableDate,
  localSlotToIso,
  scheduleForDate,
  weekDayForDate,
} from "../lib/booking-rules.ts";

test("a agenda abre de terça a sábado com horário especial no sábado", () => {
  assert.deepEqual(scheduleForDate("2026-09-01"), { opens: 540, closes: 1200 });
  assert.deepEqual(scheduleForDate("2026-09-05"), { opens: 480, closes: 1080 });
  assert.equal(scheduleForDate("2026-09-06"), null);
  assert.equal(scheduleForDate("2026-09-07"), null);
  assert.equal(weekDayForDate("2026-09-05"), 6);
});

test("datas fora da janela de 60 dias ou em dia fechado são recusadas", () => {
  const now = new Date("2026-09-02T15:00:00.000Z");
  const today = dateInBusinessZone(now);
  assert.equal(today, "2026-09-02");
  assert.equal(isBookableDate(today, now), true);
  assert.equal(isBookableDate(addCalendarDays(today, 61), now), false);
  assert.equal(isBookableDate("2026-09-06", now), false);
});

test("slots ocupados bloqueiam toda a duração e não apenas o horário inicial", () => {
  const now = new Date("2026-09-01T12:00:00.000Z");
  const occupied = new Set([localSlotToIso("2026-09-03", 570)]); // 09:30
  const slots = availableSlots("2026-09-03", 60, occupied, now);
  assert.equal(slots.some((slot) => slot.label === "09:00"), false);
  assert.equal(slots.some((slot) => slot.label === "09:30"), false);
  assert.equal(slots.some((slot) => slot.label === "10:00"), true);
  assert.equal(appointmentSlotStarts(localSlotToIso("2026-09-03", 540), 50).length, 2);
});

test("cancelamento exige antecedência mínima de 12 horas", () => {
  const now = new Date("2026-09-02T12:00:00.000Z");
  assert.equal(canCancelAppointment("2026-09-03T01:00:00.000Z", now), true);
  assert.equal(canCancelAppointment("2026-09-02T23:59:59.000Z", now), false);
});

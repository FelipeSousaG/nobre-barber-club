import test from "node:test";
import assert from "node:assert/strict";
import { appointmentSchema, blockedSlotSchema, loginSchema, profileSchema, registrationSchema, serviceAdminSchema } from "../lib/validators.ts";

test("perfil normaliza telefone e rejeita nomes ou cargas inválidas", () => {
  const valid = profileSchema.safeParse({ firstName: "João", lastName: "D'Ávila", phone: "(11) 99999-9999" });
  assert.equal(valid.success, true);
  if (valid.success) assert.equal(valid.data.phone, "11999999999");
  assert.equal(profileSchema.safeParse({ firstName: "<script>", lastName: "Teste", phone: "11999999999" }).success, false);
  assert.equal(profileSchema.safeParse({ firstName: "A", lastName: "Teste", phone: "123" }).success, false);
});

test("cadastro exige e-mail válido, consentimento e senha longa confirmada", () => {
  const base = { firstName: "Felipe", lastName: "Sousa", phone: "16999999999", email: "felipe@example.com", password: "frase-secreta-com-18", confirmPassword: "frase-secreta-com-18", privacyAccepted: true };
  assert.equal(registrationSchema.safeParse(base).success, true);
  assert.equal(registrationSchema.safeParse({ ...base, confirmPassword: "outra-senha-segura" }).success, false);
  assert.equal(registrationSchema.safeParse({ ...base, password: "curta", confirmPassword: "curta" }).success, false);
  assert.equal(registrationSchema.safeParse({ ...base, privacyAccepted: false }).success, false);
  assert.equal(loginSchema.safeParse({ email: "invalido", password: "qualquer" }).success, false);
});

test("agendamento e comandos administrativos têm limites explícitos", () => {
  assert.equal(appointmentSchema.safeParse({ serviceId: "srv", barberId: "brb", startsAt: "2026-09-03T12:00:00.000Z", notes: "x".repeat(281) }).success, false);
  assert.equal(serviceAdminSchema.safeParse({ priceCents: -1 }).success, false);
  assert.equal(blockedSlotSchema.safeParse({ barberId: "brb", startsAt: "2026-09-03T12:00:00.000Z", durationMinutes: 999, reason: "curso" }).success, false);
});

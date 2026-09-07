import { z } from "zod";

const personName = z
  .string()
  .trim()
  .min(2, "Informe pelo menos 2 caracteres")
  .max(50, "Use no máximo 50 caracteres")
  .regex(/^[\p{L}][\p{L}\p{M} .'-]*$/u, "Use apenas letras e separadores comuns");

export const profileSchema = z.object({
  firstName: personName,
  lastName: personName,
  phone: z.string().transform((value) => value.replace(/\D/g, "")).pipe(
    z.string().min(10, "Informe um telefone com DDD").max(13, "Telefone inválido"),
  ),
});

const email = z.string().trim().toLowerCase().email("Informe um e-mail válido").max(254, "E-mail muito longo");
const password = z.string().min(12, "A senha deve ter pelo menos 12 caracteres").max(128, "A senha deve ter no máximo 128 caracteres");

const registrationFields = profileSchema.extend({
  email,
  password,
  confirmPassword: z.string(),
  privacyAccepted: z.literal(true, { message: "Aceite o uso dos dados para criar a conta" }),
});

export const registrationSchema = registrationFields.refine((value) => value.password === value.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

export const adminSetupSchema = registrationFields.extend({
  setupCode: z.string().min(32, "Código de configuração inválido").max(256, "Código de configuração inválido"),
}).refine((value) => value.password === value.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(128),
  password,
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  password,
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
}).refine((value) => value.currentPassword !== value.password, {
  message: "A nova senha precisa ser diferente da atual",
  path: ["password"],
});

export const appointmentSchema = z.object({
  serviceId: z.string().trim().min(1).max(64),
  barberId: z.string().trim().min(1).max(64),
  startsAt: z.string().datetime({ offset: true }),
  notes: z.string().trim().max(280).optional().default(""),
});

export const availabilitySchema = z.object({
  serviceId: z.string().trim().min(1).max(64),
  barberId: z.string().trim().min(1).max(64),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const serviceAdminSchema = z.object({
  priceCents: z.number().int().min(0).max(1_000_000).optional(),
  active: z.boolean().optional(),
}).refine((value) => value.priceCents !== undefined || value.active !== undefined);

export const appointmentStatusSchema = z.object({
  status: z.enum(["confirmed", "completed", "canceled", "no_show"]),
});

export const blockedSlotSchema = z.object({
  barberId: z.string().trim().min(1).max(64),
  startsAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(30).max(480),
  reason: z.string().trim().min(2).max(120),
});

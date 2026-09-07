import { sql } from "drizzle-orm";
import { check, index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    phone: text("phone"),
    passwordHash: text("password_hash"),
    emailVerifiedAt: text("email_verified_at"),
    role: text("role", { enum: ["client", "admin"] }).notNull().default("client"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    check("users_role_check", sql`${table.role} in ('client', 'admin')`),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
  },
  (table) => [
    index("sessions_user_idx").on(table.userId),
    index("sessions_expires_idx").on(table.expiresAt),
  ],
);

export const passwordResetTokens = sqliteTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    usedAt: text("used_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("password_reset_tokens_user_idx").on(table.userId),
    index("password_reset_tokens_expires_idx").on(table.expiresAt),
  ],
);

export const barbers = sqliteTable(
  "barbers",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    bio: text("bio").notNull(),
    specialty: text("specialty").notNull(),
    photoUrl: text("photo_url").notNull(),
    yearsExperience: integer("years_experience").notNull(),
    favoriteStyles: text("favorite_styles").notNull(),
    workDays: text("work_days").notNull().default("[]"),
    rating: real("rating").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("barbers_active_idx").on(table.active)],
);

export const services = sqliteTable(
  "services",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    priceCents: integer("price_cents").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("services_active_idx").on(table.active),
    check("services_duration_check", sql`${table.durationMinutes} between 15 and 240`),
    check("services_price_check", sql`${table.priceCents} between 0 and 1000000`),
  ],
);

export const appointments = sqliteTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    barberId: text("barber_id").notNull().references(() => barbers.id, { onDelete: "restrict" }),
    serviceId: text("service_id").notNull().references(() => services.id, { onDelete: "restrict" }),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    status: text("status", { enum: ["confirmed", "completed", "canceled", "no_show"] }).notNull().default("confirmed"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    canceledAt: text("canceled_at"),
  },
  (table) => [
    index("appointments_user_starts_idx").on(table.userId, table.startsAt),
    index("appointments_barber_starts_idx").on(table.barberId, table.startsAt),
    index("appointments_status_starts_idx").on(table.status, table.startsAt),
    check("appointments_status_check", sql`${table.status} in ('confirmed', 'completed', 'canceled', 'no_show')`),
  ],
);

export const scheduleSlots = sqliteTable(
  "schedule_slots",
  {
    id: text("id").primaryKey(),
    barberId: text("barber_id").notNull().references(() => barbers.id, { onDelete: "cascade" }),
    slotStart: text("slot_start").notNull(),
    appointmentId: text("appointment_id").references(() => appointments.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["appointment", "blocked"] }).notNull(),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("schedule_slots_barber_start_unique").on(table.barberId, table.slotStart),
    index("schedule_slots_appointment_idx").on(table.appointmentId),
    check("schedule_slots_kind_check", sql`${table.kind} in ('appointment', 'blocked')`),
  ],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadataJson: text("metadata_json"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("audit_logs_action_created_idx").on(table.action, table.createdAt)],
);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: integer("window_start").notNull(),
  count: integer("count").notNull(),
});

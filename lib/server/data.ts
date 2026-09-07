import { getD1 } from "@/db";
import { BARBERS, SERVICES } from "@/lib/catalog";
import type { Barber, Profile, Service } from "@/lib/types";

function nowIso(): string {
  return new Date().toISOString();
}

export async function ensureCatalog(): Promise<void> {
  const db = getD1();
  const createdAt = nowIso();
  const statements = [
    ...BARBERS.map((barber) => db.prepare(
      `INSERT OR IGNORE INTO barbers
       (id, slug, name, bio, specialty, photo_url, years_experience, favorite_styles, work_days, rating, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      barber.id, barber.slug, barber.name, barber.bio, barber.specialty, barber.photoUrl,
      barber.yearsExperience, barber.favoriteStyles, JSON.stringify(barber.workDays), barber.rating, barber.active ? 1 : 0, createdAt,
    )),
    ...SERVICES.map((service) => db.prepare(
      `INSERT OR IGNORE INTO services
       (id, slug, name, description, duration_minutes, price_cents, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      service.id, service.slug, service.name, service.description, service.durationMinutes,
      service.priceCents, service.active ? 1 : 0, createdAt,
    )),
  ];
  await db.batch(statements);
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const row = await getD1().prepare(
    `SELECT id, email, first_name, last_name, phone, email_verified_at, role, created_at, updated_at FROM users WHERE id = ? LIMIT 1`,
  ).bind(userId).first<{
    id: string; email: string; first_name: string | null; last_name: string | null;
    phone: string | null; email_verified_at: string | null; role: "client" | "admin"; created_at: string; updated_at: string;
  }>();
  return row ? {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    emailVerifiedAt: row.email_verified_at,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } : null;
}

export function isProfileComplete(profile: Profile | null): boolean {
  return Boolean(profile?.firstName && profile.lastName && profile.phone);
}

export async function updateProfile(userId: string, firstName: string, lastName: string, phone: string): Promise<Profile> {
  await getD1().prepare(
    `UPDATE users SET first_name = ?, last_name = ?, phone = ?, updated_at = ? WHERE id = ?`,
  ).bind(firstName, lastName, phone, nowIso(), userId).run();
  const profile = await getProfile(userId);
  if (!profile) throw new Error("Profile update failed");
  return profile;
}

export async function listCatalog(): Promise<{ services: Service[]; barbers: Barber[] }> {
  await ensureCatalog();
  const db = getD1();
  const [serviceResult, barberResult] = await Promise.all([
    db.prepare(
      `SELECT id, slug, name, description, duration_minutes, price_cents, active
       FROM services WHERE active = 1 ORDER BY rowid`,
    ).all<{
      id: string; slug: string; name: string; description: string; duration_minutes: number; price_cents: number; active: number;
    }>(),
    db.prepare(
      `SELECT id, slug, name, bio, specialty, photo_url, years_experience, favorite_styles, work_days, rating, active
       FROM barbers WHERE active = 1 ORDER BY rowid`,
    ).all<{
      id: string; slug: string; name: string; bio: string; specialty: string; photo_url: string;
      years_experience: number; favorite_styles: string; work_days: string; rating: number; active: number;
    }>(),
  ]);
  return {
    services: serviceResult.results.map((row) => ({
      id: row.id, slug: row.slug, name: row.name, description: row.description,
      durationMinutes: row.duration_minutes, priceCents: row.price_cents, active: Boolean(row.active),
    })),
    barbers: barberResult.results.map((row) => ({
      id: row.id, slug: row.slug, name: row.name, bio: row.bio, specialty: row.specialty,
      photoUrl: row.photo_url, yearsExperience: row.years_experience,
      favoriteStyles: row.favorite_styles, workDays: JSON.parse(row.work_days) as number[], rating: row.rating, active: Boolean(row.active),
      availability: BARBERS.find((item) => item.id === row.id)?.availability ?? "Consulte a agenda",
    })),
  };
}

export async function audit(
  actorUserId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, string | number | boolean> = {},
): Promise<void> {
  await getD1().prepare(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), actorUserId, action, entityType, entityId, JSON.stringify(metadata), nowIso()).run();
}

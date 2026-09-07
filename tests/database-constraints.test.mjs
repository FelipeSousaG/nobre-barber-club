import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

function applyMigrations(db) {
  const files = readdirSync(new URL("../drizzle/", import.meta.url)).filter((name) => name.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8").replaceAll("--> statement-breakpoint", "");
    db.exec(sql);
  }
}

test("o banco rejeita dois usos do mesmo slot pelo mesmo barbeiro", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  applyMigrations(db);
  db.prepare("INSERT INTO users (id,email,role,created_at,updated_at) VALUES (?,?,?,?,?)").run("u1", "u@example.com", "client", "now", "now");
  db.prepare("INSERT INTO barbers (id,slug,name,bio,specialty,photo_url,years_experience,favorite_styles,work_days,rating,active,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .run("b1", "barber-1", "Barber 1", "bio", "fade", "photo", 5, "fade", "[2,3,4,5,6]", 5, 1, "now");
  db.prepare("INSERT INTO barbers (id,slug,name,bio,specialty,photo_url,years_experience,favorite_styles,work_days,rating,active,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .run("b2", "barber-2", "Barber 2", "bio", "fade", "photo", 5, "fade", "[2,3,4,5,6]", 5, 1, "now");
  db.prepare("INSERT INTO schedule_slots (id,barber_id,slot_start,kind,created_at) VALUES (?,?,?,?,?)").run("s1", "b1", "2026-09-03T12:00:00.000Z", "blocked", "now");
  assert.throws(() => db.prepare("INSERT INTO schedule_slots (id,barber_id,slot_start,kind,created_at) VALUES (?,?,?,?,?)").run("orphan", "missing", "2026-09-03T13:00:00.000Z", "blocked", "now"));
  assert.throws(() => db.prepare("INSERT INTO schedule_slots (id,barber_id,slot_start,kind,created_at) VALUES (?,?,?,?,?)").run("s2", "b1", "2026-09-03T12:00:00.000Z", "blocked", "now"));
  assert.doesNotThrow(() => db.prepare("INSERT INTO schedule_slots (id,barber_id,slot_start,kind,created_at) VALUES (?,?,?,?,?)").run("s3", "b2", "2026-09-03T12:00:00.000Z", "blocked", "now"));
  db.close();
});

test("a migração guarda apenas hash de senha e identificador opaco de sessão", () => {
  const combined = readdirSync(new URL("../drizzle/", import.meta.url))
    .filter((name) => name.endsWith(".sql"))
    .map((file) => readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8"))
    .join("\n");
  assert.match(combined, /`password_hash` text/);
  assert.match(combined, /CREATE TABLE `sessions`/);
  assert.doesNotMatch(combined, /plain_password|raw_password|session_token|refresh_token/i);
  assert.match(combined, /UNIQUE INDEX `schedule_slots_barber_start_unique`/);
  assert.match(combined, /ADD `work_days` text DEFAULT '\[\]' NOT NULL/);
});

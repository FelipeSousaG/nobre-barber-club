CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`barber_id` text NOT NULL,
	`service_id` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`canceled_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`barber_id`) REFERENCES `barbers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "appointments_status_check" CHECK("appointments"."status" in ('confirmed', 'completed', 'canceled', 'no_show'))
);
--> statement-breakpoint
CREATE INDEX `appointments_user_starts_idx` ON `appointments` (`user_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `appointments_barber_starts_idx` ON `appointments` (`barber_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `appointments_status_starts_idx` ON `appointments` (`status`,`starts_at`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`metadata_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_logs_action_created_idx` ON `audit_logs` (`action`,`created_at`);--> statement-breakpoint
CREATE TABLE `barbers` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`bio` text NOT NULL,
	`specialty` text NOT NULL,
	`photo_url` text NOT NULL,
	`years_experience` integer NOT NULL,
	`favorite_styles` text NOT NULL,
	`rating` real NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `barbers_slug_unique` ON `barbers` (`slug`);--> statement-breakpoint
CREATE INDEX `barbers_active_idx` ON `barbers` (`active`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `schedule_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`barber_id` text NOT NULL,
	`slot_start` text NOT NULL,
	`appointment_id` text,
	`kind` text NOT NULL,
	`created_by` text,
	`reason` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`barber_id`) REFERENCES `barbers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "schedule_slots_kind_check" CHECK("schedule_slots"."kind" in ('appointment', 'blocked'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_slots_barber_start_unique` ON `schedule_slots` (`barber_id`,`slot_start`);--> statement-breakpoint
CREATE INDEX `schedule_slots_appointment_idx` ON `schedule_slots` (`appointment_id`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "services_duration_check" CHECK("services"."duration_minutes" between 15 and 240),
	CONSTRAINT "services_price_check" CHECK("services"."price_cents" between 0 and 1000000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `services_slug_unique` ON `services` (`slug`);--> statement-breakpoint
CREATE INDEX `services_active_idx` ON `services` (`active`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`first_name` text,
	`last_name` text,
	`phone` text,
	`role` text DEFAULT 'client' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "users_role_check" CHECK("users"."role" in ('client', 'admin'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
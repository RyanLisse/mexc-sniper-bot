-- Migration: Add transaction lock tables
-- These tables are defined in schema.ts but were missing from migrations

CREATE TABLE `transaction_locks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lock_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`owner_id` text NOT NULL,
	`owner_type` text NOT NULL,
	`acquired_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer NOT NULL,
	`released_at` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`lock_type` text DEFAULT 'exclusive' NOT NULL,
	`transaction_type` text NOT NULL,
	`transaction_data` text NOT NULL,
	`max_retries` integer DEFAULT 3 NOT NULL,
	`current_retries` integer DEFAULT 0 NOT NULL,
	`timeout_ms` integer DEFAULT 30000 NOT NULL,
	`result` text,
	`error_message` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transaction_locks_lock_id_unique` ON `transaction_locks` (`lock_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `transaction_locks_idempotency_key_unique` ON `transaction_locks` (`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `transaction_locks_resource_id_idx` ON `transaction_locks` (`resource_id`);
--> statement-breakpoint
CREATE INDEX `transaction_locks_status_idx` ON `transaction_locks` (`status`);
--> statement-breakpoint
CREATE INDEX `transaction_locks_expires_at_idx` ON `transaction_locks` (`expires_at`);
--> statement-breakpoint
CREATE INDEX `transaction_locks_idempotency_key_idx` ON `transaction_locks` (`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `transaction_locks_owner_id_idx` ON `transaction_locks` (`owner_id`);
--> statement-breakpoint
CREATE INDEX `transaction_locks_resource_status_idx` ON `transaction_locks` (`resource_id`,`status`);
--> statement-breakpoint
CREATE INDEX `transaction_locks_owner_status_idx` ON `transaction_locks` (`owner_id`,`status`);
--> statement-breakpoint

CREATE TABLE `transaction_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`queue_id` text NOT NULL,
	`lock_id` text,
	`resource_id` text NOT NULL,
	`priority` integer DEFAULT 5 NOT NULL,
	`transaction_type` text NOT NULL,
	`transaction_data` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`queued_at` integer DEFAULT (unixepoch()) NOT NULL,
	`processing_started_at` integer,
	`completed_at` integer,
	`result` text,
	`error_message` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`owner_id` text NOT NULL,
	`owner_type` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lock_id`) REFERENCES `transaction_locks`(`lock_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transaction_queue_queue_id_unique` ON `transaction_queue` (`queue_id`);
--> statement-breakpoint
CREATE INDEX `transaction_queue_resource_id_idx` ON `transaction_queue` (`resource_id`);
--> statement-breakpoint
CREATE INDEX `transaction_queue_status_idx` ON `transaction_queue` (`status`);
--> statement-breakpoint
CREATE INDEX `transaction_queue_priority_idx` ON `transaction_queue` (`priority`);
--> statement-breakpoint
CREATE INDEX `transaction_queue_queued_at_idx` ON `transaction_queue` (`queued_at`);
--> statement-breakpoint
CREATE INDEX `transaction_queue_idempotency_key_idx` ON `transaction_queue` (`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `transaction_queue_status_priority_idx` ON `transaction_queue` (`status`,`priority`,`queued_at`);
--> statement-breakpoint
CREATE INDEX `transaction_queue_resource_status_idx` ON `transaction_queue` (`resource_id`,`status`);
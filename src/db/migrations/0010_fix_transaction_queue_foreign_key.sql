-- Fix transaction queue foreign key constraint to allow NULL values
-- This addresses foreign key mismatch errors in tests

-- Disable foreign key checks temporarily
PRAGMA foreign_keys = OFF;

-- Create new transaction_queue table with proper foreign key handling
CREATE TABLE `transaction_queue_new` (
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
	FOREIGN KEY (`lock_id`) REFERENCES `transaction_locks`(`lock_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

-- Copy existing data from old table to new table
INSERT INTO `transaction_queue_new` 
SELECT * FROM `transaction_queue` WHERE EXISTS (SELECT 1 FROM `transaction_queue`);
--> statement-breakpoint

-- Drop old table
DROP TABLE IF EXISTS `transaction_queue`;
--> statement-breakpoint

-- Rename new table to original name
ALTER TABLE `transaction_queue_new` RENAME TO `transaction_queue`;
--> statement-breakpoint

-- Recreate indexes
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
--> statement-breakpoint

-- Re-enable foreign key checks
PRAGMA foreign_keys = ON;
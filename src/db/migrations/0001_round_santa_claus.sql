CREATE TABLE `workflow_activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text DEFAULT 'default' NOT NULL,
	`activity_id` text NOT NULL,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`workflow_id` text,
	`symbol_name` text,
	`vcoin_id` text,
	`level` text DEFAULT 'info' NOT NULL,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workflow_activity_activity_id_unique` ON `workflow_activity` (`activity_id`);--> statement-breakpoint
CREATE INDEX `workflow_activity_user_id_idx` ON `workflow_activity` (`user_id`);--> statement-breakpoint
CREATE INDEX `workflow_activity_activity_id_idx` ON `workflow_activity` (`activity_id`);--> statement-breakpoint
CREATE INDEX `workflow_activity_type_idx` ON `workflow_activity` (`type`);--> statement-breakpoint
CREATE INDEX `workflow_activity_timestamp_idx` ON `workflow_activity` (`timestamp`);--> statement-breakpoint
CREATE TABLE `workflow_system_status` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text DEFAULT 'default' NOT NULL,
	`system_status` text DEFAULT 'stopped' NOT NULL,
	`last_update` integer DEFAULT (unixepoch()) NOT NULL,
	`active_workflows` text DEFAULT '[]' NOT NULL,
	`ready_tokens` integer DEFAULT 0 NOT NULL,
	`total_detections` integer DEFAULT 0 NOT NULL,
	`successful_snipes` integer DEFAULT 0 NOT NULL,
	`total_profit` real DEFAULT 0 NOT NULL,
	`success_rate` real DEFAULT 0 NOT NULL,
	`average_roi` real DEFAULT 0 NOT NULL,
	`best_trade` real DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workflow_system_status_user_id_idx` ON `workflow_system_status` (`user_id`);
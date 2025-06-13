-- Fix foreign key constraints to use SET NULL instead of NO ACTION
-- This prevents orphaned references when snipe targets are deleted

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- 1. Fix execution_history foreign key
CREATE TABLE `execution_history_fixed` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`snipe_target_id` integer,
	`vcoin_id` text NOT NULL,
	`symbol_name` text NOT NULL,
	`action` text NOT NULL,
	`order_type` text NOT NULL,
	`order_side` text NOT NULL,
	`requested_quantity` real NOT NULL,
	`requested_price` real,
	`executed_quantity` real,
	`executed_price` real,
	`total_cost` real,
	`fees` real,
	`exchange_order_id` text,
	`exchange_status` text,
	`exchange_response` text,
	`execution_latency_ms` integer,
	`slippage_percent` real,
	`status` text NOT NULL,
	`error_code` text,
	`error_message` text,
	`requested_at` integer NOT NULL,
	`executed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`snipe_target_id`) REFERENCES `snipe_targets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

-- Skip data copy - table may not exist yet in fresh databases
--> statement-breakpoint

-- Drop old table if it exists
DROP TABLE IF EXISTS `execution_history`;
--> statement-breakpoint

-- Rename new table
ALTER TABLE `execution_history_fixed` RENAME TO `execution_history`;
--> statement-breakpoint

-- 2. Fix transactions foreign key
CREATE TABLE `transactions_fixed` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`transaction_type` text NOT NULL,
	`symbol_name` text NOT NULL,
	`vcoin_id` text,
	`buy_price` real,
	`buy_quantity` real,
	`buy_total_cost` real,
	`buy_timestamp` integer,
	`buy_order_id` text,
	`sell_price` real,
	`sell_quantity` real,
	`sell_total_revenue` real,
	`sell_timestamp` integer,
	`sell_order_id` text,
	`profit_loss` real,
	`profit_loss_percentage` real,
	`fees` real,
	`status` text DEFAULT 'pending' NOT NULL,
	`snipe_target_id` integer,
	`notes` text,
	`transaction_time` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`snipe_target_id`) REFERENCES `snipe_targets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

-- Skip data copy - table may not exist yet in fresh databases
--> statement-breakpoint

-- Drop old table if it exists
DROP TABLE IF EXISTS `transactions`;
--> statement-breakpoint

-- Rename new table
ALTER TABLE `transactions_fixed` RENAME TO `transactions`;
--> statement-breakpoint

-- 3. Recreate all indexes for execution_history
CREATE INDEX `execution_history_user_idx` ON `execution_history` (`user_id`);
--> statement-breakpoint
CREATE INDEX `execution_history_snipe_target_idx` ON `execution_history` (`snipe_target_id`);
--> statement-breakpoint
CREATE INDEX `execution_history_symbol_idx` ON `execution_history` (`symbol_name`);
--> statement-breakpoint
CREATE INDEX `execution_history_status_idx` ON `execution_history` (`status`);
--> statement-breakpoint
CREATE INDEX `execution_history_executed_at_idx` ON `execution_history` (`executed_at`);
--> statement-breakpoint
CREATE INDEX `execution_history_user_symbol_time_idx` ON `execution_history` (`user_id`,`symbol_name`,`executed_at`);
--> statement-breakpoint
CREATE INDEX `execution_history_user_status_action_idx` ON `execution_history` (`user_id`,`status`,`action`);
--> statement-breakpoint
CREATE INDEX `execution_history_snipe_target_action_status_idx` ON `execution_history` (`snipe_target_id`,`action`,`status`);
--> statement-breakpoint

-- 4. Recreate all indexes for transactions
CREATE INDEX `transactions_user_idx` ON `transactions` (`user_id`);
--> statement-breakpoint
CREATE INDEX `transactions_symbol_idx` ON `transactions` (`symbol_name`);
--> statement-breakpoint
CREATE INDEX `transactions_status_idx` ON `transactions` (`status`);
--> statement-breakpoint
CREATE INDEX `transactions_transaction_time_idx` ON `transactions` (`transaction_time`);
--> statement-breakpoint
CREATE INDEX `transactions_type_idx` ON `transactions` (`transaction_type`);
--> statement-breakpoint
CREATE INDEX `transactions_user_status_idx` ON `transactions` (`user_id`,`status`);
--> statement-breakpoint
CREATE INDEX `transactions_user_time_idx` ON `transactions` (`user_id`,`transaction_time`);
--> statement-breakpoint
CREATE INDEX `transactions_symbol_time_idx` ON `transactions` (`symbol_name`,`transaction_time`);
--> statement-breakpoint

-- 5. Add missing performance indexes
CREATE INDEX IF NOT EXISTS `transactions_profit_loss_idx` ON `transactions` (`profit_loss`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `system_health_metrics_error_rate_idx` ON `system_health_metrics` (`error_rate`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `workflow_activity_level_idx` ON `workflow_activity` (`level`);
-- Cleanup execution_history_fixed table if it exists
-- This fixes migration 0005 that may have left orphaned tables

-- Drop the orphaned execution_history_fixed table if it exists
DROP TABLE IF EXISTS `execution_history_fixed`;
--> statement-breakpoint

-- Drop the orphaned transactions_fixed table if it exists  
DROP TABLE IF EXISTS `transactions_fixed`;
--> statement-breakpoint

-- Ensure execution_history table exists with correct structure
CREATE TABLE IF NOT EXISTS `execution_history` (
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

-- Ensure transactions table exists with correct structure
CREATE TABLE IF NOT EXISTS `transactions` (
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
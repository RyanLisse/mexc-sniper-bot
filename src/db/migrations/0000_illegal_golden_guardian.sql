CREATE TABLE `api_credentials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`encrypted_api_key` text NOT NULL,
	`encrypted_secret_key` text NOT NULL,
	`encrypted_passphrase` text,
	`is_active` integer DEFAULT true NOT NULL,
	`last_used` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `api_credentials_user_provider_idx` ON `api_credentials` (`user_id`,`provider`);--> statement-breakpoint
CREATE TABLE `execution_history` (
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
	FOREIGN KEY (`snipe_target_id`) REFERENCES `snipe_targets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `execution_history_user_idx` ON `execution_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `execution_history_snipe_target_idx` ON `execution_history` (`snipe_target_id`);--> statement-breakpoint
CREATE INDEX `execution_history_symbol_idx` ON `execution_history` (`symbol_name`);--> statement-breakpoint
CREATE INDEX `execution_history_status_idx` ON `execution_history` (`status`);--> statement-breakpoint
CREATE INDEX `execution_history_executed_at_idx` ON `execution_history` (`executed_at`);--> statement-breakpoint
CREATE TABLE `monitored_listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vcoin_id` text NOT NULL,
	`symbol_name` text NOT NULL,
	`project_name` text,
	`first_open_time` integer NOT NULL,
	`estimated_launch_time` integer,
	`status` text DEFAULT 'monitoring' NOT NULL,
	`confidence` real DEFAULT 0 NOT NULL,
	`pattern_sts` integer,
	`pattern_st` integer,
	`pattern_tt` integer,
	`has_ready_pattern` integer DEFAULT false NOT NULL,
	`discovered_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_checked` integer DEFAULT (unixepoch()) NOT NULL,
	`trading_pairs` text,
	`price_data` text,
	`volume_data` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monitored_listings_vcoin_id_unique` ON `monitored_listings` (`vcoin_id`);--> statement-breakpoint
CREATE INDEX `monitored_listings_vcoin_id_idx` ON `monitored_listings` (`vcoin_id`);--> statement-breakpoint
CREATE INDEX `monitored_listings_status_idx` ON `monitored_listings` (`status`);--> statement-breakpoint
CREATE INDEX `monitored_listings_launch_time_idx` ON `monitored_listings` (`first_open_time`);--> statement-breakpoint
CREATE INDEX `monitored_listings_ready_pattern_idx` ON `monitored_listings` (`has_ready_pattern`);--> statement-breakpoint
CREATE TABLE `snipe_targets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`vcoin_id` text NOT NULL,
	`symbol_name` text NOT NULL,
	`entry_strategy` text DEFAULT 'market' NOT NULL,
	`entry_price` real,
	`position_size_usdt` real NOT NULL,
	`take_profit_level` integer DEFAULT 2 NOT NULL,
	`take_profit_custom` real,
	`stop_loss_percent` real NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`priority` integer DEFAULT 1 NOT NULL,
	`max_retries` integer DEFAULT 3 NOT NULL,
	`current_retries` integer DEFAULT 0 NOT NULL,
	`target_execution_time` integer,
	`actual_execution_time` integer,
	`execution_price` real,
	`actual_position_size` real,
	`execution_status` text,
	`error_message` text,
	`confidence_score` real DEFAULT 0 NOT NULL,
	`risk_level` text DEFAULT 'medium' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `snipe_targets_user_idx` ON `snipe_targets` (`user_id`);--> statement-breakpoint
CREATE INDEX `snipe_targets_status_idx` ON `snipe_targets` (`status`);--> statement-breakpoint
CREATE INDEX `snipe_targets_priority_idx` ON `snipe_targets` (`priority`);--> statement-breakpoint
CREATE INDEX `snipe_targets_execution_time_idx` ON `snipe_targets` (`target_execution_time`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`default_buy_amount_usdt` real DEFAULT 100 NOT NULL,
	`max_concurrent_snipes` integer DEFAULT 3 NOT NULL,
	`take_profit_level_1` real DEFAULT 5 NOT NULL,
	`take_profit_level_2` real DEFAULT 10 NOT NULL,
	`take_profit_level_3` real DEFAULT 15 NOT NULL,
	`take_profit_level_4` real DEFAULT 25 NOT NULL,
	`take_profit_custom` real,
	`default_take_profit_level` integer DEFAULT 2 NOT NULL,
	`stop_loss_percent` real DEFAULT 5 NOT NULL,
	`risk_tolerance` text DEFAULT 'medium' NOT NULL,
	`ready_state_pattern` text DEFAULT '2,2,4' NOT NULL,
	`target_advance_hours` real DEFAULT 3.5 NOT NULL,
	`calendar_poll_interval_seconds` integer DEFAULT 300 NOT NULL,
	`symbols_poll_interval_seconds` integer DEFAULT 30 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_preferences_user_id_unique` ON `user_preferences` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_preferences_user_id_idx` ON `user_preferences` (`user_id`);
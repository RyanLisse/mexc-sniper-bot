PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_execution_history` (
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
INSERT INTO `__new_execution_history`("id", "user_id", "snipe_target_id", "vcoin_id", "symbol_name", "action", "order_type", "order_side", "requested_quantity", "requested_price", "executed_quantity", "executed_price", "total_cost", "fees", "exchange_order_id", "exchange_status", "exchange_response", "execution_latency_ms", "slippage_percent", "status", "error_code", "error_message", "requested_at", "executed_at", "created_at") SELECT "id", "user_id", "snipe_target_id", "vcoin_id", "symbol_name", "action", "order_type", "order_side", "requested_quantity", "requested_price", "executed_quantity", "executed_price", "total_cost", "fees", "exchange_order_id", "exchange_status", "exchange_response", "execution_latency_ms", "slippage_percent", "status", "error_code", "error_message", "requested_at", "executed_at", "created_at" FROM `execution_history`;--> statement-breakpoint
DROP TABLE `execution_history`;--> statement-breakpoint
ALTER TABLE `__new_execution_history` RENAME TO `execution_history`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `execution_history_user_idx` ON `execution_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `execution_history_snipe_target_idx` ON `execution_history` (`snipe_target_id`);--> statement-breakpoint
CREATE INDEX `execution_history_symbol_idx` ON `execution_history` (`symbol_name`);--> statement-breakpoint
CREATE INDEX `execution_history_status_idx` ON `execution_history` (`status`);--> statement-breakpoint
CREATE INDEX `execution_history_executed_at_idx` ON `execution_history` (`executed_at`);--> statement-breakpoint
CREATE INDEX `execution_history_user_symbol_time_idx` ON `execution_history` (`user_id`,`symbol_name`,`executed_at`);--> statement-breakpoint
CREATE INDEX `execution_history_user_status_action_idx` ON `execution_history` (`user_id`,`status`,`action`);--> statement-breakpoint
CREATE INDEX `execution_history_snipe_target_action_status_idx` ON `execution_history` (`snipe_target_id`,`action`,`status`);--> statement-breakpoint
CREATE TABLE `__new_transactions` (
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
INSERT INTO `__new_transactions`("id", "user_id", "transaction_type", "symbol_name", "vcoin_id", "buy_price", "buy_quantity", "buy_total_cost", "buy_timestamp", "buy_order_id", "sell_price", "sell_quantity", "sell_total_revenue", "sell_timestamp", "sell_order_id", "profit_loss", "profit_loss_percentage", "fees", "status", "snipe_target_id", "notes", "transaction_time", "created_at", "updated_at") SELECT "id", "user_id", "transaction_type", "symbol_name", "vcoin_id", "buy_price", "buy_quantity", "buy_total_cost", "buy_timestamp", "buy_order_id", "sell_price", "sell_quantity", "sell_total_revenue", "sell_timestamp", "sell_order_id", "profit_loss", "profit_loss_percentage", "fees", "status", "snipe_target_id", "notes", "transaction_time", "created_at", "updated_at" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
CREATE INDEX `transactions_user_idx` ON `transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `transactions_symbol_idx` ON `transactions` (`symbol_name`);--> statement-breakpoint
CREATE INDEX `transactions_status_idx` ON `transactions` (`status`);--> statement-breakpoint
CREATE INDEX `transactions_transaction_time_idx` ON `transactions` (`transaction_time`);--> statement-breakpoint
CREATE INDEX `transactions_type_idx` ON `transactions` (`transaction_type`);--> statement-breakpoint
CREATE INDEX `transactions_user_status_idx` ON `transactions` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `transactions_user_time_idx` ON `transactions` (`user_id`,`transaction_time`);--> statement-breakpoint
CREATE INDEX `transactions_symbol_time_idx` ON `transactions` (`symbol_name`,`transaction_time`);--> statement-breakpoint
CREATE TABLE `__new_api_credentials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`encrypted_api_key` text NOT NULL,
	`encrypted_secret_key` text NOT NULL,
	`encrypted_passphrase` text,
	`is_active` integer DEFAULT true NOT NULL,
	`last_used` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_api_credentials`("id", "user_id", "provider", "encrypted_api_key", "encrypted_secret_key", "encrypted_passphrase", "is_active", "last_used", "created_at", "updated_at") SELECT "id", "user_id", "provider", "encrypted_api_key", "encrypted_secret_key", "encrypted_passphrase", "is_active", "last_used", "created_at", "updated_at" FROM `api_credentials`;--> statement-breakpoint
DROP TABLE `api_credentials`;--> statement-breakpoint
ALTER TABLE `__new_api_credentials` RENAME TO `api_credentials`;--> statement-breakpoint
CREATE INDEX `api_credentials_user_provider_idx` ON `api_credentials` (`user_id`,`provider`);--> statement-breakpoint
CREATE TABLE `__new_snipe_targets` (
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
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_snipe_targets`("id", "user_id", "vcoin_id", "symbol_name", "entry_strategy", "entry_price", "position_size_usdt", "take_profit_level", "take_profit_custom", "stop_loss_percent", "status", "priority", "max_retries", "current_retries", "target_execution_time", "actual_execution_time", "execution_price", "actual_position_size", "execution_status", "error_message", "confidence_score", "risk_level", "created_at", "updated_at") SELECT "id", "user_id", "vcoin_id", "symbol_name", "entry_strategy", "entry_price", "position_size_usdt", "take_profit_level", "take_profit_custom", "stop_loss_percent", "status", "priority", "max_retries", "current_retries", "target_execution_time", "actual_execution_time", "execution_price", "actual_position_size", "execution_status", "error_message", "confidence_score", "risk_level", "created_at", "updated_at" FROM `snipe_targets`;--> statement-breakpoint
DROP TABLE `snipe_targets`;--> statement-breakpoint
ALTER TABLE `__new_snipe_targets` RENAME TO `snipe_targets`;--> statement-breakpoint
CREATE INDEX `snipe_targets_user_idx` ON `snipe_targets` (`user_id`);--> statement-breakpoint
CREATE INDEX `snipe_targets_status_idx` ON `snipe_targets` (`status`);--> statement-breakpoint
CREATE INDEX `snipe_targets_priority_idx` ON `snipe_targets` (`priority`);--> statement-breakpoint
CREATE INDEX `snipe_targets_execution_time_idx` ON `snipe_targets` (`target_execution_time`);--> statement-breakpoint
CREATE INDEX `snipe_targets_user_status_priority_idx` ON `snipe_targets` (`user_id`,`status`,`priority`);--> statement-breakpoint
CREATE INDEX `snipe_targets_status_execution_time_idx` ON `snipe_targets` (`status`,`target_execution_time`);--> statement-breakpoint
CREATE TABLE `__new_user_preferences` (
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
	`auto_snipe_enabled` integer DEFAULT true NOT NULL,
	`selected_exit_strategy` text DEFAULT 'balanced' NOT NULL,
	`custom_exit_strategy` text,
	`auto_buy_enabled` integer DEFAULT true NOT NULL,
	`auto_sell_enabled` integer DEFAULT true NOT NULL,
	`calendar_poll_interval_seconds` integer DEFAULT 300 NOT NULL,
	`symbols_poll_interval_seconds` integer DEFAULT 30 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_user_preferences`("id", "user_id", "default_buy_amount_usdt", "max_concurrent_snipes", "take_profit_level_1", "take_profit_level_2", "take_profit_level_3", "take_profit_level_4", "take_profit_custom", "default_take_profit_level", "stop_loss_percent", "risk_tolerance", "ready_state_pattern", "target_advance_hours", "auto_snipe_enabled", "selected_exit_strategy", "custom_exit_strategy", "auto_buy_enabled", "auto_sell_enabled", "calendar_poll_interval_seconds", "symbols_poll_interval_seconds", "created_at", "updated_at") SELECT "id", "user_id", "default_buy_amount_usdt", "max_concurrent_snipes", "take_profit_level_1", "take_profit_level_2", "take_profit_level_3", "take_profit_level_4", "take_profit_custom", "default_take_profit_level", "stop_loss_percent", "risk_tolerance", "ready_state_pattern", "target_advance_hours", "auto_snipe_enabled", "selected_exit_strategy", "custom_exit_strategy", "auto_buy_enabled", "auto_sell_enabled", "calendar_poll_interval_seconds", "symbols_poll_interval_seconds", "created_at", "updated_at" FROM `user_preferences`;--> statement-breakpoint
DROP TABLE `user_preferences`;--> statement-breakpoint
ALTER TABLE `__new_user_preferences` RENAME TO `user_preferences`;--> statement-breakpoint
CREATE UNIQUE INDEX `user_preferences_user_id_unique` ON `user_preferences` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_preferences_user_id_idx` ON `user_preferences` (`user_id`);
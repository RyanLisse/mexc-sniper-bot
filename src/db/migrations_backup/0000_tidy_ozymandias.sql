CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
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
CREATE INDEX `execution_history_user_symbol_time_idx` ON `execution_history` (`user_id`,`symbol_name`,`executed_at`);--> statement-breakpoint
CREATE INDEX `execution_history_user_status_action_idx` ON `execution_history` (`user_id`,`status`,`action`);--> statement-breakpoint
CREATE INDEX `execution_history_snipe_target_action_status_idx` ON `execution_history` (`snipe_target_id`,`action`,`status`);--> statement-breakpoint
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
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
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
CREATE INDEX `snipe_targets_user_status_priority_idx` ON `snipe_targets` (`user_id`,`status`,`priority`);--> statement-breakpoint
CREATE INDEX `snipe_targets_status_execution_time_idx` ON `snipe_targets` (`status`,`target_execution_time`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer DEFAULT false NOT NULL,
	`image` text,
	`username` text,
	`displayUsername` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
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
	`auto_snipe_enabled` integer DEFAULT true NOT NULL,
	`selected_exit_strategy` text DEFAULT 'balanced' NOT NULL,
	`custom_exit_strategy` text,
	`auto_buy_enabled` integer DEFAULT true NOT NULL,
	`auto_sell_enabled` integer DEFAULT true NOT NULL,
	`calendar_poll_interval_seconds` integer DEFAULT 300 NOT NULL,
	`symbols_poll_interval_seconds` integer DEFAULT 30 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_preferences_user_id_unique` ON `user_preferences` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_preferences_user_id_idx` ON `user_preferences` (`user_id`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
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
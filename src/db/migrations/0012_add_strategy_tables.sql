CREATE TABLE `strategy_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`strategy_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`risk_level` text NOT NULL,
	`default_settings` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`is_built_in` integer DEFAULT 0 NOT NULL,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`success_rate` real DEFAULT 0.0,
	`avg_profit_percent` real DEFAULT 0.0,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trading_strategies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`strategy_template_id` integer,
	`name` text NOT NULL,
	`description` text,
	`symbol` text NOT NULL,
	`vcoin_id` text,
	`entry_price` real NOT NULL,
	`position_size` real NOT NULL,
	`position_size_usdt` real NOT NULL,
	`levels` text NOT NULL,
	`stop_loss_percent` real NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`current_price` real,
	`unrealized_pnl` real DEFAULT 0.0,
	`unrealized_pnl_percent` real DEFAULT 0.0,
	`realized_pnl` real DEFAULT 0.0,
	`realized_pnl_percent` real DEFAULT 0.0,
	`total_pnl` real DEFAULT 0.0,
	`total_pnl_percent` real DEFAULT 0.0,
	`executed_phases` integer DEFAULT 0 NOT NULL,
	`total_phases` integer NOT NULL,
	`remaining_position` real,
	`max_drawdown` real DEFAULT 0.0,
	`risk_reward_ratio` real DEFAULT 0.0,
	`confidence_score` real DEFAULT 0.0,
	`ai_insights` text,
	`last_ai_analysis` integer,
	`activated_at` integer,
	`completed_at` integer,
	`last_execution_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`strategy_template_id`) REFERENCES `strategy_templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `strategy_phase_executions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`strategy_id` integer NOT NULL,
	`phase_number` integer NOT NULL,
	`target_percentage` real NOT NULL,
	`target_price` real NOT NULL,
	`target_multiplier` real NOT NULL,
	`planned_sell_percentage` real NOT NULL,
	`execution_status` text DEFAULT 'pending' NOT NULL,
	`trigger_price` real,
	`execution_price` real,
	`executed_quantity` real,
	`executed_value` real,
	`profit` real,
	`profit_percent` real,
	`fees` real,
	`slippage` real,
	`exchange_order_id` text,
	`exchange_response` text,
	`triggered_at` integer,
	`executed_at` integer,
	`error_message` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`strategy_id`) REFERENCES `trading_strategies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `strategy_performance_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`strategy_id` integer NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`period_type` text NOT NULL,
	`highest_price` real,
	`lowest_price` real,
	`avg_price` real,
	`price_volatility` real,
	`pnl` real,
	`pnl_percent` real,
	`max_drawdown` real,
	`max_drawdown_percent` real,
	`sharpe_ratio` real,
	`sort_ratio` real,
	`calmar_ratio` real,
	`value_at_risk` real,
	`phases_executed` integer,
	`avg_execution_time` real,
	`total_slippage` real,
	`total_fees` real,
	`market_trend` text,
	`market_volatility` text,
	`calculated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`strategy_id`) REFERENCES `trading_strategies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `strategy_config_backups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`strategy_id` integer NOT NULL,
	`backup_reason` text NOT NULL,
	`config_snapshot` text NOT NULL,
	`version` integer NOT NULL,
	`is_active` integer DEFAULT 0 NOT NULL,
	`performance_snapshot` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`strategy_id`) REFERENCES `trading_strategies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `strategy_templates_strategy_id_unique` ON `strategy_templates` (`strategy_id`);--> statement-breakpoint
CREATE INDEX `strategy_templates_strategy_id_idx` ON `strategy_templates` (`strategy_id`);--> statement-breakpoint
CREATE INDEX `strategy_templates_type_idx` ON `strategy_templates` (`type`);--> statement-breakpoint
CREATE INDEX `strategy_templates_risk_level_idx` ON `strategy_templates` (`risk_level`);--> statement-breakpoint
CREATE INDEX `strategy_templates_usage_count_idx` ON `strategy_templates` (`usage_count`);--> statement-breakpoint
CREATE INDEX `trading_strategies_user_idx` ON `trading_strategies` (`user_id`);--> statement-breakpoint
CREATE INDEX `trading_strategies_symbol_idx` ON `trading_strategies` (`symbol`);--> statement-breakpoint
CREATE INDEX `trading_strategies_status_idx` ON `trading_strategies` (`status`);--> statement-breakpoint
CREATE INDEX `trading_strategies_template_idx` ON `trading_strategies` (`strategy_template_id`);--> statement-breakpoint
CREATE INDEX `trading_strategies_user_status_idx` ON `trading_strategies` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `trading_strategies_symbol_status_idx` ON `trading_strategies` (`symbol`,`status`);--> statement-breakpoint
CREATE INDEX `trading_strategies_user_symbol_idx` ON `trading_strategies` (`user_id`,`symbol`);--> statement-breakpoint
CREATE INDEX `strategy_phase_executions_strategy_idx` ON `strategy_phase_executions` (`strategy_id`);--> statement-breakpoint
CREATE INDEX `strategy_phase_executions_user_idx` ON `strategy_phase_executions` (`user_id`);--> statement-breakpoint
CREATE INDEX `strategy_phase_executions_status_idx` ON `strategy_phase_executions` (`execution_status`);--> statement-breakpoint
CREATE INDEX `strategy_phase_executions_phase_idx` ON `strategy_phase_executions` (`phase_number`);--> statement-breakpoint
CREATE INDEX `strategy_phase_executions_strategy_phase_idx` ON `strategy_phase_executions` (`strategy_id`,`phase_number`);--> statement-breakpoint
CREATE INDEX `strategy_phase_executions_strategy_status_idx` ON `strategy_phase_executions` (`strategy_id`,`execution_status`);--> statement-breakpoint
CREATE INDEX `strategy_phase_executions_user_strategy_idx` ON `strategy_phase_executions` (`user_id`,`strategy_id`);--> statement-breakpoint
CREATE INDEX `strategy_performance_metrics_strategy_idx` ON `strategy_performance_metrics` (`strategy_id`);--> statement-breakpoint
CREATE INDEX `strategy_performance_metrics_user_idx` ON `strategy_performance_metrics` (`user_id`);--> statement-breakpoint
CREATE INDEX `strategy_performance_metrics_period_idx` ON `strategy_performance_metrics` (`period_start`,`period_end`);--> statement-breakpoint
CREATE INDEX `strategy_performance_metrics_period_type_idx` ON `strategy_performance_metrics` (`period_type`);--> statement-breakpoint
CREATE INDEX `strategy_performance_metrics_strategy_period_idx` ON `strategy_performance_metrics` (`strategy_id`,`period_start`);--> statement-breakpoint
CREATE INDEX `strategy_performance_metrics_user_period_idx` ON `strategy_performance_metrics` (`user_id`,`period_start`);--> statement-breakpoint
CREATE INDEX `strategy_config_backups_strategy_idx` ON `strategy_config_backups` (`strategy_id`);--> statement-breakpoint
CREATE INDEX `strategy_config_backups_version_idx` ON `strategy_config_backups` (`version`);--> statement-breakpoint
CREATE INDEX `strategy_config_backups_active_idx` ON `strategy_config_backups` (`is_active`);--> statement-breakpoint
CREATE INDEX `strategy_config_backups_reason_idx` ON `strategy_config_backups` (`backup_reason`);
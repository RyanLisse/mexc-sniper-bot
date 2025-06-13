CREATE TABLE `error_incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`severity` text NOT NULL,
	`service` text NOT NULL,
	`error_message` text NOT NULL,
	`stack_trace` text,
	`context` text NOT NULL,
	`first_occurrence` integer NOT NULL,
	`last_occurrence` integer NOT NULL,
	`occurrence_count` integer DEFAULT 1 NOT NULL,
	`recovered` integer DEFAULT false NOT NULL,
	`recovery_attempts` integer DEFAULT 0 NOT NULL,
	`resolution` text,
	`prevention_strategy` text,
	`last_recovery_attempt` integer,
	`average_recovery_time` integer,
	`successful_recoveries` integer DEFAULT 0 NOT NULL,
	`failed_recoveries` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `error_incidents_type_idx` ON `error_incidents` (`type`);--> statement-breakpoint
CREATE INDEX `error_incidents_severity_idx` ON `error_incidents` (`severity`);--> statement-breakpoint
CREATE INDEX `error_incidents_service_idx` ON `error_incidents` (`service`);--> statement-breakpoint
CREATE INDEX `error_incidents_first_occurrence_idx` ON `error_incidents` (`first_occurrence`);--> statement-breakpoint
CREATE INDEX `error_incidents_last_occurrence_idx` ON `error_incidents` (`last_occurrence`);--> statement-breakpoint
CREATE INDEX `error_incidents_recovered_idx` ON `error_incidents` (`recovered`);--> statement-breakpoint
CREATE INDEX `error_incidents_service_severity_idx` ON `error_incidents` (`service`,`severity`);--> statement-breakpoint
CREATE INDEX `error_incidents_type_occurrence_idx` ON `error_incidents` (`type`,`last_occurrence`);--> statement-breakpoint
CREATE TABLE `position_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`snapshot_id` text NOT NULL,
	`source` text NOT NULL,
	`symbol` text NOT NULL,
	`quantity` real NOT NULL,
	`average_price` real NOT NULL,
	`market_value` real NOT NULL,
	`unrealized_pnl` real NOT NULL,
	`currency` text,
	`total_balance` real,
	`available_balance` real,
	`locked_balance` real,
	`snapshot_type` text NOT NULL,
	`reconciliation_id` text,
	`timestamp` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `position_snapshots_snapshot_id_unique` ON `position_snapshots` (`snapshot_id`);--> statement-breakpoint
CREATE INDEX `position_snapshots_user_id_idx` ON `position_snapshots` (`user_id`);--> statement-breakpoint
CREATE INDEX `position_snapshots_snapshot_id_idx` ON `position_snapshots` (`snapshot_id`);--> statement-breakpoint
CREATE INDEX `position_snapshots_source_idx` ON `position_snapshots` (`source`);--> statement-breakpoint
CREATE INDEX `position_snapshots_symbol_idx` ON `position_snapshots` (`symbol`);--> statement-breakpoint
CREATE INDEX `position_snapshots_timestamp_idx` ON `position_snapshots` (`timestamp`);--> statement-breakpoint
CREATE INDEX `position_snapshots_reconciliation_id_idx` ON `position_snapshots` (`reconciliation_id`);--> statement-breakpoint
CREATE INDEX `position_snapshots_source_timestamp_idx` ON `position_snapshots` (`source`,`timestamp`);--> statement-breakpoint
CREATE INDEX `position_snapshots_user_symbol_idx` ON `position_snapshots` (`user_id`,`symbol`);--> statement-breakpoint
CREATE TABLE `reconciliation_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text DEFAULT 'default' NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`total_checks` integer NOT NULL,
	`discrepancies_found` integer NOT NULL,
	`critical_issues` integer NOT NULL,
	`auto_resolved` integer NOT NULL,
	`manual_review_required` integer NOT NULL,
	`overall_status` text NOT NULL,
	`discrepancies` text NOT NULL,
	`recommendations` text NOT NULL,
	`triggered_by` text DEFAULT 'scheduled' NOT NULL,
	`processing_time_ms` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reconciliation_reports_user_id_idx` ON `reconciliation_reports` (`user_id`);--> statement-breakpoint
CREATE INDEX `reconciliation_reports_start_time_idx` ON `reconciliation_reports` (`start_time`);--> statement-breakpoint
CREATE INDEX `reconciliation_reports_overall_status_idx` ON `reconciliation_reports` (`overall_status`);--> statement-breakpoint
CREATE INDEX `reconciliation_reports_critical_issues_idx` ON `reconciliation_reports` (`critical_issues`);--> statement-breakpoint
CREATE TABLE `risk_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text DEFAULT 'default' NOT NULL,
	`event_type` text NOT NULL,
	`severity` text NOT NULL,
	`description` text NOT NULL,
	`circuit_breaker_id` text,
	`total_exposure` real,
	`daily_pnl` real,
	`open_positions` integer,
	`risk_percentage` real,
	`volatility_index` real,
	`action_taken` text NOT NULL,
	`action_details` text,
	`resolved` integer DEFAULT false NOT NULL,
	`resolved_at` integer,
	`resolution` text,
	`timestamp` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `risk_events_user_id_idx` ON `risk_events` (`user_id`);--> statement-breakpoint
CREATE INDEX `risk_events_event_type_idx` ON `risk_events` (`event_type`);--> statement-breakpoint
CREATE INDEX `risk_events_severity_idx` ON `risk_events` (`severity`);--> statement-breakpoint
CREATE INDEX `risk_events_timestamp_idx` ON `risk_events` (`timestamp`);--> statement-breakpoint
CREATE INDEX `risk_events_resolved_idx` ON `risk_events` (`resolved`);--> statement-breakpoint
CREATE INDEX `risk_events_user_severity_idx` ON `risk_events` (`user_id`,`severity`);--> statement-breakpoint
CREATE INDEX `risk_events_type_timestamp_idx` ON `risk_events` (`event_type`,`timestamp`);--> statement-breakpoint
CREATE TABLE `simulation_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`virtual_balance` real NOT NULL,
	`current_balance` real NOT NULL,
	`final_balance` real,
	`total_trades` integer DEFAULT 0 NOT NULL,
	`profit_loss` real DEFAULT 0 NOT NULL,
	`win_rate` real DEFAULT 0 NOT NULL,
	`max_drawdown` real DEFAULT 0 NOT NULL,
	`best_trade` real DEFAULT 0 NOT NULL,
	`worst_trade` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`trading_fees` real DEFAULT 0.001 NOT NULL,
	`slippage` real DEFAULT 0.0005 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `simulation_sessions_user_id_idx` ON `simulation_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `simulation_sessions_status_idx` ON `simulation_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `simulation_sessions_start_time_idx` ON `simulation_sessions` (`start_time`);--> statement-breakpoint
CREATE TABLE `simulation_trades` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`symbol` text NOT NULL,
	`type` text NOT NULL,
	`quantity` real NOT NULL,
	`price` real NOT NULL,
	`value` real NOT NULL,
	`fees` real NOT NULL,
	`timestamp` integer NOT NULL,
	`strategy` text NOT NULL,
	`realized` integer DEFAULT false NOT NULL,
	`profit_loss` real,
	`exit_price` real,
	`exit_timestamp` integer,
	`slippage_percent` real,
	`market_impact_percent` real,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `simulation_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `simulation_trades_session_id_idx` ON `simulation_trades` (`session_id`);--> statement-breakpoint
CREATE INDEX `simulation_trades_symbol_idx` ON `simulation_trades` (`symbol`);--> statement-breakpoint
CREATE INDEX `simulation_trades_timestamp_idx` ON `simulation_trades` (`timestamp`);--> statement-breakpoint
CREATE INDEX `simulation_trades_type_idx` ON `simulation_trades` (`type`);--> statement-breakpoint
CREATE INDEX `simulation_trades_realized_idx` ON `simulation_trades` (`realized`);--> statement-breakpoint
CREATE TABLE `system_health_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`service` text NOT NULL,
	`status` text NOT NULL,
	`response_time` integer,
	`error_rate` real,
	`uptime` real,
	`throughput` real,
	`cpu_usage` real,
	`memory_usage` real,
	`disk_usage` real,
	`total_errors` integer DEFAULT 0 NOT NULL,
	`critical_errors` integer DEFAULT 0 NOT NULL,
	`circuit_breaker_open` integer DEFAULT false NOT NULL,
	`circuit_breaker_failures` integer DEFAULT 0 NOT NULL,
	`metadata` text,
	`alerts_active` integer DEFAULT 0 NOT NULL,
	`timestamp` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `system_health_metrics_service_idx` ON `system_health_metrics` (`service`);--> statement-breakpoint
CREATE INDEX `system_health_metrics_status_idx` ON `system_health_metrics` (`status`);--> statement-breakpoint
CREATE INDEX `system_health_metrics_timestamp_idx` ON `system_health_metrics` (`timestamp`);--> statement-breakpoint
CREATE INDEX `system_health_metrics_service_timestamp_idx` ON `system_health_metrics` (`service`,`timestamp`);--> statement-breakpoint
CREATE INDEX `system_health_metrics_service_status_idx` ON `system_health_metrics` (`service`,`status`);
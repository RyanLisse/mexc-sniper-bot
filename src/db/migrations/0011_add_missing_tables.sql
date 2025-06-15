-- Add all missing tables for MEXC Sniper Bot system
-- This migration addresses the critical database schema issues

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- ===========================================
-- WORKFLOW TABLES
-- ===========================================

-- Workflow System Status Table
CREATE TABLE IF NOT EXISTS `workflow_system_status` (
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

-- Workflow Activity Table
CREATE TABLE IF NOT EXISTS `workflow_activity` (
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

-- ===========================================
-- PATTERN TABLES
-- ===========================================

-- Monitored Listings Table
CREATE TABLE IF NOT EXISTS `monitored_listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vcoin_id` text NOT NULL,
	`symbol_name` text NOT NULL,
	`status` text DEFAULT 'monitoring' NOT NULL,
	`exchange` text DEFAULT 'mexc' NOT NULL,
	`launch_time` integer,
	`first_detected` integer DEFAULT (unixepoch()) NOT NULL,
	`ready_state_detected` integer,
	`pattern_confidence` real DEFAULT 0 NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Pattern Embeddings Table
CREATE TABLE IF NOT EXISTS `pattern_embeddings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vcoin_id` text NOT NULL,
	`symbol_name` text NOT NULL,
	`pattern_type` text NOT NULL,
	`embedding_vector` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Pattern Similarity Cache Table
CREATE TABLE IF NOT EXISTS `pattern_similarity_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pattern_a` text NOT NULL,
	`pattern_b` text NOT NULL,
	`similarity_score` real NOT NULL,
	`computed_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint

-- ===========================================
-- SAFETY TABLES
-- ===========================================

-- Simulation Sessions Table
CREATE TABLE IF NOT EXISTS `simulation_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`session_name` text NOT NULL,
	`strategy_config` text NOT NULL,
	`initial_balance` real NOT NULL,
	`current_balance` real NOT NULL,
	`total_trades` integer DEFAULT 0 NOT NULL,
	`winning_trades` integer DEFAULT 0 NOT NULL,
	`losing_trades` integer DEFAULT 0 NOT NULL,
	`total_profit_loss` real DEFAULT 0 NOT NULL,
	`max_drawdown` real DEFAULT 0 NOT NULL,
	`sharpe_ratio` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`ended_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Simulation Trades Table
CREATE TABLE IF NOT EXISTS `simulation_trades` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`trade_id` text NOT NULL,
	`symbol_name` text NOT NULL,
	`side` text NOT NULL,
	`entry_price` real NOT NULL,
	`exit_price` real,
	`quantity` real NOT NULL,
	`profit_loss` real DEFAULT 0 NOT NULL,
	`profit_loss_percentage` real DEFAULT 0 NOT NULL,
	`fees` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`entry_time` integer DEFAULT (unixepoch()) NOT NULL,
	`exit_time` integer,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Risk Events Table
CREATE TABLE IF NOT EXISTS `risk_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`severity` text DEFAULT 'medium' NOT NULL,
	`symbol_name` text,
	`trigger_condition` text NOT NULL,
	`current_value` real NOT NULL,
	`threshold_value` real NOT NULL,
	`risk_score` real NOT NULL,
	`action_taken` text,
	`status` text DEFAULT 'active' NOT NULL,
	`resolved_at` integer,
	`metadata` text DEFAULT '{}' NOT NULL,
	`triggered_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Position Snapshots Table
CREATE TABLE IF NOT EXISTS `position_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`snapshot_id` text NOT NULL,
	`symbol_name` text NOT NULL,
	`position_size` real NOT NULL,
	`average_price` real NOT NULL,
	`market_value` real NOT NULL,
	`unrealized_pnl` real NOT NULL,
	`realized_pnl` real NOT NULL,
	`margin_used` real DEFAULT 0 NOT NULL,
	`leverage` real DEFAULT 1 NOT NULL,
	`risk_percentage` real NOT NULL,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Reconciliation Reports Table
CREATE TABLE IF NOT EXISTS `reconciliation_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`report_id` text NOT NULL,
	`report_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`discrepancies_found` integer DEFAULT 0 NOT NULL,
	`total_items_checked` integer DEFAULT 0 NOT NULL,
	`system_balance` real,
	`exchange_balance` real,
	`balance_difference` real,
	`report_data` text DEFAULT '{}' NOT NULL,
	`recommendations` text,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Error Incidents Table
CREATE TABLE IF NOT EXISTS `error_incidents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`incident_id` text NOT NULL,
	`user_id` text,
	`error_type` text NOT NULL,
	`error_code` text,
	`error_message` text NOT NULL,
	`severity` text DEFAULT 'medium' NOT NULL,
	`component` text NOT NULL,
	`operation` text NOT NULL,
	`context` text DEFAULT '{}' NOT NULL,
	`stack_trace` text,
	`recovery_action` text,
	`status` text DEFAULT 'open' NOT NULL,
	`resolved_at` integer,
	`occurrence_count` integer DEFAULT 1 NOT NULL,
	`first_occurrence` integer DEFAULT (unixepoch()) NOT NULL,
	`last_occurrence` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- System Health Metrics Table
CREATE TABLE IF NOT EXISTS `system_health_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`metric_id` text NOT NULL,
	`metric_name` text NOT NULL,
	`metric_type` text NOT NULL,
	`value` real NOT NULL,
	`unit` text,
	`component` text NOT NULL,
	`status` text DEFAULT 'healthy' NOT NULL,
	`threshold_warning` real,
	`threshold_critical` real,
	`metadata` text DEFAULT '{}' NOT NULL,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- ===========================================
-- PERFORMANCE TABLES
-- ===========================================

-- Agent Performance Metrics Table
CREATE TABLE IF NOT EXISTS `agent_performance_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agent_name` text NOT NULL,
	`operation_type` text NOT NULL,
	`execution_time_ms` integer NOT NULL,
	`success` integer NOT NULL,
	`error_message` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`cache_hit` integer DEFAULT 0 NOT NULL,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Workflow Performance Metrics Table
CREATE TABLE IF NOT EXISTS `workflow_performance_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workflow_id` text NOT NULL,
	`workflow_name` text NOT NULL,
	`execution_time_ms` integer NOT NULL,
	`success` integer NOT NULL,
	`error_message` text,
	`agents_used` text NOT NULL,
	`total_agent_calls` integer DEFAULT 0 NOT NULL,
	`cache_hits` integer DEFAULT 0 NOT NULL,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- System Performance Snapshots Table
CREATE TABLE IF NOT EXISTS `system_performance_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_id` text NOT NULL,
	`cpu_usage_percent` real,
	`memory_usage_mb` real,
	`memory_usage_percent` real,
	`disk_usage_percent` real,
	`network_latency_ms` real,
	`active_connections` integer,
	`database_connections` integer,
	`queue_depth` integer,
	`error_rate_per_minute` real,
	`requests_per_minute` real,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Performance Alerts Table
CREATE TABLE IF NOT EXISTS `performance_alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alert_id` text NOT NULL,
	`alert_type` text NOT NULL,
	`metric_name` text NOT NULL,
	`current_value` real NOT NULL,
	`threshold_value` real NOT NULL,
	`severity` text DEFAULT 'warning' NOT NULL,
	`component` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`message` text NOT NULL,
	`resolved_at` integer,
	`triggered_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Performance Baselines Table
CREATE TABLE IF NOT EXISTS `performance_baselines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`baseline_id` text NOT NULL,
	`component` text NOT NULL,
	`metric_name` text NOT NULL,
	`baseline_value` real NOT NULL,
	`confidence_interval` real,
	`sample_size` integer NOT NULL,
	`measurement_period_hours` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- ===========================================
-- ALERT TABLES
-- ===========================================

-- Alert Rules Table
CREATE TABLE IF NOT EXISTS `alert_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rule_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`rule_type` text NOT NULL,
	`condition` text NOT NULL,
	`threshold_value` real,
	`severity` text DEFAULT 'medium' NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`notification_channels` text DEFAULT '[]' NOT NULL,
	`escalation_policy_id` text,
	`cooldown_minutes` integer DEFAULT 5 NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Alert Instances Table
CREATE TABLE IF NOT EXISTS `alert_instances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`instance_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`severity` text NOT NULL,
	`message` text NOT NULL,
	`trigger_value` real,
	`context` text DEFAULT '{}' NOT NULL,
	`acknowledged_by` text,
	`acknowledged_at` integer,
	`resolved_by` text,
	`resolved_at` integer,
	`auto_resolved` integer DEFAULT 0 NOT NULL,
	`escalated` integer DEFAULT 0 NOT NULL,
	`notification_count` integer DEFAULT 0 NOT NULL,
	`last_notification` integer,
	`triggered_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Notification Channels Table
CREATE TABLE IF NOT EXISTS `notification_channels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`configuration` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`last_used` integer,
	`success_count` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Escalation Policies Table
CREATE TABLE IF NOT EXISTS `escalation_policies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`policy_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`escalation_rules` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Alert Notifications Table
CREATE TABLE IF NOT EXISTS `alert_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notification_id` text NOT NULL,
	`instance_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`message` text NOT NULL,
	`sent_at` integer,
	`delivered_at` integer,
	`error_message` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Alert Correlations Table
CREATE TABLE IF NOT EXISTS `alert_correlations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`correlation_id` text NOT NULL,
	`primary_instance_id` text NOT NULL,
	`related_instance_ids` text NOT NULL,
	`correlation_type` text NOT NULL,
	`confidence_score` real NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Alert Suppressions Table
CREATE TABLE IF NOT EXISTS `alert_suppressions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`suppression_id` text NOT NULL,
	`rule_pattern` text NOT NULL,
	`reason` text NOT NULL,
	`created_by` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Anomaly Models Table
CREATE TABLE IF NOT EXISTS `anomaly_models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`model_id` text NOT NULL,
	`name` text NOT NULL,
	`metric_name` text NOT NULL,
	`model_type` text NOT NULL,
	`parameters` text NOT NULL,
	`training_data_size` integer NOT NULL,
	`accuracy_score` real,
	`false_positive_rate` real,
	`last_trained` integer NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Alert Analytics Table
CREATE TABLE IF NOT EXISTS `alert_analytics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`analytics_id` text NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`total_alerts` integer NOT NULL,
	`critical_alerts` integer NOT NULL,
	`warning_alerts` integer NOT NULL,
	`info_alerts` integer NOT NULL,
	`resolved_alerts` integer NOT NULL,
	`false_positive_alerts` integer NOT NULL,
	`mean_time_to_resolve` real,
	`mean_time_to_acknowledge` real,
	`top_alert_sources` text,
	`alert_frequency_trends` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- ===========================================
-- INDEXES FOR PERFORMANCE
-- ===========================================

-- Workflow table indexes
CREATE INDEX IF NOT EXISTS `workflow_system_status_user_id_idx` ON `workflow_system_status` (`user_id`);
CREATE INDEX IF NOT EXISTS `workflow_activity_user_id_idx` ON `workflow_activity` (`user_id`);
CREATE INDEX IF NOT EXISTS `workflow_activity_activity_id_idx` ON `workflow_activity` (`activity_id`);
CREATE INDEX IF NOT EXISTS `workflow_activity_type_idx` ON `workflow_activity` (`type`);
CREATE INDEX IF NOT EXISTS `workflow_activity_timestamp_idx` ON `workflow_activity` (`timestamp`);

-- Pattern table indexes
CREATE INDEX IF NOT EXISTS `monitored_listings_vcoin_id_idx` ON `monitored_listings` (`vcoin_id`);
CREATE INDEX IF NOT EXISTS `monitored_listings_symbol_name_idx` ON `monitored_listings` (`symbol_name`);
CREATE INDEX IF NOT EXISTS `monitored_listings_status_idx` ON `monitored_listings` (`status`);
CREATE INDEX IF NOT EXISTS `pattern_embeddings_vcoin_id_idx` ON `pattern_embeddings` (`vcoin_id`);
CREATE INDEX IF NOT EXISTS `pattern_embeddings_pattern_type_idx` ON `pattern_embeddings` (`pattern_type`);
CREATE INDEX IF NOT EXISTS `pattern_similarity_cache_patterns_idx` ON `pattern_similarity_cache` (`pattern_a`, `pattern_b`);

-- Safety table indexes
CREATE INDEX IF NOT EXISTS `simulation_sessions_user_id_idx` ON `simulation_sessions` (`user_id`);
CREATE INDEX IF NOT EXISTS `simulation_sessions_session_id_idx` ON `simulation_sessions` (`session_id`);
CREATE INDEX IF NOT EXISTS `simulation_trades_session_id_idx` ON `simulation_trades` (`session_id`);
CREATE INDEX IF NOT EXISTS `simulation_trades_user_id_idx` ON `simulation_trades` (`user_id`);
CREATE INDEX IF NOT EXISTS `risk_events_user_id_idx` ON `risk_events` (`user_id`);
CREATE INDEX IF NOT EXISTS `risk_events_event_type_idx` ON `risk_events` (`event_type`);
CREATE INDEX IF NOT EXISTS `position_snapshots_user_id_idx` ON `position_snapshots` (`user_id`);
CREATE INDEX IF NOT EXISTS `position_snapshots_symbol_name_idx` ON `position_snapshots` (`symbol_name`);
CREATE INDEX IF NOT EXISTS `reconciliation_reports_user_id_idx` ON `reconciliation_reports` (`user_id`);
CREATE INDEX IF NOT EXISTS `error_incidents_incident_id_idx` ON `error_incidents` (`incident_id`);
CREATE INDEX IF NOT EXISTS `error_incidents_component_idx` ON `error_incidents` (`component`);
CREATE INDEX IF NOT EXISTS `system_health_metrics_component_idx` ON `system_health_metrics` (`component`);
CREATE INDEX IF NOT EXISTS `system_health_metrics_metric_name_idx` ON `system_health_metrics` (`metric_name`);

-- Performance table indexes
CREATE INDEX IF NOT EXISTS `agent_performance_metrics_agent_name_idx` ON `agent_performance_metrics` (`agent_name`);
CREATE INDEX IF NOT EXISTS `agent_performance_metrics_timestamp_idx` ON `agent_performance_metrics` (`timestamp`);
CREATE INDEX IF NOT EXISTS `workflow_performance_metrics_workflow_name_idx` ON `workflow_performance_metrics` (`workflow_name`);
CREATE INDEX IF NOT EXISTS `workflow_performance_metrics_timestamp_idx` ON `workflow_performance_metrics` (`timestamp`);
CREATE INDEX IF NOT EXISTS `system_performance_snapshots_timestamp_idx` ON `system_performance_snapshots` (`timestamp`);
CREATE INDEX IF NOT EXISTS `performance_alerts_component_idx` ON `performance_alerts` (`component`);
CREATE INDEX IF NOT EXISTS `performance_alerts_status_idx` ON `performance_alerts` (`status`);

-- Alert table indexes
CREATE INDEX IF NOT EXISTS `alert_rules_rule_id_idx` ON `alert_rules` (`rule_id`);
CREATE INDEX IF NOT EXISTS `alert_rules_enabled_idx` ON `alert_rules` (`enabled`);
CREATE INDEX IF NOT EXISTS `alert_instances_rule_id_idx` ON `alert_instances` (`rule_id`);
CREATE INDEX IF NOT EXISTS `alert_instances_status_idx` ON `alert_instances` (`status`);
CREATE INDEX IF NOT EXISTS `alert_instances_instance_id_idx` ON `alert_instances` (`instance_id`);
CREATE INDEX IF NOT EXISTS `notification_channels_channel_id_idx` ON `notification_channels` (`channel_id`);
CREATE INDEX IF NOT EXISTS `escalation_policies_policy_id_idx` ON `escalation_policies` (`policy_id`);
CREATE INDEX IF NOT EXISTS `alert_notifications_instance_id_idx` ON `alert_notifications` (`instance_id`);
CREATE INDEX IF NOT EXISTS `alert_notifications_channel_id_idx` ON `alert_notifications` (`channel_id`);
CREATE INDEX IF NOT EXISTS `alert_correlations_primary_instance_id_idx` ON `alert_correlations` (`primary_instance_id`);
CREATE INDEX IF NOT EXISTS `alert_suppressions_suppression_id_idx` ON `alert_suppressions` (`suppression_id`);
CREATE INDEX IF NOT EXISTS `anomaly_models_model_id_idx` ON `anomaly_models` (`model_id`);
CREATE INDEX IF NOT EXISTS `anomaly_models_metric_name_idx` ON `anomaly_models` (`metric_name`);
CREATE INDEX IF NOT EXISTS `alert_analytics_period_start_idx` ON `alert_analytics` (`period_start`);

-- Add unique constraints where needed
CREATE UNIQUE INDEX IF NOT EXISTS `workflow_activity_activity_id_unique` ON `workflow_activity` (`activity_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `monitored_listings_vcoin_id_unique` ON `monitored_listings` (`vcoin_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `simulation_sessions_session_id_unique` ON `simulation_sessions` (`session_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `simulation_trades_trade_id_unique` ON `simulation_trades` (`trade_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `risk_events_event_id_unique` ON `risk_events` (`event_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `position_snapshots_snapshot_id_unique` ON `position_snapshots` (`snapshot_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `reconciliation_reports_report_id_unique` ON `reconciliation_reports` (`report_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `error_incidents_incident_id_unique` ON `error_incidents` (`incident_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `system_health_metrics_metric_id_unique` ON `system_health_metrics` (`metric_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `system_performance_snapshots_snapshot_id_unique` ON `system_performance_snapshots` (`snapshot_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `performance_alerts_alert_id_unique` ON `performance_alerts` (`alert_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `performance_baselines_baseline_id_unique` ON `performance_baselines` (`baseline_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `alert_rules_rule_id_unique` ON `alert_rules` (`rule_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `alert_instances_instance_id_unique` ON `alert_instances` (`instance_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `notification_channels_channel_id_unique` ON `notification_channels` (`channel_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `escalation_policies_policy_id_unique` ON `escalation_policies` (`policy_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `alert_notifications_notification_id_unique` ON `alert_notifications` (`notification_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `alert_correlations_correlation_id_unique` ON `alert_correlations` (`correlation_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `alert_suppressions_suppression_id_unique` ON `alert_suppressions` (`suppression_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `anomaly_models_model_id_unique` ON `anomaly_models` (`model_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `alert_analytics_analytics_id_unique` ON `alert_analytics` (`analytics_id`);
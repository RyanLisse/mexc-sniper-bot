CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" integer,
	"refreshTokenExpiresAt" integer,
	"scope" text,
	"password" text,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_performance_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"response_time" real NOT NULL,
	"success_rate" real NOT NULL,
	"error_rate" real NOT NULL,
	"throughput" real NOT NULL,
	"memory_usage" real NOT NULL,
	"cpu_usage" real NOT NULL,
	"cache_hit_rate" real NOT NULL,
	"total_requests" integer NOT NULL,
	"total_errors" integer NOT NULL,
	"average_response_time" real NOT NULL,
	"p95_response_time" real NOT NULL,
	"p99_response_time" real NOT NULL,
	"uptime" real NOT NULL,
	"last_error" text,
	"metadata" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_analytics" (
	"id" text PRIMARY KEY NOT NULL,
	"bucket" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"total_alerts" integer DEFAULT 0,
	"critical_alerts" integer DEFAULT 0,
	"high_alerts" integer DEFAULT 0,
	"medium_alerts" integer DEFAULT 0,
	"low_alerts" integer DEFAULT 0,
	"resolved_alerts" integer DEFAULT 0,
	"average_resolution_time" real,
	"mttr" real,
	"false_positives" integer DEFAULT 0,
	"false_positive_rate" real,
	"email_notifications" integer DEFAULT 0,
	"slack_notifications" integer DEFAULT 0,
	"webhook_notifications" integer DEFAULT 0,
	"sms_notifications" integer DEFAULT 0,
	"failed_notifications" integer DEFAULT 0,
	"trading_alerts" integer DEFAULT 0,
	"safety_alerts" integer DEFAULT 0,
	"performance_alerts" integer DEFAULT 0,
	"system_alerts" integer DEFAULT 0,
	"agent_alerts" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "alert_correlations" (
	"id" text PRIMARY KEY NOT NULL,
	"correlation_key" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"severity" text NOT NULL,
	"status" text NOT NULL,
	"alert_count" integer DEFAULT 1,
	"pattern" text,
	"confidence" real,
	"first_alert_at" timestamp NOT NULL,
	"last_alert_at" timestamp NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "alert_instances" (
	"id" text PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"status" text NOT NULL,
	"severity" text NOT NULL,
	"message" text NOT NULL,
	"description" text,
	"metric_value" real,
	"threshold" real,
	"anomaly_score" real,
	"source" text NOT NULL,
	"source_id" text,
	"environment" text DEFAULT 'production',
	"correlation_id" text,
	"parent_alert_id" text,
	"escalation_level" integer DEFAULT 0,
	"last_escalated_at" timestamp,
	"resolved_at" timestamp,
	"resolved_by" text,
	"resolution_notes" text,
	"first_triggered_at" timestamp NOT NULL,
	"last_triggered_at" timestamp NOT NULL,
	"additional_data" text,
	"labels" text
);
--> statement-breakpoint
CREATE TABLE "alert_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"alert_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 0,
	"last_attempt_at" timestamp,
	"sent_at" timestamp,
	"subject" text,
	"message" text NOT NULL,
	"response" text,
	"error_message" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"severity" text NOT NULL,
	"metric_name" text NOT NULL,
	"operator" text NOT NULL,
	"threshold" real,
	"aggregation_window" integer DEFAULT 300,
	"evaluation_interval" integer DEFAULT 60,
	"use_anomaly_detection" boolean DEFAULT false,
	"anomaly_threshold" real DEFAULT 2,
	"learning_window" integer DEFAULT 86400,
	"is_enabled" boolean DEFAULT true,
	"suppression_duration" integer DEFAULT 300,
	"escalation_delay" integer DEFAULT 1800,
	"max_alerts" integer DEFAULT 10,
	"correlation_key" text,
	"parent_rule_id" text,
	"tags" text,
	"custom_fields" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_suppressions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"reason" text NOT NULL,
	"rule_ids" text,
	"category_filter" text,
	"severity_filter" text,
	"source_filter" text,
	"tag_filter" text,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp NOT NULL,
	"created_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anomaly_models" (
	"id" text PRIMARY KEY NOT NULL,
	"metric_name" text NOT NULL,
	"model_type" text NOT NULL,
	"parameters" text NOT NULL,
	"training_data_from" timestamp NOT NULL,
	"training_data_to" timestamp NOT NULL,
	"sample_count" integer NOT NULL,
	"accuracy" real,
	"precision" real,
	"recall" real,
	"f1_score" real,
	"false_positive_rate" real,
	"model_data" text,
	"features" text,
	"is_active" boolean DEFAULT true,
	"last_trained_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"encrypted_secret_key" text NOT NULL,
	"encrypted_passphrase" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "error_incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"service" text NOT NULL,
	"error_message" text NOT NULL,
	"stack_trace" text,
	"context" text NOT NULL,
	"first_occurrence" timestamp NOT NULL,
	"last_occurrence" timestamp NOT NULL,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"recovered" boolean DEFAULT false NOT NULL,
	"recovery_attempts" integer DEFAULT 0 NOT NULL,
	"resolution" text,
	"prevention_strategy" text,
	"last_recovery_attempt" timestamp,
	"average_recovery_time" integer,
	"successful_recoveries" integer DEFAULT 0 NOT NULL,
	"failed_recoveries" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalation_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"steps" text NOT NULL,
	"is_enabled" boolean DEFAULT true,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "execution_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"snipe_target_id" integer,
	"vcoin_id" text NOT NULL,
	"symbol_name" text NOT NULL,
	"action" text NOT NULL,
	"order_type" text NOT NULL,
	"order_side" text NOT NULL,
	"requested_quantity" real NOT NULL,
	"requested_price" real,
	"executed_quantity" real,
	"executed_price" real,
	"total_cost" real,
	"fees" real,
	"exchange_order_id" text,
	"exchange_status" text,
	"exchange_response" text,
	"execution_latency_ms" integer,
	"slippage_percent" real,
	"status" text NOT NULL,
	"error_code" text,
	"error_message" text,
	"requested_at" timestamp NOT NULL,
	"executed_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitored_listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"vcoin_id" text NOT NULL,
	"symbol_name" text NOT NULL,
	"project_name" text,
	"first_open_time" integer NOT NULL,
	"estimated_launch_time" integer,
	"status" text DEFAULT 'monitoring' NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"pattern_sts" integer,
	"pattern_st" integer,
	"pattern_tt" integer,
	"has_ready_pattern" boolean DEFAULT false NOT NULL,
	"discovered_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"last_checked" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"trading_pairs" text,
	"price_data" text,
	"volume_data" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "monitored_listings_vcoin_id_unique" UNIQUE("vcoin_id")
);
--> statement-breakpoint
CREATE TABLE "notification_channels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"config" text NOT NULL,
	"headers" text,
	"severity_filter" text,
	"category_filter" text,
	"tag_filter" text,
	"is_enabled" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"rate_limit_per_hour" integer DEFAULT 100,
	"message_template" text,
	"title_template" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"created_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pattern_embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"pattern_id" text NOT NULL,
	"pattern_type" text NOT NULL,
	"symbol_name" text NOT NULL,
	"vcoin_id" text,
	"pattern_data" text NOT NULL,
	"embedding" text NOT NULL,
	"embedding_dimension" integer DEFAULT 1536 NOT NULL,
	"embedding_model" text DEFAULT 'text-embedding-ada-002' NOT NULL,
	"confidence" real NOT NULL,
	"occurrences" integer DEFAULT 1 NOT NULL,
	"success_rate" real,
	"avg_profit" real,
	"discovered_at" timestamp NOT NULL,
	"last_seen_at" timestamp NOT NULL,
	"similarity_threshold" real DEFAULT 0.85 NOT NULL,
	"false_positives" integer DEFAULT 0 NOT NULL,
	"true_positives" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "pattern_embeddings_pattern_id_unique" UNIQUE("pattern_id")
);
--> statement-breakpoint
CREATE TABLE "pattern_similarity_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"pattern_id_1" text NOT NULL,
	"pattern_id_2" text NOT NULL,
	"cosine_similarity" real NOT NULL,
	"euclidean_distance" real NOT NULL,
	"calculated_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"alert_type" text NOT NULL,
	"severity" text NOT NULL,
	"target_id" text NOT NULL,
	"target_type" text NOT NULL,
	"message" text NOT NULL,
	"threshold" real,
	"actual_value" real,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" text,
	"metadata" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_baselines" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_id" text NOT NULL,
	"target_type" text NOT NULL,
	"metric_name" text NOT NULL,
	"baseline_value" real NOT NULL,
	"calculation_period" integer NOT NULL,
	"sample_count" integer NOT NULL,
	"standard_deviation" real,
	"confidence_interval" real,
	"calculated_at" timestamp NOT NULL,
	"valid_until" timestamp,
	"metadata" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "position_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"snapshot_id" text NOT NULL,
	"source" text NOT NULL,
	"symbol" text NOT NULL,
	"quantity" real NOT NULL,
	"average_price" real NOT NULL,
	"market_value" real NOT NULL,
	"unrealized_pnl" real NOT NULL,
	"currency" text,
	"total_balance" real,
	"available_balance" real,
	"locked_balance" real,
	"snapshot_type" text NOT NULL,
	"reconciliation_id" text,
	"timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "position_snapshots_snapshot_id_unique" UNIQUE("snapshot_id")
);
--> statement-breakpoint
CREATE TABLE "reconciliation_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT 'default' NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"total_checks" integer NOT NULL,
	"discrepancies_found" integer NOT NULL,
	"critical_issues" integer NOT NULL,
	"auto_resolved" integer NOT NULL,
	"manual_review_required" integer NOT NULL,
	"overall_status" text NOT NULL,
	"discrepancies" text NOT NULL,
	"recommendations" text NOT NULL,
	"triggered_by" text DEFAULT 'scheduled' NOT NULL,
	"processing_time_ms" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT 'default' NOT NULL,
	"event_type" text NOT NULL,
	"severity" text NOT NULL,
	"description" text NOT NULL,
	"circuit_breaker_id" text,
	"total_exposure" real,
	"daily_pnl" real,
	"open_positions" integer,
	"risk_percentage" real,
	"volatility_index" real,
	"action_taken" text NOT NULL,
	"action_details" text,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp,
	"resolution" text,
	"timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" integer NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "simulation_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"virtual_balance" real NOT NULL,
	"current_balance" real NOT NULL,
	"final_balance" real,
	"total_trades" integer DEFAULT 0 NOT NULL,
	"profit_loss" real DEFAULT 0 NOT NULL,
	"win_rate" real DEFAULT 0 NOT NULL,
	"max_drawdown" real DEFAULT 0 NOT NULL,
	"best_trade" real DEFAULT 0 NOT NULL,
	"worst_trade" real DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"trading_fees" real DEFAULT 0.001 NOT NULL,
	"slippage" real DEFAULT 0.0005 NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_trades" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"symbol" text NOT NULL,
	"type" text NOT NULL,
	"quantity" real NOT NULL,
	"price" real NOT NULL,
	"value" real NOT NULL,
	"fees" real NOT NULL,
	"timestamp" timestamp NOT NULL,
	"strategy" text NOT NULL,
	"realized" boolean DEFAULT false NOT NULL,
	"profit_loss" real,
	"exit_price" real,
	"exit_timestamp" timestamp,
	"slippage_percent" real,
	"market_impact_percent" real,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snipe_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"vcoin_id" text NOT NULL,
	"symbol_name" text NOT NULL,
	"entry_strategy" text DEFAULT 'market' NOT NULL,
	"entry_price" real,
	"position_size_usdt" real NOT NULL,
	"take_profit_level" integer DEFAULT 2 NOT NULL,
	"take_profit_custom" real,
	"stop_loss_percent" real NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"current_retries" integer DEFAULT 0 NOT NULL,
	"target_execution_time" timestamp,
	"actual_execution_time" timestamp,
	"execution_price" real,
	"actual_position_size" real,
	"execution_status" text,
	"error_message" text,
	"confidence_score" real DEFAULT 0 NOT NULL,
	"risk_level" text DEFAULT 'medium' NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_config_backups" (
	"id" serial PRIMARY KEY NOT NULL,
	"strategy_id" integer NOT NULL,
	"backup_reason" text NOT NULL,
	"config_snapshot" text NOT NULL,
	"version" integer NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"performance_snapshot" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_performance_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"strategy_id" integer NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"period_type" text NOT NULL,
	"highest_price" real,
	"lowest_price" real,
	"avg_price" real,
	"price_volatility" real,
	"pnl" real,
	"pnl_percent" real,
	"max_drawdown" real,
	"max_drawdown_percent" real,
	"sharpe_ratio" real,
	"sort_ratio" real,
	"calmar_ratio" real,
	"value_at_risk" real,
	"phases_executed" integer,
	"avg_execution_time" real,
	"total_slippage" real,
	"total_fees" real,
	"market_trend" text,
	"market_volatility" text,
	"calculated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_phase_executions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"strategy_id" integer NOT NULL,
	"phase_number" integer NOT NULL,
	"target_percentage" real NOT NULL,
	"target_price" real NOT NULL,
	"target_multiplier" real NOT NULL,
	"planned_sell_percentage" real NOT NULL,
	"execution_status" text DEFAULT 'pending' NOT NULL,
	"trigger_price" real,
	"execution_price" real,
	"executed_quantity" real,
	"executed_value" real,
	"profit" real,
	"profit_percent" real,
	"fees" real,
	"slippage" real,
	"exchange_order_id" text,
	"exchange_response" text,
	"triggered_at" timestamp,
	"executed_at" timestamp,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"strategy_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"risk_level" text NOT NULL,
	"default_settings" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_built_in" boolean DEFAULT false NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"success_rate" real DEFAULT 0,
	"avg_profit_percent" real DEFAULT 0,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "strategy_templates_strategy_id_unique" UNIQUE("strategy_id")
);
--> statement-breakpoint
CREATE TABLE "system_health_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"service" text NOT NULL,
	"status" text NOT NULL,
	"response_time" integer,
	"error_rate" real,
	"uptime" real,
	"throughput" real,
	"cpu_usage" real,
	"memory_usage" real,
	"disk_usage" real,
	"total_errors" integer DEFAULT 0 NOT NULL,
	"critical_errors" integer DEFAULT 0 NOT NULL,
	"circuit_breaker_open" boolean DEFAULT false NOT NULL,
	"circuit_breaker_failures" integer DEFAULT 0 NOT NULL,
	"metadata" text,
	"alerts_active" integer DEFAULT 0 NOT NULL,
	"timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_performance_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp NOT NULL,
	"total_agents" integer NOT NULL,
	"healthy_agents" integer NOT NULL,
	"degraded_agents" integer NOT NULL,
	"unhealthy_agents" integer NOT NULL,
	"total_workflows" integer NOT NULL,
	"running_workflows" integer NOT NULL,
	"completed_workflows" integer NOT NULL,
	"failed_workflows" integer NOT NULL,
	"system_memory_usage" real NOT NULL,
	"system_cpu_usage" real NOT NULL,
	"database_connections" integer NOT NULL,
	"average_response_time" real NOT NULL,
	"throughput" real NOT NULL,
	"error_rate" real NOT NULL,
	"uptime" integer NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_strategies" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"strategy_template_id" integer,
	"name" text NOT NULL,
	"description" text,
	"symbol" text NOT NULL,
	"vcoin_id" text,
	"entry_price" real NOT NULL,
	"position_size" real NOT NULL,
	"position_size_usdt" real NOT NULL,
	"levels" text NOT NULL,
	"stop_loss_percent" real NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"current_price" real,
	"unrealized_pnl" real DEFAULT 0,
	"unrealized_pnl_percent" real DEFAULT 0,
	"realized_pnl" real DEFAULT 0,
	"realized_pnl_percent" real DEFAULT 0,
	"total_pnl" real DEFAULT 0,
	"total_pnl_percent" real DEFAULT 0,
	"executed_phases" integer DEFAULT 0 NOT NULL,
	"total_phases" integer NOT NULL,
	"remaining_position" real,
	"max_drawdown" real DEFAULT 0,
	"risk_reward_ratio" real DEFAULT 0,
	"confidence_score" real DEFAULT 0,
	"ai_insights" text,
	"last_ai_analysis" timestamp,
	"activated_at" timestamp,
	"completed_at" timestamp,
	"last_execution_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_locks" (
	"id" serial PRIMARY KEY NOT NULL,
	"lock_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"owner_id" text NOT NULL,
	"owner_type" text NOT NULL,
	"acquired_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expires_at" timestamp NOT NULL,
	"released_at" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"lock_type" text DEFAULT 'exclusive' NOT NULL,
	"transaction_type" text NOT NULL,
	"transaction_data" text NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"current_retries" integer DEFAULT 0 NOT NULL,
	"timeout_ms" integer DEFAULT 30000 NOT NULL,
	"result" text,
	"error_message" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "transaction_locks_lock_id_unique" UNIQUE("lock_id"),
	CONSTRAINT "transaction_locks_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "transaction_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"queue_id" text NOT NULL,
	"lock_id" text,
	"resource_id" text NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"transaction_type" text NOT NULL,
	"transaction_data" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"queued_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"processing_started_at" timestamp,
	"completed_at" timestamp,
	"result" text,
	"error_message" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"owner_id" text NOT NULL,
	"owner_type" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "transaction_queue_queue_id_unique" UNIQUE("queue_id")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"transaction_type" text NOT NULL,
	"symbol_name" text NOT NULL,
	"vcoin_id" text,
	"buy_price" real,
	"buy_quantity" real,
	"buy_total_cost" real,
	"buy_timestamp" timestamp,
	"buy_order_id" text,
	"sell_price" real,
	"sell_quantity" real,
	"sell_total_revenue" real,
	"sell_timestamp" timestamp,
	"sell_order_id" text,
	"profit_loss" real,
	"profit_loss_percentage" real,
	"fees" real,
	"status" text DEFAULT 'pending' NOT NULL,
	"snipe_target_id" integer,
	"notes" text,
	"transaction_time" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"username" text,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"legacyBetterAuthId" text,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username"),
	CONSTRAINT "user_legacyBetterAuthId_unique" UNIQUE("legacyBetterAuthId")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"default_buy_amount_usdt" real DEFAULT 100 NOT NULL,
	"max_concurrent_snipes" integer DEFAULT 3 NOT NULL,
	"take_profit_level_1" real DEFAULT 5 NOT NULL,
	"take_profit_level_2" real DEFAULT 10 NOT NULL,
	"take_profit_level_3" real DEFAULT 15 NOT NULL,
	"take_profit_level_4" real DEFAULT 25 NOT NULL,
	"take_profit_custom" real,
	"default_take_profit_level" integer DEFAULT 2 NOT NULL,
	"stop_loss_percent" real DEFAULT 5 NOT NULL,
	"risk_tolerance" text DEFAULT 'medium' NOT NULL,
	"ready_state_pattern" text DEFAULT '2,2,4' NOT NULL,
	"target_advance_hours" real DEFAULT 3.5 NOT NULL,
	"auto_snipe_enabled" boolean DEFAULT true NOT NULL,
	"selected_exit_strategy" text DEFAULT 'balanced' NOT NULL,
	"custom_exit_strategy" text,
	"auto_buy_enabled" boolean DEFAULT true NOT NULL,
	"auto_sell_enabled" boolean DEFAULT true NOT NULL,
	"calendar_poll_interval_seconds" integer DEFAULT 300 NOT NULL,
	"symbols_poll_interval_seconds" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" integer NOT NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT 'default' NOT NULL,
	"activity_id" text NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"workflow_id" text,
	"symbol_name" text,
	"vcoin_id" text,
	"level" text DEFAULT 'info' NOT NULL,
	"timestamp" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "workflow_activity_activity_id_unique" UNIQUE("activity_id")
);
--> statement-breakpoint
CREATE TABLE "workflow_performance_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"execution_id" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"duration" integer NOT NULL,
	"status" text NOT NULL,
	"steps_executed" integer NOT NULL,
	"steps_skipped" integer NOT NULL,
	"steps_failed" integer NOT NULL,
	"agents_used" text NOT NULL,
	"retries_performed" integer NOT NULL,
	"fallbacks_used" integer NOT NULL,
	"total_response_time" real NOT NULL,
	"average_step_time" real NOT NULL,
	"bottleneck_step" text,
	"bottleneck_duration" real,
	"peak_memory" real NOT NULL,
	"average_memory" real NOT NULL,
	"peak_cpu" real NOT NULL,
	"average_cpu" real NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_system_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT 'default' NOT NULL,
	"system_status" text DEFAULT 'stopped' NOT NULL,
	"last_update" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"active_workflows" text DEFAULT '[]' NOT NULL,
	"ready_tokens" integer DEFAULT 0 NOT NULL,
	"total_detections" integer DEFAULT 0 NOT NULL,
	"successful_snipes" integer DEFAULT 0 NOT NULL,
	"total_profit" real DEFAULT 0 NOT NULL,
	"success_rate" real DEFAULT 0 NOT NULL,
	"average_roi" real DEFAULT 0 NOT NULL,
	"best_trade" real DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_instances" ADD CONSTRAINT "alert_instances_rule_id_alert_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_notifications" ADD CONSTRAINT "alert_notifications_alert_id_alert_instances_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alert_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_notifications" ADD CONSTRAINT "alert_notifications_channel_id_notification_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."notification_channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_history" ADD CONSTRAINT "execution_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_history" ADD CONSTRAINT "execution_history_snipe_target_id_snipe_targets_id_fk" FOREIGN KEY ("snipe_target_id") REFERENCES "public"."snipe_targets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_similarity_cache" ADD CONSTRAINT "pattern_similarity_cache_pattern_id_1_pattern_embeddings_pattern_id_fk" FOREIGN KEY ("pattern_id_1") REFERENCES "public"."pattern_embeddings"("pattern_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_similarity_cache" ADD CONSTRAINT "pattern_similarity_cache_pattern_id_2_pattern_embeddings_pattern_id_fk" FOREIGN KEY ("pattern_id_2") REFERENCES "public"."pattern_embeddings"("pattern_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_snapshots" ADD CONSTRAINT "position_snapshots_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_sessions" ADD CONSTRAINT "simulation_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_trades" ADD CONSTRAINT "simulation_trades_session_id_simulation_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."simulation_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snipe_targets" ADD CONSTRAINT "snipe_targets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_config_backups" ADD CONSTRAINT "strategy_config_backups_strategy_id_trading_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."trading_strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_performance_metrics" ADD CONSTRAINT "strategy_performance_metrics_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_performance_metrics" ADD CONSTRAINT "strategy_performance_metrics_strategy_id_trading_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."trading_strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_phase_executions" ADD CONSTRAINT "strategy_phase_executions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_phase_executions" ADD CONSTRAINT "strategy_phase_executions_strategy_id_trading_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."trading_strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_strategies" ADD CONSTRAINT "trading_strategies_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_strategies" ADD CONSTRAINT "trading_strategies_strategy_template_id_strategy_templates_id_fk" FOREIGN KEY ("strategy_template_id") REFERENCES "public"."strategy_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_queue" ADD CONSTRAINT "transaction_queue_lock_id_transaction_locks_lock_id_fk" FOREIGN KEY ("lock_id") REFERENCES "public"."transaction_locks"("lock_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_snipe_target_id_snipe_targets_id_fk" FOREIGN KEY ("snipe_target_id") REFERENCES "public"."snipe_targets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_credentials_user_provider_idx" ON "api_credentials" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "error_incidents_type_idx" ON "error_incidents" USING btree ("type");--> statement-breakpoint
CREATE INDEX "error_incidents_severity_idx" ON "error_incidents" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "error_incidents_service_idx" ON "error_incidents" USING btree ("service");--> statement-breakpoint
CREATE INDEX "error_incidents_first_occurrence_idx" ON "error_incidents" USING btree ("first_occurrence");--> statement-breakpoint
CREATE INDEX "error_incidents_last_occurrence_idx" ON "error_incidents" USING btree ("last_occurrence");--> statement-breakpoint
CREATE INDEX "error_incidents_recovered_idx" ON "error_incidents" USING btree ("recovered");--> statement-breakpoint
CREATE INDEX "error_incidents_service_severity_idx" ON "error_incidents" USING btree ("service","severity");--> statement-breakpoint
CREATE INDEX "error_incidents_type_occurrence_idx" ON "error_incidents" USING btree ("type","last_occurrence");--> statement-breakpoint
CREATE INDEX "execution_history_user_idx" ON "execution_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "execution_history_snipe_target_idx" ON "execution_history" USING btree ("snipe_target_id");--> statement-breakpoint
CREATE INDEX "execution_history_symbol_idx" ON "execution_history" USING btree ("symbol_name");--> statement-breakpoint
CREATE INDEX "execution_history_status_idx" ON "execution_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "execution_history_executed_at_idx" ON "execution_history" USING btree ("executed_at");--> statement-breakpoint
CREATE INDEX "execution_history_user_symbol_time_idx" ON "execution_history" USING btree ("user_id","symbol_name","executed_at");--> statement-breakpoint
CREATE INDEX "execution_history_user_status_action_idx" ON "execution_history" USING btree ("user_id","status","action");--> statement-breakpoint
CREATE INDEX "execution_history_snipe_target_action_status_idx" ON "execution_history" USING btree ("snipe_target_id","action","status");--> statement-breakpoint
CREATE INDEX "monitored_listings_vcoin_id_idx" ON "monitored_listings" USING btree ("vcoin_id");--> statement-breakpoint
CREATE INDEX "monitored_listings_status_idx" ON "monitored_listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "monitored_listings_launch_time_idx" ON "monitored_listings" USING btree ("first_open_time");--> statement-breakpoint
CREATE INDEX "monitored_listings_ready_pattern_idx" ON "monitored_listings" USING btree ("has_ready_pattern");--> statement-breakpoint
CREATE INDEX "pattern_embeddings_pattern_type_idx" ON "pattern_embeddings" USING btree ("pattern_type");--> statement-breakpoint
CREATE INDEX "pattern_embeddings_symbol_name_idx" ON "pattern_embeddings" USING btree ("symbol_name");--> statement-breakpoint
CREATE INDEX "pattern_embeddings_confidence_idx" ON "pattern_embeddings" USING btree ("confidence");--> statement-breakpoint
CREATE INDEX "pattern_embeddings_is_active_idx" ON "pattern_embeddings" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "pattern_embeddings_last_seen_idx" ON "pattern_embeddings" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "pattern_embeddings_type_confidence_idx" ON "pattern_embeddings" USING btree ("pattern_type","confidence");--> statement-breakpoint
CREATE INDEX "pattern_embeddings_symbol_type_idx" ON "pattern_embeddings" USING btree ("symbol_name","pattern_type");--> statement-breakpoint
CREATE INDEX "pattern_similarity_cache_pattern1_idx" ON "pattern_similarity_cache" USING btree ("pattern_id_1");--> statement-breakpoint
CREATE INDEX "pattern_similarity_cache_pattern2_idx" ON "pattern_similarity_cache" USING btree ("pattern_id_2");--> statement-breakpoint
CREATE INDEX "pattern_similarity_cache_similarity_idx" ON "pattern_similarity_cache" USING btree ("cosine_similarity");--> statement-breakpoint
CREATE INDEX "pattern_similarity_cache_expires_idx" ON "pattern_similarity_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "pattern_similarity_cache_unique_pair_idx" ON "pattern_similarity_cache" USING btree ("pattern_id_1","pattern_id_2");--> statement-breakpoint
CREATE INDEX "position_snapshots_user_id_idx" ON "position_snapshots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "position_snapshots_snapshot_id_idx" ON "position_snapshots" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "position_snapshots_source_idx" ON "position_snapshots" USING btree ("source");--> statement-breakpoint
CREATE INDEX "position_snapshots_symbol_idx" ON "position_snapshots" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "position_snapshots_timestamp_idx" ON "position_snapshots" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "position_snapshots_reconciliation_id_idx" ON "position_snapshots" USING btree ("reconciliation_id");--> statement-breakpoint
CREATE INDEX "position_snapshots_source_timestamp_idx" ON "position_snapshots" USING btree ("source","timestamp");--> statement-breakpoint
CREATE INDEX "position_snapshots_user_symbol_idx" ON "position_snapshots" USING btree ("user_id","symbol");--> statement-breakpoint
CREATE INDEX "reconciliation_reports_user_id_idx" ON "reconciliation_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reconciliation_reports_start_time_idx" ON "reconciliation_reports" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "reconciliation_reports_overall_status_idx" ON "reconciliation_reports" USING btree ("overall_status");--> statement-breakpoint
CREATE INDEX "reconciliation_reports_critical_issues_idx" ON "reconciliation_reports" USING btree ("critical_issues");--> statement-breakpoint
CREATE INDEX "risk_events_user_id_idx" ON "risk_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "risk_events_event_type_idx" ON "risk_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "risk_events_severity_idx" ON "risk_events" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "risk_events_timestamp_idx" ON "risk_events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "risk_events_resolved_idx" ON "risk_events" USING btree ("resolved");--> statement-breakpoint
CREATE INDEX "risk_events_user_severity_idx" ON "risk_events" USING btree ("user_id","severity");--> statement-breakpoint
CREATE INDEX "risk_events_type_timestamp_idx" ON "risk_events" USING btree ("event_type","timestamp");--> statement-breakpoint
CREATE INDEX "simulation_sessions_user_id_idx" ON "simulation_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "simulation_sessions_status_idx" ON "simulation_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "simulation_sessions_start_time_idx" ON "simulation_sessions" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "simulation_trades_session_id_idx" ON "simulation_trades" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "simulation_trades_symbol_idx" ON "simulation_trades" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "simulation_trades_timestamp_idx" ON "simulation_trades" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "simulation_trades_type_idx" ON "simulation_trades" USING btree ("type");--> statement-breakpoint
CREATE INDEX "simulation_trades_realized_idx" ON "simulation_trades" USING btree ("realized");--> statement-breakpoint
CREATE INDEX "snipe_targets_user_idx" ON "snipe_targets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "snipe_targets_status_idx" ON "snipe_targets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "snipe_targets_priority_idx" ON "snipe_targets" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "snipe_targets_execution_time_idx" ON "snipe_targets" USING btree ("target_execution_time");--> statement-breakpoint
CREATE INDEX "snipe_targets_user_status_priority_idx" ON "snipe_targets" USING btree ("user_id","status","priority");--> statement-breakpoint
CREATE INDEX "snipe_targets_status_execution_time_idx" ON "snipe_targets" USING btree ("status","target_execution_time");--> statement-breakpoint
CREATE INDEX "strategy_config_backups_strategy_idx" ON "strategy_config_backups" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "strategy_config_backups_version_idx" ON "strategy_config_backups" USING btree ("version");--> statement-breakpoint
CREATE INDEX "strategy_config_backups_active_idx" ON "strategy_config_backups" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "strategy_config_backups_reason_idx" ON "strategy_config_backups" USING btree ("backup_reason");--> statement-breakpoint
CREATE INDEX "strategy_performance_metrics_strategy_idx" ON "strategy_performance_metrics" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "strategy_performance_metrics_user_idx" ON "strategy_performance_metrics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "strategy_performance_metrics_period_idx" ON "strategy_performance_metrics" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "strategy_performance_metrics_period_type_idx" ON "strategy_performance_metrics" USING btree ("period_type");--> statement-breakpoint
CREATE INDEX "strategy_performance_metrics_strategy_period_idx" ON "strategy_performance_metrics" USING btree ("strategy_id","period_start");--> statement-breakpoint
CREATE INDEX "strategy_performance_metrics_user_period_idx" ON "strategy_performance_metrics" USING btree ("user_id","period_start");--> statement-breakpoint
CREATE INDEX "strategy_phase_executions_strategy_idx" ON "strategy_phase_executions" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "strategy_phase_executions_user_idx" ON "strategy_phase_executions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "strategy_phase_executions_status_idx" ON "strategy_phase_executions" USING btree ("execution_status");--> statement-breakpoint
CREATE INDEX "strategy_phase_executions_phase_idx" ON "strategy_phase_executions" USING btree ("phase_number");--> statement-breakpoint
CREATE INDEX "strategy_phase_executions_strategy_phase_idx" ON "strategy_phase_executions" USING btree ("strategy_id","phase_number");--> statement-breakpoint
CREATE INDEX "strategy_phase_executions_strategy_status_idx" ON "strategy_phase_executions" USING btree ("strategy_id","execution_status");--> statement-breakpoint
CREATE INDEX "strategy_phase_executions_user_strategy_idx" ON "strategy_phase_executions" USING btree ("user_id","strategy_id");--> statement-breakpoint
CREATE INDEX "strategy_templates_strategy_id_idx" ON "strategy_templates" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "strategy_templates_type_idx" ON "strategy_templates" USING btree ("type");--> statement-breakpoint
CREATE INDEX "strategy_templates_risk_level_idx" ON "strategy_templates" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX "strategy_templates_usage_count_idx" ON "strategy_templates" USING btree ("usage_count");--> statement-breakpoint
CREATE INDEX "system_health_metrics_service_idx" ON "system_health_metrics" USING btree ("service");--> statement-breakpoint
CREATE INDEX "system_health_metrics_status_idx" ON "system_health_metrics" USING btree ("status");--> statement-breakpoint
CREATE INDEX "system_health_metrics_timestamp_idx" ON "system_health_metrics" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "system_health_metrics_service_timestamp_idx" ON "system_health_metrics" USING btree ("service","timestamp");--> statement-breakpoint
CREATE INDEX "system_health_metrics_service_status_idx" ON "system_health_metrics" USING btree ("service","status");--> statement-breakpoint
CREATE INDEX "trading_strategies_user_idx" ON "trading_strategies" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trading_strategies_symbol_idx" ON "trading_strategies" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "trading_strategies_status_idx" ON "trading_strategies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trading_strategies_template_idx" ON "trading_strategies" USING btree ("strategy_template_id");--> statement-breakpoint
CREATE INDEX "trading_strategies_user_status_idx" ON "trading_strategies" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "trading_strategies_symbol_status_idx" ON "trading_strategies" USING btree ("symbol","status");--> statement-breakpoint
CREATE INDEX "trading_strategies_user_symbol_idx" ON "trading_strategies" USING btree ("user_id","symbol");--> statement-breakpoint
CREATE INDEX "transaction_locks_resource_id_idx" ON "transaction_locks" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "transaction_locks_status_idx" ON "transaction_locks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transaction_locks_expires_at_idx" ON "transaction_locks" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "transaction_locks_idempotency_key_idx" ON "transaction_locks" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "transaction_locks_owner_id_idx" ON "transaction_locks" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "transaction_locks_resource_status_idx" ON "transaction_locks" USING btree ("resource_id","status");--> statement-breakpoint
CREATE INDEX "transaction_locks_owner_status_idx" ON "transaction_locks" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "transaction_queue_resource_id_idx" ON "transaction_queue" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "transaction_queue_status_idx" ON "transaction_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transaction_queue_priority_idx" ON "transaction_queue" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "transaction_queue_queued_at_idx" ON "transaction_queue" USING btree ("queued_at");--> statement-breakpoint
CREATE INDEX "transaction_queue_idempotency_key_idx" ON "transaction_queue" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "transaction_queue_status_priority_idx" ON "transaction_queue" USING btree ("status","priority","queued_at");--> statement-breakpoint
CREATE INDEX "transaction_queue_resource_status_idx" ON "transaction_queue" USING btree ("resource_id","status");--> statement-breakpoint
CREATE INDEX "transactions_user_idx" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_symbol_idx" ON "transactions" USING btree ("symbol_name");--> statement-breakpoint
CREATE INDEX "transactions_status_idx" ON "transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transactions_transaction_time_idx" ON "transactions" USING btree ("transaction_time");--> statement-breakpoint
CREATE INDEX "transactions_type_idx" ON "transactions" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "transactions_user_status_idx" ON "transactions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "transactions_user_time_idx" ON "transactions" USING btree ("user_id","transaction_time");--> statement-breakpoint
CREATE INDEX "transactions_symbol_time_idx" ON "transactions" USING btree ("symbol_name","transaction_time");--> statement-breakpoint
CREATE INDEX "user_preferences_user_id_idx" ON "user_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workflow_activity_user_id_idx" ON "workflow_activity" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workflow_activity_activity_id_idx" ON "workflow_activity" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "workflow_activity_type_idx" ON "workflow_activity" USING btree ("type");--> statement-breakpoint
CREATE INDEX "workflow_activity_timestamp_idx" ON "workflow_activity" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "workflow_system_status_user_id_idx" ON "workflow_system_status" USING btree ("user_id");
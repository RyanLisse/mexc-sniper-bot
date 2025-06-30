CREATE TABLE "balance_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"asset" text NOT NULL,
	"free_amount" real DEFAULT 0 NOT NULL,
	"locked_amount" real DEFAULT 0 NOT NULL,
	"total_amount" real DEFAULT 0 NOT NULL,
	"usd_value" real DEFAULT 0 NOT NULL,
	"price_source" text DEFAULT 'mexc' NOT NULL,
	"exchange_rate" real,
	"snapshot_type" text DEFAULT 'periodic' NOT NULL,
	"data_source" text DEFAULT 'api' NOT NULL,
	"timestamp" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "error_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"error_code" text,
	"stack_trace" text,
	"user_id" text,
	"session_id" text,
	"metadata" text,
	"context" text,
	"service" text DEFAULT 'unknown' NOT NULL,
	"component" text,
	"timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"total_usd_value" real DEFAULT 0 NOT NULL,
	"asset_count" integer DEFAULT 0 NOT NULL,
	"performance_24h" real DEFAULT 0,
	"performance_7d" real DEFAULT 0,
	"performance_30d" real DEFAULT 0,
	"top_assets" text,
	"last_balance_update" timestamp NOT NULL,
	"last_calculated" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_summary" ADD CONSTRAINT "portfolio_summary_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "balance_snapshots_user_idx" ON "balance_snapshots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "balance_snapshots_asset_idx" ON "balance_snapshots" USING btree ("asset");--> statement-breakpoint
CREATE INDEX "balance_snapshots_timestamp_idx" ON "balance_snapshots" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "balance_snapshots_user_time_idx" ON "balance_snapshots" USING btree ("user_id","timestamp");--> statement-breakpoint
CREATE INDEX "balance_snapshots_user_asset_time_idx" ON "balance_snapshots" USING btree ("user_id","asset","timestamp");--> statement-breakpoint
CREATE INDEX "balance_snapshots_asset_time_idx" ON "balance_snapshots" USING btree ("asset","timestamp");--> statement-breakpoint
CREATE INDEX "balance_snapshots_snapshot_type_idx" ON "balance_snapshots" USING btree ("snapshot_type");--> statement-breakpoint
CREATE INDEX "balance_snapshots_data_source_idx" ON "balance_snapshots" USING btree ("data_source");--> statement-breakpoint
CREATE INDEX "error_logs_level_idx" ON "error_logs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "error_logs_service_idx" ON "error_logs" USING btree ("service");--> statement-breakpoint
CREATE INDEX "error_logs_timestamp_idx" ON "error_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "error_logs_user_id_idx" ON "error_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "error_logs_session_id_idx" ON "error_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "error_logs_error_code_idx" ON "error_logs" USING btree ("error_code");--> statement-breakpoint
CREATE INDEX "error_logs_level_timestamp_idx" ON "error_logs" USING btree ("level","timestamp");--> statement-breakpoint
CREATE INDEX "error_logs_service_timestamp_idx" ON "error_logs" USING btree ("service","timestamp");--> statement-breakpoint
CREATE INDEX "error_logs_user_level_idx" ON "error_logs" USING btree ("user_id","level");--> statement-breakpoint
CREATE INDEX "portfolio_summary_user_idx" ON "portfolio_summary" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "portfolio_summary_last_updated_idx" ON "portfolio_summary" USING btree ("last_balance_update");--> statement-breakpoint
CREATE INDEX "portfolio_summary_last_calculated_idx" ON "portfolio_summary" USING btree ("last_calculated");
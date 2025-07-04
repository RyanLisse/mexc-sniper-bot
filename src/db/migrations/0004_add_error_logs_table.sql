-- Add missing error_logs table that is referenced in the schema but missing from initial migration
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
CREATE INDEX "error_logs_level_idx" ON "error_logs" USING btree ("level");
--> statement-breakpoint
CREATE INDEX "error_logs_service_idx" ON "error_logs" USING btree ("service");
--> statement-breakpoint
CREATE INDEX "error_logs_timestamp_idx" ON "error_logs" USING btree ("timestamp");
--> statement-breakpoint
CREATE INDEX "error_logs_user_id_idx" ON "error_logs" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "error_logs_session_id_idx" ON "error_logs" USING btree ("session_id");
--> statement-breakpoint
CREATE INDEX "error_logs_error_code_idx" ON "error_logs" USING btree ("error_code");
--> statement-breakpoint
CREATE INDEX "error_logs_level_timestamp_idx" ON "error_logs" USING btree ("level","timestamp");
--> statement-breakpoint
CREATE INDEX "error_logs_service_timestamp_idx" ON "error_logs" USING btree ("service","timestamp");
--> statement-breakpoint
CREATE INDEX "error_logs_user_level_idx" ON "error_logs" USING btree ("user_id","level");
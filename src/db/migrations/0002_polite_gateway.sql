CREATE TABLE "coin_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"vcoin_id" text NOT NULL,
	"currency" text NOT NULL,
	"activity_id" text NOT NULL,
	"currency_id" text,
	"activity_type" text NOT NULL,
	"discovered_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"last_checked" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"confidence_boost" real DEFAULT 0 NOT NULL,
	"priority_score" real DEFAULT 0 NOT NULL,
	"activity_details" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "coin_activities_activity_id_unique" UNIQUE("activity_id")
);
--> statement-breakpoint
CREATE INDEX "coin_activities_vcoin_id_idx" ON "coin_activities" USING btree ("vcoin_id");--> statement-breakpoint
CREATE INDEX "coin_activities_currency_idx" ON "coin_activities" USING btree ("currency");--> statement-breakpoint
CREATE INDEX "coin_activities_activity_type_idx" ON "coin_activities" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "coin_activities_is_active_idx" ON "coin_activities" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "coin_activities_discovered_at_idx" ON "coin_activities" USING btree ("discovered_at");--> statement-breakpoint
CREATE INDEX "coin_activities_active_currency_idx" ON "coin_activities" USING btree ("is_active","currency");--> statement-breakpoint
CREATE INDEX "coin_activities_type_discovered_idx" ON "coin_activities" USING btree ("activity_type","discovered_at");
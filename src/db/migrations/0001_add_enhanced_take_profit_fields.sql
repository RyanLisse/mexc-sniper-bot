-- Migration: Add Enhanced Take Profit Strategy Fields
-- Created: 2025-01-19
-- Description: Adds the missing take profit strategy fields to user_preferences table

--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "take_profit_strategy" text DEFAULT 'balanced' NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "take_profit_levels_config" text;
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "sell_quantity_level_1" real DEFAULT 25.0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "sell_quantity_level_2" real DEFAULT 25.0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "sell_quantity_level_3" real DEFAULT 25.0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "sell_quantity_level_4" real DEFAULT 25.0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "sell_quantity_custom" real DEFAULT 100.0;

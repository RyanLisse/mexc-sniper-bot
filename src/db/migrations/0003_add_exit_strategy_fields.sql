-- Add exit strategy fields to user_preferences table
ALTER TABLE `user_preferences` ADD COLUMN `auto_snipe_enabled` integer DEFAULT true NOT NULL;
ALTER TABLE `user_preferences` ADD COLUMN `selected_exit_strategy` text DEFAULT 'balanced' NOT NULL;
ALTER TABLE `user_preferences` ADD COLUMN `custom_exit_strategy` text;
ALTER TABLE `user_preferences` ADD COLUMN `auto_buy_enabled` integer DEFAULT true NOT NULL;
ALTER TABLE `user_preferences` ADD COLUMN `auto_sell_enabled` integer DEFAULT true NOT NULL;
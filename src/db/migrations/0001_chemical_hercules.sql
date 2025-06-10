CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`transaction_type` text NOT NULL,
	`symbol_name` text NOT NULL,
	`vcoin_id` text,
	`buy_price` real,
	`buy_quantity` real,
	`buy_total_cost` real,
	`buy_timestamp` integer,
	`buy_order_id` text,
	`sell_price` real,
	`sell_quantity` real,
	`sell_total_revenue` real,
	`sell_timestamp` integer,
	`sell_order_id` text,
	`profit_loss` real,
	`profit_loss_percentage` real,
	`fees` real,
	`status` text DEFAULT 'pending' NOT NULL,
	`snipe_target_id` integer,
	`notes` text,
	`transaction_time` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`snipe_target_id`) REFERENCES `snipe_targets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transactions_user_idx` ON `transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `transactions_symbol_idx` ON `transactions` (`symbol_name`);--> statement-breakpoint
CREATE INDEX `transactions_status_idx` ON `transactions` (`status`);--> statement-breakpoint
CREATE INDEX `transactions_transaction_time_idx` ON `transactions` (`transaction_time`);--> statement-breakpoint
CREATE INDEX `transactions_type_idx` ON `transactions` (`transaction_type`);--> statement-breakpoint
CREATE INDEX `transactions_user_status_idx` ON `transactions` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `transactions_user_time_idx` ON `transactions` (`user_id`,`transaction_time`);--> statement-breakpoint
CREATE INDEX `transactions_symbol_time_idx` ON `transactions` (`symbol_name`,`transaction_time`);
CREATE TABLE `pattern_embeddings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pattern_id` text NOT NULL,
	`pattern_type` text NOT NULL,
	`symbol_name` text NOT NULL,
	`vcoin_id` text,
	`pattern_data` text NOT NULL,
	`embedding` text NOT NULL,
	`embedding_dimension` integer DEFAULT 1536 NOT NULL,
	`embedding_model` text DEFAULT 'text-embedding-ada-002' NOT NULL,
	`confidence` real NOT NULL,
	`occurrences` integer DEFAULT 1 NOT NULL,
	`success_rate` real,
	`avg_profit` real,
	`discovered_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`similarity_threshold` real DEFAULT 0.85 NOT NULL,
	`false_positives` integer DEFAULT 0 NOT NULL,
	`true_positives` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pattern_embeddings_pattern_id_unique` ON `pattern_embeddings` (`pattern_id`);--> statement-breakpoint
CREATE INDEX `pattern_embeddings_pattern_type_idx` ON `pattern_embeddings` (`pattern_type`);--> statement-breakpoint
CREATE INDEX `pattern_embeddings_symbol_name_idx` ON `pattern_embeddings` (`symbol_name`);--> statement-breakpoint
CREATE INDEX `pattern_embeddings_confidence_idx` ON `pattern_embeddings` (`confidence`);--> statement-breakpoint
CREATE INDEX `pattern_embeddings_is_active_idx` ON `pattern_embeddings` (`is_active`);--> statement-breakpoint
CREATE INDEX `pattern_embeddings_last_seen_idx` ON `pattern_embeddings` (`last_seen_at`);--> statement-breakpoint
CREATE INDEX `pattern_embeddings_type_confidence_idx` ON `pattern_embeddings` (`pattern_type`,`confidence`);--> statement-breakpoint
CREATE INDEX `pattern_embeddings_symbol_type_idx` ON `pattern_embeddings` (`symbol_name`,`pattern_type`);--> statement-breakpoint
CREATE TABLE `pattern_similarity_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pattern_id_1` text NOT NULL,
	`pattern_id_2` text NOT NULL,
	`cosine_similarity` real NOT NULL,
	`euclidean_distance` real NOT NULL,
	`calculated_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`pattern_id_1`) REFERENCES `pattern_embeddings`(`pattern_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pattern_id_2`) REFERENCES `pattern_embeddings`(`pattern_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pattern_similarity_cache_pattern1_idx` ON `pattern_similarity_cache` (`pattern_id_1`);--> statement-breakpoint
CREATE INDEX `pattern_similarity_cache_pattern2_idx` ON `pattern_similarity_cache` (`pattern_id_2`);--> statement-breakpoint
CREATE INDEX `pattern_similarity_cache_similarity_idx` ON `pattern_similarity_cache` (`cosine_similarity`);--> statement-breakpoint
CREATE INDEX `pattern_similarity_cache_expires_idx` ON `pattern_similarity_cache` (`expires_at`);--> statement-breakpoint
CREATE INDEX `pattern_similarity_cache_unique_pair_idx` ON `pattern_similarity_cache` (`pattern_id_1`,`pattern_id_2`);
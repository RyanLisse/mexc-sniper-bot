import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ===========================================
// PATTERN ANALYSIS SCHEMA MODULE
// ===========================================

// Monitored Listings Table
export const monitoredListings = sqliteTable(
  "monitored_listings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    vcoinId: text("vcoin_id").notNull().unique(),
    symbolName: text("symbol_name").notNull(),
    projectName: text("project_name"),

    // Launch Details
    firstOpenTime: integer("first_open_time").notNull(), // Unix timestamp in milliseconds
    estimatedLaunchTime: integer("estimated_launch_time"), // Calculated launch time

    // Status
    status: text("status").notNull().default("monitoring"), // "monitoring", "ready", "launched", "completed", "failed"
    confidence: real("confidence").notNull().default(0.0), // 0-100 confidence score

    // Pattern Data
    patternSts: integer("pattern_sts"), // Symbol trading status
    patternSt: integer("pattern_st"), // Symbol state
    patternTt: integer("pattern_tt"), // Trading time status
    hasReadyPattern: integer("has_ready_pattern", { mode: "boolean" }).notNull().default(false),

    // Discovery Information
    discoveredAt: integer("discovered_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    lastChecked: integer("last_checked", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),

    // Trading Data
    tradingPairs: text("trading_pairs"), // JSON array of trading pairs
    priceData: text("price_data"), // JSON price information
    volumeData: text("volume_data"), // JSON volume information

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    vcoinIdIdx: index("monitored_listings_vcoin_id_idx").on(table.vcoinId),
    statusIdx: index("monitored_listings_status_idx").on(table.status),
    launchTimeIdx: index("monitored_listings_launch_time_idx").on(table.firstOpenTime),
    readyPatternIdx: index("monitored_listings_ready_pattern_idx").on(table.hasReadyPattern),
  })
);

// Pattern Embeddings Table for Vector Search
export const patternEmbeddings = sqliteTable(
  "pattern_embeddings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),

    // Pattern Identification
    patternId: text("pattern_id").notNull().unique(), // embed-{timestamp}-{random}
    patternType: text("pattern_type").notNull(), // "ready_state", "launch_pattern", "price_action", "volume_profile"

    // Pattern Data
    symbolName: text("symbol_name").notNull(),
    vcoinId: text("vcoin_id"),
    patternData: text("pattern_data").notNull(), // JSON representation of the pattern

    // Vector Embedding (stored as JSON array for SQLite compatibility)
    embedding: text("embedding").notNull(), // JSON array of floats [0.1, 0.2, ...]
    embeddingDimension: integer("embedding_dimension").notNull().default(1536), // OpenAI ada-002 dimension
    embeddingModel: text("embedding_model").notNull().default("text-embedding-ada-002"),

    // Pattern Metadata
    confidence: real("confidence").notNull(), // 0-100
    occurrences: integer("occurrences").notNull().default(1),
    successRate: real("success_rate"), // Historical success rate of this pattern
    avgProfit: real("avg_profit"), // Average profit when this pattern appears

    // Discovery Information
    discoveredAt: integer("discovered_at", { mode: "timestamp" }).notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).notNull(),

    // Performance Metrics
    similarityThreshold: real("similarity_threshold").notNull().default(0.85), // Threshold for pattern matching
    falsePositives: integer("false_positives").notNull().default(0),
    truePositives: integer("true_positives").notNull().default(0),

    // Status
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    patternTypeIdx: index("pattern_embeddings_pattern_type_idx").on(table.patternType),
    symbolNameIdx: index("pattern_embeddings_symbol_name_idx").on(table.symbolName),
    confidenceIdx: index("pattern_embeddings_confidence_idx").on(table.confidence),
    isActiveIdx: index("pattern_embeddings_is_active_idx").on(table.isActive),
    lastSeenIdx: index("pattern_embeddings_last_seen_idx").on(table.lastSeenAt),
    // Compound indexes
    typeConfidenceIdx: index("pattern_embeddings_type_confidence_idx").on(
      table.patternType,
      table.confidence
    ),
    symbolTypeIdx: index("pattern_embeddings_symbol_type_idx").on(
      table.symbolName,
      table.patternType
    ),
  })
);

// Pattern Similarity Cache Table
export const patternSimilarityCache = sqliteTable(
  "pattern_similarity_cache",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),

    // Pattern References
    patternId1: text("pattern_id_1")
      .notNull()
      .references(() => patternEmbeddings.patternId, { onDelete: "cascade" }),
    patternId2: text("pattern_id_2")
      .notNull()
      .references(() => patternEmbeddings.patternId, { onDelete: "cascade" }),

    // Similarity Metrics
    cosineSimilarity: real("cosine_similarity").notNull(), // -1 to 1
    euclideanDistance: real("euclidean_distance").notNull(), // 0 to infinity

    // Cache Metadata
    calculatedAt: integer("calculated_at", { mode: "timestamp" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(), // Cache expiry

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    pattern1Idx: index("pattern_similarity_cache_pattern1_idx").on(table.patternId1),
    pattern2Idx: index("pattern_similarity_cache_pattern2_idx").on(table.patternId2),
    similarityIdx: index("pattern_similarity_cache_similarity_idx").on(table.cosineSimilarity),
    expiresIdx: index("pattern_similarity_cache_expires_idx").on(table.expiresAt),
    // Unique constraint on pattern pair
    uniquePairIdx: index("pattern_similarity_cache_unique_pair_idx").on(
      table.patternId1,
      table.patternId2
    ),
  })
);

// Pattern Analysis Types
export type MonitoredListing = typeof monitoredListings.$inferSelect;
export type NewMonitoredListing = typeof monitoredListings.$inferInsert;

export type PatternEmbedding = typeof patternEmbeddings.$inferSelect;
export type NewPatternEmbedding = typeof patternEmbeddings.$inferInsert;

export type PatternSimilarityCache = typeof patternSimilarityCache.$inferSelect;
export type NewPatternSimilarityCache = typeof patternSimilarityCache.$inferInsert;
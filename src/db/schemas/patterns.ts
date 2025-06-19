import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// ===========================================
// PATTERN ANALYSIS SCHEMA MODULE
// ===========================================

// Monitored Listings Table
export const monitoredListings = pgTable(
  "monitored_listings",
  {
    id: serial("id").primaryKey(),
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
    hasReadyPattern: boolean("has_ready_pattern").notNull().default(false),

    // Discovery Information
    discoveredAt: timestamp("discovered_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastChecked: timestamp("last_checked").notNull().default(sql`CURRENT_TIMESTAMP`),

    // Trading Data
    tradingPairs: text("trading_pairs"), // JSON array of trading pairs
    priceData: text("price_data"), // JSON price information
    volumeData: text("volume_data"), // JSON volume information

    // Timestamps
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    vcoinIdIdx: index("monitored_listings_vcoin_id_idx").on(table.vcoinId),
    statusIdx: index("monitored_listings_status_idx").on(table.status),
    launchTimeIdx: index("monitored_listings_launch_time_idx").on(table.firstOpenTime),
    readyPatternIdx: index("monitored_listings_ready_pattern_idx").on(table.hasReadyPattern),
  })
);

// Pattern Embeddings Table for Vector Search
export const patternEmbeddings = pgTable(
  "pattern_embeddings",
  {
    id: serial("id").primaryKey(),

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
    discoveredAt: timestamp("discovered_at").notNull(),
    lastSeenAt: timestamp("last_seen_at").notNull(),

    // Performance Metrics
    similarityThreshold: real("similarity_threshold").notNull().default(0.85), // Threshold for pattern matching
    falsePositives: integer("false_positives").notNull().default(0),
    truePositives: integer("true_positives").notNull().default(0),

    // Status
    isActive: boolean("is_active").notNull().default(true),

    // Timestamps
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
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
export const patternSimilarityCache = pgTable(
  "pattern_similarity_cache",
  {
    id: serial("id").primaryKey(),

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
    calculatedAt: timestamp("calculated_at").notNull(),
    expiresAt: timestamp("expires_at").notNull(), // Cache expiry

    // Timestamps
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
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

// Coin Activities Table for MEXC Activity API Integration
export const coinActivities = pgTable(
  "coin_activities",
  {
    id: serial("id").primaryKey(),

    // Core Activity Data
    vcoinId: text("vcoin_id").notNull(),
    currency: text("currency").notNull(), // Symbol/currency name
    activityId: text("activity_id").notNull().unique(), // Unique activity identifier
    currencyId: text("currency_id"), // Internal MEXC currency ID
    activityType: text("activity_type").notNull(), // SUN_SHINE, PROMOTION, etc.

    // Discovery Metadata
    discoveredAt: timestamp("discovered_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastChecked: timestamp("last_checked").notNull().default(sql`CURRENT_TIMESTAMP`),
    isActive: boolean("is_active").notNull().default(true),

    // Pattern Enhancement Data
    confidenceBoost: real("confidence_boost").notNull().default(0), // 0-20 boost points
    priorityScore: real("priority_score").notNull().default(0), // Calculated priority score

    // Activity Details (JSON for flexibility)
    activityDetails: text("activity_details"), // JSON metadata about the activity

    // Timestamps
    createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    // Primary indexes
    vcoinIdIdx: index("coin_activities_vcoin_id_idx").on(table.vcoinId),
    currencyIdx: index("coin_activities_currency_idx").on(table.currency),
    activityTypeIdx: index("coin_activities_activity_type_idx").on(table.activityType),
    isActiveIdx: index("coin_activities_is_active_idx").on(table.isActive),
    discoveredAtIdx: index("coin_activities_discovered_at_idx").on(table.discoveredAt),

    // Compound indexes for pattern queries
    activeCurrencyIdx: index("coin_activities_active_currency_idx").on(
      table.isActive,
      table.currency
    ),
    typeDiscoveredIdx: index("coin_activities_type_discovered_idx").on(
      table.activityType,
      table.discoveredAt
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

export type CoinActivity = typeof coinActivities.$inferSelect;
export type NewCoinActivity = typeof coinActivities.$inferInsert;

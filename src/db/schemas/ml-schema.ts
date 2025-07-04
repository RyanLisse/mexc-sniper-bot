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

/**
 * Machine Learning and Pattern Detection Schema
 * Contains tables for anomaly models, pattern embeddings, and similarity cache
 */

export const anomalyModels = pgTable("anomaly_models", {
  id: text().primaryKey().notNull(),
  metricName: text("metric_name").notNull(),
  modelType: text("model_type").notNull(),
  parameters: text().notNull(),
  trainedAt: timestamp("trained_at", { mode: "string" }).notNull(),
  accuracy: real(),
  precision: real(),
  recall: real(),
  f1Score: real("f1_score"),
  threshold: real().notNull(),
  isActive: boolean("is_active").default(true),
  version: text().default("1.0").notNull(),
  trainingDataSize: integer("training_data_size"),
  lastPredictionAt: timestamp("last_prediction_at", { mode: "string" }),
  predictionCount: integer("prediction_count").default(0),
  anomalyCount: integer("anomaly_count").default(0),
  falsePositiveRate: real("false_positive_rate"),
  falseNegativeRate: real("false_negative_rate"),
  modelData: text("model_data"),
  metadata: text(),
  createdAt: timestamp("created_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const patternEmbeddings = pgTable(
  "pattern_embeddings",
  {
    id: serial().primaryKey().notNull(),
    patternId: text("pattern_id").notNull(),
    patternType: text("pattern_type").notNull(),
    symbol: text().notNull(),
    vcoinId: text("vcoin_id"),
    embedding: text().notNull(),
    dimensionality: integer().notNull(),
    confidence: real().default(0).notNull(),
    detectedAt: timestamp("detected_at", { mode: "string" }).notNull(),
    priceData: text("price_data"),
    volumeData: text("volume_data"),
    timeframe: text().default("1m").notNull(),
    patternContext: text("pattern_context"),
    isValidated: boolean("is_validated").default(false),
    validationScore: real("validation_score"),
    similarity: real(),
    clusterLabel: text("cluster_label"),
    metadata: text(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("pattern_embeddings_symbol_type_idx").using(
      "btree",
      table.symbol.asc().nullsLast(),
      table.patternType.asc().nullsLast()
    ),
    index("pattern_embeddings_confidence_idx").using(
      "btree",
      table.confidence.desc().nullsLast()
    ),
  ]
);

export const patternSimilarityCache = pgTable(
  "pattern_similarity_cache",
  {
    id: serial().primaryKey().notNull(),
    patternId1: text("pattern_id_1").notNull(),
    patternId2: text("pattern_id_2").notNull(),
    similarity: real().notNull(),
    distance: real(),
    algorithm: text().default("cosine").notNull(),
    threshold: real(),
    isSignificant: boolean("is_significant").default(false),
    computedAt: timestamp("computed_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    expiresAt: timestamp("expires_at", { mode: "string" }),
    hitCount: integer("hit_count").default(0),
    lastAccessedAt: timestamp("last_accessed_at", { mode: "string" }),
    metadata: text(),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("pattern_similarity_cache_patterns_idx").using(
      "btree",
      table.patternId1.asc().nullsLast(),
      table.patternId2.asc().nullsLast()
    ),
    index("pattern_similarity_cache_similarity_idx").using(
      "btree",
      table.similarity.desc().nullsLast()
    ),
  ]
);

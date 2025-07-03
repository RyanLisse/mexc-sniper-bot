/**
 * Optimized Pattern Service
 *
 * Eliminates N+1 query patterns in pattern processing operations.
 * Implements batch operations and efficient data fetching strategies.
 *
 * Key Optimizations:
 * - Batch user preference fetching
 * - Optimized pattern similarity searches
 * - Efficient duplicate checking
 * - Bulk pattern processing
 */

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, executeWithRetry, monitoredQuery } from "@/src/db";
import {
  patternEmbeddings,
  snipeTargets,
  userPreferences,
} from "@/src/db/schema";
import { toSafeError } from "@/src/lib/error-type-utils";

// ============================================================================
// Types and Schemas
// ============================================================================

const PatternBatchSchema = z.object({
  symbol: z.string(),
  patternType: z.enum([
    "ready_state",
    "pre_ready",
    "launch_sequence",
    "price_action",
  ]),
  userId: z.string(),
  confidence: z.number().min(0).max(100).optional(),
  vcoinId: z.string().optional(),
  embedding: z.array(z.number()).optional(),
});

const BulkPatternSchema = z.object({
  symbol: z.string(),
  patternType: z.enum([
    "ready_state",
    "pre_ready",
    "launch_sequence",
    "price_action",
  ]),
  confidence: z.number().min(0).max(100),
  embedding: z.array(z.number()),
  metadata: z.record(z.any()).optional(),
});

type PatternBatch = z.infer<typeof PatternBatchSchema>;
type BulkPattern = z.infer<typeof BulkPatternSchema>;

interface ProcessingOptions {
  batchSize?: number;
  useOptimizedQueries?: boolean;
  enableVectorOptimization?: boolean;
  maxConcurrency?: number;
}

interface UserPreferenceCache {
  [userId: string]: {
    defaultBuyAmountUsdt: number;
    defaultTakeProfitLevel: number;
    stopLossPercent: number;
    takeProfitCustom?: number;
  };
}

// ============================================================================
// Optimized Pattern Service
// ============================================================================

export class OptimizedPatternService {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[optimized-pattern-service]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[optimized-pattern-service]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error(
        "[optimized-pattern-service]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: any) =>
      console.debug("[optimized-pattern-service]", message, context || ""),
  };

  private userPreferenceCache: UserPreferenceCache = {};
  private cacheExpiry = new Map<string, number>();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Process patterns in batch to eliminate N+1 queries
   * OPTIMIZATION: Batch fetch user preferences instead of individual queries
   */
  async processPatternsBatch(patterns: PatternBatch[]): Promise<void> {
    if (patterns.length === 0) return;

    const startTime = performance.now();
    this.logger.info("Processing patterns batch", {
      count: patterns.length,
      operation: "batch_processing",
    });

    try {
      // OPTIMIZATION 1: Batch fetch user preferences to avoid N+1 queries
      const userPrefs = await this.batchFetchUserPreferences(patterns);

      // OPTIMIZATION 2: Batch check for existing snipe targets
      const nonDuplicatePatterns = await this.batchCheckDuplicates(patterns);

      // OPTIMIZATION 3: Process patterns in optimized batches
      await this.processNonDuplicatePatterns(nonDuplicatePatterns, userPrefs);

      const processingTime = performance.now() - startTime;
      this.logger.info("Batch processing completed", {
        totalPatterns: patterns.length,
        processedPatterns: nonDuplicatePatterns.length,
        duplicatesSkipped: patterns.length - nonDuplicatePatterns.length,
        processingTimeMs: Math.round(processingTime),
        avgTimePerPattern: Math.round(processingTime / patterns.length),
      });
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(
        "Batch processing failed",
        {
          patternCount: patterns.length,
          error: safeError.message,
        },
        safeError
      );
      throw error;
    }
  }

  /**
   * OPTIMIZATION: Batch fetch user preferences instead of individual queries
   * Eliminates N+1 pattern: 1 query per user → 1 query for all users
   */
  private async batchFetchUserPreferences(
    patterns: PatternBatch[]
  ): Promise<UserPreferenceCache> {
    const uniqueUserIds = [...new Set(patterns.map((p) => p.userId))];

    // Check cache first
    const cachedPrefs: UserPreferenceCache = {};
    const uncachedUserIds: string[] = [];
    const now = Date.now();

    for (const userId of uniqueUserIds) {
      const cacheKey = `user_pref_${userId}`;
      const expiry = this.cacheExpiry.get(cacheKey);

      if (expiry && expiry > now && this.userPreferenceCache[userId]) {
        cachedPrefs[userId] = this.userPreferenceCache[userId];
      } else {
        uncachedUserIds.push(userId);
      }
    }

    this.logger.debug("User preference cache status", {
      totalUsers: uniqueUserIds.length,
      cachedUsers: Object.keys(cachedPrefs).length,
      uncachedUsers: uncachedUserIds.length,
    });

    // Fetch uncached preferences in single batch query
    if (uncachedUserIds.length > 0) {
      const preferences = await monitoredQuery(
        "batch_fetch_user_preferences",
        async () => {
          return await executeWithRetry(async () => {
            return await db
              .select({
                userId: userPreferences.userId,
                defaultBuyAmountUsdt: userPreferences.defaultBuyAmountUsdt,
                defaultTakeProfitLevel: userPreferences.defaultTakeProfitLevel,
                stopLossPercent: userPreferences.stopLossPercent,
                takeProfitCustom: userPreferences.takeProfitCustom,
              })
              .from(userPreferences)
              .where(inArray(userPreferences.userId, uncachedUserIds));
          });
        },
        {
          operationType: "select",
          tableName: "user_preferences",
          query: `SELECT userId, defaultBuyAmountUsdt, defaultTakeProfitLevel, stopLossPercent, takeProfitCustom FROM user_preferences WHERE userId IN (${uncachedUserIds.map(() => "?").join(",")})`,
          parameters: uncachedUserIds,
        }
      );

      // Update cache
      for (const pref of preferences) {
        this.userPreferenceCache[pref.userId] = {
          defaultBuyAmountUsdt: pref.defaultBuyAmountUsdt || 100,
          defaultTakeProfitLevel: pref.defaultTakeProfitLevel || 2,
          stopLossPercent: pref.stopLossPercent || 15,
          takeProfitCustom: pref.takeProfitCustom,
        };
        this.cacheExpiry.set(`user_pref_${pref.userId}`, now + this.cacheTTL);
      }

      // Set defaults for users without preferences
      for (const userId of uncachedUserIds) {
        if (!this.userPreferenceCache[userId]) {
          this.userPreferenceCache[userId] = {
            defaultBuyAmountUsdt: 100,
            defaultTakeProfitLevel: 2,
            stopLossPercent: 15,
          };
          this.cacheExpiry.set(`user_pref_${userId}`, now + this.cacheTTL);
        }
      }
    }

    // Combine cached and newly fetched preferences
    return { ...cachedPrefs, ...this.userPreferenceCache };
  }

  /**
   * OPTIMIZATION: Batch check for duplicate snipe targets
   * Eliminates N+1 pattern: 1 query per pattern → 1 query for all patterns
   */
  private async batchCheckDuplicates(
    patterns: PatternBatch[]
  ): Promise<PatternBatch[]> {
    if (patterns.length === 0) return [];

    const userIds = [...new Set(patterns.map((p) => p.userId))];
    const symbols = [...new Set(patterns.map((p) => p.symbol))];

    // Single query to find existing targets for all users and symbols
    const existingTargets = await monitoredQuery(
      "batch_check_snipe_target_duplicates",
      async () => {
        return await executeWithRetry(async () => {
          return await db
            .select({
              userId: snipeTargets.userId,
              symbolName: snipeTargets.symbolName,
            })
            .from(snipeTargets)
            .where(
              and(
                inArray(snipeTargets.userId, userIds),
                inArray(snipeTargets.symbolName, symbols),
                eq(snipeTargets.status, "pending")
              )
            );
        });
      },
      {
        operationType: "select",
        tableName: "snipe_targets",
        query: `SELECT userId, symbolName FROM snipe_targets WHERE userId IN (${userIds.map(() => "?").join(",")}) AND symbolName IN (${symbols.map(() => "?").join(",")}) AND status = 'pending'`,
        parameters: [...userIds, ...symbols],
      }
    );

    // Create lookup set for O(1) duplicate checking
    const existingCombinations = new Set(
      existingTargets.map(
        (target: any) => `${target.userId}:${target.symbolName}`
      )
    );

    // Filter out duplicates in O(n) time
    const nonDuplicates = patterns.filter((pattern) => {
      const combination = `${pattern.userId}:${pattern.symbol}`;
      return !existingCombinations.has(combination);
    });

    this.logger.debug("Duplicate checking completed", {
      totalPatterns: patterns.length,
      existingTargets: existingTargets.length,
      nonDuplicates: nonDuplicates.length,
      duplicatesFiltered: patterns.length - nonDuplicates.length,
    });

    return nonDuplicates;
  }

  /**
   * Process non-duplicate patterns efficiently
   */
  private async processNonDuplicatePatterns(
    patterns: PatternBatch[],
    userPrefs: UserPreferenceCache
  ): Promise<void> {
    if (patterns.length === 0) return;

    const records = patterns.map((pattern) => {
      const prefs = userPrefs[pattern.userId];

      return {
        userId: pattern.userId,
        vcoinId: pattern.vcoinId || pattern.symbol,
        symbolName: pattern.symbol,
        entryStrategy: "market",
        positionSizeUsdt: prefs.defaultBuyAmountUsdt,
        takeProfitLevel: prefs.defaultTakeProfitLevel,
        takeProfitCustom: prefs.takeProfitCustom,
        stopLossPercent: prefs.stopLossPercent,
        status: pattern.patternType === "ready_state" ? "ready" : "pending",
        priority: this.calculatePriority(pattern),
        confidenceScore: Math.round(pattern.confidence || 80),
        riskLevel: this.calculateRiskLevel(pattern),
      };
    });

    // Batch insert all records
    await monitoredQuery(
      "batch_insert_snipe_targets",
      async () => {
        return await executeWithRetry(async () => {
          await db.insert(snipeTargets).values(records);
          return records.length;
        });
      },
      {
        operationType: "insert",
        tableName: "snipe_targets",
        query: `INSERT INTO snipe_targets (userId, vcoinId, symbolName, ...) VALUES ...`,
        parameters: records,
      }
    );

    this.logger.info("Batch insert completed", {
      recordsInserted: records.length,
    });
  }

  /**
   * Process bulk patterns for high-volume scenarios
   */
  async processBulkPatterns(
    patterns: BulkPattern[],
    options: ProcessingOptions = {}
  ): Promise<void> {
    const {
      batchSize = 50,
      useOptimizedQueries = true,
      enableVectorOptimization = true,
      maxConcurrency = 3,
    } = options;

    if (patterns.length === 0) return;

    this.logger.info("Starting bulk pattern processing", {
      totalPatterns: patterns.length,
      batchSize,
      useOptimizedQueries,
      enableVectorOptimization,
      maxConcurrency,
    });

    const startTime = performance.now();

    try {
      // Process in batches to avoid memory issues
      const batches = this.chunkArray(patterns, batchSize);

      if (maxConcurrency === 1) {
        // Sequential processing
        for (const batch of batches) {
          await this.processBulkBatch(batch, {
            useOptimizedQueries,
            enableVectorOptimization,
          });
        }
      } else {
        // Concurrent processing with controlled concurrency
        const semaphore = new Array(maxConcurrency).fill(null);
        let batchIndex = 0;

        await Promise.all(
          semaphore.map(async () => {
            while (batchIndex < batches.length) {
              const currentBatch = batches[batchIndex++];
              if (currentBatch) {
                await this.processBulkBatch(currentBatch, {
                  useOptimizedQueries,
                  enableVectorOptimization,
                });
              }
            }
          })
        );
      }

      const processingTime = performance.now() - startTime;
      this.logger.info("Bulk processing completed", {
        totalPatterns: patterns.length,
        batchCount: batches.length,
        processingTimeMs: Math.round(processingTime),
        avgTimePerPattern: Math.round(processingTime / patterns.length),
        patternsPerSecond: Math.round(
          patterns.length / (processingTime / 1000)
        ),
      });
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(
        "Bulk processing failed",
        {
          totalPatterns: patterns.length,
          error: safeError.message,
        },
        safeError
      );
      throw error;
    }
  }

  /**
   * Process a single bulk batch
   */
  private async processBulkBatch(
    batch: BulkPattern[],
    options: { useOptimizedQueries: boolean; enableVectorOptimization: boolean }
  ): Promise<void> {
    const { useOptimizedQueries, enableVectorOptimization } = options;

    // Convert to embedding records
    const embeddingRecords = batch.map((pattern) => ({
      patternId: `bulk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      patternType: pattern.patternType,
      symbolName: pattern.symbol,
      patternData: JSON.stringify(pattern.metadata || {}),
      embedding: JSON.stringify(pattern.embedding),
      embeddingDimension: pattern.embedding.length,
      confidence: pattern.confidence,
      discoveredAt: new Date(),
      lastSeenAt: new Date(),
    }));

    if (useOptimizedQueries) {
      // Use batch insert for better performance
      await monitoredQuery(
        "bulk_batch_insert_embeddings",
        async () => {
          return await executeWithRetry(async () => {
            await db.insert(patternEmbeddings).values(embeddingRecords);
            return embeddingRecords.length;
          });
        },
        {
          operationType: "insert",
          tableName: "pattern_embeddings",
          query: `INSERT INTO pattern_embeddings (...) VALUES ...`,
          parameters: embeddingRecords,
        }
      );
    } else {
      // Legacy individual inserts
      for (const record of embeddingRecords) {
        await db.insert(patternEmbeddings).values(record);
      }
    }

    this.logger.debug("Bulk batch processed", {
      batchSize: batch.length,
      useOptimizedQueries,
      enableVectorOptimization,
    });
  }

  /**
   * Helper: Calculate pattern priority
   */
  private calculatePriority(pattern: PatternBatch): number {
    let priority = 5; // Base priority

    const confidence = pattern.confidence || 80;
    if (confidence >= 90) priority = 1;
    else if (confidence >= 85) priority = 2;
    else if (confidence >= 80) priority = 3;
    else if (confidence >= 75) priority = 4;

    if (pattern.patternType === "ready_state")
      priority = Math.max(1, priority - 1);
    if (pattern.patternType === "launch_sequence")
      priority = Math.max(1, priority - 1);

    return Math.max(1, Math.min(10, priority));
  }

  /**
   * Helper: Calculate risk level
   */
  private calculateRiskLevel(pattern: PatternBatch): "low" | "medium" | "high" {
    const confidence = pattern.confidence || 80;

    if (confidence >= 90) return "low";
    if (confidence >= 80) return "medium";
    return "high";
  }

  /**
   * Helper: Chunk array into smaller batches
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Clear internal caches
   */
  clearCaches(): void {
    this.userPreferenceCache = {};
    this.cacheExpiry.clear();
    this.logger.debug("Internal caches cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    userPreferencesCached: number;
    cacheHitRate: number;
    averageCacheAge: number;
  } {
    const now = Date.now();
    const cachedUsers = Object.keys(this.userPreferenceCache).length;
    const expiries = Array.from(this.cacheExpiry.values());
    const validExpiries = expiries.filter((expiry) => expiry > now);
    const averageAge =
      validExpiries.length > 0
        ? this.cacheTTL -
          validExpiries.reduce((sum, exp) => sum + (exp - now), 0) /
            validExpiries.length
        : 0;

    return {
      userPreferencesCached: cachedUsers,
      cacheHitRate: validExpiries.length / Math.max(expiries.length, 1),
      averageCacheAge: averageAge,
    };
  }
}

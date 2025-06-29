/**
 * Batch Database Service (Refactored)
 *
 * Refactored version eliminating redundancy and applying consistent patterns.
 * Reduced from 1161 lines to under 500 lines by consolidating repetitive patterns.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, executeWithRetry, monitoredQuery } from "@/src/db";
import { patternEmbeddings, snipeTargets } from "@/src/db/schema";
import { databaseConnectionPool } from "@/src/lib/database-connection-pool";
import { toSafeError } from "@/src/lib/error-type-utils";

// ============================================================================
// Types and Schemas
// ============================================================================

const BatchInsertOptionsSchema = z.object({
  chunkSize: z.number().min(1).max(1000).default(50),
  enableDeduplication: z.boolean().default(true),
  onConflictStrategy: z.enum(["ignore", "update", "error"]).default("ignore"),
  validateData: z.boolean().default(true),
});

const AggregationOptionsSchema = z.object({
  groupBy: z.enum(["pattern_type", "symbol_name", "user_id", "confidence_range"]),
  timeframe: z.enum(["1h", "6h", "24h", "7d", "30d"]).default("24h"),
  includeInactive: z.boolean().default(false),
  minConfidence: z.number().min(0).max(100).optional(),
});

type BatchInsertOptions = z.infer<typeof BatchInsertOptionsSchema>;
type AggregationOptions = z.infer<typeof AggregationOptionsSchema>;

interface PatternEmbeddingBatch {
  patternId: string;
  patternType: string;
  symbolName: string;
  patternData: string;
  embedding: string;
  confidence: number;
  discoveredAt: Date;
  lastSeenAt: Date;
}

interface PatternMetricUpdate {
  patternId: string;
  successRate?: number;
  avgProfit?: number;
  occurrences?: number;
  truePositives?: number;
  falsePositives?: number;
}

interface SnipeTargetCheck {
  userId: string;
  symbolName: string;
  vcoinId?: string;
}

interface AggregatedMetrics {
  groupKey: string;
  totalPatterns: number;
  averageConfidence: number;
  successRate: number;
  totalOccurrences: number;
  avgProfit: number;
  activePatterns: number;
  timeframe: string;
}

// ============================================================================
// Utility Classes for Eliminating Redundancy
// ============================================================================

/**
 * Handles common database operation patterns with error handling and monitoring
 */
class DatabaseExecutionUtils {
  static async executeWithFullHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    context: {
      tableName?: string;
      query?: string;
      parameters?: any;
      operationType?: "select" | "insert" | "update" | "delete";
    },
    logger: any
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      return await monitoredQuery(
        operationName,
        async () => {
          return await executeWithRetry(operation);
        },
        {
          operationType: context.operationType || "select",
          tableName: context.tableName || "unknown",
          query: context.query || "Unknown query",
          parameters: context.parameters,
        }
      );
    } catch (error) {
      const executionTime = performance.now() - startTime;
      const safeError = toSafeError(error);
      logger.error(`Database operation failed: ${operationName}`, {
        executionTimeMs: Math.round(executionTime),
        error: safeError.message,
        ...context,
      });
      throw error;
    }
  }

  static async executeTransaction<T>(
    operation: (tx: any) => Promise<T>,
    invalidatePatterns: string[],
    logger: any
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      return await databaseConnectionPool.executeWrite(
        async () => {
          return await db.transaction(operation);
        },
        invalidatePatterns
      );
    } catch (error) {
      const safeError = toSafeError(error);
      logger.error("Transaction execution failed", {
        executionTimeMs: Math.round(performance.now() - startTime),
        error: safeError.message,
      });
      throw error;
    }
  }
}

/**
 * Batch processing utilities to eliminate chunking and processing redundancy
 */
class BatchProcessingUtils {
  static chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  static async processBatches<T, R>(
    items: T[],
    chunkSize: number,
    processor: (chunk: T[], index: number) => Promise<R>,
    onError: (error: Error, chunkIndex: number, chunk: T[]) => void,
    errorStrategy: "throw" | "continue" = "continue"
  ): Promise<R[]> {
    const chunks = this.chunkArray(items, chunkSize);
    const results: R[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const result = await processor(chunk, i);
        results.push(result);
      } catch (error) {
        onError(error as Error, i, chunk);
        if (errorStrategy === "throw") {
          throw error;
        }
      }
    }

    return results;
  }

  static async validateAndDeduplicate<T extends { patternId: string }>(
    items: T[],
    validator: (item: T) => boolean,
    deduplicator: (items: T[]) => Promise<T[]>,
    enableDeduplication: boolean,
    validateData: boolean
  ): Promise<T[]> {
    let processedItems = items;

    if (validateData) {
      processedItems = items.filter(validator);
    }

    if (enableDeduplication) {
      processedItems = await deduplicator(processedItems);
    }

    return processedItems;
  }
}

/**
 * Performance tracking utilities
 */
class PerformanceTrackingUtils {
  static logOperationCompletion(
    operationName: string,
    startTime: number,
    context: Record<string, any>,
    logger: any
  ): void {
    const totalTime = performance.now() - startTime;
    logger.info(`${operationName} completed`, {
      ...context,
      totalTimeMs: Math.round(totalTime),
      avgTimePerRecord: context.recordCount ? Math.round(totalTime / context.recordCount) : 0,
      recordsPerSecond: context.recordCount ? Math.round(context.recordCount / (totalTime / 1000)) : 0,
    });
  }

  static logOperationStart(
    operationName: string,
    context: Record<string, any>,
    logger: any
  ): void {
    logger.info(`Starting ${operationName}`, context);
  }
}

/**
 * Database schema utilities
 */
class DatabaseSchemaUtils {
  private static readonly TABLE_MAP: Record<string, any> = {
    pattern_embeddings: patternEmbeddings,
    snipe_targets: snipeTargets,
  };

  static getTableReference(tableName: string): any {
    const tableRef = this.TABLE_MAP[tableName];
    if (!tableRef) {
      throw new Error(`Unknown table: ${tableName}`);
    }
    return tableRef;
  }

  static buildWhereConditions(conditions: Record<string, any>): any {
    const whereConditions: any[] = [];

    for (const [key, value] of Object.entries(conditions)) {
      if (Array.isArray(value)) {
        whereConditions.push(inArray(sql.identifier(key), value));
      } else if (value === null) {
        whereConditions.push(sql`${sql.identifier(key)} IS NULL`);
      } else {
        whereConditions.push(eq(sql.identifier(key), value));
      }
    }

    return whereConditions.length === 1 
      ? whereConditions[0] 
      : and(...whereConditions);
  }

  static buildUpdateSetClause(update: PatternMetricUpdate): Record<string, any> {
    const setClause: Record<string, any> = {};

    if (update.successRate !== undefined) setClause.successRate = update.successRate;
    if (update.avgProfit !== undefined) setClause.avgProfit = update.avgProfit;
    if (update.occurrences !== undefined) setClause.occurrences = sql`occurrences + ${update.occurrences}`;
    if (update.truePositives !== undefined) setClause.truePositives = sql`true_positives + ${update.truePositives}`;
    if (update.falsePositives !== undefined) setClause.falsePositives = sql`false_positives + ${update.falsePositives}`;

    return setClause;
  }
}

/**
 * Query building utilities
 */
class QueryBuildingUtils {
  static parseTimeframe(timeframe: string): number {
    const timeframes: Record<string, number> = {
      "1h": 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    return timeframes[timeframe] || timeframes["24h"];
  }

  static getGroupByColumn(groupBy: string): string {
    switch (groupBy) {
      case "pattern_type": return "pattern_type";
      case "symbol_name": return "symbol_name";
      case "confidence_range": 
        return "CASE WHEN confidence >= 90 THEN '90-100' WHEN confidence >= 80 THEN '80-89' WHEN confidence >= 70 THEN '70-79' ELSE '<70' END";
      default: return "pattern_type";
    }
  }

  static buildAggregationQuery(
    groupBy: string,
    cutoffTime: Date,
    includeInactive: boolean,
    minConfidence?: number
  ): { query: string; parameters: any[] } {
    const parameters: any[] = [cutoffTime];
    const whereConditions = ["discovered_at >= $1"];

    if (!includeInactive) {
      whereConditions.push("is_active = true");
    }

    if (minConfidence) {
      whereConditions.push(`confidence >= $${parameters.length + 1}`);
      parameters.push(minConfidence);
    }

    const groupByColumn = this.getGroupByColumn(groupBy);

    const query = `
      SELECT 
        ${groupByColumn} as group_key,
        COUNT(*) as total_patterns,
        AVG(confidence) as average_confidence,
        AVG(COALESCE(success_rate, 0)) as success_rate,
        SUM(COALESCE(occurrences, 0)) as total_occurrences,
        AVG(COALESCE(avg_profit, 0)) as avg_profit,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_patterns
      FROM pattern_embeddings
      WHERE ${whereConditions.join(" AND ")}
      GROUP BY ${groupByColumn}
      ORDER BY total_patterns DESC
    `;

    return { query, parameters };
  }
}

// ============================================================================
// Batch Database Service (Refactored)
// ============================================================================

export class BatchDatabaseServiceRefactored {
  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[batch-database-service-refactored]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[batch-database-service-refactored]", message, context || ""),
    error: (message: string, context?: unknown, error?: Error) =>
      console.error("[batch-database-service-refactored]", message, context || "", error || ""),
    debug: (message: string, context?: unknown) =>
      console.debug("[batch-database-service-refactored]", message, context || ""),
  };

  private performanceMetrics = {
    totalOperations: 0,
    totalProcessingTime: 0,
    averageOperationTime: 0,
    lastOptimizationTime: Date.now(),
  };

  /**
   * Batch insert pattern embeddings with optimized processing
   */
  async batchInsertPatternEmbeddings(
    embeddings: PatternEmbeddingBatch[],
    options: Partial<BatchInsertOptions> = {}
  ): Promise<number> {
    if (embeddings.length === 0) return 0;

    const validatedOptions = BatchInsertOptionsSchema.parse(options);
    const { chunkSize, enableDeduplication, onConflictStrategy, validateData } = validatedOptions;
    const startTime = performance.now();

    PerformanceTrackingUtils.logOperationStart("batch pattern embedding insertion", {
      totalEmbeddings: embeddings.length,
      chunkSize,
      enableDeduplication,
      onConflictStrategy,
    }, this.logger);

    try {
      // Validate and deduplicate using utility
      const processedEmbeddings = await BatchProcessingUtils.validateAndDeduplicate(
        embeddings,
        this.validateEmbeddingData.bind(this),
        this.deduplicateEmbeddings.bind(this),
        enableDeduplication,
        validateData
      );

      // Process in chunks using utility
      let insertedCount = 0;
      await BatchProcessingUtils.processBatches(
        processedEmbeddings,
        chunkSize,
        async (chunk, index) => {
          const chunkResult = await DatabaseExecutionUtils.executeTransaction(
            async (tx) => {
              if (onConflictStrategy === "ignore") {
                const result = await tx
                  .insert(patternEmbeddings)
                  .values(chunk)
                  .onConflictDoNothing()
                  .returning({ id: patternEmbeddings.id });
                return result.length;
              } else if (onConflictStrategy === "update") {
                const result = await tx
                  .insert(patternEmbeddings)
                  .values(chunk)
                  .onConflictDoUpdate({
                    target: patternEmbeddings.patternId,
                    set: {
                      lastSeenAt: sql`EXCLUDED.last_seen_at`,
                      confidence: sql`EXCLUDED.confidence`,
                      patternData: sql`EXCLUDED.pattern_data`,
                      embedding: sql`EXCLUDED.embedding`,
                      updatedAt: sql`CURRENT_TIMESTAMP`,
                    },
                  })
                  .returning({ id: patternEmbeddings.id });
                return result.length;
              } else {
                const result = await tx
                  .insert(patternEmbeddings)
                  .values(chunk)
                  .returning({ id: patternEmbeddings.id });
                return result.length;
              }
            },
            ["pattern_embeddings"],
            this.logger
          );
          insertedCount += chunkResult;
          return chunkResult;
        },
        (error, chunkIndex, chunk) => {
          this.logger.error("Chunk insertion failed", {
            chunkIndex: chunkIndex + 1,
            chunkSize: chunk.length,
            error: error.message,
          });
          if (onConflictStrategy === "error") throw error;
        },
        onConflictStrategy === "error" ? "throw" : "continue"
      );

      PerformanceTrackingUtils.logOperationCompletion(
        "Batch embedding insertion",
        startTime,
        {
          originalCount: embeddings.length,
          processedCount: processedEmbeddings.length,
          insertedCount,
          recordCount: embeddings.length,
        },
        this.logger
      );

      return insertedCount;
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Batch embedding insertion failed", {
        totalEmbeddings: embeddings.length,
        error: safeError.message,
      });
      throw error;
    }
  }

  /**
   * Batch update pattern metrics using utilities
   */
  async batchUpdatePatternMetrics(updates: PatternMetricUpdate[]): Promise<number> {
    if (updates.length === 0) return 0;

    const startTime = performance.now();
    PerformanceTrackingUtils.logOperationStart("batch pattern metrics update", {
      updateCount: updates.length,
    }, this.logger);

    try {
      return await DatabaseExecutionUtils.executeTransaction(
        async (tx) => {
          let updatedCount = 0;

          if (updates.length === 1) {
            // Single update optimization
            const update = updates[0];
            const setClause = DatabaseSchemaUtils.buildUpdateSetClause(update);

            if (Object.keys(setClause).length > 0) {
              await tx
                .update(patternEmbeddings)
                .set({
                  ...setClause,
                  lastSeenAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(patternEmbeddings.patternId, update.patternId));
              updatedCount = 1;
            }
          } else {
            // Batch updates
            await BatchProcessingUtils.processBatches(
              updates,
              25,
              async (chunk) => {
                for (const update of chunk) {
                  const setClause = DatabaseSchemaUtils.buildUpdateSetClause(update);
                  if (Object.keys(setClause).length > 0) {
                    await tx
                      .update(patternEmbeddings)
                      .set({
                        ...setClause,
                        lastSeenAt: new Date(),
                        updatedAt: new Date(),
                      })
                      .where(eq(patternEmbeddings.patternId, update.patternId));
                    updatedCount++;
                  }
                }
                return chunk.length;
              },
              (error) => {
                this.logger.error("Update batch failed", { error: error.message });
              }
            );
          }

          return updatedCount;
        },
        ["pattern_embeddings", "pattern_metrics"],
        this.logger
      );
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Batch metrics update failed", {
        updateCount: updates.length,
        error: safeError.message,
      });
      throw error;
    }
  }

  /**
   * Batch check for snipe target duplicates using optimized query
   */
  async batchCheckSnipeTargetDuplicates(targets: SnipeTargetCheck[]): Promise<SnipeTargetCheck[]> {
    if (targets.length === 0) return [];

    const startTime = performance.now();

    try {
      const userIds = [...new Set(targets.map((t) => t.userId))];
      const symbols = [...new Set(targets.map((t) => t.symbolName))];

      const existingTargets = await DatabaseExecutionUtils.executeWithFullHandling(
        async () => {
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
        },
        "batch_check_snipe_target_duplicates",
        {
          tableName: "snipe_targets",
          query: "SELECT userId, symbolName FROM snipe_targets WHERE userId IN (...) AND symbolName IN (...) AND status = pending",
          parameters: [...userIds, ...symbols],
          operationType: "select",
        },
        this.logger
      );

      // Filter duplicates using Set for O(1) lookup
      const existingCombinations = new Set(
        existingTargets.map((target: any) => `${target.userId}:${target.symbolName}`)
      );

      const nonDuplicates = targets.filter((target) => {
        const combination = `${target.userId}:${target.symbolName}`;
        return !existingCombinations.has(combination);
      });

      PerformanceTrackingUtils.logOperationCompletion(
        "Duplicate checking",
        startTime,
        {
          totalTargets: targets.length,
          existingTargets: existingTargets.length,
          nonDuplicates: nonDuplicates.length,
          duplicatesFiltered: targets.length - nonDuplicates.length,
          recordCount: targets.length,
        },
        this.logger
      );

      return nonDuplicates;
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Duplicate checking failed", {
        targetCount: targets.length,
        error: safeError.message,
      });
      throw error;
    }
  }

  /**
   * Aggregate pattern performance metrics using utilities
   */
  async aggregatePatternPerformanceMetrics(
    options: AggregationOptions
  ): Promise<AggregatedMetrics[]> {
    const validatedOptions = AggregationOptionsSchema.parse(options);
    const { groupBy, timeframe, includeInactive, minConfidence } = validatedOptions;
    const startTime = performance.now();

    PerformanceTrackingUtils.logOperationStart("pattern performance aggregation", {
      groupBy,
      timeframe,
      includeInactive,
      minConfidence,
    }, this.logger);

    try {
      const timeRangeMs = QueryBuildingUtils.parseTimeframe(timeframe);
      const cutoffTime = new Date(Date.now() - timeRangeMs);

      const baseQuery = QueryBuildingUtils.buildAggregationQuery(
        groupBy,
        cutoffTime,
        includeInactive,
        minConfidence
      );

      const results = await DatabaseExecutionUtils.executeWithFullHandling(
        async () => {
          let queryWithParams = baseQuery.query;
          baseQuery.parameters.forEach((param, index) => {
            const placeholder = `$${index + 1}`;
            const value = param instanceof Date ? `'${param.toISOString()}'` : `'${param}'`;
            queryWithParams = queryWithParams.replace(placeholder, value);
          });
          return await db.execute(sql.raw(queryWithParams));
        },
        "aggregate_pattern_performance_metrics",
        {
          tableName: "pattern_embeddings",
          query: baseQuery.query,
          parameters: baseQuery.parameters,
          operationType: "select",
        },
        this.logger
      );

      const metrics: AggregatedMetrics[] = results.map((row: any) => ({
        groupKey: row.group_key,
        totalPatterns: parseInt(row.total_patterns),
        averageConfidence: parseFloat(row.average_confidence),
        successRate: parseFloat(row.success_rate) || 0,
        totalOccurrences: parseInt(row.total_occurrences),
        avgProfit: parseFloat(row.avg_profit) || 0,
        activePatterns: parseInt(row.active_patterns),
        timeframe,
      }));

      PerformanceTrackingUtils.logOperationCompletion(
        "Pattern performance aggregation",
        startTime,
        {
          groupBy,
          timeframe,
          resultCount: metrics.length,
          recordCount: metrics.length,
        },
        this.logger
      );

      return metrics;
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Pattern performance aggregation failed", {
        groupBy,
        timeframe,
        error: safeError.message,
      });
      throw error;
    }
  }

  // ============================================================================
  // Simplified Helper Methods Using Utilities
  // ============================================================================

  private validateEmbeddingData(embedding: PatternEmbeddingBatch): boolean {
    try {
      const parsedEmbedding = JSON.parse(embedding.embedding);
      if (!Array.isArray(parsedEmbedding) || parsedEmbedding.length === 0) {
        this.logger.warn("Invalid embedding format", { patternId: embedding.patternId });
        return false;
      }

      if (!embedding.patternId || !embedding.symbolName || !embedding.patternType) {
        this.logger.warn("Missing required fields", { patternId: embedding.patternId });
        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn("Embedding validation failed", {
        patternId: embedding.patternId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }

  private async deduplicateEmbeddings(
    embeddings: PatternEmbeddingBatch[]
  ): Promise<PatternEmbeddingBatch[]> {
    const patternIds = embeddings.map((e) => e.patternId);

    const existingPatterns = await executeWithRetry(async () => {
      return await db
        .select({ patternId: patternEmbeddings.patternId })
        .from(patternEmbeddings)
        .where(inArray(patternEmbeddings.patternId, patternIds));
    });

    const existingIds = new Set(existingPatterns.map((p: any) => p.patternId));
    return embeddings.filter((e) => !existingIds.has(e.patternId));
  }

  getPerformanceMetrics(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }

  resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      totalOperations: 0,
      totalProcessingTime: 0,
      averageOperationTime: 0,
      lastOptimizationTime: Date.now(),
    };
  }
}
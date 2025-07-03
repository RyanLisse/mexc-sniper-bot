/**
 * Batch Database Service
 *
 * Provides efficient batch operations for high-volume database tasks.
 * Optimizes database performance through intelligent batching strategies.
 *
 * Key Features:
 * - Batch insertions with optimal chunk sizes
 * - Batch updates using efficient SQL patterns
 * - Aggregate operations for analytics
 * - Duplicate checking with minimal queries
 * - Memory-efficient processing
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, executeWithRetry, monitoredQuery } from "@/src/db";
import { patternEmbeddings, snipeTargets } from "@/src/db/schema";
import { databaseConnectionPool } from "@/src/lib/database-connection-pool";
import { toSafeError } from "@/src/lib/error-type-utils";
import type { SnipeTargetRow } from "@/src/types/database-types";

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
  groupBy: z.enum([
    "pattern_type",
    "symbol_name",
    "user_id",
    "confidence_range",
  ]),
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
// Batch Database Service
// ============================================================================

export class BatchDatabaseService {
  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[batch-database-service]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[batch-database-service]", message, context || ""),
    error: (message: string, context?: unknown, error?: Error) =>
      console.error(
        "[batch-database-service]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: unknown) =>
      console.debug("[batch-database-service]", message, context || ""),
  };

  private performanceMetrics = {
    totalOperations: 0,
    totalProcessingTime: 0,
    averageOperationTime: 0,
    lastOptimizationTime: Date.now(),
  };

  /**
   * Batch insert pattern embeddings with real database transactions and optimization
   */
  async batchInsertPatternEmbeddings(
    embeddings: PatternEmbeddingBatch[],
    options: Partial<BatchInsertOptions> = {}
  ): Promise<number> {
    if (embeddings.length === 0) return 0;

    const validatedOptions = BatchInsertOptionsSchema.parse(options);
    const { chunkSize, enableDeduplication, onConflictStrategy, validateData } =
      validatedOptions;

    const startTime = performance.now();
    this.logger.info("Starting batch pattern embedding insertion", {
      totalEmbeddings: embeddings.length,
      chunkSize,
      enableDeduplication,
      onConflictStrategy,
    });

    try {
      let processedEmbeddings = embeddings;

      // Validate data if requested
      if (validateData) {
        processedEmbeddings = this.validateEmbeddingData(embeddings);
      }

      // Remove duplicates if requested
      if (enableDeduplication) {
        processedEmbeddings =
          await this.deduplicateEmbeddings(processedEmbeddings);
      }

      // Process in chunks with real database transactions for optimal performance
      let insertedCount = 0;
      const chunks = this.chunkArray(processedEmbeddings, chunkSize);

      // Use database transaction for better consistency and rollback capability
      const result = await db.transaction(async (tx: any) => {
        let totalInserted = 0;

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const chunkStartTime = performance.now();

          try {
            if (onConflictStrategy === "ignore") {
              // Use ON CONFLICT DO NOTHING for better performance
              await monitoredQuery(
                `batch_insert_embeddings_chunk_${i}`,
                async () => {
                  return await executeWithRetry(async () => {
                    const insertResult = await tx
                      .insert(patternEmbeddings)
                      .values(chunk)
                      .onConflictDoNothing()
                      .returning({ id: patternEmbeddings.id });
                    return insertResult.length;
                  });
                },
                {
                  operationType: "insert",
                  tableName: "pattern_embeddings",
                  query:
                    "INSERT INTO pattern_embeddings (...) VALUES (...) ON CONFLICT DO NOTHING",
                  parameters: chunk,
                }
              );
            } else if (onConflictStrategy === "update") {
              // Use UPSERT for updating existing records
              await monitoredQuery(
                `batch_upsert_embeddings_chunk_${i}`,
                async () => {
                  return await executeWithRetry(async () => {
                    const upsertResult = await tx
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
                    return upsertResult.length;
                  });
                },
                {
                  operationType: "insert",
                  tableName: "pattern_embeddings",
                  query:
                    "INSERT INTO pattern_embeddings (...) VALUES (...) ON CONFLICT DO UPDATE SET ...",
                  parameters: chunk,
                }
              );
            } else {
              // Regular insert that will fail on conflicts
              await monitoredQuery(
                `batch_insert_embeddings_chunk_${i}`,
                async () => {
                  return await executeWithRetry(async () => {
                    const insertResult = await tx
                      .insert(patternEmbeddings)
                      .values(chunk)
                      .returning({ id: patternEmbeddings.id });
                    return insertResult.length;
                  });
                },
                {
                  operationType: "insert",
                  tableName: "pattern_embeddings",
                  query: "INSERT INTO pattern_embeddings (...) VALUES (...)",
                  parameters: chunk,
                }
              );
            }

            totalInserted += chunk.length;
            const chunkTime = performance.now() - chunkStartTime;

            this.logger.debug("Chunk processed", {
              chunkIndex: i + 1,
              chunkSize: chunk.length,
              chunkTimeMs: Math.round(chunkTime),
              totalInserted,
            });
          } catch (error) {
            const safeError = toSafeError(error);
            this.logger.error("Chunk insertion failed", {
              chunkIndex: i + 1,
              chunkSize: chunk.length,
              error: safeError.message,
            });

            if (onConflictStrategy === "error") {
              throw error; // Will rollback the entire transaction
            }
            // Continue with next chunk for other strategies
          }
        }

        return totalInserted;
      });

      insertedCount = result;

      const totalTime = performance.now() - startTime;
      this.logger.info("Batch embedding insertion completed", {
        originalCount: embeddings.length,
        processedCount: processedEmbeddings.length,
        insertedCount,
        totalTimeMs: Math.round(totalTime),
        avgTimePerRecord: Math.round(totalTime / embeddings.length),
        recordsPerSecond: Math.round(embeddings.length / (totalTime / 1000)),
      });

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
   * Batch update pattern metrics with real database transactions
   */
  async batchUpdatePatternMetrics(
    updates: PatternMetricUpdate[]
  ): Promise<number> {
    if (updates.length === 0) return 0;

    const _startTime = performance.now();
    this.logger.info("Starting batch pattern metrics update", {
      updateCount: updates.length,
    });

    try {
      // Use database transaction for consistent updates
      return await databaseConnectionPool.executeWrite(async () => {
        return await db.transaction(async (tx: any) => {
          let updatedCount = 0;

          if (updates.length === 1) {
            // Single update - use direct query
            const update = updates[0];
            const setClause = this.buildUpdateSetClause(update);

            if (Object.keys(setClause).length > 0) {
              const result = await monitoredQuery(
                "single_pattern_metric_update",
                async () => {
                  return await executeWithRetry(async () => {
                    return await tx
                      .update(patternEmbeddings)
                      .set({
                        ...setClause,
                        lastSeenAt: new Date(),
                        updatedAt: new Date(),
                      })
                      .where(eq(patternEmbeddings.patternId, update.patternId));
                  });
                },
                {
                  operationType: "update",
                  tableName: "pattern_embeddings",
                  query:
                    "UPDATE pattern_embeddings SET ... WHERE pattern_id = ?",
                  parameters: [update.patternId],
                }
              );
              updatedCount = (result as any).rowsAffected || 1;
            }
          } else {
            // Multiple updates - use efficient batch approach within transaction
            const updateQueries = updates
              .map((update) => {
                const setClause = this.buildUpdateSetClause(update);
                return {
                  patternId: update.patternId,
                  updateFields: setClause,
                };
              })
              .filter((item) => Object.keys(item.updateFields).length > 0);

            // Process updates in batches to avoid query size limits
            const batchSize = 25;
            const batches = this.chunkArray(updateQueries, batchSize);

            for (const batch of batches) {
              // Use individual updates within transaction for better reliability
              for (const item of batch) {
                if (Object.keys(item.updateFields).length > 0) {
                  await monitoredQuery(
                    "batch_pattern_metric_update_item",
                    async () => {
                      return await executeWithRetry(async () => {
                        const result = await tx
                          .update(patternEmbeddings)
                          .set({
                            ...item.updateFields,
                            lastSeenAt: new Date(),
                            updatedAt: new Date(),
                          })
                          .where(
                            eq(patternEmbeddings.patternId, item.patternId)
                          );
                        return result;
                      });
                    },
                    {
                      operationType: "update",
                      tableName: "pattern_embeddings",
                      query:
                        "UPDATE pattern_embeddings SET ... WHERE pattern_id = ?",
                      parameters: [item.patternId],
                    }
                  );
                  updatedCount++;
                }
              }
            }
          }

          return updatedCount;
        });
      }, ["pattern_embeddings", "pattern_metrics"]);
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
   * Batch check for snipe target duplicates
   */
  async batchCheckSnipeTargetDuplicates(
    targets: SnipeTargetCheck[]
  ): Promise<SnipeTargetCheck[]> {
    if (targets.length === 0) return [];

    const startTime = performance.now();

    try {
      const userIds = [...new Set(targets.map((t) => t.userId))];
      const symbols = [...new Set(targets.map((t) => t.symbolName))];

      // Single query to find existing targets
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
          query:
            "SELECT userId, symbolName FROM snipe_targets WHERE userId IN (...) AND symbolName IN (...) AND status = pending",
          parameters: [...userIds, ...symbols],
        }
      );

      // Create lookup set for O(1) duplicate checking
      const existingCombinations = new Set(
        existingTargets.map(
          (target: SnipeTargetRow) => `${target.userId}:${target.symbolName}`
        )
      );

      // Filter out duplicates
      const nonDuplicates = targets.filter((target) => {
        const combination = `${target.userId}:${target.symbolName}`;
        return !existingCombinations.has(combination);
      });

      const checkTime = performance.now() - startTime;
      this.logger.debug("Duplicate checking completed", {
        totalTargets: targets.length,
        existingTargets: existingTargets.length,
        nonDuplicates: nonDuplicates.length,
        duplicatesFiltered: targets.length - nonDuplicates.length,
        checkTimeMs: Math.round(checkTime),
      });

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
   * Aggregate pattern performance metrics
   */
  async aggregatePatternPerformanceMetrics(
    options: AggregationOptions
  ): Promise<AggregatedMetrics[]> {
    const validatedOptions = AggregationOptionsSchema.parse(options);
    const { groupBy, timeframe, includeInactive, minConfidence } =
      validatedOptions;

    const startTime = performance.now();
    this.logger.info("Starting pattern performance aggregation", {
      groupBy,
      timeframe,
      includeInactive,
      minConfidence,
    });

    try {
      // Build time range condition
      const timeRangeMs = this.parseTimeframe(timeframe);
      const cutoffTime = new Date(Date.now() - timeRangeMs);

      // Build aggregation query
      const baseQuery = this.buildAggregationQuery(
        groupBy,
        cutoffTime,
        includeInactive,
        minConfidence
      );

      const results = await monitoredQuery(
        "aggregate_pattern_performance_metrics",
        async () => {
          return await executeWithRetry(async () => {
            // Replace PostgreSQL-style placeholders with actual values
            let queryWithParams = baseQuery.query;
            baseQuery.parameters.forEach((param, index) => {
              const placeholder = `$${index + 1}`;
              const value =
                param instanceof Date
                  ? `'${param.toISOString()}'`
                  : `'${param}'`;
              queryWithParams = queryWithParams.replace(placeholder, value);
            });
            return await db.execute(sql.raw(queryWithParams));
          });
        },
        {
          operationType: "select",
          tableName: "pattern_embeddings",
          query: baseQuery.query,
          parameters: baseQuery.parameters,
        }
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

      const aggregationTime = performance.now() - startTime;
      this.logger.info("Pattern performance aggregation completed", {
        groupBy,
        timeframe,
        resultCount: metrics.length,
        aggregationTimeMs: Math.round(aggregationTime),
      });

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

  /**
   * Helper: Validate embedding data
   */
  private validateEmbeddingData(
    embeddings: PatternEmbeddingBatch[]
  ): PatternEmbeddingBatch[] {
    return embeddings.filter((embedding) => {
      try {
        // Validate embedding JSON
        const parsedEmbedding = JSON.parse(embedding.embedding);
        if (!Array.isArray(parsedEmbedding) || parsedEmbedding.length === 0) {
          this.logger.warn("Invalid embedding format", {
            patternId: embedding.patternId,
          });
          return false;
        }

        // Validate required fields
        if (
          !embedding.patternId ||
          !embedding.symbolName ||
          !embedding.patternType
        ) {
          this.logger.warn("Missing required fields", {
            patternId: embedding.patternId,
          });
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
    });
  }

  /**
   * Helper: Remove duplicate embeddings
   */
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

  /**
   * Helper: Build update set clause for pattern metrics
   */
  private buildUpdateSetClause(
    update: PatternMetricUpdate
  ): Record<string, any> {
    const setClause: Record<string, any> = {};

    if (update.successRate !== undefined) {
      setClause.successRate = update.successRate;
    }

    if (update.avgProfit !== undefined) {
      setClause.avgProfit = update.avgProfit;
    }

    if (update.occurrences !== undefined) {
      setClause.occurrences = sql`occurrences + ${update.occurrences}`;
    }

    if (update.truePositives !== undefined) {
      setClause.truePositives = sql`true_positives + ${update.truePositives}`;
    }

    if (update.falsePositives !== undefined) {
      setClause.falsePositives = sql`false_positives + ${update.falsePositives}`;
    }

    return setClause;
  }

  /**
   * Helper: Build batch update CASE statements
   */
  private buildBatchUpdateCaseStatements(
    batch: { patternId: string; updateFields: Record<string, any> }[]
  ): string[] {
    const fields = [
      "success_rate",
      "avg_profit",
      "occurrences",
      "true_positives",
      "false_positives",
    ];
    const caseStatements: string[] = [];

    for (const field of fields) {
      const updates = batch.filter((b) => b.updateFields[field] !== undefined);
      if (updates.length > 0) {
        const cases = updates
          .map(
            (u) =>
              `WHEN pattern_id = '${u.patternId}' THEN ${this.formatUpdateValue(u.updateFields[field])}`
          )
          .join(" ");

        caseStatements.push(`${field} = CASE ${cases} ELSE ${field} END`);
      }
    }

    return caseStatements;
  }

  /**
   * Helper: Format update value for SQL
   */
  private formatUpdateValue(value: any): string {
    if (typeof value === "number") {
      return value.toString();
    }
    if (typeof value === "string") {
      return `'${value.replace(/'/g, "''")}'`;
    }
    if (value && typeof value === "object" && "sql" in value) {
      // Handle Drizzle SQL fragments
      return value.toString();
    }
    return "NULL";
  }

  /**
   * Helper: Build aggregation query based on groupBy option
   */
  private buildAggregationQuery(
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

  /**
   * Helper: Get GROUP BY column based on option
   */
  private getGroupByColumn(groupBy: string): string {
    switch (groupBy) {
      case "pattern_type":
        return "pattern_type";
      case "symbol_name":
        return "symbol_name";
      case "confidence_range":
        return "CASE WHEN confidence >= 90 THEN '90-100' WHEN confidence >= 80 THEN '80-89' WHEN confidence >= 70 THEN '70-79' ELSE '<70' END";
      default:
        return "pattern_type";
    }
  }

  /**
   * Helper: Parse timeframe to milliseconds
   */
  private parseTimeframe(timeframe: string): number {
    const timeframes: Record<string, number> = {
      "1h": 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };

    return timeframes[timeframe] || timeframes["24h"];
  }

  /**
   * Helper: Chunk array into smaller pieces
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // ============================================================================
  // Advanced Batch Operations with Real Database Transactions
  // ============================================================================

  /**
   * Generic batch insert with proper transaction handling
   */
  async batchInsert<T extends Record<string, any>>(
    tableName: string,
    records: T[],
    options: Partial<BatchInsertOptions> = {}
  ): Promise<number> {
    if (records.length === 0) return 0;

    const validatedOptions = BatchInsertOptionsSchema.parse(options);
    const { chunkSize, onConflictStrategy } = validatedOptions;

    const _startTime = performance.now();
    this.logger.info("Starting generic batch insert", {
      tableName,
      recordCount: records.length,
      chunkSize,
      onConflictStrategy,
    });

    try {
      return await databaseConnectionPool.executeWrite(async () => {
        return await db.transaction(async (tx: any) => {
          let insertedCount = 0;
          const chunks = this.chunkArray(records, chunkSize);

          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            try {
              const insertResult = await monitoredQuery(
                `batch_insert_${tableName}_chunk_${i}`,
                async () => {
                  return await executeWithRetry(async () => {
                    // Dynamic table access based on tableName
                    const tableRef = this.getTableReference(tableName);

                    if (onConflictStrategy === "ignore") {
                      return await tx
                        .insert(tableRef)
                        .values(chunk)
                        .onConflictDoNothing()
                        .returning({ id: sql`id` });
                    } else if (onConflictStrategy === "update") {
                      // Note: This would need table-specific conflict resolution
                      return await tx
                        .insert(tableRef)
                        .values(chunk)
                        .returning({ id: sql`id` });
                    } else {
                      return await tx
                        .insert(tableRef)
                        .values(chunk)
                        .returning({ id: sql`id` });
                    }
                  });
                },
                {
                  operationType: "insert",
                  tableName,
                  query: `INSERT INTO ${tableName} (...) VALUES (...)`,
                  parameters: chunk,
                }
              );

              insertedCount += (insertResult as any[]).length;
            } catch (error) {
              if (onConflictStrategy === "error") {
                throw error;
              }
              this.logger.warn(`Chunk ${i + 1} insertion failed, continuing`, {
                tableName,
                chunkSize: chunk.length,
                error: error instanceof Error ? error.message : "Unknown error",
              });
            }
          }

          return insertedCount;
        });
      }, [tableName]);
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Generic batch insert failed", {
        tableName,
        recordCount: records.length,
        error: safeError.message,
      });
      throw error;
    }
  }

  /**
   * Bulk update with optimized queries
   */
  async bulkUpdate<T extends Record<string, any>>(
    tableName: string,
    updates: Array<{ where: Record<string, any>; set: T }>,
    options: { batchSize?: number } = {}
  ): Promise<number> {
    if (updates.length === 0) return 0;

    const batchSize = options.batchSize || 25;
    const _startTime = performance.now();

    this.logger.info("Starting bulk update", {
      tableName,
      updateCount: updates.length,
      batchSize,
    });

    try {
      return await databaseConnectionPool.executeWrite(async () => {
        return await db.transaction(async (tx: any) => {
          let updatedCount = 0;
          const batches = this.chunkArray(updates, batchSize);

          for (const batch of batches) {
            for (const update of batch) {
              const tableRef = this.getTableReference(tableName);
              const whereConditions = this.buildWhereConditions(update.where);

              const result = await monitoredQuery(
                `bulk_update_${tableName}`,
                async () => {
                  return await executeWithRetry(async () => {
                    return await tx
                      .update(tableRef)
                      .set({
                        ...update.set,
                        updatedAt: new Date(),
                      })
                      .where(whereConditions);
                  });
                },
                {
                  operationType: "update",
                  tableName,
                  query: `UPDATE ${tableName} SET ... WHERE ...`,
                  parameters: [update.where],
                }
              );

              updatedCount += (result as any).rowsAffected || 1;
            }
          }

          return updatedCount;
        });
      }, [tableName]);
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Bulk update failed", {
        tableName,
        updateCount: updates.length,
        error: safeError.message,
      });
      throw error;
    }
  }

  /**
   * Optimized bulk select with connection pooling and caching
   */
  async bulkSelect<T>(
    tableName: string,
    conditions: Record<string, any>[],
    options: {
      select?: string[];
      orderBy?: string;
      limit?: number;
      cacheKey?: string;
      cacheTTL?: number;
    } = {}
  ): Promise<T[]> {
    if (conditions.length === 0) return [];

    const cacheKey =
      options.cacheKey ||
      `bulk_select_${tableName}_${JSON.stringify(conditions).slice(0, 50)}`;
    const cacheTTL = options.cacheTTL || 60000; // 1 minute default

    return await databaseConnectionPool.executeSelect(
      async () => {
        return await monitoredQuery(
          `bulk_select_${tableName}`,
          async () => {
            return await executeWithRetry(async () => {
              const tableRef = this.getTableReference(tableName);
              let query = db.select().from(tableRef);

              // Build OR conditions for multiple where clauses
              if (conditions.length > 0) {
                const orConditions = conditions.map((condition) =>
                  this.buildWhereConditions(condition)
                );
                query = query.where(sql`${sql.join(orConditions, sql` OR `)}`);
              }

              if (options.limit) {
                query = query.limit(options.limit);
              }

              return await query;
            });
          },
          {
            operationType: "select",
            tableName,
            query: `SELECT * FROM ${tableName} WHERE ...`,
            parameters: conditions,
          }
        );
      },
      cacheKey,
      cacheTTL
    );
  }

  /**
   * Transaction wrapper for complex operations
   */
  async executeTransaction<T>(
    operations: (tx: any) => Promise<T>,
    invalidatePatterns: string[] = []
  ): Promise<T> {
    const startTime = performance.now();

    try {
      return await databaseConnectionPool.executeWrite(async () => {
        return await db.transaction(operations);
      }, invalidatePatterns);
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Transaction execution failed", {
        executionTimeMs: Math.round(performance.now() - startTime),
        error: safeError.message,
      });
      throw error;
    }
  }

  /**
   * Batch delete with transaction support
   */
  async batchDelete(
    tableName: string,
    conditions: Record<string, any>[],
    options: { batchSize?: number } = {}
  ): Promise<number> {
    if (conditions.length === 0) return 0;

    const batchSize = options.batchSize || 50;
    const _startTime = performance.now();

    this.logger.info("Starting batch delete", {
      tableName,
      conditionCount: conditions.length,
      batchSize,
    });

    try {
      return await databaseConnectionPool.executeWrite(async () => {
        return await db.transaction(async (tx: any) => {
          let deletedCount = 0;
          const batches = this.chunkArray(conditions, batchSize);

          for (const batch of batches) {
            for (const condition of batch) {
              const tableRef = this.getTableReference(tableName);
              const whereConditions = this.buildWhereConditions(condition);

              const result = await monitoredQuery(
                `batch_delete_${tableName}`,
                async () => {
                  return await executeWithRetry(async () => {
                    return await tx.delete(tableRef).where(whereConditions);
                  });
                },
                {
                  operationType: "delete",
                  tableName,
                  query: `DELETE FROM ${tableName} WHERE ...`,
                  parameters: [condition],
                }
              );

              deletedCount += (result as any).rowsAffected || 1;
            }
          }

          return deletedCount;
        });
      }, [tableName]);
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Batch delete failed", {
        tableName,
        conditionCount: conditions.length,
        error: safeError.message,
      });
      throw error;
    }
  }

  // ============================================================================
  // Database Utility Methods
  // ============================================================================

  /**
   * Get table reference by name (for dynamic queries)
   */
  private getTableReference(tableName: string): any {
    const tableMap: Record<string, any> = {
      pattern_embeddings: patternEmbeddings,
      snipe_targets: snipeTargets,
      // Add more tables as needed
    };

    const tableRef = tableMap[tableName];
    if (!tableRef) {
      throw new Error(`Unknown table: ${tableName}`);
    }

    return tableRef;
  }

  /**
   * Build WHERE conditions from object
   */
  private buildWhereConditions(conditions: Record<string, any>): any {
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

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    this.performanceMetrics.totalOperations++;
    this.performanceMetrics.averageOperationTime =
      this.performanceMetrics.totalProcessingTime /
      this.performanceMetrics.totalOperations;

    // Auto-optimize based on performance
    if (this.performanceMetrics.totalOperations % 100 === 0) {
      this.optimizeBasedOnMetrics();
    }
  }

  /**
   * Optimize batch operations based on performance metrics
   */
  private optimizeBasedOnMetrics(): void {
    const avgTime = this.performanceMetrics.averageOperationTime;

    if (avgTime > 5000) {
      // 5 seconds average
      this.logger.warn(
        "Performance degradation detected, considering optimizations",
        {
          averageOperationTime: avgTime,
          totalOperations: this.performanceMetrics.totalOperations,
        }
      );
    }

    // Update optimization timestamp
    this.performanceMetrics.lastOptimizationTime = Date.now();
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Reset performance metrics
   */
  resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      totalOperations: 0,
      totalProcessingTime: 0,
      averageOperationTime: 0,
      lastOptimizationTime: Date.now(),
    };
  }
}

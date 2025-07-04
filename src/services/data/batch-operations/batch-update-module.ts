/**
 * Batch Update Module
 *
 * Handles all batch update operations with transaction support and optimization.
 * Extracted from batch-database-service.ts for better modularity.
 */

import { eq, sql } from "drizzle-orm";
import { db, executeWithRetry, monitoredQuery } from "@/src/db";
import { patternEmbeddings } from "@/src/db/schema";
import { databaseConnectionPool } from "@/src/lib/database-connection-pool";
import { toSafeError } from "@/src/lib/error-type-utils";

interface PatternMetricUpdate {
  patternId: string;
  successRate?: number;
  avgProfit?: number;
  occurrences?: number;
  truePositives?: number;
  falsePositives?: number;
}

export class BatchUpdateModule {
  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[batch-update-module]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[batch-update-module]", message, context || ""),
    error: (message: string, context?: unknown, error?: Error) =>
      console.error(
        "[batch-update-module]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: unknown) =>
      console.debug("[batch-update-module]", message, context || ""),
  };

  /**
   * Batch update pattern metrics with real database transactions
   */
  async batchUpdatePatternMetrics(
    updates: PatternMetricUpdate[]
  ): Promise<number> {
    if (updates.length === 0) return 0;

    const startTime = performance.now();
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
   * Bulk update with optimized queries
   */
  async bulkUpdate<T extends Record<string, any>>(
    tableName: string,
    updates: Array<{ where: Record<string, any>; set: T }>,
    options: { batchSize?: number } = {}
  ): Promise<number> {
    if (updates.length === 0) return 0;

    const batchSize = options.batchSize || 25;
    const startTime = performance.now();

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
   * Batch delete with transaction support
   */
  async batchDelete(
    tableName: string,
    conditions: Record<string, any>[],
    options: { batchSize?: number } = {}
  ): Promise<number> {
    if (conditions.length === 0) return 0;

    const batchSize = options.batchSize || 50;
    const startTime = performance.now();

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

  // Helper methods
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

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private getTableReference(tableName: string): any {
    const tableMap: Record<string, any> = {
      pattern_embeddings: patternEmbeddings,
      // Add more tables as needed
    };

    const tableRef = tableMap[tableName];
    if (!tableRef) {
      throw new Error(`Unknown table: ${tableName}`);
    }

    return tableRef;
  }

  private buildWhereConditions(conditions: Record<string, any>): any {
    const whereConditions: any[] = [];

    for (const [key, value] of Object.entries(conditions)) {
      if (Array.isArray(value)) {
        whereConditions.push(sql`${sql.identifier(key)} = ANY(${value})`);
      } else if (value === null) {
        whereConditions.push(sql`${sql.identifier(key)} IS NULL`);
      } else {
        whereConditions.push(eq(sql.identifier(key), value));
      }
    }

    return whereConditions.length === 1
      ? whereConditions[0]
      : sql`${sql.join(whereConditions, sql` AND `)}`;
  }
}

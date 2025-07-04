/**
 * Batch Insert Module
 *
 * Handles all batch insertion operations with transaction support and optimization.
 * Extracted from batch-database-service.ts for better modularity.
 */

import { sql } from "drizzle-orm";
import { z } from "zod";
import { db, executeWithRetry, monitoredQuery } from "@/src/db";
import { patternEmbeddings } from "@/src/db/schema";
import { databaseConnectionPool } from "@/src/lib/database-connection-pool";
import { toSafeError } from "@/src/lib/error-type-utils";

const BatchInsertOptionsSchema = z.object({
  chunkSize: z.number().min(1).max(1000).default(50),
  enableDeduplication: z.boolean().default(true),
  onConflictStrategy: z.enum(["ignore", "update", "error"]).default("ignore"),
  validateData: z.boolean().default(true),
});

type BatchInsertOptions = z.infer<typeof BatchInsertOptionsSchema>;

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

export class BatchInsertModule {
  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[batch-insert-module]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[batch-insert-module]", message, context || ""),
    error: (message: string, context?: unknown, error?: Error) =>
      console.error(
        "[batch-insert-module]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: unknown) =>
      console.debug("[batch-insert-module]", message, context || ""),
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

    const startTime = performance.now();
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

  // Helper methods
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

  private async deduplicateEmbeddings(
    embeddings: PatternEmbeddingBatch[]
  ): Promise<PatternEmbeddingBatch[]> {
    const patternIds = embeddings.map((e) => e.patternId);

    const existingPatterns = await executeWithRetry(async () => {
      return await db
        .select({ patternId: patternEmbeddings.patternId })
        .from(patternEmbeddings)
        .where(
          sql`pattern_id IN (${sql.join(
            patternIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        );
    });

    const existingIds = new Set(existingPatterns.map((p: any) => p.patternId));
    return embeddings.filter((e) => !existingIds.has(e.patternId));
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
}

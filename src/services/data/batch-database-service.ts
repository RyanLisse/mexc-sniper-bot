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

import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, executeWithRetry, monitoredQuery } from '../db';
import { patternEmbeddings, snipeTargets, userPreferences } from '../db/schema';
import { toSafeError } from '../lib/error-type-utils';

// ============================================================================
// Types and Schemas
// ============================================================================

const BatchInsertOptionsSchema = z.object({
  chunkSize: z.number().min(1).max(1000).default(50),
  enableDeduplication: z.boolean().default(true),
  onConflictStrategy: z.enum(['ignore', 'update', 'error']).default('ignore'),
  validateData: z.boolean().default(true),
});

const AggregationOptionsSchema = z.object({
  groupBy: z.enum(['pattern_type', 'symbol_name', 'user_id', 'confidence_range']),
  timeframe: z.enum(['1h', '6h', '24h', '7d', '30d']).default('24h'),
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
    info: (message: string, context?: any) =>
      console.info('[batch-database-service]', message, context || ''),
    warn: (message: string, context?: any) =>
      console.warn('[batch-database-service]', message, context || ''),
    error: (message: string, context?: any, error?: Error) =>
      console.error('[batch-database-service]', message, context || '', error || ''),
    debug: (message: string, context?: any) =>
      console.debug('[batch-database-service]', message, context || ''),
  };

  /**
   * Batch insert pattern embeddings with optimization
   */
  async batchInsertPatternEmbeddings(
    embeddings: PatternEmbeddingBatch[],
    options: BatchInsertOptions = {}
  ): Promise<number> {
    if (embeddings.length === 0) return 0;

    const validatedOptions = BatchInsertOptionsSchema.parse(options);
    const { chunkSize, enableDeduplication, onConflictStrategy, validateData } = validatedOptions;

    const startTime = performance.now();
    this.logger.info('Starting batch pattern embedding insertion', {
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
        processedEmbeddings = await this.deduplicateEmbeddings(processedEmbeddings);
      }

      // Process in chunks for optimal performance
      let insertedCount = 0;
      const chunks = this.chunkArray(processedEmbeddings, chunkSize);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkStartTime = performance.now();

        try {
          if (onConflictStrategy === 'ignore') {
            // Use ON CONFLICT DO NOTHING for better performance
            await monitoredQuery(
              `batch_insert_embeddings_chunk_${i}`,
              async () => {
                return await executeWithRetry(async () => {
                  try {
                    await db
                      .insert(patternEmbeddings)
                      .values(chunk);
                    return chunk.length;
                  } catch (error: any) {
                    // Ignore conflict errors (duplicate key violations)
                    if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
                      return chunk.length; // Treat as successful
                    }
                    throw error; // Re-throw other errors
                  }
                });
              },
              {
                operationType: 'insert',
                tableName: 'pattern_embeddings',
                query: 'INSERT INTO pattern_embeddings (...) VALUES (...) ON CONFLICT DO NOTHING',
                parameters: chunk,
              }
            );
          } else if (onConflictStrategy === 'update') {
            // Use UPSERT for updating existing records
            await monitoredQuery(
              `batch_upsert_embeddings_chunk_${i}`,
              async () => {
                return await executeWithRetry(async () => {
                  await db
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
                    });
                  return chunk.length;
                });
              },
              {
                operationType: 'insert',
                tableName: 'pattern_embeddings',
                query: 'INSERT INTO pattern_embeddings (...) VALUES (...) ON CONFLICT DO UPDATE SET ...',
                parameters: chunk,
              }
            );
          } else {
            // Regular insert that will fail on conflicts
            await monitoredQuery(
              `batch_insert_embeddings_chunk_${i}`,
              async () => {
                return await executeWithRetry(async () => {
                  await db.insert(patternEmbeddings).values(chunk);
                  return chunk.length;
                });
              },
              {
                operationType: 'insert',
                tableName: 'pattern_embeddings',
                query: 'INSERT INTO pattern_embeddings (...) VALUES (...)',
                parameters: chunk,
              }
            );
          }

          insertedCount += chunk.length;
          const chunkTime = performance.now() - chunkStartTime;

          this.logger.debug('Chunk processed', {
            chunkIndex: i + 1,
            chunkSize: chunk.length,
            chunkTimeMs: Math.round(chunkTime),
            totalInserted: insertedCount,
          });

        } catch (error) {
          const safeError = toSafeError(error);
          this.logger.error('Chunk insertion failed', {
            chunkIndex: i + 1,
            chunkSize: chunk.length,
            error: safeError.message,
          });

          if (onConflictStrategy === 'error') {
            throw error;
          }
          // Continue with next chunk for other strategies
        }
      }

      const totalTime = performance.now() - startTime;
      this.logger.info('Batch embedding insertion completed', {
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
      this.logger.error('Batch embedding insertion failed', {
        totalEmbeddings: embeddings.length,
        error: safeError.message,
      });
      throw error;
    }
  }

  /**
   * Batch update pattern metrics efficiently
   */
  async batchUpdatePatternMetrics(updates: PatternMetricUpdate[]): Promise<number> {
    if (updates.length === 0) return 0;

    const startTime = performance.now();
    this.logger.info('Starting batch pattern metrics update', {
      updateCount: updates.length,
    });

    try {
      let updatedCount = 0;

      // Use a single UPDATE query with a VALUES clause for efficiency
      if (updates.length === 1) {
        // Single update - use direct query
        const update = updates[0];
        const setClause = this.buildUpdateSetClause(update);
        
        if (setClause.length > 0) {
          const result = await monitoredQuery(
            'single_pattern_metric_update',
            async () => {
              return await executeWithRetry(async () => {
                return await db
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
              operationType: 'update',
              tableName: 'pattern_embeddings',
              query: 'UPDATE pattern_embeddings SET ... WHERE pattern_id = ?',
              parameters: [update.patternId],
            }
          );
          updatedCount = (result as any).rowsAffected || 1;
        }
      } else {
        // Multiple updates - use efficient batch approach
        // Create a temporary table approach for complex batch updates
        const updateQueries = updates.map(update => {
          const setClause = this.buildUpdateSetClause(update);
          return {
            patternId: update.patternId,
            updateFields: setClause,
          };
        }).filter(item => Object.keys(item.updateFields).length > 0);

        // Process updates in batches to avoid query size limits
        const batchSize = 25;
        const batches = this.chunkArray(updateQueries, batchSize);

        for (const batch of batches) {
          // Build a single query that updates multiple records
          const caseStatements = this.buildBatchUpdateCaseStatements(batch);
          
          if (caseStatements.length > 0) {
            const patternIds = batch.map(b => b.patternId);
            
            const updateQuery = `
              UPDATE pattern_embeddings 
              SET 
                ${caseStatements.join(', ')},
                last_seen_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
              WHERE pattern_id = ANY($1)
            `;

            const result = await monitoredQuery(
              'batch_pattern_metrics_update',
              async () => {
                return await executeWithRetry(async () => {
                  return await db.execute(sql.raw(updateQuery, [patternIds]));
                });
              },
              {
                operationType: 'update',
                tableName: 'pattern_embeddings',
                query: updateQuery,
                parameters: [patternIds],
              }
            );

            updatedCount += (result as any).rowsAffected || batch.length;
          }
        }
      }

      const totalTime = performance.now() - startTime;
      this.logger.info('Batch metrics update completed', {
        updateCount: updates.length,
        updatedCount,
        totalTimeMs: Math.round(totalTime),
        avgTimePerUpdate: Math.round(totalTime / updates.length),
      });

      return updatedCount;

    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error('Batch metrics update failed', {
        updateCount: updates.length,
        error: safeError.message,
      });
      throw error;
    }
  }

  /**
   * Batch check for snipe target duplicates
   */
  async batchCheckSnipeTargetDuplicates(targets: SnipeTargetCheck[]): Promise<SnipeTargetCheck[]> {
    if (targets.length === 0) return [];

    const startTime = performance.now();

    try {
      const userIds = [...new Set(targets.map(t => t.userId))];
      const symbols = [...new Set(targets.map(t => t.symbolName))];

      // Single query to find existing targets
      const existingTargets = await monitoredQuery(
        'batch_check_snipe_target_duplicates',
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
                  eq(snipeTargets.status, 'pending')
                )
              );
          });
        },
        {
          operationType: 'select',
          tableName: 'snipe_targets',
          query: 'SELECT userId, symbolName FROM snipe_targets WHERE userId IN (...) AND symbolName IN (...) AND status = pending',
          parameters: [...userIds, ...symbols],
        }
      );

      // Create lookup set for O(1) duplicate checking
      const existingCombinations = new Set(
        existingTargets.map(target => `${target.userId}:${target.symbolName}`)
      );

      // Filter out duplicates
      const nonDuplicates = targets.filter(target => {
        const combination = `${target.userId}:${target.symbolName}`;
        return !existingCombinations.has(combination);
      });

      const checkTime = performance.now() - startTime;
      this.logger.debug('Duplicate checking completed', {
        totalTargets: targets.length,
        existingTargets: existingTargets.length,
        nonDuplicates: nonDuplicates.length,
        duplicatesFiltered: targets.length - nonDuplicates.length,
        checkTimeMs: Math.round(checkTime),
      });

      return nonDuplicates;

    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error('Duplicate checking failed', {
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
    const { groupBy, timeframe, includeInactive, minConfidence } = validatedOptions;

    const startTime = performance.now();
    this.logger.info('Starting pattern performance aggregation', {
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
      const baseQuery = this.buildAggregationQuery(groupBy, cutoffTime, includeInactive, minConfidence);

      const results = await monitoredQuery(
        'aggregate_pattern_performance_metrics',
        async () => {
          return await executeWithRetry(async () => {
            return await db.execute(sql.raw(baseQuery.query, baseQuery.parameters));
          });
        },
        {
          operationType: 'select',
          tableName: 'pattern_embeddings',
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
      this.logger.info('Pattern performance aggregation completed', {
        groupBy,
        timeframe,
        resultCount: metrics.length,
        aggregationTimeMs: Math.round(aggregationTime),
      });

      return metrics;

    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error('Pattern performance aggregation failed', {
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
  private validateEmbeddingData(embeddings: PatternEmbeddingBatch[]): PatternEmbeddingBatch[] {
    return embeddings.filter(embedding => {
      try {
        // Validate embedding JSON
        const parsedEmbedding = JSON.parse(embedding.embedding);
        if (!Array.isArray(parsedEmbedding) || parsedEmbedding.length === 0) {
          this.logger.warn('Invalid embedding format', { patternId: embedding.patternId });
          return false;
        }

        // Validate required fields
        if (!embedding.patternId || !embedding.symbolName || !embedding.patternType) {
          this.logger.warn('Missing required fields', { patternId: embedding.patternId });
          return false;
        }

        return true;
      } catch (error) {
        this.logger.warn('Embedding validation failed', { 
          patternId: embedding.patternId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
      }
    });
  }

  /**
   * Helper: Remove duplicate embeddings
   */
  private async deduplicateEmbeddings(embeddings: PatternEmbeddingBatch[]): Promise<PatternEmbeddingBatch[]> {
    const patternIds = embeddings.map(e => e.patternId);
    
    const existingPatterns = await executeWithRetry(async () => {
      return await db
        .select({ patternId: patternEmbeddings.patternId })
        .from(patternEmbeddings)
        .where(inArray(patternEmbeddings.patternId, patternIds));
    });

    const existingIds = new Set(existingPatterns.map(p => p.patternId));
    return embeddings.filter(e => !existingIds.has(e.patternId));
  }

  /**
   * Helper: Build update set clause for pattern metrics
   */
  private buildUpdateSetClause(update: PatternMetricUpdate): Record<string, any> {
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
  private buildBatchUpdateCaseStatements(batch: { patternId: string; updateFields: Record<string, any> }[]): string[] {
    const fields = ['success_rate', 'avg_profit', 'occurrences', 'true_positives', 'false_positives'];
    const caseStatements: string[] = [];

    for (const field of fields) {
      const updates = batch.filter(b => b.updateFields[field] !== undefined);
      if (updates.length > 0) {
        const cases = updates.map(u => 
          `WHEN pattern_id = '${u.patternId}' THEN ${this.formatUpdateValue(u.updateFields[field])}`
        ).join(' ');
        
        caseStatements.push(`${field} = CASE ${cases} ELSE ${field} END`);
      }
    }

    return caseStatements;
  }

  /**
   * Helper: Format update value for SQL
   */
  private formatUpdateValue(value: any): string {
    if (typeof value === 'number') {
      return value.toString();
    }
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }
    if (value && typeof value === 'object' && 'sql' in value) {
      // Handle Drizzle SQL fragments
      return value.toString();
    }
    return 'NULL';
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
    let whereConditions = ['discovered_at >= $1'];

    if (!includeInactive) {
      whereConditions.push('is_active = true');
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
      WHERE ${whereConditions.join(' AND ')}
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
      case 'pattern_type':
        return 'pattern_type';
      case 'symbol_name':
        return 'symbol_name';
      case 'confidence_range':
        return 'CASE WHEN confidence >= 90 THEN \'90-100\' WHEN confidence >= 80 THEN \'80-89\' WHEN confidence >= 70 THEN \'70-79\' ELSE \'<70\' END';
      default:
        return 'pattern_type';
    }
  }

  /**
   * Helper: Parse timeframe to milliseconds
   */
  private parseTimeframe(timeframe: string): number {
    const timeframes: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };

    return timeframes[timeframe] || timeframes['24h'];
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
}
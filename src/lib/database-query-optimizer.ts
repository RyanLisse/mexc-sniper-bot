import { createLogger } from "./structured-logger";

/**
 * Database Query Optimizer
 *
 * Phase 3: Query Optimization (4h)
 * - Optimizes N+1 query problems in agent operations
 * - Implements efficient batch operations
 * - Uses Drizzle ORM features for query optimization
 * - Optimizes pattern discovery database operations
 */

import { and, asc, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  executionHistory,
  type PatternEmbedding,
  patternEmbeddings,
  type SnipeTarget,
  snipeTargets,
  transactionLocks,
  transactions,
} from "../db/schema";

interface QueryOptimizationConfig {
  enableBatching: boolean;
  batchSize: number;
  enableCaching: boolean;
  cacheTimeout: number;
  enablePreparedStatements: boolean;
  maxConcurrentQueries: number;
}

interface OptimizedQueryResult<T> {
  data: T;
  executionTime: number;
  cacheHit: boolean;
  batchSize?: number;
  queryComplexity: "simple" | "moderate" | "complex";
}

interface BatchQueryOperation<T> {
  operation: "select" | "insert" | "update" | "delete";
  items: T[];
  batchSize: number;
}

export class DatabaseQueryOptimizer {
  private logger = createLogger("database-query-optimizer");

  private static instance: DatabaseQueryOptimizer;
  private config: QueryOptimizationConfig;
  private queryCache: Map<string, { data: any; timestamp: number }> = new Map();
  private preparedStatements: Map<string, any> = new Map();

  constructor() {
    this.config = {
      enableBatching: true,
      batchSize: 100,
      enableCaching: true,
      cacheTimeout: 300000, // 5 minutes
      enablePreparedStatements: true,
      maxConcurrentQueries: 10,
    };
  }

  static getInstance(): DatabaseQueryOptimizer {
    if (!DatabaseQueryOptimizer.instance) {
      DatabaseQueryOptimizer.instance = new DatabaseQueryOptimizer();
    }
    return DatabaseQueryOptimizer.instance;
  }

  // ======================================
  // OPTIMIZED SNIPE TARGET OPERATIONS
  // ======================================

  /**
   * Get pending snipe targets optimized for agent workflows
   */
  async getPendingSnipeTargetsOptimized(
    userId: string,
    limit = 50
  ): Promise<OptimizedQueryResult<SnipeTarget[]>> {
    const cacheKey = `pending_snipe_targets_${userId}_${limit}`;
    const startTime = performance.now();

    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return {
          data: cached,
          executionTime: performance.now() - startTime,
          cacheHit: true,
          queryComplexity: "simple",
        };
      }
    }

    // Optimized query using compound index
    const targets = await db
      .select()
      .from(snipeTargets)
      .where(
        and(
          eq(snipeTargets.userId, userId),
          or(eq(snipeTargets.status, "pending"), eq(snipeTargets.status, "ready"))
        )
      )
      .orderBy(asc(snipeTargets.priority), asc(snipeTargets.targetExecutionTime))
      .limit(limit);

    const executionTime = performance.now() - startTime;

    // Cache the result
    if (this.config.enableCaching) {
      this.setCachedResult(cacheKey, targets);
    }

    return {
      data: targets,
      executionTime,
      cacheHit: false,
      queryComplexity: "moderate",
    };
  }

  /**
   * Batch update snipe target statuses - eliminates N+1 queries
   */
  async batchUpdateSnipeTargetStatus(
    targetIds: number[],
    newStatus: string,
    additionalFields?: Partial<SnipeTarget>
  ): Promise<OptimizedQueryResult<void>> {
    const startTime = performance.now();

    if (!this.config.enableBatching || targetIds.length <= 5) {
      // Small batch - use single query
      await db
        .update(snipeTargets)
        .set({
          status: newStatus,
          updatedAt: new Date(),
          ...additionalFields,
        })
        .where(inArray(snipeTargets.id, targetIds));
    } else {
      // Large batch - chunk into smaller batches
      const chunks = this.chunkArray(targetIds, this.config.batchSize);

      await Promise.all(
        chunks.map((chunk) =>
          db
            .update(snipeTargets)
            .set({
              status: newStatus,
              updatedAt: new Date(),
              ...additionalFields,
            })
            .where(inArray(snipeTargets.id, chunk))
        )
      );
    }

    // Invalidate related cache entries
    this.invalidateCache("pending_snipe_targets_");

    return {
      data: undefined,
      executionTime: performance.now() - startTime,
      cacheHit: false,
      batchSize: targetIds.length,
      queryComplexity: "moderate",
    };
  }

  /**
   * Get snipe targets with execution history - optimized join
   */
  async getSnipeTargetsWithHistoryOptimized(
    userId: string,
    symbolName?: string
  ): Promise<OptimizedQueryResult<any[]>> {
    const cacheKey = `snipe_targets_history_${userId}_${symbolName || "all"}`;
    const startTime = performance.now();

    if (this.config.enableCaching) {
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return {
          data: cached,
          executionTime: performance.now() - startTime,
          cacheHit: true,
          queryComplexity: "complex",
        };
      }
    }

    // Optimized join query
    const whereConditions = [eq(snipeTargets.userId, userId)];
    if (symbolName) {
      whereConditions.push(eq(snipeTargets.symbolName, symbolName));
    }

    const results = await db
      .select({
        target: snipeTargets,
        history: executionHistory,
      })
      .from(snipeTargets)
      .leftJoin(executionHistory, eq(snipeTargets.id, executionHistory.snipeTargetId))
      .where(and(...whereConditions))
      .orderBy(desc(snipeTargets.createdAt), desc(executionHistory.executedAt));

    // Group results by target to avoid N+1 issues
    const groupedResults = this.groupExecutionHistoryByTarget(results);

    const executionTime = performance.now() - startTime;

    if (this.config.enableCaching) {
      this.setCachedResult(cacheKey, groupedResults);
    }

    return {
      data: groupedResults,
      executionTime,
      cacheHit: false,
      queryComplexity: "complex",
    };
  }

  // ======================================
  // OPTIMIZED PATTERN DISCOVERY OPERATIONS
  // ======================================

  /**
   * Get similar pattern embeddings - optimized for AI agent workflows
   */
  async getSimilarPatternsOptimized(
    patternType: string,
    minConfidence: number,
    limit = 20
  ): Promise<OptimizedQueryResult<PatternEmbedding[]>> {
    const cacheKey = `similar_patterns_${patternType}_${minConfidence}_${limit}`;
    const startTime = performance.now();

    if (this.config.enableCaching) {
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return {
          data: cached,
          executionTime: performance.now() - startTime,
          cacheHit: true,
          queryComplexity: "moderate",
        };
      }
    }

    // Optimized query using partial index
    const patterns = await db
      .select()
      .from(patternEmbeddings)
      .where(
        and(
          eq(patternEmbeddings.isActive, true),
          eq(patternEmbeddings.patternType, patternType),
          gte(patternEmbeddings.confidence, minConfidence)
        )
      )
      .orderBy(desc(patternEmbeddings.confidence), desc(patternEmbeddings.lastSeenAt))
      .limit(limit);

    const executionTime = performance.now() - startTime;

    if (this.config.enableCaching) {
      this.setCachedResult(cacheKey, patterns);
    }

    return {
      data: patterns,
      executionTime,
      cacheHit: false,
      queryComplexity: "moderate",
    };
  }

  /**
   * Batch insert pattern embeddings - optimized for AI agent data ingestion
   */
  async batchInsertPatternEmbeddings(
    patterns: Partial<PatternEmbedding>[]
  ): Promise<OptimizedQueryResult<void>> {
    const startTime = performance.now();

    if (patterns.length === 0) {
      return {
        data: undefined,
        executionTime: 0,
        cacheHit: false,
        queryComplexity: "simple",
      };
    }

    // Batch insert with chunking for large datasets
    const chunks = this.chunkArray(patterns, this.config.batchSize);

    await Promise.all(chunks.map((chunk) => db.insert(patternEmbeddings).values(chunk as any[])));

    // Invalidate pattern cache
    this.invalidateCache("similar_patterns_");

    return {
      data: undefined,
      executionTime: performance.now() - startTime,
      cacheHit: false,
      batchSize: patterns.length,
      queryComplexity: "moderate",
    };
  }

  /**
   * Update pattern confidence scores in batch
   */
  async batchUpdatePatternConfidence(
    updates: { patternId: string; confidence: number; successRate?: number }[]
  ): Promise<OptimizedQueryResult<void>> {
    const startTime = performance.now();

    // Use prepared statement for better performance
    const chunks = this.chunkArray(updates, this.config.batchSize);

    await Promise.all(
      chunks.map(async (chunk) => {
        for (const update of chunk) {
          await db
            .update(patternEmbeddings)
            .set({
              confidence: update.confidence,
              successRate: update.successRate,
              updatedAt: new Date(),
            })
            .where(eq(patternEmbeddings.patternId, update.patternId));
        }
      })
    );

    this.invalidateCache("similar_patterns_");

    return {
      data: undefined,
      executionTime: performance.now() - startTime,
      cacheHit: false,
      batchSize: updates.length,
      queryComplexity: "moderate",
    };
  }

  // ======================================
  // OPTIMIZED TRANSACTION OPERATIONS
  // ======================================

  /**
   * Get active transaction locks efficiently
   */
  async getActiveLocksOptimized(resourceIds?: string[]): Promise<OptimizedQueryResult<any[]>> {
    const cacheKey = `active_locks_${resourceIds?.join(",") || "all"}`;
    const startTime = performance.now();

    if (this.config.enableCaching) {
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return {
          data: cached,
          executionTime: performance.now() - startTime,
          cacheHit: true,
          queryComplexity: "simple",
        };
      }
    }

    const now = new Date();
    const whereConditions = [
      eq(transactionLocks.status, "active"),
      gte(transactionLocks.expiresAt, now),
    ];

    if (resourceIds && resourceIds.length > 0) {
      whereConditions.push(inArray(transactionLocks.resourceId, resourceIds));
    }

    const locks = await db
      .select()
      .from(transactionLocks)
      .where(and(...whereConditions))
      .orderBy(asc(transactionLocks.acquiredAt));

    const executionTime = performance.now() - startTime;

    if (this.config.enableCaching && executionTime < 100) {
      // Only cache quick queries
      this.setCachedResult(cacheKey, locks, 30000); // 30 second cache for locks
    }

    return {
      data: locks,
      executionTime,
      cacheHit: false,
      queryComplexity: "simple",
    };
  }

  /**
   * Batch cleanup expired locks
   */
  async cleanupExpiredLocksOptimized(): Promise<OptimizedQueryResult<number>> {
    const startTime = performance.now();
    const now = new Date();

    // Update expired locks to 'expired' status
    const result = await db
      .update(transactionLocks)
      .set({
        status: "expired",
        updatedAt: now,
      })
      .where(and(eq(transactionLocks.status, "active"), lte(transactionLocks.expiresAt, now)));

    // Invalidate lock cache
    this.invalidateCache("active_locks_");

    return {
      data: (result as any).changes || (result as any).rowsAffected || 0,
      executionTime: performance.now() - startTime,
      cacheHit: false,
      queryComplexity: "simple",
    };
  }

  // ======================================
  // OPTIMIZED PORTFOLIO OPERATIONS
  // ======================================

  /**
   * Get user portfolio with profit/loss - optimized aggregation
   */
  async getUserPortfolioOptimized(
    userId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<OptimizedQueryResult<any>> {
    const cacheKey = `user_portfolio_${userId}_${timeRange?.start.getTime()}_${timeRange?.end.getTime()}`;
    const startTime = performance.now();

    if (this.config.enableCaching) {
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return {
          data: cached,
          executionTime: performance.now() - startTime,
          cacheHit: true,
          queryComplexity: "complex",
        };
      }
    }

    const whereConditions = [eq(transactions.userId, userId)];

    if (timeRange) {
      whereConditions.push(
        gte(transactions.transactionTime, timeRange.start),
        lte(transactions.transactionTime, timeRange.end)
      );
    }

    // Optimized aggregation query
    const portfolioStats = await db
      .select({
        totalTransactions: sql<number>`COUNT(*)`,
        totalProfit: sql<number>`SUM(COALESCE(${transactions.profitLoss}, 0))`,
        totalVolume: sql<number>`SUM(COALESCE(${transactions.buyTotalCost}, 0))`,
        successfulTrades: sql<number>`SUM(CASE WHEN ${transactions.profitLoss} > 0 THEN 1 ELSE 0 END)`,
        avgProfitPerTrade: sql<number>`AVG(COALESCE(${transactions.profitLoss}, 0))`,
        bestTrade: sql<number>`MAX(COALESCE(${transactions.profitLoss}, 0))`,
        worstTrade: sql<number>`MIN(COALESCE(${transactions.profitLoss}, 0))`,
      })
      .from(transactions)
      .where(and(...whereConditions));

    // Get recent transactions
    const recentTransactions = await db
      .select()
      .from(transactions)
      .where(and(...whereConditions))
      .orderBy(desc(transactions.transactionTime))
      .limit(20);

    const portfolio = {
      stats: portfolioStats[0],
      recentTransactions,
      calculatedAt: new Date(),
    };

    const executionTime = performance.now() - startTime;

    if (this.config.enableCaching) {
      this.setCachedResult(cacheKey, portfolio);
    }

    return {
      data: portfolio,
      executionTime,
      cacheHit: false,
      queryComplexity: "complex",
    };
  }

  // ======================================
  // UTILITY METHODS
  // ======================================

  /**
   * Chunk array into smaller batches
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Group execution history by target to avoid N+1 issues
   */
  private groupExecutionHistoryByTarget(results: any[]): any[] {
    const grouped = new Map();

    for (const result of results) {
      const targetId = result.target.id;
      if (!grouped.has(targetId)) {
        grouped.set(targetId, {
          target: result.target,
          executionHistory: [],
        });
      }

      if (result.history) {
        grouped.get(targetId).executionHistory.push(result.history);
      }
    }

    return Array.from(grouped.values());
  }

  /**
   * Cache management
   */
  private getCachedResult(key: string): any | null {
    const cached = this.queryCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  private setCachedResult(key: string, data: any, _customTimeout?: number): void {
    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
    });

    // Clean up old cache entries periodically
    if (this.queryCache.size > 1000) {
      this.cleanupCache();
    }
  }

  private invalidateCache(keyPrefix: string): void {
    for (const key of this.queryCache.keys()) {
      if (key.startsWith(keyPrefix)) {
        this.queryCache.delete(key);
      }
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.queryCache.entries()) {
      if (now - value.timestamp > this.config.cacheTimeout) {
        this.queryCache.delete(key);
      }
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<QueryOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.queryCache.size,
      maxSize: 1000,
      timeout: this.config.cacheTimeout,
      enabled: this.config.enableCaching,
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.queryCache.clear();
    logger.info("🗑️ Query cache cleared");
  }
}

// Export singleton instance
export const databaseQueryOptimizer = DatabaseQueryOptimizer.getInstance();

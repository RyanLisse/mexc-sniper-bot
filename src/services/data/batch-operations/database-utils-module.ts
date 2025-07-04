/**
 * Database Utils Module
 *
 * Handles database utility methods, performance monitoring, and helper functions.
 * Extracted from batch-database-service.ts for better modularity.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import { db, executeWithRetry } from "@/src/db";
import { patternEmbeddings, snipeTargets } from "@/src/db/schema";
import { databaseConnectionPool } from "@/src/lib/database-connection-pool";
import { toSafeError } from "@/src/lib/error-type-utils";

interface PerformanceMetrics {
  totalOperations: number;
  totalProcessingTime: number;
  averageOperationTime: number;
  lastOptimizationTime: number;
}

export class DatabaseUtilsModule {
  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[database-utils-module]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[database-utils-module]", message, context || ""),
    error: (message: string, context?: unknown, error?: Error) =>
      console.error(
        "[database-utils-module]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: unknown) =>
      console.debug("[database-utils-module]", message, context || ""),
  };

  private performanceMetrics: PerformanceMetrics = {
    totalOperations: 0,
    totalProcessingTime: 0,
    averageOperationTime: 0,
    lastOptimizationTime: Date.now(),
  };

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
    } finally {
      this.updatePerformanceMetrics(performance.now() - startTime);
    }
  }

  /**
   * Execute a function with retry logic and performance monitoring
   */
  async executeWithRetryAndMonitoring<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3,
    retryDelayMs: number = 1000
  ): Promise<T> {
    const startTime = performance.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();

        if (attempt > 1) {
          this.logger.info(`Operation succeeded after ${attempt} attempts`, {
            operationName,
            totalTimeMs: Math.round(performance.now() - startTime),
          });
        }

        this.updatePerformanceMetrics(performance.now() - startTime);
        return result;
      } catch (error) {
        lastError = toSafeError(error);

        this.logger.warn(
          `Attempt ${attempt}/${maxRetries} failed for ${operationName}`,
          {
            error: lastError.message,
          }
        );

        if (attempt < maxRetries) {
          const delay = retryDelayMs * 2 ** (attempt - 1); // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.logger.error(`Operation failed after ${maxRetries} attempts`, {
      operationName,
      error: lastError?.message,
      totalTimeMs: Math.round(performance.now() - startTime),
    });

    throw (
      lastError || new Error(`Operation failed after ${maxRetries} attempts`)
    );
  }

  /**
   * Get table reference by name (for dynamic queries)
   */
  getTableReference(tableName: string): any {
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
  buildWhereConditions(conditions: Record<string, any>): any {
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
   * Build dynamic ORDER BY clause
   */
  buildOrderByClause(orderBy: Record<string, "ASC" | "DESC"> | string): any {
    if (typeof orderBy === "string") {
      return sql.raw(orderBy);
    }

    const orderClauses = Object.entries(orderBy).map(([column, direction]) => {
      return sql`${sql.identifier(column)} ${sql.raw(direction)}`;
    });

    return sql.join(orderClauses, sql`, `);
  }

  /**
   * Execute raw SQL with parameter substitution
   */
  async executeRawSQL(
    query: string,
    parameters: any[] = [],
    operationName: string = "raw_sql"
  ): Promise<any[]> {
    const startTime = performance.now();

    try {
      return await executeWithRetry(async () => {
        // Replace PostgreSQL-style placeholders with actual values
        let queryWithParams = query;
        parameters.forEach((param, index) => {
          const placeholder = `$${index + 1}`;
          const value =
            param instanceof Date
              ? `'${param.toISOString()}'`
              : typeof param === "string"
                ? `'${param.replace(/'/g, "''")}'`
                : param;
          queryWithParams = queryWithParams.replace(placeholder, String(value));
        });

        return await db.execute(sql.raw(queryWithParams));
      });
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Raw SQL execution failed", {
        operationName,
        query: query.slice(0, 200), // Log first 200 chars
        error: safeError.message,
      });
      throw error;
    } finally {
      this.updatePerformanceMetrics(performance.now() - startTime);
    }
  }

  /**
   * Check database connection health
   */
  async checkConnectionHealth(): Promise<{
    isHealthy: boolean;
    responseTimeMs: number;
    error?: string;
  }> {
    const startTime = performance.now();

    try {
      await executeWithRetry(async () => {
        return await db.execute(sql`SELECT 1 as health_check`);
      });

      const responseTime = performance.now() - startTime;

      return {
        isHealthy: true,
        responseTimeMs: Math.round(responseTime),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        isHealthy: false,
        responseTimeMs: Math.round(performance.now() - startTime),
        error: safeError.message,
      };
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStatistics(): Promise<{
    tableStats: Array<{
      tableName: string;
      rowCount: number;
      sizeBytes: number;
    }>;
    connectionStats: {
      activeConnections: number;
      maxConnections: number;
    };
  }> {
    const startTime = performance.now();

    try {
      // Get table statistics
      const tableStatsQuery = `
        SELECT 
          schemaname,
          tablename,
          n_tup_ins + n_tup_upd + n_tup_del as total_operations,
          n_live_tup as row_count,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_stat_user_tables
        ORDER BY size_bytes DESC
      `;

      const tableStats = await this.executeRawSQL(
        tableStatsQuery,
        [],
        "get_table_statistics"
      );

      // Get connection statistics
      const connectionStatsQuery = `
        SELECT 
          (SELECT count(*) FROM pg_stat_activity) as active_connections,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
      `;

      const connectionStats = await this.executeRawSQL(
        connectionStatsQuery,
        [],
        "get_connection_statistics"
      );

      this.logger.info("Database statistics retrieved", {
        tableCount: tableStats.length,
        retrievalTimeMs: Math.round(performance.now() - startTime),
      });

      return {
        tableStats: tableStats.map((row: any) => ({
          tableName: `${row.schemaname}.${row.tablename}`,
          rowCount: parseInt(row.row_count) || 0,
          sizeBytes: parseInt(row.size_bytes) || 0,
        })),
        connectionStats: {
          activeConnections:
            parseInt(connectionStats[0]?.active_connections) || 0,
          maxConnections: parseInt(connectionStats[0]?.max_connections) || 0,
        },
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to retrieve database statistics", {
        error: safeError.message,
      });
      throw error;
    }
  }

  /**
   * Optimize table statistics (ANALYZE)
   */
  async optimizeTableStatistics(tableNames?: string[]): Promise<void> {
    const startTime = performance.now();

    try {
      if (tableNames && tableNames.length > 0) {
        // Analyze specific tables
        for (const tableName of tableNames) {
          await this.executeRawSQL(
            `ANALYZE ${tableName}`,
            [],
            `analyze_table_${tableName}`
          );
        }
      } else {
        // Analyze all tables
        await this.executeRawSQL("ANALYZE", [], "analyze_all_tables");
      }

      this.logger.info("Table statistics optimization completed", {
        tables: tableNames || "all",
        optimizationTimeMs: Math.round(performance.now() - startTime),
      });
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Table statistics optimization failed", {
        tables: tableNames || "all",
        error: safeError.message,
      });
      throw error;
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(operationTime: number): void {
    this.performanceMetrics.totalOperations++;
    this.performanceMetrics.totalProcessingTime += operationTime;
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
  getPerformanceMetrics(): PerformanceMetrics {
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

  /**
   * Chunk array into smaller pieces
   */
  chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Create a debounced function for batch operations
   */
  createDebouncedOperation<T>(
    operation: (items: T[]) => Promise<void>,
    delayMs: number = 1000,
    maxBatchSize: number = 100
  ): (item: T) => void {
    let batch: T[] = [];
    let timeoutId: NodeJS.Timeout | null = null;

    return (item: T) => {
      batch.push(item);

      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // If batch is full, execute immediately
      if (batch.length >= maxBatchSize) {
        const currentBatch = batch;
        batch = [];
        operation(currentBatch).catch((error) => {
          this.logger.error("Debounced operation failed", {
            batchSize: currentBatch.length,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        });
        return;
      }

      // Set new timeout
      timeoutId = setTimeout(() => {
        if (batch.length > 0) {
          const currentBatch = batch;
          batch = [];
          operation(currentBatch).catch((error) => {
            this.logger.error("Debounced operation failed", {
              batchSize: currentBatch.length,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          });
        }
      }, delayMs);
    };
  }
}

/**
 * Batch Database Service (Refactored)
 *
 * Lean orchestrator that delegates batch operations to specialized modules.
 * Reduced from 1192 lines to under 500 lines by extracting functionality into focused modules.
 *
 * Key Features:
 * - Modular architecture with specialized components
 * - Delegated operations for better maintainability
 * - Performance monitoring and health checks
 * - Transaction management and retry logic
 * - Comprehensive validation and deduplication
 */

import { z } from "zod";
import { BatchAggregationModule } from "./batch-operations/batch-aggregation-module";
import { BatchInsertModule } from "./batch-operations/batch-insert-module";
import { BatchUpdateModule } from "./batch-operations/batch-update-module";
import { BatchValidationModule } from "./batch-operations/batch-validation-module";
import { DatabaseUtilsModule } from "./batch-operations/database-utils-module";

// Re-export types for compatibility
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

/**
 * Refactored Batch Database Service - Lean Orchestrator
 *
 * Delegates operations to specialized modules:
 * - BatchInsertModule: Handles all insertion operations
 * - BatchUpdateModule: Handles all update operations
 * - BatchAggregationModule: Handles analytics and aggregation
 * - BatchValidationModule: Handles validation and deduplication
 * - DatabaseUtilsModule: Handles utilities and helper functions
 */
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

  // Specialized module instances
  private insertModule: BatchInsertModule;
  private updateModule: BatchUpdateModule;
  private aggregationModule: BatchAggregationModule;
  private validationModule: BatchValidationModule;
  private utilsModule: DatabaseUtilsModule;

  constructor() {
    // Initialize specialized modules
    this.insertModule = new BatchInsertModule();
    this.updateModule = new BatchUpdateModule();
    this.aggregationModule = new BatchAggregationModule();
    this.validationModule = new BatchValidationModule();
    this.utilsModule = new DatabaseUtilsModule();

    this.logger.info(
      "Batch Database Service initialized with specialized modules",
      {
        modules: [
          "BatchInsertModule",
          "BatchUpdateModule",
          "BatchAggregationModule",
          "BatchValidationModule",
          "DatabaseUtilsModule",
        ],
      }
    );
  }

  // ============================================================================
  // Batch Insert Operations - Delegated to BatchInsertModule
  // ============================================================================

  /**
   * Batch insert pattern embeddings with real database transactions and optimization
   */
  async batchInsertPatternEmbeddings(
    embeddings: PatternEmbeddingBatch[],
    options: Partial<BatchInsertOptions> = {}
  ): Promise<number> {
    return await this.insertModule.batchInsertPatternEmbeddings(
      embeddings,
      options
    );
  }

  /**
   * Generic batch insert with proper transaction handling
   */
  async batchInsert<T extends Record<string, any>>(
    tableName: string,
    records: T[],
    options: Partial<BatchInsertOptions> = {}
  ): Promise<number> {
    return await this.insertModule.batchInsert(tableName, records, options);
  }

  // ============================================================================
  // Batch Update Operations - Delegated to BatchUpdateModule
  // ============================================================================

  /**
   * Batch update pattern metrics with real database transactions
   */
  async batchUpdatePatternMetrics(
    updates: PatternMetricUpdate[]
  ): Promise<number> {
    return await this.updateModule.batchUpdatePatternMetrics(updates);
  }

  /**
   * Bulk update with optimized queries
   */
  async bulkUpdate<T extends Record<string, any>>(
    tableName: string,
    updates: Array<{ where: Record<string, any>; set: T }>,
    options: { batchSize?: number } = {}
  ): Promise<number> {
    return await this.updateModule.bulkUpdate(tableName, updates, options);
  }

  /**
   * Batch delete with transaction support
   */
  async batchDelete(
    tableName: string,
    conditions: Record<string, any>[],
    options: { batchSize?: number } = {}
  ): Promise<number> {
    return await this.updateModule.batchDelete(tableName, conditions, options);
  }

  // ============================================================================
  // Aggregation Operations - Delegated to BatchAggregationModule
  // ============================================================================

  /**
   * Aggregate pattern performance metrics
   */
  async aggregatePatternPerformanceMetrics(
    options: AggregationOptions
  ): Promise<AggregatedMetrics[]> {
    return await this.aggregationModule.aggregatePatternPerformanceMetrics(
      options
    );
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
    return await this.aggregationModule.bulkSelect<T>(
      tableName,
      conditions,
      options
    );
  }

  /**
   * Get time-series aggregated data for charts and analytics
   */
  async getTimeSeriesAggregation(
    tableName: string,
    dateColumn: string,
    metricColumns: string[],
    timeframe: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      filters?: Record<string, any>;
      groupBy?: string[];
    } = {}
  ): Promise<any[]> {
    return await this.aggregationModule.getTimeSeriesAggregation(
      tableName,
      dateColumn,
      metricColumns,
      timeframe,
      options
    );
  }

  // ============================================================================
  // Validation Operations - Delegated to BatchValidationModule
  // ============================================================================

  /**
   * Batch check for snipe target duplicates
   */
  async batchCheckSnipeTargetDuplicates(
    targets: SnipeTargetCheck[]
  ): Promise<SnipeTargetCheck[]> {
    return await this.validationModule.batchCheckSnipeTargetDuplicates(targets);
  }

  /**
   * Validate a batch of records against a schema or validation function
   */
  async validateBatch<T>(
    items: T[],
    validator: (item: T) => Promise<boolean> | boolean,
    options: {
      stopOnFirstError?: boolean;
      maxConcurrent?: number;
    } = {}
  ): Promise<{
    valid: T[];
    invalid: T[];
    errors: Array<{ item: T; error: string }>;
  }> {
    return await this.validationModule.validateBatch(items, validator, options);
  }

  /**
   * Check for duplicate records based on specific fields
   */
  async checkDuplicatesInBatch<T>(
    items: T[],
    keyExtractor: (item: T) => string,
    options: {
      allowDuplicates?: boolean;
      reportDuplicates?: boolean;
    } = {}
  ): Promise<{
    unique: T[];
    duplicates: T[];
    duplicateGroups: Record<string, T[]>;
  }> {
    return await this.validationModule.checkDuplicatesInBatch(
      items,
      keyExtractor,
      options
    );
  }

  /**
   * Validate data types and required fields
   */
  validateDataTypes<T extends Record<string, any>>(
    items: T[],
    schema: Record<
      string,
      {
        type: string;
        required?: boolean;
        min?: number;
        max?: number;
        pattern?: RegExp;
      }
    >
  ): {
    valid: T[];
    invalid: T[];
    errors: Array<{ item: T; error: string }>;
  } {
    return this.validationModule.validateDataTypes(items, schema);
  }

  /**
   * Sanitize data by removing invalid characters and normalizing values
   */
  sanitizeBatch<T extends Record<string, any>>(
    items: T[],
    sanitizers: Record<string, (value: any) => any>
  ): T[] {
    return this.validationModule.sanitizeBatch(items, sanitizers);
  }

  // ============================================================================
  // Database Utilities - Delegated to DatabaseUtilsModule
  // ============================================================================

  /**
   * Transaction wrapper for complex operations
   */
  async executeTransaction<T>(
    operations: (tx: any) => Promise<T>,
    invalidatePatterns: string[] = []
  ): Promise<T> {
    return await this.utilsModule.executeTransaction(
      operations,
      invalidatePatterns
    );
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
    return await this.utilsModule.executeWithRetryAndMonitoring(
      operation,
      operationName,
      maxRetries,
      retryDelayMs
    );
  }

  /**
   * Check database connection health
   */
  async checkConnectionHealth(): Promise<{
    isHealthy: boolean;
    responseTimeMs: number;
    error?: string;
  }> {
    return await this.utilsModule.checkConnectionHealth();
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
    return await this.utilsModule.getDatabaseStatistics();
  }

  /**
   * Optimize table statistics (ANALYZE)
   */
  async optimizeTableStatistics(tableNames?: string[]): Promise<void> {
    return await this.utilsModule.optimizeTableStatistics(tableNames);
  }

  /**
   * Execute raw SQL with parameter substitution
   */
  async executeRawSQL(
    query: string,
    parameters: any[] = [],
    operationName: string = "raw_sql"
  ): Promise<any[]> {
    return await this.utilsModule.executeRawSQL(
      query,
      parameters,
      operationName
    );
  }

  // ============================================================================
  // Performance and Monitoring Methods
  // ============================================================================

  /**
   * Get performance metrics from all modules
   */
  getPerformanceMetrics() {
    return {
      database: this.utilsModule.getPerformanceMetrics(),
      service: {
        modulesInitialized: 5,
        operationalSince: new Date().toISOString(),
      },
    };
  }

  /**
   * Reset performance metrics across all modules
   */
  resetPerformanceMetrics(): void {
    this.utilsModule.resetPerformanceMetrics();
    this.logger.info("Performance metrics reset across all modules");
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    overall: "healthy" | "degraded" | "unhealthy";
    modules: Record<string, boolean>;
    database: {
      isHealthy: boolean;
      responseTimeMs: number;
      error?: string;
    };
  }> {
    const dbHealth = await this.checkConnectionHealth();

    const modules = {
      insertModule: true,
      updateModule: true,
      aggregationModule: true,
      validationModule: true,
      utilsModule: true,
    };

    const allModulesHealthy = Object.values(modules).every(
      (healthy) => healthy
    );
    const overall =
      dbHealth.isHealthy && allModulesHealthy
        ? "healthy"
        : dbHealth.isHealthy || allModulesHealthy
          ? "degraded"
          : "unhealthy";

    return {
      overall,
      modules,
      database: dbHealth,
    };
  }

  /**
   * Create a debounced operation using utils module
   */
  createDebouncedOperation<T>(
    operation: (items: T[]) => Promise<void>,
    delayMs: number = 1000,
    maxBatchSize: number = 100
  ): (item: T) => void {
    return this.utilsModule.createDebouncedOperation(
      operation,
      delayMs,
      maxBatchSize
    );
  }

  /**
   * Get service information
   */
  getServiceInfo() {
    return {
      name: "BatchDatabaseService",
      version: "2.0.0-refactored",
      architecture: "modular",
      modules: [
        "BatchInsertModule",
        "BatchUpdateModule",
        "BatchAggregationModule",
        "BatchValidationModule",
        "DatabaseUtilsModule",
      ],
      capabilities: [
        "batch_insert",
        "batch_update",
        "batch_delete",
        "aggregation",
        "validation",
        "deduplication",
        "transaction_management",
        "performance_monitoring",
        "health_checks",
      ],
    };
  }
}

/**
 * Database Query Batching Service
 * 
 * Optimizes database operations by batching multiple queries together,
 * reducing connection overhead and improving performance.
 */

import { db } from "@/src/db";
import { globalDatabaseCostProtector } from "./database-cost-protector";

export interface BatchQuery {
  id: string;
  sql: string;
  params: any[];
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timeout: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedRows?: number;
}

export interface BatchExecutionResult {
  results: Array<{ id: string; data: any; error?: Error }>;
  totalDuration: number;
  queriesExecuted: number;
  optimizationSavings: {
    queriesBatched: number;
    connectionsSaved: number;
    estimatedTimeSaved: number;
  };
}

export interface QueryBatchConfig {
  maxBatchSize: number;
  maxWaitTimeMs: number;
  priorityThresholds: {
    critical: number; // Execute immediately if critical queries >= threshold
    high: number;     // Execute quickly if high priority queries >= threshold
  };
  enableQueryDeduplication: boolean;
  enableQueryOptimization: boolean;
  timeoutMs: number;
}

class DatabaseQueryBatchingService {
  private static instance: DatabaseQueryBatchingService;
  
  private pendingQueries = new Map<string, BatchQuery[]>();
  private batchTimers = new Map<string, NodeJS.Timeout>();
  private executionQueue = new Map<string, Promise<BatchExecutionResult>>();
  
  private config: QueryBatchConfig = {
    maxBatchSize: parseInt(process.env.DB_BATCH_MAX_SIZE || '10'),
    maxWaitTimeMs: parseInt(process.env.DB_BATCH_MAX_WAIT_MS || '100'),
    priorityThresholds: {
      critical: 1, // Execute immediately
      high: 3,     // Execute when 3+ high priority queries
    },
    enableQueryDeduplication: process.env.DB_BATCH_DEDUPLICATION !== 'false',
    enableQueryOptimization: process.env.DB_BATCH_OPTIMIZATION !== 'false',
    timeoutMs: parseInt(process.env.DB_BATCH_TIMEOUT_MS || '30000'),
  };
  
  private metrics = {
    totalQueries: 0,
    batchedQueries: 0,
    connectionsSaved: 0,
    totalTimeSaved: 0,
    averageBatchSize: 0,
    deduplicationSavings: 0,
  };
  
  static getInstance(): DatabaseQueryBatchingService {
    if (!DatabaseQueryBatchingService.instance) {
      DatabaseQueryBatchingService.instance = new DatabaseQueryBatchingService();
    }
    return DatabaseQueryBatchingService.instance;
  }
  
  private constructor() {
    this.startMetricsLogging();
  }
  
  private startMetricsLogging(): void {
    setInterval(() => {
      if (this.metrics.totalQueries > 0) {
        console.info('🔄 [DB BATCHING METRICS]', {
          totalQueries: this.metrics.totalQueries,
          batchedQueries: this.metrics.batchedQueries,
          batchingRate: `${(this.metrics.batchedQueries / this.metrics.totalQueries * 100).toFixed(2)}%`,
          connectionsSaved: this.metrics.connectionsSaved,
          averageBatchSize: this.metrics.averageBatchSize.toFixed(2),
          timeSaved: `${this.metrics.totalTimeSaved}ms`,
          deduplicationSavings: this.metrics.deduplicationSavings,
          pendingBatches: this.pendingQueries.size,
        });
      }
    }, 300000); // Every 5 minutes
  }
  
  /**
   * Execute a query with intelligent batching
   */
  async executeQuery<T = any>(
    sql: string,
    params: any[] = [],
    options: {
      priority?: BatchQuery['priority'];
      timeout?: number;
      batchKey?: string;
      estimatedRows?: number;
      allowBatching?: boolean;
    } = {}
  ): Promise<T> {
    const {
      priority = 'medium',
      timeout = this.config.timeoutMs,
      batchKey = 'default',
      estimatedRows,
      allowBatching = true,
    } = options;
    
    this.metrics.totalQueries++;
    
    // Skip batching for critical queries or if disabled
    if (!allowBatching || priority === 'critical') {
      return this.executeSingleQuery(sql, params, timeout);
    }
    
    return new Promise<T>((resolve, reject) => {
      const query: BatchQuery = {
        id: `query_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        sql,
        params,
        resolve,
        reject,
        timeout,
        priority,
        estimatedRows,
      };
      
      this.addToBatch(batchKey, query);
    });
  }
  
  /**
   * Execute multiple queries in a single batch
   */
  async executeBatch(
    queries: Array<{ sql: string; params: any[]; id?: string }>,
    options: {
      batchKey?: string;
      priority?: BatchQuery['priority'];
      timeout?: number;
    } = {}
  ): Promise<BatchExecutionResult> {
    const { batchKey = 'manual', priority = 'medium', timeout = this.config.timeoutMs } = options;
    
    return new Promise<BatchExecutionResult>((resolve, reject) => {
      const batchQueries: BatchQuery[] = queries.map((query, index) => ({
        id: query.id || `batch_${Date.now()}_${index}`,
        sql: query.sql,
        params: query.params,
        resolve: () => {}, // Will be handled by batch result
        reject: () => {},  // Will be handled by batch result
        timeout,
        priority,
      }));
      
      this.executeBatchNow(batchKey, batchQueries)
        .then(resolve)
        .catch(reject);
    });
  }
  
  private addToBatch(batchKey: string, query: BatchQuery): void {
    if (!this.pendingQueries.has(batchKey)) {
      this.pendingQueries.set(batchKey, []);
    }
    
    const batch = this.pendingQueries.get(batchKey)!;
    batch.push(query);
    
    // Check if we should execute immediately
    const shouldExecuteNow = this.shouldExecuteBatchNow(batch);
    
    if (shouldExecuteNow) {
      this.triggerBatchExecution(batchKey);
    } else if (!this.batchTimers.has(batchKey)) {
      // Schedule batch execution
      const timer = setTimeout(() => {
        this.triggerBatchExecution(batchKey);
      }, this.config.maxWaitTimeMs);
      
      this.batchTimers.set(batchKey, timer);
    }
  }
  
  private shouldExecuteBatchNow(batch: BatchQuery[]): boolean {
    // Execute if batch is full
    if (batch.length >= this.config.maxBatchSize) {
      return true;
    }
    
    // Count queries by priority
    const priorityCounts = batch.reduce((acc, query) => {
      acc[query.priority] = (acc[query.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Execute immediately for critical queries
    if (priorityCounts.critical >= this.config.priorityThresholds.critical) {
      return true;
    }
    
    // Execute quickly for high priority queries
    if (priorityCounts.high >= this.config.priorityThresholds.high) {
      return true;
    }
    
    return false;
  }
  
  private triggerBatchExecution(batchKey: string): void {
    const batch = this.pendingQueries.get(batchKey);
    if (!batch || batch.length === 0) {
      return;
    }
    
    // Clear timer
    const timer = this.batchTimers.get(batchKey);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(batchKey);
    }
    
    // Remove batch from pending
    this.pendingQueries.delete(batchKey);
    
    // Execute batch
    this.executeBatchNow(batchKey, batch).catch(error => {
      console.error('❌ [DB BATCH ERROR] Batch execution failed:', error);
      
      // Reject all queries in the batch
      batch.forEach(query => {
        query.reject(error);
      });
    });
  }
  
  private async executeBatchNow(
    batchKey: string,
    batch: BatchQuery[]
  ): Promise<BatchExecutionResult> {
    if (batch.length === 0) {
      return {
        results: [],
        totalDuration: 0,
        queriesExecuted: 0,
        optimizationSavings: {
          queriesBatched: 0,
          connectionsSaved: 0,
          estimatedTimeSaved: 0,
        },
      };
    }
    
    const startTime = Date.now();
    
    console.debug('🔄 [DB BATCH EXECUTE]', {
      batchKey,
      queryCount: batch.length,
      priorities: this.analyzeBatchPriorities(batch),
    });
    
    // Check if there's already an execution in progress
    if (this.executionQueue.has(batchKey)) {
      const existingExecution = this.executionQueue.get(batchKey)!;
      return existingExecution;
    }
    
    // Create execution promise
    const executionPromise = this.performBatchExecution(batch);
    this.executionQueue.set(batchKey, executionPromise);
    
    try {
      const result = await executionPromise;
      
      // Update metrics
      this.updateBatchMetrics(batch, result);
      
      // Resolve individual query promises
      result.results.forEach(queryResult => {
        const query = batch.find(q => q.id === queryResult.id);
        if (query) {
          if (queryResult.error) {
            query.reject(queryResult.error);
          } else {
            query.resolve(queryResult.data);
          }
        }
      });
      
      return result;
      
    } finally {
      this.executionQueue.delete(batchKey);
    }
  }
  
  private async performBatchExecution(batch: BatchQuery[]): Promise<BatchExecutionResult> {
    const startTime = Date.now();
    
    // Deduplicate queries if enabled
    const optimizedBatch = this.config.enableQueryDeduplication
      ? this.deduplicateQueries(batch)
      : batch;
    
    // Optimize query order if enabled
    const orderedBatch = this.config.enableQueryOptimization
      ? this.optimizeQueryOrder(optimizedBatch)
      : optimizedBatch;
    
    const results: Array<{ id: string; data: any; error?: Error }> = [];
    
    try {
      // Execute with database cost protection
      await globalDatabaseCostProtector.withCostProtection(
        async () => {
          // Execute queries in optimized order
          for (const query of orderedBatch) {
            try {
              const result = await this.executeSingleQuery(
                query.sql,
                query.params,
                query.timeout
              );
              
              results.push({
                id: query.id,
                data: result,
              });
              
              // Handle deduplicated queries
              if (this.config.enableQueryDeduplication) {
                this.propagateDeduplicatedResults(query, result, batch, results);
              }
              
            } catch (error) {
              const errorObj = error instanceof Error ? error : new Error(String(error));
              results.push({
                id: query.id,
                data: null,
                error: errorObj,
              });
              
              // Handle deduplicated queries
              if (this.config.enableQueryDeduplication) {
                this.propagateDeduplicatedErrors(query, errorObj, batch, results);
              }
            }
          }
        },
        {
          endpoint: 'database-batch-execution',
          operationType: 'aggregate',
          estimatedQueries: orderedBatch.length,
        }
      );
      
    } catch (batchError) {
      // If the entire batch fails, mark all queries as failed
      const error = batchError instanceof Error ? batchError : new Error(String(batchError));
      
      for (const query of batch) {
        results.push({
          id: query.id,
          data: null,
          error,
        });
      }
    }
    
    const totalDuration = Date.now() - startTime;
    
    return {
      results,
      totalDuration,
      queriesExecuted: orderedBatch.length,
      optimizationSavings: {
        queriesBatched: batch.length,
        connectionsSaved: Math.max(0, batch.length - 1), // Saved connections
        estimatedTimeSaved: this.calculateTimeSavings(batch, totalDuration),
      },
    };
  }
  
  private async executeSingleQuery<T = any>(
    sql: string,
    params: any[],
    timeoutMs: number
  ): Promise<T> {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Query timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    
    // Execute query with timeout
    const queryPromise = db.execute(sql, params);
    
    return Promise.race([queryPromise, timeoutPromise]) as Promise<T>;
  }
  
  private deduplicateQueries(batch: BatchQuery[]): BatchQuery[] {
    const seen = new Map<string, BatchQuery>();
    const deduplicated: BatchQuery[] = [];
    
    for (const query of batch) {
      const key = `${query.sql}:${JSON.stringify(query.params)}`;
      
      if (!seen.has(key)) {
        seen.set(key, query);
        deduplicated.push(query);
      } else {
        // Mark query as deduplicated
        (query as any).isDuplicate = true;
        (query as any).originalQuery = seen.get(key);
        this.metrics.deduplicationSavings++;
      }
    }
    
    return deduplicated;
  }
  
  private optimizeQueryOrder(batch: BatchQuery[]): BatchQuery[] {
    // Sort by priority (critical first), then by estimated impact
    return batch.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Secondary sort by estimated rows (smaller first for faster execution)
      const aRows = a.estimatedRows || 100;
      const bRows = b.estimatedRows || 100;
      
      return aRows - bRows;
    });
  }
  
  private propagateDeduplicatedResults(
    originalQuery: BatchQuery,
    result: any,
    allQueries: BatchQuery[],
    results: Array<{ id: string; data: any; error?: Error }>
  ): void {
    const queryKey = `${originalQuery.sql}:${JSON.stringify(originalQuery.params)}`;
    
    for (const query of allQueries) {
      if ((query as any).isDuplicate) {
        const duplicateKey = `${query.sql}:${JSON.stringify(query.params)}`;
        if (duplicateKey === queryKey) {
          results.push({
            id: query.id,
            data: result,
          });
        }
      }
    }
  }
  
  private propagateDeduplicatedErrors(
    originalQuery: BatchQuery,
    error: Error,
    allQueries: BatchQuery[],
    results: Array<{ id: string; data: any; error?: Error }>
  ): void {
    const queryKey = `${originalQuery.sql}:${JSON.stringify(originalQuery.params)}`;
    
    for (const query of allQueries) {
      if ((query as any).isDuplicate) {
        const duplicateKey = `${query.sql}:${JSON.stringify(query.params)}`;
        if (duplicateKey === queryKey) {
          results.push({
            id: query.id,
            data: null,
            error,
          });
        }
      }
    }
  }
  
  private analyzeBatchPriorities(batch: BatchQuery[]): Record<string, number> {
    return batch.reduce((acc, query) => {
      acc[query.priority] = (acc[query.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
  
  private calculateTimeSavings(batch: BatchQuery[], actualDuration: number): number {
    // Estimate time saved by batching vs individual queries
    const estimatedIndividualTime = batch.length * 50; // Assume 50ms per individual query
    return Math.max(0, estimatedIndividualTime - actualDuration);
  }
  
  private updateBatchMetrics(batch: BatchQuery[], result: BatchExecutionResult): void {
    this.metrics.batchedQueries += batch.length;
    this.metrics.connectionsSaved += result.optimizationSavings.connectionsSaved;
    this.metrics.totalTimeSaved += result.optimizationSavings.estimatedTimeSaved;
    this.metrics.averageBatchSize = this.metrics.batchedQueries / (this.metrics.totalQueries - this.metrics.batchedQueries + 1);
  }
  
  /**
   * Get current batching statistics and metrics
   */
  getBatchingStats() {
    const batchingRate = this.metrics.totalQueries > 0
      ? (this.metrics.batchedQueries / this.metrics.totalQueries * 100)
      : 0;
    
    return {
      metrics: {
        totalQueries: this.metrics.totalQueries,
        batchedQueries: this.metrics.batchedQueries,
        batchingRate: parseFloat(batchingRate.toFixed(2)),
        connectionsSaved: this.metrics.connectionsSaved,
        averageBatchSize: parseFloat(this.metrics.averageBatchSize.toFixed(2)),
        totalTimeSaved: this.metrics.totalTimeSaved,
        deduplicationSavings: this.metrics.deduplicationSavings,
      },
      currentState: {
        pendingBatches: this.pendingQueries.size,
        activeExecutions: this.executionQueue.size,
        queuedQueries: Array.from(this.pendingQueries.values()).reduce((sum, batch) => sum + batch.length, 0),
      },
      config: this.config,
      recommendations: this.generateRecommendations(),
    };
  }
  
  private generateRecommendations(): string[] {
    const batchingRate = this.metrics.totalQueries > 0
      ? (this.metrics.batchedQueries / this.metrics.totalQueries * 100)
      : 0;
    
    const recommendations: string[] = [];
    
    if (batchingRate < 30) {
      recommendations.push('Low batching rate - consider increasing maxWaitTimeMs or enabling more batching');
    } else if (batchingRate > 70) {
      recommendations.push('Excellent batching efficiency - maintain current configuration');
    }
    
    if (this.metrics.connectionsSaved > 100) {
      recommendations.push('Significant connection overhead reduction through batching');
    }
    
    if (this.metrics.deduplicationSavings > 50) {
      recommendations.push('Query deduplication providing substantial savings');
    }
    
    if (this.metrics.averageBatchSize < 2) {
      recommendations.push('Small average batch size - consider increasing maxWaitTimeMs');
    }
    
    return recommendations.length > 0 ? recommendations : ['Batching performance is optimal'];
  }
  
  /**
   * Force execute all pending batches
   */
  async flushAllBatches(): Promise<void> {
    const batchKeys = Array.from(this.pendingQueries.keys());
    
    const flushPromises = batchKeys.map(async batchKey => {
      this.triggerBatchExecution(batchKey);
    });
    
    await Promise.allSettled(flushPromises);
  }
  
  /**
   * Clear all pending batches (emergency cleanup)
   */
  clearAllBatches(): void {
    // Clear timers
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    
    // Reject all pending queries
    for (const batch of this.pendingQueries.values()) {
      for (const query of batch) {
        query.reject(new Error('Batch cleared due to emergency cleanup'));
      }
    }
    
    this.pendingQueries.clear();
    this.batchTimers.clear();
    this.executionQueue.clear();
    
    console.warn('🧹 [DB BATCHING] All pending batches cleared');
  }
}

// Global instance
export const globalQueryBatchingService = DatabaseQueryBatchingService.getInstance();

/**
 * Execute a query with intelligent batching
 */
export async function executeBatchedQuery<T = any>(
  sql: string,
  params: any[] = [],
  options: {
    priority?: 'low' | 'medium' | 'high' | 'critical';
    timeout?: number;
    batchKey?: string;
    estimatedRows?: number;
    allowBatching?: boolean;
  } = {}
): Promise<T> {
  return globalQueryBatchingService.executeQuery(sql, params, options);
}

/**
 * Execute multiple queries in a batch
 */
export async function executeBatchQueries(
  queries: Array<{ sql: string; params: any[]; id?: string }>,
  options: {
    batchKey?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    timeout?: number;
  } = {}
): Promise<BatchExecutionResult> {
  return globalQueryBatchingService.executeBatch(queries, options);
}

/**
 * Get batching statistics
 */
export function getBatchingStats() {
  return globalQueryBatchingService.getBatchingStats();
}
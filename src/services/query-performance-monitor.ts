/**
 * Query Performance Monitor Service
 *
 * Monitors database query performance and provides metrics for optimization.
 * Integrates with OpenTelemetry for distributed tracing.
 */

import { trace } from "@opentelemetry/api";

interface QueryMetrics {
  queryName: string;
  executionTime: number;
  timestamp: Date;
  success: boolean;
  error?: string;
  operationType?: "select" | "insert" | "update" | "delete";
  tableName?: string;
}

interface QueryOptions {
  query?: string;
  parameters?: unknown[];
  userId?: string;
  operationType?: "select" | "insert" | "update" | "delete";
  tableName?: string;
}

class QueryPerformanceMonitor {
  private metrics: QueryMetrics[] = [];
  private isMonitoring = false;
  private maxMetrics = 1000; // Keep last 1000 queries in memory

  startMonitoring(): void {
    this.isMonitoring = true;
    console.info("[QueryPerformanceMonitor] Performance monitoring started");
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    console.info("[QueryPerformanceMonitor] Performance monitoring stopped");
  }

  async wrapQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    options?: QueryOptions
  ): Promise<T> {
    if (!this.isMonitoring) {
      // If monitoring is disabled, just execute the query
      return queryFn();
    }

    const tracer = trace.getTracer("query-performance-monitor");

    return tracer.startActiveSpan(`db_query_${queryName}`, async (span) => {
      const startTime = Date.now();
      let success = true;
      let error: string | undefined;

      try {
        // Set span attributes
        span.setAttributes({
          "db.operation": options?.operationType || "unknown",
          "db.table": options?.tableName || "unknown",
          "db.query_name": queryName,
          "db.user_id": options?.userId || "unknown",
        });

        const result = await queryFn();

        span.setAttributes({
          "db.success": true,
          "db.execution_time_ms": Date.now() - startTime,
        });

        return result;
      } catch (err) {
        success = false;
        error = err instanceof Error ? err.message : String(err);

        span.setAttributes({
          "db.success": false,
          "db.error": error,
          "db.execution_time_ms": Date.now() - startTime,
        });

        throw err;
      } finally {
        const executionTime = Date.now() - startTime;

        // Record metrics
        this.recordMetrics({
          queryName,
          executionTime,
          timestamp: new Date(),
          success,
          error,
          operationType: options?.operationType,
          tableName: options?.tableName,
        });

        span.end();
      }
    });
  }

  private recordMetrics(metrics: QueryMetrics): void {
    this.metrics.push(metrics);

    // Keep only the last maxMetrics entries
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log slow queries (over 1 second)
    if (metrics.executionTime > 1000) {
      console.warn("[QueryPerformanceMonitor] Slow query detected", {
        queryName: metrics.queryName,
        executionTime: metrics.executionTime,
        operationType: metrics.operationType,
        tableName: metrics.tableName,
        success: metrics.success,
        error: metrics.error,
      });
    }
  }

  getMetrics(): QueryMetrics[] {
    return [...this.metrics];
  }

  getSlowQueries(thresholdMs = 1000): QueryMetrics[] {
    return this.metrics.filter((m) => m.executionTime > thresholdMs);
  }

  getAverageExecutionTime(queryName?: string): number {
    const relevantMetrics = queryName
      ? this.metrics.filter((m) => m.queryName === queryName)
      : this.metrics;

    if (relevantMetrics.length === 0) return 0;

    const totalTime = relevantMetrics.reduce((sum, m) => sum + m.executionTime, 0);
    return totalTime / relevantMetrics.length;
  }

  getQueryStats(): {
    totalQueries: number;
    successRate: number;
    averageExecutionTime: number;
    slowQueries: number;
  } {
    const total = this.metrics.length;
    const successful = this.metrics.filter((m) => m.success).length;
    const slowQueries = this.getSlowQueries().length;
    const avgTime = this.getAverageExecutionTime();

    return {
      totalQueries: total,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      averageExecutionTime: avgTime,
      slowQueries,
    };
  }

  clearMetrics(): void {
    this.metrics = [];
    console.info("[QueryPerformanceMonitor] Metrics cleared");
  }
}

// Singleton instance
export const queryPerformanceMonitor = new QueryPerformanceMonitor();

// Default export for compatibility
export default queryPerformanceMonitor;

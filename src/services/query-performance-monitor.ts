import { createSafeLogger } from "../lib/structured-logger";

/**
 * Query Performance Monitor
 * Tracks database query performance and identifies slow queries
 * Provides insights for optimization opportunities
 */

interface QueryMetric {
  queryName: string;
  query: string;
  duration: number;
  timestamp: Date;
  parameters?: unknown[];
  stackTrace?: string;
  userId?: string;
}

interface PerformanceStats {
  totalQueries: number;
  averageDuration: number;
  slowQueries: number;
  fastQueries: number;
  errorQueries: number;
  recentSlowQueries: QueryMetric[];
}

interface QueryPattern {
  pattern: string;
  count: number;
  totalDuration: number;
  averageDuration: number;
  slowestDuration: number;
  lastExecuted: Date;
}

export class QueryPerformanceMonitor {
  private logger = createSafeLogger("query-performance-monitor");

  private static instance: QueryPerformanceMonitor;
  private metrics: QueryMetric[] = [];
  private readonly maxMetrics = 10000; // Keep last 10k queries
  private readonly slowQueryThreshold = 1000; // 1 second
  private readonly verySlowQueryThreshold = 5000; // 5 seconds
  private isMonitoring = false;

  private constructor() {}

  public static getInstance(): QueryPerformanceMonitor {
    if (!QueryPerformanceMonitor.instance) {
      QueryPerformanceMonitor.instance = new QueryPerformanceMonitor();
    }
    return QueryPerformanceMonitor.instance;
  }

  /**
   * Start monitoring query performance
   */
  startMonitoring(): void {
    this.isMonitoring = true;
    logger.info("📊 Query performance monitoring started");
  }

  /**
   * Stop monitoring query performance
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    logger.info("📊 Query performance monitoring stopped");
  }

  /**
   * Wrap a query function with performance monitoring
   */
  wrapQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    options?: {
      query?: string;
      parameters?: unknown[];
      userId?: string;
    }
  ): Promise<T> {
    if (!this.isMonitoring) {
      return queryFn();
    }

    const startTime = performance.now();
    const stackTrace = this.captureStackTrace();

    return queryFn()
      .then((result) => {
        const duration = performance.now() - startTime;
        this.recordMetric({
          queryName,
          query: options?.query || queryName,
          duration,
          timestamp: new Date(),
          parameters: options?.parameters,
          stackTrace,
          userId: options?.userId,
        });

        // Log slow queries immediately
        if (duration > this.slowQueryThreshold) {
          const level = duration > this.verySlowQueryThreshold ? "ERROR" : "WARN";
          logger.info(`[${level}] Slow query detected: ${queryName} took ${duration.toFixed(2)}ms`);

          if (options?.query) {
            logger.info(`Query: ${options.query}`);
          }

          if (options?.parameters) {
            logger.info(`Parameters:`, options.parameters);
          }
        }

        return result;
      })
      .catch((error) => {
        const duration = performance.now() - startTime;
        this.recordMetric({
          queryName: `${queryName}_ERROR`,
          query: options?.query || queryName,
          duration,
          timestamp: new Date(),
          parameters: options?.parameters,
          stackTrace,
          userId: options?.userId,
        });

        logger.error(`❌ Query failed: ${queryName} took ${duration.toFixed(2)}ms`, error);
        throw error;
      });
  }

  /**
   * Record a query metric
   */
  private recordMetric(metric: QueryMetric): void {
    this.metrics.push(metric);

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(timeframeMinutes = 60): PerformanceStats {
    const cutoffTime = new Date(Date.now() - timeframeMinutes * 60 * 1000);
    const recentMetrics = this.metrics.filter((m) => m.timestamp >= cutoffTime);

    if (recentMetrics.length === 0) {
      return {
        totalQueries: 0,
        averageDuration: 0,
        slowQueries: 0,
        fastQueries: 0,
        errorQueries: 0,
        recentSlowQueries: [],
      };
    }

    const totalDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0);
    const slowQueries = recentMetrics.filter((m) => m.duration > this.slowQueryThreshold);
    const fastQueries = recentMetrics.filter((m) => m.duration <= this.slowQueryThreshold);
    const errorQueries = recentMetrics.filter((m) => m.queryName.endsWith("_ERROR"));

    return {
      totalQueries: recentMetrics.length,
      averageDuration: totalDuration / recentMetrics.length,
      slowQueries: slowQueries.length,
      fastQueries: fastQueries.length,
      errorQueries: errorQueries.length,
      recentSlowQueries: slowQueries.sort((a, b) => b.duration - a.duration).slice(0, 10), // Top 10 slowest
    };
  }

  /**
   * Analyze query patterns
   */
  analyzeQueryPatterns(timeframeMinutes = 60): QueryPattern[] {
    const cutoffTime = new Date(Date.now() - timeframeMinutes * 60 * 1000);
    const recentMetrics = this.metrics.filter((m) => m.timestamp >= cutoffTime);

    const patterns = new Map<string, QueryPattern>();

    for (const metric of recentMetrics) {
      // Normalize query name for pattern analysis
      const pattern = this.normalizeQueryName(metric.queryName);

      if (!patterns.has(pattern)) {
        patterns.set(pattern, {
          pattern,
          count: 0,
          totalDuration: 0,
          averageDuration: 0,
          slowestDuration: 0,
          lastExecuted: metric.timestamp,
        });
      }

      const patternData = patterns.get(pattern);
      if (!patternData) continue;
      patternData.count++;
      patternData.totalDuration += metric.duration;
      patternData.slowestDuration = Math.max(patternData.slowestDuration, metric.duration);
      patternData.lastExecuted =
        metric.timestamp > patternData.lastExecuted ? metric.timestamp : patternData.lastExecuted;
    }

    // Calculate averages
    for (const pattern of patterns.values()) {
      pattern.averageDuration = pattern.totalDuration / pattern.count;
    }

    return Array.from(patterns.values()).sort((a, b) => b.totalDuration - a.totalDuration); // Sort by total time spent
  }

  /**
   * Get slow query recommendations
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex recommendation logic with multiple conditions and patterns
  getOptimizationRecommendations(timeframeMinutes = 60): {
    recommendation: string;
    queryPattern: string;
    impact: "high" | "medium" | "low";
    frequency: number;
    averageDuration: number;
  }[] {
    const patterns = this.analyzeQueryPatterns(timeframeMinutes);
    const recommendations: {
      recommendation: string;
      queryPattern: string;
      impact: "high" | "medium" | "low";
      frequency: number;
      averageDuration: number;
    }[] = [];

    for (const pattern of patterns) {
      if (pattern.averageDuration > this.slowQueryThreshold) {
        let recommendation = "";
        let impact: "high" | "medium" | "low" = "low";

        // Analyze query pattern and suggest optimizations
        if (pattern.pattern.includes("execution_history") && pattern.count > 50) {
          recommendation =
            "Consider adding indexes on execution_history table for frequent queries";
          impact = "high";
        } else if (pattern.pattern.includes("snipe_targets") && pattern.averageDuration > 2000) {
          recommendation = "Optimize snipe_targets queries with compound indexes";
          impact = "high";
        } else if (pattern.pattern.includes("user_preferences") && pattern.count > 100) {
          recommendation = "Cache user preferences to reduce database load";
          impact = "medium";
        } else if (pattern.averageDuration > this.verySlowQueryThreshold) {
          recommendation = "Query is very slow and needs immediate optimization";
          impact = "high";
        } else {
          recommendation = "Consider query optimization or caching";
          impact = "medium";
        }

        recommendations.push({
          recommendation,
          queryPattern: pattern.pattern,
          impact,
          frequency: pattern.count,
          averageDuration: pattern.averageDuration,
        });
      }
    }

    return recommendations.sort((a, b) => {
      // Sort by impact first, then by frequency
      const impactOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
      const aImpact = impactOrder[a.impact] || 1;
      const bImpact = impactOrder[b.impact] || 1;
      if (aImpact !== bImpact) {
        return bImpact - aImpact;
      }
      return b.frequency - a.frequency;
    });
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    logger.info("📊 Query performance metrics cleared");
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(timeframeMinutes = 60): {
    exportedAt: Date;
    timeframeMinutes: number;
    metrics: QueryMetric[];
    stats: PerformanceStats;
    patterns: QueryPattern[];
  } {
    const cutoffTime = new Date(Date.now() - timeframeMinutes * 60 * 1000);
    const recentMetrics = this.metrics.filter((m) => m.timestamp >= cutoffTime);

    return {
      exportedAt: new Date(),
      timeframeMinutes,
      metrics: recentMetrics,
      stats: this.getPerformanceStats(timeframeMinutes),
      patterns: this.analyzeQueryPatterns(timeframeMinutes),
    };
  }

  /**
   * Capture stack trace for debugging
   */
  private captureStackTrace(): string {
    const error = new Error();
    return error.stack?.split("\n").slice(2, 6).join("\n") || "";
  }

  /**
   * Normalize query name for pattern analysis
   */
  private normalizeQueryName(queryName: string): string {
    // Remove specific IDs and parameters to group similar queries
    return queryName
      .replace(/\d+/g, "N") // Replace numbers with N
      .replace(/_ERROR$/, "") // Remove error suffix
      .replace(/user-\w+/g, "user-X"); // Replace user IDs
  }

  /**
   * Get monitoring status
   */
  getStatus(): {
    isMonitoring: boolean;
    totalMetrics: number;
    slowQueryThreshold: number;
    verySlowQueryThreshold: number;
    maxMetrics: number;
  } {
    return {
      isMonitoring: this.isMonitoring,
      totalMetrics: this.metrics.length,
      slowQueryThreshold: this.slowQueryThreshold,
      verySlowQueryThreshold: this.verySlowQueryThreshold,
      maxMetrics: this.maxMetrics,
    };
  }
}

// Export singleton instance
export const queryPerformanceMonitor = QueryPerformanceMonitor.getInstance();

// Convenience wrapper for database operations
export function monitorQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  options?: {
    query?: string;
    parameters?: unknown[];
    userId?: string;
  }
): Promise<T> {
  return queryPerformanceMonitor.wrapQuery(queryName, queryFn, options);
}

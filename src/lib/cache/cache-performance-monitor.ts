/**
 * Cache Performance Monitor
 * 
 * Tracks and analyzes cache performance metrics for agents with detailed
 * statistics on hit rates, response times, and efficiency calculations.
 * 
 * FEATURES:
 * - Real-time performance metrics tracking
 * - Cache hit/miss/set event monitoring
 * - Efficiency calculations and scoring
 * - Agent performance comparison
 * - Throughput and response time analytics
 * - Performance trend analysis
 */

import type {
  AgentCacheConfig,
  AgentCacheMetrics,
  CachePerformanceMetrics,
} from "./agent-cache-types";

export class CachePerformanceMonitor {
  private config: AgentCacheConfig;
  private performanceMetrics: Map<string, AgentCacheMetrics> = new Map();
  private responseTimeHistory: Map<string, number[]> = new Map();
  private readonly HISTORY_SIZE = 100; // Keep last 100 response times

  constructor(config: AgentCacheConfig) {
    this.config = config;
  }

  /**
   * Track cache hit for performance metrics
   */
  async trackCacheHit(agentId: string, cacheKey: string, responseTime?: number): Promise<void> {
    if (!this.config.enablePerformanceTracking) {
      return;
    }

    try {
      const metrics = this.performanceMetrics.get(agentId) || this.createDefaultMetrics(agentId);

      metrics.cacheHits++;
      metrics.totalExecutions++;
      metrics.successfulExecutions++;
      metrics.lastActivity = Date.now();

      // Update response time if provided (cached responses are typically faster)
      if (responseTime !== undefined) {
        this.updateResponseTime(agentId, responseTime);
        metrics.avgResponseTime = this.calculateAverageResponseTime(agentId);
      }

      // Calculate throughput (requests per minute)
      metrics.throughput = this.calculateThroughput(agentId);

      this.performanceMetrics.set(agentId, metrics);
    } catch (error) {
      console.error(`[CachePerformanceMonitor] Error tracking cache hit for ${agentId}:`, error);
    }
  }

  /**
   * Track cache set for performance metrics
   */
  async trackCacheSet(agentId: string, cacheKey: string, ttl: number, responseTime?: number): Promise<void> {
    if (!this.config.enablePerformanceTracking) {
      return;
    }

    try {
      const metrics = this.performanceMetrics.get(agentId) || this.createDefaultMetrics(agentId);

      metrics.cacheSets++;
      metrics.totalExecutions++;
      metrics.successfulExecutions++;
      metrics.lastActivity = Date.now();

      // Update response time for cache set operations
      if (responseTime !== undefined) {
        this.updateResponseTime(agentId, responseTime);
        metrics.avgResponseTime = this.calculateAverageResponseTime(agentId);
      }

      // Calculate throughput
      metrics.throughput = this.calculateThroughput(agentId);

      this.performanceMetrics.set(agentId, metrics);
    } catch (error) {
      console.error(`[CachePerformanceMonitor] Error tracking cache set for ${agentId}:`, error);
    }
  }

  /**
   * Track cache miss for performance metrics
   */
  async trackCacheMiss(agentId: string, responseTime?: number): Promise<void> {
    if (!this.config.enablePerformanceTracking) {
      return;
    }

    try {
      const metrics = this.performanceMetrics.get(agentId) || this.createDefaultMetrics(agentId);

      metrics.totalExecutions++;
      metrics.lastActivity = Date.now();

      // Update response time for cache miss (typically slower)
      if (responseTime !== undefined) {
        this.updateResponseTime(agentId, responseTime);
        metrics.avgResponseTime = this.calculateAverageResponseTime(agentId);
      }

      // Calculate throughput
      metrics.throughput = this.calculateThroughput(agentId);

      this.performanceMetrics.set(agentId, metrics);
    } catch (error) {
      console.error(`[CachePerformanceMonitor] Error tracking cache miss for ${agentId}:`, error);
    }
  }

  /**
   * Track failed execution
   */
  async trackCacheError(agentId: string, error: Error, responseTime?: number): Promise<void> {
    if (!this.config.enablePerformanceTracking) {
      return;
    }

    try {
      const metrics = this.performanceMetrics.get(agentId) || this.createDefaultMetrics(agentId);

      metrics.totalExecutions++;
      metrics.failedExecutions++;
      metrics.lastActivity = Date.now();

      // Update error rate
      metrics.errorRate = (metrics.failedExecutions / metrics.totalExecutions) * 100;

      // Update response time even for errors
      if (responseTime !== undefined) {
        this.updateResponseTime(agentId, responseTime);
        metrics.avgResponseTime = this.calculateAverageResponseTime(agentId);
      }

      this.performanceMetrics.set(agentId, metrics);
    } catch (trackingError) {
      console.error(`[CachePerformanceMonitor] Error tracking cache error for ${agentId}:`, trackingError);
    }
  }

  /**
   * Get performance metrics for a specific agent
   */
  getAgentMetrics(agentId: string): AgentCacheMetrics | null {
    return this.performanceMetrics.get(agentId) || null;
  }

  /**
   * Get all performance metrics
   */
  getAllMetrics(): Map<string, AgentCacheMetrics> {
    return new Map(this.performanceMetrics);
  }

  /**
   * Get comprehensive performance metrics
   */
  getPerformanceMetrics(): CachePerformanceMetrics {
    const allMetrics = Array.from(this.performanceMetrics.values());
    
    if (allMetrics.length === 0) {
      return {
        hitRate: 0,
        missRate: 0,
        responseTime: 0,
        throughput: 0,
        memoryUsage: 0,
        errorRate: 0,
        evictionCount: 0,
        warmupHits: 0,
      };
    }

    const totalExecutions = allMetrics.reduce((sum, m) => sum + m.totalExecutions, 0);
    const totalHits = allMetrics.reduce((sum, m) => sum + m.cacheHits, 0);
    const totalErrors = allMetrics.reduce((sum, m) => sum + m.failedExecutions, 0);
    const avgResponseTime = allMetrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / allMetrics.length;
    const avgThroughput = allMetrics.reduce((sum, m) => sum + m.throughput, 0) / allMetrics.length;

    return {
      hitRate: totalExecutions > 0 ? (totalHits / totalExecutions) * 100 : 0,
      missRate: totalExecutions > 0 ? ((totalExecutions - totalHits) / totalExecutions) * 100 : 0,
      responseTime: avgResponseTime,
      throughput: avgThroughput,
      memoryUsage: this.calculateMemoryUsage(),
      errorRate: totalExecutions > 0 ? (totalErrors / totalExecutions) * 100 : 0,
      evictionCount: 0, // Would need to be tracked separately
      warmupHits: 0, // Would need to be tracked separately
    };
  }

  /**
   * Calculate cache efficiency for an agent
   */
  calculateCacheEfficiency(agentId: string): number {
    const metrics = this.performanceMetrics.get(agentId);
    if (!metrics) return 0;

    const totalRequests = metrics.totalExecutions;
    if (totalRequests === 0) return 0;

    const hitRate = (metrics.cacheHits / totalRequests) * 100;
    const errorRate = metrics.errorRate;
    const responseTimeScore = Math.max(0, 100 - metrics.avgResponseTime / 10);

    return hitRate * 0.5 + responseTimeScore * 0.3 + (100 - errorRate) * 0.2;
  }

  /**
   * Get top performing agents
   */
  getTopPerformingAgents(limit = 10): Array<{ agentId: string; efficiency: number; metrics: AgentCacheMetrics }> {
    return Array.from(this.performanceMetrics.entries())
      .map(([agentId, metrics]) => ({
        agentId,
        efficiency: this.calculateCacheEfficiency(agentId),
        metrics,
      }))
      .sort((a, b) => b.efficiency - a.efficiency)
      .slice(0, limit);
  }

  /**
   * Reset metrics for a specific agent
   */
  resetAgentMetrics(agentId: string): void {
    this.performanceMetrics.delete(agentId);
    this.responseTimeHistory.delete(agentId);
  }

  /**
   * Reset all metrics
   */
  resetAllMetrics(): void {
    this.performanceMetrics.clear();
    this.responseTimeHistory.clear();
  }

  /**
   * Get performance report for an agent
   */
  getAgentPerformanceReport(agentId: string): {
    metrics: AgentCacheMetrics | null;
    efficiency: number;
    hitRate: number;
    missRate: number;
    recommendations: string[];
  } {
    const metrics = this.getAgentMetrics(agentId);
    const efficiency = this.calculateCacheEfficiency(agentId);
    const recommendations: string[] = [];

    let hitRate = 0;
    let missRate = 0;

    if (metrics && metrics.totalExecutions > 0) {
      hitRate = (metrics.cacheHits / metrics.totalExecutions) * 100;
      missRate = 100 - hitRate;

      // Generate recommendations
      if (hitRate < 30) {
        recommendations.push("Low cache hit rate - consider adjusting TTL or cache strategy");
      }
      if (metrics.avgResponseTime > 5000) {
        recommendations.push("High response time - consider performance optimization");
      }
      if (metrics.errorRate > 10) {
        recommendations.push("High error rate - investigate error patterns");
      }
      if (efficiency < 50) {
        recommendations.push("Low cache efficiency - review caching strategy");
      }
    }

    return {
      metrics,
      efficiency,
      hitRate,
      missRate,
      recommendations,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Create default metrics for a new agent
   */
  private createDefaultMetrics(agentId: string): AgentCacheMetrics {
    return {
      agentId,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      avgResponseTime: 0,
      errorRate: 0,
      lastActivity: Date.now(),
      cacheHits: 0,
      cacheSets: 0,
      throughput: 0,
    };
  }

  /**
   * Update response time history for an agent
   */
  private updateResponseTime(agentId: string, responseTime: number): void {
    const history = this.responseTimeHistory.get(agentId) || [];
    history.push(responseTime);
    
    // Keep only the last N response times
    if (history.length > this.HISTORY_SIZE) {
      history.shift();
    }
    
    this.responseTimeHistory.set(agentId, history);
  }

  /**
   * Calculate average response time from history
   */
  private calculateAverageResponseTime(agentId: string): number {
    const history = this.responseTimeHistory.get(agentId) || [];
    if (history.length === 0) return 0;
    
    return history.reduce((sum, time) => sum + time, 0) / history.length;
  }

  /**
   * Calculate throughput (requests per minute)
   */
  private calculateThroughput(agentId: string): number {
    const metrics = this.performanceMetrics.get(agentId);
    if (!metrics) return 0;
    
    const timeElapsed = Date.now() - metrics.lastActivity;
    const minutesElapsed = Math.max(1, timeElapsed / (1000 * 60));
    
    return metrics.totalExecutions / minutesElapsed;
  }

  /**
   * Calculate estimated memory usage
   */
  private calculateMemoryUsage(): number {
    // Rough estimation based on metrics objects
    const metricsSize = this.performanceMetrics.size * 500; // ~500 bytes per metrics object
    const historySize = Array.from(this.responseTimeHistory.values())
      .reduce((sum, history) => sum + history.length, 0) * 8; // 8 bytes per number
    
    return metricsSize + historySize;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AgentCacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
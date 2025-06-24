/**
 * Performance Monitoring Service for MEXC Sniper Bot
 *
 * Phase 2 Implementation: Real-time Performance Dashboards & Monitoring
 *
 * This service provides comprehensive performance monitoring:
 * - Real-time cache performance metrics
 * - API response time tracking
 * - Pattern detection accuracy monitoring
 * - Activity data effectiveness tracking
 * - System health and resource usage
 * - Performance alerts and recommendations
 */

import { getCacheWarmingService, type WarmupMetrics } from "./cache-warming-service";
import { type CachePerformanceMetrics, getEnhancedUnifiedCache } from "./enhanced-unified-cache";
import { getIncrementalDataProcessor, type ProcessingMetrics } from "./incremental-data-processor";
import { getRedisCacheService } from "./redis-cache-service";

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface SystemPerformanceMetrics {
  timestamp: number;
  cache: CachePerformanceMetrics;
  warmup: WarmupMetrics;
  processing: ProcessingMetrics;
  api: ApiPerformanceMetrics;
  pattern: PatternDetectionMetrics;
  system: SystemResourceMetrics;
}

export interface ApiPerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  timeouts: number;
}

export interface PatternDetectionMetrics {
  totalAnalyses: number;
  readyStateDetections: number;
  falsePositives: number;
  truePositives: number;
  accuracy: number;
  avgConfidenceScore: number;
  advanceDetectionTime: number; // Average hours of advance notice
  activityEnhancementImpact: number; // Percentage improvement from activity data
}

export interface SystemResourceMetrics {
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage: number;
  networkLatency: number;
  diskUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  activeConnections: number;
}

export interface PerformanceAlert {
  id: string;
  type: "warning" | "error" | "critical";
  category: "cache" | "api" | "pattern" | "system" | "processing";
  message: string;
  timestamp: number;
  threshold: number;
  currentValue: number;
  recommendation?: string;
  resolved: boolean;
}

export interface PerformanceRecommendation {
  id: string;
  category: "cache" | "api" | "pattern" | "system" | "processing";
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  expectedImpact: string;
  implementationEffort: "low" | "medium" | "high";
  timestamp: number;
}

export interface MonitoringConfig {
  enableRealTimeMonitoring: boolean;
  metricsCollectionInterval: number;
  alertThresholds: {
    cacheHitRate: number;
    apiResponseTime: number;
    errorRate: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  enableAlerts: boolean;
  enableRecommendations: boolean;
  retentionPeriod: number; // milliseconds
}

// ============================================================================
// Performance Monitoring Service Implementation
// ============================================================================

export class PerformanceMonitoringService {
  private _logger?: {
    info: (message: string, context?: any) => void;
    warn: (message: string, context?: any) => void;
    error: (message: string, context?: any, error?: Error) => void;
    debug: (message: string, context?: any) => void;
  };

  private get logger() {
    if (!this._logger) {
      this._logger = {
        info: (message: string, context?: any) =>
          console.info("[performance-monitoring-service]", message, context || ""),
        warn: (message: string, context?: any) =>
          console.warn("[performance-monitoring-service]", message, context || ""),
        error: (message: string, context?: any, error?: Error) =>
          console.error("[performance-monitoring-service]", message, context || "", error || ""),
        debug: (message: string, context?: any) =>
          console.debug("[performance-monitoring-service]", message, context || ""),
      };
    }
    return this._logger;
  }

  // PERFORMANCE OPTIMIZATION: Memory leak prevention with size limits
  private static readonly MAX_HISTORY_SIZE = 1000;
  private static readonly MAX_ALERTS_SIZE = 500;
  private static readonly MAX_RECOMMENDATIONS_SIZE = 200;
  private static readonly MAX_RESPONSE_TIMES_SIZE = 1000;

  private config: MonitoringConfig;
  private metricsHistory: SystemPerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private recommendations: PerformanceRecommendation[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private apiMetrics: ApiPerformanceMetrics;
  private patternMetrics: PatternDetectionMetrics;
  private responseTimes: number[] = [];

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      enableRealTimeMonitoring: true,
      metricsCollectionInterval: 30000, // 30 seconds
      alertThresholds: {
        cacheHitRate: 70, // Below 70% hit rate
        apiResponseTime: 1000, // Above 1 second
        errorRate: 5, // Above 5% error rate
        memoryUsage: 80, // Above 80% memory usage
        cpuUsage: 80, // Above 80% CPU usage
      },
      enableAlerts: true,
      enableRecommendations: true,
      retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      ...config,
    };

    this.apiMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      requestsPerSecond: 0,
      errorRate: 0,
      timeouts: 0,
    };

    this.patternMetrics = {
      totalAnalyses: 0,
      readyStateDetections: 0,
      falsePositives: 0,
      truePositives: 0,
      accuracy: 0,
      avgConfidenceScore: 0,
      advanceDetectionTime: 0,
      activityEnhancementImpact: 0,
    };

    if (this.config.enableRealTimeMonitoring) {
      this.startMonitoring();
    }
  }

  // ============================================================================
  // Monitoring Management
  // ============================================================================

  private startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
    }, this.config.metricsCollectionInterval);

    console.info("[PerformanceMonitoring] Real-time monitoring started");
  }

  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = Date.now();

      // Collect metrics from all services
      const cache = getEnhancedUnifiedCache();
      const warmupService = getCacheWarmingService();
      const processingService = getIncrementalDataProcessor();

      const metrics: SystemPerformanceMetrics = {
        timestamp,
        cache: cache.getPerformanceMetrics(),
        warmup: warmupService.getMetrics(),
        processing: processingService.getMetrics(),
        api: { ...this.apiMetrics },
        pattern: { ...this.patternMetrics },
        system: await this.collectSystemMetrics(),
      };

      // Store metrics
      this.addToMetricsHistory(metrics);

      // Clean up old metrics
      this.cleanupOldMetrics();

      // Check for alerts
      if (this.config.enableAlerts) {
        this.checkAlerts(metrics);
      }

      // Generate recommendations
      if (this.config.enableRecommendations) {
        this.generateRecommendations(metrics);
      }

      console.info(
        `[PerformanceMonitoring] Metrics collected at ${new Date(timestamp).toISOString()}`
      );
    } catch (error) {
      console.error("[PerformanceMonitoring] Failed to collect metrics:", error);
    }
  }

  private async collectSystemMetrics(): Promise<SystemResourceMetrics> {
    try {
      // Get memory usage
      const memoryUsage = process.memoryUsage();
      const totalMemory = memoryUsage.heapTotal + memoryUsage.external;
      const usedMemory = memoryUsage.heapUsed;

      // Get Redis connection info if available
      const redisService = getRedisCacheService();
      const redisMetrics = redisService.getMetrics();

      return {
        memoryUsage: {
          used: usedMemory,
          total: totalMemory,
          percentage: (usedMemory / totalMemory) * 100,
        },
        cpuUsage: await this.getCpuUsage(),
        networkLatency: await this.measureNetworkLatency(),
        diskUsage: {
          used: 0, // Would be implemented with actual disk monitoring
          total: 0,
          percentage: 0,
        },
        activeConnections: redisMetrics.connectionStatus === "connected" ? 1 : 0,
      };
    } catch (error) {
      console.error("[PerformanceMonitoring] Failed to collect system metrics:", error);
      return {
        memoryUsage: { used: 0, total: 0, percentage: 0 },
        cpuUsage: 0,
        networkLatency: 0,
        diskUsage: { used: 0, total: 0, percentage: 0 },
        activeConnections: 0,
      };
    }
  }

  private async getCpuUsage(): Promise<number> {
    // Simplified CPU usage calculation
    const startUsage = process.cpuUsage();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const endUsage = process.cpuUsage(startUsage);

    const totalUsage = endUsage.user + endUsage.system;
    return (totalUsage / 100000) * 100; // Convert to percentage
  }

  private async measureNetworkLatency(): Promise<number> {
    const start = Date.now();
    try {
      // Simple latency test (would be replaced with actual network test)
      await new Promise((resolve) => setTimeout(resolve, 1));
      return Date.now() - start;
    } catch {
      return -1; // Indicate failure
    }
  }

  // ============================================================================
  // Alert Management
  // ============================================================================

  private checkAlerts(metrics: SystemPerformanceMetrics): void {
    const alerts: PerformanceAlert[] = [];

    // Cache hit rate alert
    if (metrics.cache.overall.overallHitRate < this.config.alertThresholds.cacheHitRate) {
      alerts.push({
        id: `cache-hit-rate-${Date.now()}`,
        type: "warning",
        category: "cache",
        message: `Cache hit rate is below threshold: ${metrics.cache.overall.overallHitRate.toFixed(1)}%`,
        timestamp: Date.now(),
        threshold: this.config.alertThresholds.cacheHitRate,
        currentValue: metrics.cache.overall.overallHitRate,
        recommendation: "Consider increasing cache TTL or implementing cache warming strategies",
        resolved: false,
      });
    }

    // API response time alert
    if (metrics.api.avgResponseTime > this.config.alertThresholds.apiResponseTime) {
      alerts.push({
        id: `api-response-time-${Date.now()}`,
        type: "warning",
        category: "api",
        message: `API response time is above threshold: ${metrics.api.avgResponseTime}ms`,
        timestamp: Date.now(),
        threshold: this.config.alertThresholds.apiResponseTime,
        currentValue: metrics.api.avgResponseTime,
        recommendation: "Check network connectivity and consider implementing request batching",
        resolved: false,
      });
    }

    // Error rate alert
    if (metrics.api.errorRate > this.config.alertThresholds.errorRate) {
      alerts.push({
        id: `api-error-rate-${Date.now()}`,
        type: "error",
        category: "api",
        message: `API error rate is above threshold: ${metrics.api.errorRate.toFixed(1)}%`,
        timestamp: Date.now(),
        threshold: this.config.alertThresholds.errorRate,
        currentValue: metrics.api.errorRate,
        recommendation: "Investigate API failures and implement better error handling",
        resolved: false,
      });
    }

    // Memory usage alert
    if (metrics.system.memoryUsage.percentage > this.config.alertThresholds.memoryUsage) {
      alerts.push({
        id: `memory-usage-${Date.now()}`,
        type: "warning",
        category: "system",
        message: `Memory usage is above threshold: ${metrics.system.memoryUsage.percentage.toFixed(1)}%`,
        timestamp: Date.now(),
        threshold: this.config.alertThresholds.memoryUsage,
        currentValue: metrics.system.memoryUsage.percentage,
        recommendation: "Consider implementing memory cleanup or increasing available memory",
        resolved: false,
      });
    }

    // Add new alerts
    this.addToAlerts(alerts);

    if (alerts.length > 0) {
      console.warn(`[PerformanceMonitoring] Generated ${alerts.length} new alerts`);
    }
  }

  // ============================================================================
  // Recommendation Engine
  // ============================================================================

  private generateRecommendations(metrics: SystemPerformanceMetrics): void {
    const recommendations: PerformanceRecommendation[] = [];

    // Cache optimization recommendations
    if (metrics.cache.overall.overallHitRate < 80) {
      recommendations.push({
        id: `cache-optimization-${Date.now()}`,
        category: "cache",
        priority: "medium",
        title: "Optimize Cache Hit Rate",
        description:
          "Cache hit rate is below optimal levels. Consider implementing cache warming or adjusting TTL values.",
        expectedImpact: "Improve response times by 20-30%",
        implementationEffort: "medium",
        timestamp: Date.now(),
      });
    }

    // Processing efficiency recommendations
    if (metrics.processing.dataEfficiency < 60) {
      recommendations.push({
        id: `processing-efficiency-${Date.now()}`,
        category: "processing",
        priority: "high",
        title: "Improve Incremental Processing",
        description:
          "Data processing efficiency is low. More full updates than delta updates are being performed.",
        expectedImpact: "Reduce processing time by 40-50%",
        implementationEffort: "low",
        timestamp: Date.now(),
      });
    }

    // API performance recommendations
    if (metrics.api.avgResponseTime > 500) {
      recommendations.push({
        id: `api-performance-${Date.now()}`,
        category: "api",
        priority: "high",
        title: "Optimize API Performance",
        description:
          "API response times are higher than optimal. Consider implementing request batching or connection pooling.",
        expectedImpact: "Reduce API response times by 30-40%",
        implementationEffort: "medium",
        timestamp: Date.now(),
      });
    }

    // Add new recommendations (avoid duplicates)
    const existingIds = new Set(this.recommendations.map((r) => r.id));
    const newRecommendations = recommendations.filter((r) => !existingIds.has(r.id));
    this.addToRecommendations(newRecommendations);

    if (newRecommendations.length > 0) {
      console.info(
        `[PerformanceMonitoring] Generated ${newRecommendations.length} new recommendations`
      );
    }
  }

  // ============================================================================
  // API Metrics Tracking
  // ============================================================================

  trackApiRequest(responseTime: number, success: boolean): void {
    this.apiMetrics.totalRequests++;

    if (success) {
      this.apiMetrics.successfulRequests++;
    } else {
      this.apiMetrics.failedRequests++;
    }

    // Update response times
    this.addToResponseTimes(responseTime);

    // Calculate metrics
    this.apiMetrics.avgResponseTime =
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    this.apiMetrics.errorRate =
      (this.apiMetrics.failedRequests / this.apiMetrics.totalRequests) * 100;

    // Calculate percentiles
    const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
    this.apiMetrics.p95ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
    this.apiMetrics.p99ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0;
  }

  trackPatternDetection(
    confidence: number,
    isReadyState: boolean,
    isCorrect?: boolean,
    advanceHours?: number,
    activityEnhancement?: number
  ): void {
    this.patternMetrics.totalAnalyses++;

    if (isReadyState) {
      this.patternMetrics.readyStateDetections++;
    }

    if (isCorrect !== undefined) {
      if (isCorrect) {
        this.patternMetrics.truePositives++;
      } else {
        this.patternMetrics.falsePositives++;
      }
    }

    // Update average confidence
    this.patternMetrics.avgConfidenceScore =
      (this.patternMetrics.avgConfidenceScore * (this.patternMetrics.totalAnalyses - 1) +
        confidence) /
      this.patternMetrics.totalAnalyses;

    // Update accuracy
    const totalValidated = this.patternMetrics.truePositives + this.patternMetrics.falsePositives;
    if (totalValidated > 0) {
      this.patternMetrics.accuracy = (this.patternMetrics.truePositives / totalValidated) * 100;
    }

    // Update advance detection time
    if (advanceHours !== undefined) {
      this.patternMetrics.advanceDetectionTime =
        (this.patternMetrics.advanceDetectionTime * (this.patternMetrics.readyStateDetections - 1) +
          advanceHours) /
        this.patternMetrics.readyStateDetections;
    }

    // Update activity enhancement impact
    if (activityEnhancement !== undefined) {
      this.patternMetrics.activityEnhancementImpact =
        (this.patternMetrics.activityEnhancementImpact * (this.patternMetrics.totalAnalyses - 1) +
          activityEnhancement) /
        this.patternMetrics.totalAnalyses;
    }
  }

  // ============================================================================
  // Data Management
  // ============================================================================

  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - this.config.retentionPeriod;

    this.metricsHistory = this.metricsHistory.filter((m) => m.timestamp > cutoffTime);
    this.alerts = this.alerts.filter((a) => a.timestamp > cutoffTime);
    this.recommendations = this.recommendations.filter((r) => r.timestamp > cutoffTime);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  getCurrentMetrics(): SystemPerformanceMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null;
  }

  getMetricsHistory(hours = 1): SystemPerformanceMetrics[] {
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
    return this.metricsHistory.filter((m) => m.timestamp > cutoffTime);
  }

  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter((a) => !a.resolved);
  }

  getRecommendations(category?: string): PerformanceRecommendation[] {
    return category
      ? this.recommendations.filter((r) => r.category === category)
      : this.recommendations;
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      return true;
    }
    return false;
  }

  getDashboardData(): {
    current: SystemPerformanceMetrics | null;
    alerts: PerformanceAlert[];
    recommendations: PerformanceRecommendation[];
    trends: {
      cacheHitRate: number[];
      apiResponseTime: number[];
      errorRate: number[];
    };
  } {
    const recentMetrics = this.getMetricsHistory(1);

    return {
      current: this.getCurrentMetrics(),
      alerts: this.getActiveAlerts(),
      recommendations: this.getRecommendations(),
      trends: {
        cacheHitRate: recentMetrics.map((m) => m.cache.overall.overallHitRate),
        apiResponseTime: recentMetrics.map((m) => m.api.avgResponseTime),
        errorRate: recentMetrics.map((m) => m.api.errorRate),
      },
    };
  }

  // ============================================================================
  // PERFORMANCE OPTIMIZATION: Memory Management Helpers
  // ============================================================================

  private addToMetricsHistory(metrics: SystemPerformanceMetrics): void {
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > PerformanceMonitoringService.MAX_HISTORY_SIZE) {
      this.metricsHistory = this.metricsHistory.slice(
        -PerformanceMonitoringService.MAX_HISTORY_SIZE
      );
    }
  }

  private addToAlerts(alerts: PerformanceAlert[]): void {
    this.alerts.push(...alerts);
    if (this.alerts.length > PerformanceMonitoringService.MAX_ALERTS_SIZE) {
      this.alerts = this.alerts.slice(-PerformanceMonitoringService.MAX_ALERTS_SIZE);
    }
  }

  private addToRecommendations(recommendations: PerformanceRecommendation[]): void {
    this.recommendations.push(...recommendations);
    if (this.recommendations.length > PerformanceMonitoringService.MAX_RECOMMENDATIONS_SIZE) {
      this.recommendations = this.recommendations.slice(
        -PerformanceMonitoringService.MAX_RECOMMENDATIONS_SIZE
      );
    }
  }

  private addToResponseTimes(responseTime: number): void {
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > PerformanceMonitoringService.MAX_RESPONSE_TIMES_SIZE) {
      this.responseTimes = this.responseTimes.slice(
        -PerformanceMonitoringService.MAX_RESPONSE_TIMES_SIZE
      );
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.metricsHistory = [];
    this.alerts = [];
    this.recommendations = [];
    this.responseTimes = [];

    console.info("[PerformanceMonitoring] Service destroyed");
  }
}

// ============================================================================
// Global Performance Monitoring Instance
// ============================================================================

let globalPerformanceMonitoringInstance: PerformanceMonitoringService | null = null;

export function getPerformanceMonitoringService(
  config?: Partial<MonitoringConfig>
): PerformanceMonitoringService {
  if (!globalPerformanceMonitoringInstance || config) {
    globalPerformanceMonitoringInstance = new PerformanceMonitoringService(config);
  }
  return globalPerformanceMonitoringInstance;
}

export function resetPerformanceMonitoringService(): void {
  if (globalPerformanceMonitoringInstance) {
    globalPerformanceMonitoringInstance.destroy();
    globalPerformanceMonitoringInstance = null;
  }
}

// ============================================================================
// Exports
// ============================================================================

export { PerformanceMonitoringService as default };
// Types are exported inline where defined

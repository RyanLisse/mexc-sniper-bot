/**
 * Performance Monitor
 * Handles performance metrics, status monitoring, and system health reporting
 */

import { BrowserCompatibleEventEmitter } from "@/src/lib/browser-compatible-events";
import { toSafeError } from "@/src/lib/error-type-utils";
import type {
  ExtendedServiceStatus,
  ModuleContext,
  PerformanceMetrics,
  ServiceStatus,
} from "../types";

export class PerformanceMonitor extends BrowserCompatibleEventEmitter {
  private startTime = new Date();
  private metrics = new Map<string, any>();
  private moduleContext: ModuleContext;

  constructor(moduleContext: ModuleContext) {
    super();
    this.moduleContext = moduleContext;
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      const uptime = Date.now() - this.startTime.getTime();
      const memoryUsage = process.memoryUsage?.() || {
        heapUsed: 0,
        heapTotal: 0,
      };

      return {
        uptime,
        memoryUsage: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
        },
        totalTrades: this.metrics.get("totalTrades") || 0,
        successfulTrades: this.metrics.get("successfulTrades") || 0,
        failedTrades: this.metrics.get("failedTrades") || 0,
        totalVolume: this.metrics.get("totalVolume") || 0,
        averageExecutionTime: this.metrics.get("averageExecutionTime") || 0,
        lastTradeTime: this.metrics.get("lastTradeTime") || null,
        apiCallCount: this.metrics.get("apiCallCount") || 0,
        apiErrorCount: this.metrics.get("apiErrorCount") || 0,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(
        `Failed to get performance metrics: ${toSafeError(error).message}`
      );
    }
  }

  async getServiceStatus(): Promise<ServiceStatus> {
    try {
      const metrics = await this.getPerformanceMetrics();
      const successRate =
        metrics.totalTrades > 0
          ? (metrics.successfulTrades / metrics.totalTrades) * 100
          : 0;

      return {
        isInitialized: true,
        isHealthy: this.calculateHealthStatus(metrics),
        uptime: metrics.uptime,
        totalTrades: metrics.totalTrades,
        successfulTrades: metrics.successfulTrades,
        failedTrades: metrics.failedTrades,
        successRate,
        lastTradeTime: metrics.lastTradeTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        isInitialized: false,
        isHealthy: false,
        uptime: 0,
        totalTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        successRate: 0,
        lastTradeTime: null,
        timestamp: new Date().toISOString(),
        error: toSafeError(error).message,
      };
    }
  }

  async getExtendedServiceStatus(): Promise<ExtendedServiceStatus> {
    try {
      const basicStatus = await this.getServiceStatus();
      const metrics = await this.getPerformanceMetrics();

      return {
        ...basicStatus,
        modules: {
          autoSniping: {
            enabled: this.moduleContext.config.autoSnipingEnabled,
            active: this.metrics.get("autoSnipingActive") || false,
            totalSnipes: this.metrics.get("totalSnipes") || 0,
            successfulSnipes: this.metrics.get("successfulSnipes") || 0,
            lastSnipeTime: this.metrics.get("lastSnipeTime") || null,
          },
          manualTrading: {
            enabled: true,
            active: this.metrics.get("manualTradingActive") || false,
            totalManualTrades: this.metrics.get("totalManualTrades") || 0,
            lastManualTradeTime:
              this.metrics.get("lastManualTradeTime") || null,
          },
          positionManager: {
            enabled: true,
            activePositions: this.metrics.get("activePositions") || 0,
            totalPositions: this.metrics.get("totalPositions") || 0,
            averageHoldTime: this.metrics.get("averageHoldTime") || 0,
          },
          performanceTracker: {
            enabled: true,
            trackingActive: true,
            metricsCollected: this.metrics.size,
            lastUpdateTime: new Date().toISOString(),
          },
          strategyManager: {
            enabled: true,
            activeStrategies: this.metrics.get("activeStrategies") || 0,
            totalStrategies: this.metrics.get("totalStrategies") || 0,
          },
        },
        performance: metrics,
        systemHealth: {
          overall: this.calculateHealthStatus(metrics),
          api: this.calculateApiHealth(metrics),
          memory: this.calculateMemoryHealth(metrics),
          trading: this.calculateTradingHealth(metrics),
        },
        configuration: {
          paperTradingEnabled: this.moduleContext.config.enablePaperTrading,
          autoSnipingEnabled: this.moduleContext.config.autoSnipingEnabled,
          circuitBreakerEnabled: this.moduleContext.config.enableCircuitBreaker,
          maxRetries: this.moduleContext.config.maxRetries,
          timeout: this.moduleContext.config.timeout,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const basicStatus = await this.getServiceStatus();
      return {
        ...basicStatus,
        modules: {},
        performance: await this.getPerformanceMetrics(),
        systemHealth: {
          overall: false,
          api: false,
          memory: false,
          trading: false,
        },
        configuration: {},
        error: toSafeError(error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private calculateHealthStatus(metrics: PerformanceMetrics): boolean {
    // System is healthy if:
    // - Memory usage is reasonable (< 80% of heap)
    // - API error rate is low (< 5%)
    // - Recent trading success rate is good (> 80% if any trades)

    const memoryHealthy =
      metrics.memoryUsage.heapTotal === 0 ||
      metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal < 0.8;

    const apiHealthy =
      metrics.apiCallCount === 0 ||
      metrics.apiErrorCount / metrics.apiCallCount < 0.05;

    const tradingHealthy =
      metrics.totalTrades === 0 ||
      metrics.successfulTrades / metrics.totalTrades > 0.8;

    return memoryHealthy && apiHealthy && tradingHealthy;
  }

  private calculateApiHealth(metrics: PerformanceMetrics): boolean {
    return (
      metrics.apiCallCount === 0 ||
      metrics.apiErrorCount / metrics.apiCallCount < 0.05
    );
  }

  private calculateMemoryHealth(metrics: PerformanceMetrics): boolean {
    return (
      metrics.memoryUsage.heapTotal === 0 ||
      metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal < 0.8
    );
  }

  private calculateTradingHealth(metrics: PerformanceMetrics): boolean {
    return (
      metrics.totalTrades === 0 ||
      metrics.successfulTrades / metrics.totalTrades > 0.8
    );
  }

  // Metric tracking methods
  incrementTradeCount(successful: boolean = true): void {
    const totalTrades = (this.metrics.get("totalTrades") || 0) + 1;
    this.metrics.set("totalTrades", totalTrades);

    if (successful) {
      const successfulTrades = (this.metrics.get("successfulTrades") || 0) + 1;
      this.metrics.set("successfulTrades", successfulTrades);
    } else {
      const failedTrades = (this.metrics.get("failedTrades") || 0) + 1;
      this.metrics.set("failedTrades", failedTrades);
    }

    this.metrics.set("lastTradeTime", new Date().toISOString());
  }

  incrementApiCall(successful: boolean = true): void {
    const apiCallCount = (this.metrics.get("apiCallCount") || 0) + 1;
    this.metrics.set("apiCallCount", apiCallCount);

    if (!successful) {
      const apiErrorCount = (this.metrics.get("apiErrorCount") || 0) + 1;
      this.metrics.set("apiErrorCount", apiErrorCount);
    }
  }

  updateVolume(volume: number): void {
    const totalVolume = (this.metrics.get("totalVolume") || 0) + volume;
    this.metrics.set("totalVolume", totalVolume);
  }

  updateExecutionTime(executionTime: number): void {
    const currentAverage = this.metrics.get("averageExecutionTime") || 0;
    const tradeCount = this.metrics.get("totalTrades") || 1;

    const newAverage =
      (currentAverage * (tradeCount - 1) + executionTime) / tradeCount;
    this.metrics.set("averageExecutionTime", newAverage);
  }

  updateMetric(key: string, value: any): void {
    this.metrics.set(key, value);
    this.emit("metricUpdated", { key, value });
  }

  getMetric(key: string): any {
    return this.metrics.get(key);
  }

  getAllMetrics(): Map<string, any> {
    return new Map(this.metrics);
  }

  clearMetrics(): void {
    this.metrics.clear();
    this.emit("metricsCleared");
  }

  async generateReport(): Promise<any> {
    try {
      const status = await this.getExtendedServiceStatus();
      const metrics = await this.getPerformanceMetrics();

      return {
        timestamp: new Date().toISOString(),
        reportType: "performance-report",
        serviceStatus: status,
        performanceMetrics: metrics,
        recommendations: this.generateRecommendations(status, metrics),
      };
    } catch (error) {
      throw new Error(
        `Failed to generate performance report: ${toSafeError(error).message}`
      );
    }
  }

  private generateRecommendations(
    status: ExtendedServiceStatus,
    metrics: PerformanceMetrics
  ): string[] {
    const recommendations: string[] = [];

    if (!status.systemHealth.memory) {
      recommendations.push(
        "Consider optimizing memory usage or increasing available memory"
      );
    }

    if (!status.systemHealth.api) {
      recommendations.push(
        "High API error rate detected - check network connectivity and API credentials"
      );
    }

    if (!status.systemHealth.trading && metrics.totalTrades > 0) {
      recommendations.push(
        "Trading success rate is below optimal - review trading strategies"
      );
    }

    if (metrics.averageExecutionTime > 5000) {
      recommendations.push(
        "High execution times detected - consider optimizing trade execution logic"
      );
    }

    return recommendations;
  }

  reset(): void {
    this.startTime = new Date();
    this.metrics.clear();
    this.emit("reset");
  }
}

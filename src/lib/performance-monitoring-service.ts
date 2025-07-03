/**
 * Performance Monitoring Service
 * 
 * Simplified performance monitoring service that provides essential metrics
 * tracking and monitoring capabilities for the trading system.
 */

import { performance } from 'node:perf_hooks';

export interface PerformanceMetrics {
  responseTime: number;
  executionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  errorRate: number;
  throughput: number;
  timestamp: number;
}

export interface PerformanceAlert {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  data: any;
  timestamp: number;
}

export interface PerformanceThreshold {
  metric: keyof PerformanceMetrics;
  threshold: number;
  condition: 'gt' | 'lt' | 'eq';
}

export interface PerformanceMonitoringConfig {
  enabled: boolean;
  samplingInterval: number;
  alertThresholds: PerformanceThreshold[];
  historySize: number;
  enableAlerts: boolean;
}

export class PerformanceMonitoringService {
  private config: PerformanceMonitoringConfig;
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private timers: Map<string, number> = new Map();
  private counters: Map<string, number> = new Map();
  private isRunning = false;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(config: Partial<PerformanceMonitoringConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      samplingInterval: config.samplingInterval ?? 10000, // 10 seconds
      alertThresholds: config.alertThresholds ?? [],
      historySize: config.historySize ?? 1000,
      enableAlerts: config.enableAlerts ?? true,
    };

    if (this.config.enabled) {
      this.start();
    }
  }

  /**
   * Start performance monitoring
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.samplingInterval);
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  /**
   * Start timing an operation
   */
  startTimer(operation: string): void {
    this.timers.set(operation, performance.now());
  }

  /**
   * End timing an operation and return duration
   */
  endTimer(operation: string): number {
    const startTime = this.timers.get(operation);
    if (!startTime) {
      throw new Error(`Timer not found for operation: ${operation}`);
    }

    const duration = performance.now() - startTime;
    this.timers.delete(operation);
    return duration;
  }

  /**
   * Measure execution time of a function
   */
  async measureAsync<T>(operation: string, fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      this.recordMetric('executionTime', duration);
      return { result, duration };
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric('executionTime', duration);
      this.incrementCounter('errors');
      throw error;
    }
  }

  /**
   * Measure execution time of a synchronous function
   */
  measure<T>(operation: string, fn: () => T): { result: T; duration: number } {
    const startTime = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - startTime;
      this.recordMetric('executionTime', duration);
      return { result, duration };
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric('executionTime', duration);
      this.incrementCounter('errors');
      throw error;
    }
  }

  /**
   * Record a custom metric
   */
  recordMetric(metric: string, value: number): void {
    // Store in counters for aggregation
    this.counters.set(metric, value);
  }

  /**
   * Increment a counter
   */
  incrementCounter(counter: string, value: number = 1): void {
    const current = this.counters.get(counter) || 0;
    this.counters.set(counter, current + value);
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    const memoryUsage = process.memoryUsage();
    const now = Date.now();

    return {
      responseTime: this.counters.get('responseTime') || 0,
      executionTime: this.counters.get('executionTime') || 0,
      memoryUsage: memoryUsage.heapUsed / 1024 / 1024, // MB
      cpuUsage: this.counters.get('cpuUsage') || 0,
      errorRate: this.calculateErrorRate(),
      throughput: this.calculateThroughput(),
      timestamp: now,
    };
  }

  /**
   * Get performance metrics history
   */
  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get recent alerts
   */
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    current: PerformanceMetrics;
    averages: Partial<PerformanceMetrics>;
    trends: Record<string, 'up' | 'down' | 'stable'>;
    alertCount: number;
  } {
    const current = this.getCurrentMetrics();
    const averages = this.calculateAverages();
    const trends = this.calculateTrends();

    return {
      current,
      averages,
      trends,
      alertCount: this.alerts.length,
    };
  }

  /**
   * Clear metrics history
   */
  clearMetrics(): void {
    this.metrics = [];
    this.alerts = [];
    this.counters.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PerformanceMonitoringConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.config.enabled && !this.isRunning) {
      this.start();
    } else if (!this.config.enabled && this.isRunning) {
      this.stop();
    }
  }

  /**
   * Check if monitoring is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get monitoring status
   */
  getStatus(): {
    enabled: boolean;
    running: boolean;
    metricsCount: number;
    alertsCount: number;
    uptime: number;
  } {
    return {
      enabled: this.config.enabled,
      running: this.isRunning,
      metricsCount: this.metrics.length,
      alertsCount: this.alerts.length,
      uptime: process.uptime(),
    };
  }

  /**
   * Collect system metrics
   */
  private collectMetrics(): void {
    const metrics = this.getCurrentMetrics();
    
    // Add to history
    this.metrics.push(metrics);
    
    // Trim history if needed
    if (this.metrics.length > this.config.historySize) {
      this.metrics.shift();
    }

    // Check thresholds and generate alerts
    if (this.config.enableAlerts) {
      this.checkThresholds(metrics);
    }
  }

  /**
   * Check performance thresholds
   */
  private checkThresholds(metrics: PerformanceMetrics): void {
    for (const threshold of this.config.alertThresholds) {
      const value = metrics[threshold.metric];
      let violated = false;

      switch (threshold.condition) {
        case 'gt':
          violated = value > threshold.threshold;
          break;
        case 'lt':
          violated = value < threshold.threshold;
          break;
        case 'eq':
          violated = value === threshold.threshold;
          break;
      }

      if (violated) {
        this.generateAlert(threshold, value);
      }
    }
  }

  /**
   * Generate performance alert
   */
  private generateAlert(threshold: PerformanceThreshold, value: number): void {
    const alert: PerformanceAlert = {
      type: 'threshold_violation',
      severity: this.determineSeverity(threshold.metric, value),
      message: `${threshold.metric} threshold violated: ${value} ${threshold.condition} ${threshold.threshold}`,
      data: {
        metric: threshold.metric,
        value,
        threshold: threshold.threshold,
        condition: threshold.condition,
      },
      timestamp: Date.now(),
    };

    this.alerts.push(alert);
    
    // Trim alerts if needed
    if (this.alerts.length > this.config.historySize) {
      this.alerts.shift();
    }
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(): number {
    const errors = this.counters.get('errors') || 0;
    const total = this.counters.get('requests') || 1;
    return (errors / total) * 100;
  }

  /**
   * Calculate throughput
   */
  private calculateThroughput(): number {
    const requests = this.counters.get('requests') || 0;
    const timeWindow = this.config.samplingInterval / 1000; // Convert to seconds
    return requests / timeWindow;
  }

  /**
   * Calculate average metrics
   */
  private calculateAverages(): Partial<PerformanceMetrics> {
    if (this.metrics.length === 0) return {};

    const sums = this.metrics.reduce((acc, metric) => {
      acc.responseTime += metric.responseTime;
      acc.executionTime += metric.executionTime;
      acc.memoryUsage += metric.memoryUsage;
      acc.cpuUsage += metric.cpuUsage;
      acc.errorRate += metric.errorRate;
      acc.throughput += metric.throughput;
      return acc;
    }, { responseTime: 0, executionTime: 0, memoryUsage: 0, cpuUsage: 0, errorRate: 0, throughput: 0 });

    const count = this.metrics.length;
    return {
      responseTime: sums.responseTime / count,
      executionTime: sums.executionTime / count,
      memoryUsage: sums.memoryUsage / count,
      cpuUsage: sums.cpuUsage / count,
      errorRate: sums.errorRate / count,
      throughput: sums.throughput / count,
    };
  }

  /**
   * Calculate performance trends
   */
  private calculateTrends(): Record<string, 'up' | 'down' | 'stable'> {
    if (this.metrics.length < 2) return {};

    const recent = this.metrics.slice(-10); // Last 10 measurements
    const older = this.metrics.slice(-20, -10); // Previous 10 measurements

    if (recent.length === 0 || older.length === 0) return {};

    const recentAvg = recent.reduce((sum, m) => sum + m.responseTime, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.responseTime, 0) / older.length;

    const diff = recentAvg - olderAvg;
    const threshold = olderAvg * 0.1; // 10% threshold

    return {
      responseTime: Math.abs(diff) < threshold ? 'stable' : (diff > 0 ? 'up' : 'down'),
    };
  }

  /**
   * Determine alert severity
   */
  private determineSeverity(metric: keyof PerformanceMetrics, value: number): 'low' | 'medium' | 'high' | 'critical' {
    // Simple severity rules - can be made more sophisticated
    if (metric === 'memoryUsage' && value > 1000) return 'critical';
    if (metric === 'responseTime' && value > 5000) return 'high';
    if (metric === 'errorRate' && value > 10) return 'high';
    if (metric === 'errorRate' && value > 5) return 'medium';
    return 'low';
  }
}

// Global performance monitoring service instance
export const performanceMonitoringService = new PerformanceMonitoringService({
  enabled: process.env.NODE_ENV !== 'test',
  samplingInterval: Number(process.env.PERF_SAMPLING_INTERVAL) || 10000,
  historySize: Number(process.env.PERF_HISTORY_SIZE) || 1000,
  enableAlerts: process.env.PERF_ALERTS_ENABLED !== 'false',
});

// Types are already exported inline above
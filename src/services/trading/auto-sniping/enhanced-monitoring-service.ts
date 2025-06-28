/**
 * Enhanced Monitoring Service for Auto-Sniping
 * 
 * Provides comprehensive real-time monitoring, logging, and alerting
 * for auto-sniping operations with performance tracking and health monitoring.
 */

import { EventEmitter } from "events";
import { toSafeError } from "@/src/lib/error-type-utils";
import type { 
  AutoSnipeTarget, 
  Position, 
  TradeResult, 
  ServiceResponse 
} from "../consolidated/core-trading/types";

export interface MonitoringConfig {
  enableRealTimeLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  metricsCollectionInterval: number;
  performanceTrackingEnabled: boolean;
  alertingEnabled: boolean;
  alertThresholds: {
    failureRatePercent: number;
    executionTimeMs: number;
    consecutiveFailures: number;
    circuitBreakerTrips: number;
  };
  retentionPolicy: {
    keepLogsForHours: number;
    keepMetricsForHours: number;
    maxLogEntries: number;
  };
}

export interface ExecutionLog {
  id: string;
  timestamp: number;
  type: 'execution_start' | 'execution_complete' | 'execution_failed' | 'position_opened' | 'position_closed';
  symbol: string;
  confidence?: number;
  executionTime?: number;
  error?: string;
  data: any;
  tags: string[];
}

export interface PerformanceMetrics {
  timestamp: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  fastestExecution: number;
  slowestExecution: number;
  activePositions: number;
  realizedPnL: number;
  unrealizedPnL: number;
  successRate: number;
  health: {
    circuitBreakerStatus: string;
    websocketConnected: boolean;
    apiResponseTime: number;
    systemLoad: number;
  };
}

export interface Alert {
  id: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'performance' | 'execution' | 'system' | 'market';
  message: string;
  data: any;
  resolved: boolean;
  acknowledgedAt?: number;
}

export class EnhancedMonitoringService extends EventEmitter {
  private config: MonitoringConfig;
  private executionLogs: ExecutionLog[] = [];
  private metricsHistory: PerformanceMetrics[] = [];
  private activeAlerts: Map<string, Alert> = new Map();
  private executionTimes: number[] = [];
  private consecutiveFailures = 0;
  private circuitBreakerTrips = 0;
  private isCollectingMetrics = false;

  private logger = {
    debug: (message: string, context?: any) => {
      if (this.config.logLevel === 'debug') {
        console.debug("[monitoring]", message, context || "");
        this.addExecutionLog('debug', 'system', message, context);
      }
    },
    info: (message: string, context?: any) => {
      if (['debug', 'info'].includes(this.config.logLevel)) {
        console.info("[monitoring]", message, context || "");
        this.addExecutionLog('info', 'system', message, context);
      }
    },
    warn: (message: string, context?: any) => {
      if (['debug', 'info', 'warn'].includes(this.config.logLevel)) {
        console.warn("[monitoring]", message, context || "");
        this.addExecutionLog('warn', 'system', message, context);
      }
    },
    error: (message: string, context?: any) => {
      console.error("[monitoring]", message, context || "");
      this.addExecutionLog('error', 'system', message, context);
    },
  };

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();
    
    this.config = {
      enableRealTimeLogging: true,
      logLevel: 'info',
      metricsCollectionInterval: 30000, // 30 seconds
      performanceTrackingEnabled: true,
      alertingEnabled: true,
      alertThresholds: {
        failureRatePercent: 20,
        executionTimeMs: 5000,
        consecutiveFailures: 3,
        circuitBreakerTrips: 2,
      },
      retentionPolicy: {
        keepLogsForHours: 24,
        keepMetricsForHours: 168, // 7 days
        maxLogEntries: 10000,
      },
      ...config,
    };

    this.initialize();
  }

  /**
   * Initialize the monitoring service
   */
  private initialize(): void {
    this.logger.info("Initializing Enhanced Monitoring Service", {
      config: this.config,
    });

    // Start metrics collection
    if (this.config.performanceTrackingEnabled) {
      this.startMetricsCollection();
    }

    // Start log cleanup
    this.startLogCleanup();

    this.logger.info("Enhanced Monitoring Service initialized successfully");
  }

  /**
   * Log auto-sniping execution start
   */
  logExecutionStart(target: AutoSnipeTarget): string {
    const logId = this.generateLogId();
    
    this.addExecutionLog('execution_start', target.symbolName, 'Auto-sniping execution started', {
      id: logId,
      targetId: target.id,
      confidence: target.confidenceScore,
      positionSize: target.positionSizeUsdt,
      strategy: target.strategy,
    }, ['auto-snipe', 'execution', 'start']);

    this.logger.info(`Auto-sniping execution started: ${target.symbolName}`, {
      logId,
      confidence: target.confidenceScore,
      positionSize: target.positionSizeUsdt,
    });

    return logId;
  }

  /**
   * Log auto-sniping execution completion
   */
  logExecutionComplete(
    logId: string,
    symbol: string,
    result: TradeResult,
    executionTime: number
  ): void {
    this.addExecutionLog('execution_complete', symbol, 'Auto-sniping execution completed', {
      logId,
      success: result.success,
      orderId: result.data?.orderId,
      executedQty: result.data?.executedQty,
      price: result.data?.price,
      executionTime,
    }, ['auto-snipe', 'execution', 'complete']);

    // Track execution time for performance metrics
    this.executionTimes.push(executionTime);
    
    // Reset consecutive failures on success
    if (result.success) {
      this.consecutiveFailures = 0;
    }

    // Check for performance alerts
    this.checkExecutionTimeAlert(executionTime);

    this.logger.info(`Auto-sniping execution completed: ${symbol}`, {
      logId,
      success: result.success,
      executionTime,
      orderId: result.data?.orderId,
    });
  }

  /**
   * Log auto-sniping execution failure
   */
  logExecutionFailure(
    logId: string,
    symbol: string,
    error: Error,
    executionTime?: number
  ): void {
    this.consecutiveFailures++;
    
    this.addExecutionLog('execution_failed', symbol, 'Auto-sniping execution failed', {
      logId,
      error: error.message,
      consecutiveFailures: this.consecutiveFailures,
      executionTime,
    }, ['auto-snipe', 'execution', 'failure', 'error']);

    // Check for consecutive failure alerts
    this.checkConsecutiveFailureAlert();

    this.logger.error(`Auto-sniping execution failed: ${symbol}`, {
      logId,
      error: error.message,
      consecutiveFailures: this.consecutiveFailures,
    });
  }

  /**
   * Log position opened
   */
  logPositionOpened(position: Position): void {
    this.addExecutionLog('position_opened', position.symbol, 'Trading position opened', {
      positionId: position.id,
      side: position.side,
      entryPrice: position.entryPrice,
      quantity: position.quantity,
      stopLossPrice: position.stopLossPrice,
      takeProfitPrice: position.takeProfitPrice,
      strategy: position.strategy,
      autoSnipe: position.autoSnipe,
    }, ['position', 'opened', 'trading']);

    this.logger.info(`Position opened: ${position.symbol}`, {
      positionId: position.id,
      entryPrice: position.entryPrice,
      quantity: position.quantity,
    });
  }

  /**
   * Log position closed
   */
  logPositionClosed(position: Position): void {
    this.addExecutionLog('position_closed', position.symbol, 'Trading position closed', {
      positionId: position.id,
      side: position.side,
      entryPrice: position.entryPrice,
      closePrice: position.currentPrice,
      realizedPnL: position.realizedPnL,
      duration: position.closeTime && position.openTime 
        ? position.closeTime.getTime() - position.openTime.getTime() 
        : undefined,
    }, ['position', 'closed', 'trading']);

    this.logger.info(`Position closed: ${position.symbol}`, {
      positionId: position.id,
      realizedPnL: position.realizedPnL,
    });
  }

  /**
   * Log circuit breaker event
   */
  logCircuitBreakerEvent(serviceName: string, state: string, reason?: string): void {
    this.circuitBreakerTrips++;
    
    this.addExecutionLog('error', 'system', 'Circuit breaker state change', {
      serviceName,
      state,
      reason,
      totalTrips: this.circuitBreakerTrips,
    }, ['circuit-breaker', 'system', 'error']);

    // Check for circuit breaker trip alerts
    this.checkCircuitBreakerAlert();

    this.logger.warn(`Circuit breaker ${state}: ${serviceName}`, {
      reason,
      totalTrips: this.circuitBreakerTrips,
    });
  }

  /**
   * Get execution logs with optional filtering
   */
  getExecutionLogs(filters?: {
    symbol?: string;
    type?: string;
    tags?: string[];
    fromTimestamp?: number;
    toTimestamp?: number;
    limit?: number;
  }): ExecutionLog[] {
    let logs = [...this.executionLogs];

    if (filters) {
      if (filters.symbol) {
        logs = logs.filter(log => log.symbol === filters.symbol);
      }
      
      if (filters.type) {
        logs = logs.filter(log => log.type === filters.type);
      }
      
      if (filters.tags && filters.tags.length > 0) {
        logs = logs.filter(log => 
          filters.tags!.some(tag => log.tags.includes(tag))
        );
      }
      
      if (filters.fromTimestamp) {
        logs = logs.filter(log => log.timestamp >= filters.fromTimestamp!);
      }
      
      if (filters.toTimestamp) {
        logs = logs.filter(log => log.timestamp <= filters.toTimestamp!);
      }
      
      if (filters.limit && filters.limit > 0) {
        logs = logs.slice(-filters.limit);
      }
    }

    return logs.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    const now = Date.now();
    const recentLogs = this.executionLogs.filter(log => 
      now - log.timestamp < 3600000 // Last hour
    );

    const executions = recentLogs.filter(log => 
      ['execution_complete', 'execution_failed'].includes(log.type)
    );

    const successful = executions.filter(log => log.type === 'execution_complete');
    const failed = executions.filter(log => log.type === 'execution_failed');
    
    const recentTimes = this.executionTimes.slice(-100); // Last 100 executions
    
    return {
      timestamp: now,
      totalExecutions: executions.length,
      successfulExecutions: successful.length,
      failedExecutions: failed.length,
      averageExecutionTime: recentTimes.length > 0 
        ? recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length 
        : 0,
      fastestExecution: recentTimes.length > 0 ? Math.min(...recentTimes) : 0,
      slowestExecution: recentTimes.length > 0 ? Math.max(...recentTimes) : 0,
      activePositions: this.countActivePositions(),
      realizedPnL: this.calculateRealizedPnL(),
      unrealizedPnL: this.calculateUnrealizedPnL(),
      successRate: executions.length > 0 ? (successful.length / executions.length) * 100 : 0,
      health: {
        circuitBreakerStatus: 'healthy', // Would be updated from actual circuit breaker
        websocketConnected: true, // Would be updated from actual WebSocket status
        apiResponseTime: 0, // Would be measured from actual API calls
        systemLoad: 0, // Would be measured from system metrics
      },
    };
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(hours?: number): PerformanceMetrics[] {
    if (!hours) {
      return [...this.metricsHistory];
    }

    const cutoff = Date.now() - (hours * 3600000);
    return this.metricsHistory.filter(metric => metric.timestamp >= cutoff);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.acknowledgedAt = Date.now();
      this.logger.info(`Alert acknowledged: ${alertId}`, { alert });
      return true;
    }
    return false;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      this.logger.info(`Alert resolved: ${alertId}`, { alert });
      return true;
    }
    return false;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private addExecutionLog(
    type: string,
    symbol: string,
    message: string,
    data: any,
    tags: string[] = []
  ): void {
    if (!this.config.enableRealTimeLogging) return;

    const log: ExecutionLog = {
      id: this.generateLogId(),
      timestamp: Date.now(),
      type: type as any,
      symbol,
      data: { message, ...data },
      tags,
    };

    this.executionLogs.push(log);

    // Emit log event for real-time monitoring
    this.emit('log_added', log);

    // Trim logs if needed
    if (this.executionLogs.length > this.config.retentionPolicy.maxLogEntries) {
      this.executionLogs.shift();
    }
  }

  private generateLogId(): string {
    return `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private startMetricsCollection(): void {
    if (this.isCollectingMetrics) return;
    
    this.isCollectingMetrics = true;
    
    const collectMetrics = () => {
      const metrics = this.getCurrentMetrics();
      this.metricsHistory.push(metrics);
      
      // Emit metrics event
      this.emit('metrics_collected', metrics);
      
      // Check for alerts based on metrics
      this.checkMetricsAlerts(metrics);
      
      // Trim metrics history
      const cutoff = Date.now() - (this.config.retentionPolicy.keepMetricsForHours * 3600000);
      this.metricsHistory = this.metricsHistory.filter(m => m.timestamp >= cutoff);
    };

    // Collect metrics immediately and then on interval
    collectMetrics();
    setInterval(collectMetrics, this.config.metricsCollectionInterval);
  }

  private startLogCleanup(): void {
    setInterval(() => {
      const cutoff = Date.now() - (this.config.retentionPolicy.keepLogsForHours * 3600000);
      this.executionLogs = this.executionLogs.filter(log => log.timestamp >= cutoff);
    }, 3600000); // Clean up every hour
  }

  private checkExecutionTimeAlert(executionTime: number): void {
    if (!this.config.alertingEnabled) return;
    
    if (executionTime > this.config.alertThresholds.executionTimeMs) {
      this.createAlert(
        'performance',
        'medium',
        `Slow execution detected: ${executionTime}ms`,
        { executionTime, threshold: this.config.alertThresholds.executionTimeMs }
      );
    }
  }

  private checkConsecutiveFailureAlert(): void {
    if (!this.config.alertingEnabled) return;
    
    if (this.consecutiveFailures >= this.config.alertThresholds.consecutiveFailures) {
      this.createAlert(
        'execution',
        'high',
        `${this.consecutiveFailures} consecutive execution failures`,
        { consecutiveFailures: this.consecutiveFailures }
      );
    }
  }

  private checkCircuitBreakerAlert(): void {
    if (!this.config.alertingEnabled) return;
    
    if (this.circuitBreakerTrips >= this.config.alertThresholds.circuitBreakerTrips) {
      this.createAlert(
        'system',
        'critical',
        `Circuit breaker tripped ${this.circuitBreakerTrips} times`,
        { circuitBreakerTrips: this.circuitBreakerTrips }
      );
    }
  }

  private checkMetricsAlerts(metrics: PerformanceMetrics): void {
    if (!this.config.alertingEnabled) return;
    
    // Check failure rate
    if (metrics.successRate < (100 - this.config.alertThresholds.failureRatePercent)) {
      this.createAlert(
        'performance',
        'high',
        `Low success rate: ${metrics.successRate.toFixed(1)}%`,
        { successRate: metrics.successRate, threshold: this.config.alertThresholds.failureRatePercent }
      );
    }
  }

  private createAlert(
    type: 'performance' | 'execution' | 'system' | 'market',
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    data: any
  ): void {
    const alertId = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const alert: Alert = {
      id: alertId,
      timestamp: Date.now(),
      severity,
      type,
      message,
      data,
      resolved: false,
    };

    this.activeAlerts.set(alertId, alert);
    
    // Emit alert event
    this.emit('alert_created', alert);
    
    this.logger.warn(`Alert created: ${message}`, { alertId, severity, type });
  }

  private countActivePositions(): number {
    // This would integrate with actual position tracking
    return 0; // Placeholder
  }

  private calculateRealizedPnL(): number {
    // This would calculate from closed positions
    return 0; // Placeholder
  }

  private calculateUnrealizedPnL(): number {
    // This would calculate from open positions
    return 0; // Placeholder
  }

  /**
   * Shutdown the monitoring service
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Enhanced Monitoring Service');
    
    this.isCollectingMetrics = false;
    this.removeAllListeners();
    
    this.logger.info('Enhanced Monitoring Service shutdown completed', {
      totalLogs: this.executionLogs.length,
      totalMetrics: this.metricsHistory.length,
      activeAlerts: this.activeAlerts.size,
    });
  }
}
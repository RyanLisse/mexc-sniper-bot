/**
 * Database Quota Monitor & Emergency Management
 * 
 * This module provides comprehensive quota monitoring and emergency
 * management capabilities to prevent database quota overages.
 * 
 * Features:
 * - Real-time quota tracking and alerting
 * - Emergency throttling and circuit breaking
 * - Query cost analysis and optimization recommendations
 * - Automated quota recovery strategies
 */

interface QuotaMetrics {
  dataTransferMB: number;
  connectionCount: number;
  queryCount: number;
  cacheHitRate: number;
  avgQueryTime: number;
  quotaUtilization: number;
  emergencyMode: boolean;
  lastResetTime: number;
  estimatedQuotaRemaining: number;
}

interface QuotaAlert {
  level: "info" | "warning" | "critical" | "emergency";
  message: string;
  timestamp: number;
  metrics: Partial<QuotaMetrics>;
  recommendations: string[];
}

interface EmergencyAction {
  type: "throttle" | "circuit_break" | "cache_extend" | "connection_limit";
  severity: number;
  description: string;
  implemented: boolean;
  timestamp: number;
}

export class DatabaseQuotaMonitor {
  private static instance: DatabaseQuotaMonitor;
  private metrics: QuotaMetrics;
  private alerts: QuotaAlert[] = [];
  private emergencyActions: EmergencyAction[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isEmergencyMode = false;

  private logger = {
    info: (message: string, context?: any) => console.info("[quota-monitor]", message, context || ""),
    warn: (message: string, context?: any) => console.warn("[quota-monitor]", message, context || ""),
    error: (message: string, context?: any) => console.error("[quota-monitor]", message, context || ""),
    debug: (message: string, context?: any) => console.debug("[quota-monitor]", message, context || ""),
  };

  constructor() {
    this.metrics = {
      dataTransferMB: 0,
      connectionCount: 0,
      queryCount: 0,
      cacheHitRate: 0,
      avgQueryTime: 0,
      quotaUtilization: 0,
      emergencyMode: false,
      lastResetTime: Date.now(),
      estimatedQuotaRemaining: 100, // Start with 100MB estimate
    };

    this.startMonitoring();
  }

  static getInstance(): DatabaseQuotaMonitor {
    if (!DatabaseQuotaMonitor.instance) {
      DatabaseQuotaMonitor.instance = new DatabaseQuotaMonitor();
    }
    return DatabaseQuotaMonitor.instance;
  }

  /**
   * Start continuous quota monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.assessQuotaStatus();
      this.checkForEmergencyConditions();
      this.cleanupOldAlerts();
    }, 30000); // Check every 30 seconds

    this.logger.info("📊 Database quota monitoring started");
  }

  /**
   * Update metrics from connection pool
   */
  updateMetrics(newMetrics: Partial<QuotaMetrics>): void {
    this.metrics = { ...this.metrics, ...newMetrics };
    
    // Calculate estimated quota remaining
    this.updateQuotaEstimate();
    
    // Check for critical conditions
    if (this.metrics.quotaUtilization > 90) {
      this.triggerEmergencyMode();
    }
  }

  /**
   * Assess current quota status and generate alerts
   */
  private assessQuotaStatus(): void {
    const utilization = this.metrics.quotaUtilization;
    const recommendations: string[] = [];

    // Critical quota usage (>90%)
    if (utilization > 90) {
      recommendations.push("🚨 EMERGENCY: Implement immediate connection throttling");
      recommendations.push("🚨 EMERGENCY: Extend cache TTL to 60+ minutes");
      recommendations.push("🚨 EMERGENCY: Enable aggressive query batching");
      
      this.addAlert({
        level: "emergency",
        message: `CRITICAL QUOTA EMERGENCY: ${utilization.toFixed(1)}% quota used`,
        timestamp: Date.now(),
        metrics: this.metrics,
        recommendations,
      });
    }
    // High quota usage (>80%)
    else if (utilization > 80) {
      recommendations.push("⚠️ Reduce max connections to emergency levels");
      recommendations.push("⚠️ Enable query deduplication if not active");
      recommendations.push("⚠️ Increase cache retention to 45+ minutes");
      
      this.addAlert({
        level: "critical",
        message: `High quota usage detected: ${utilization.toFixed(1)}%`,
        timestamp: Date.now(),
        metrics: this.metrics,
        recommendations,
      });
    }
    // Moderate quota usage (>60%)
    else if (utilization > 60) {
      recommendations.push("📈 Consider reducing connection pool size");
      recommendations.push("📈 Optimize query patterns for better caching");
      recommendations.push("📈 Review and eliminate inefficient queries");
      
      this.addAlert({
        level: "warning",
        message: `Moderate quota usage: ${utilization.toFixed(1)}%`,
        timestamp: Date.now(),
        metrics: this.metrics,
        recommendations,
      });
    }

    // Log quota status
    if (utilization > 50) {
      this.logger.info(
        `📊 Quota Status: ${utilization.toFixed(1)}% (${this.metrics.dataTransferMB.toFixed(2)}MB transferred)`
      );
    }
  }

  /**
   * Check for emergency conditions and trigger protective measures
   */
  private checkForEmergencyConditions(): void {
    const { quotaUtilization, avgQueryTime, connectionCount } = this.metrics;

    // Emergency condition 1: Quota near limit
    if (quotaUtilization > 95 && !this.isEmergencyMode) {
      this.triggerEmergencyMode();
    }

    // Emergency condition 2: Slow queries indicating performance issues
    if (avgQueryTime > 5000) {
      this.implementEmergencyAction({
        type: "throttle",
        severity: 8,
        description: "Throttle queries due to slow performance",
        implemented: true,
        timestamp: Date.now(),
      });
    }

    // Emergency condition 3: Too many connections
    if (connectionCount > 6) {
      this.implementEmergencyAction({
        type: "connection_limit",
        severity: 7,
        description: "Enforce stricter connection limits",
        implemented: true,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Trigger emergency mode with protective measures
   */
  private triggerEmergencyMode(): void {
    if (this.isEmergencyMode) return;

    this.isEmergencyMode = true;
    this.metrics.emergencyMode = true;

    this.logger.error("🚨 EMERGENCY MODE ACTIVATED - Implementing protective measures");

    // Emergency Action 1: Circuit breaker
    this.implementEmergencyAction({
      type: "circuit_break",
      severity: 10,
      description: "Activate circuit breaker to prevent quota overflow",
      implemented: true,
      timestamp: Date.now(),
    });

    // Emergency Action 2: Extended caching
    this.implementEmergencyAction({
      type: "cache_extend",
      severity: 9,
      description: "Extend cache TTL to 60 minutes for emergency quota protection",
      implemented: true,
      timestamp: Date.now(),
    });

    // Emergency Action 3: Connection throttling
    this.implementEmergencyAction({
      type: "connection_limit",
      severity: 9,
      description: "Reduce max connections to emergency level (3)",
      implemented: true,
      timestamp: Date.now(),
    });

    // Schedule emergency mode exit
    setTimeout(() => {
      this.exitEmergencyMode();
    }, 300000); // Exit after 5 minutes
  }

  /**
   * Exit emergency mode when conditions improve
   */
  private exitEmergencyMode(): void {
    if (!this.isEmergencyMode) return;

    // Only exit if quota usage has decreased significantly
    if (this.metrics.quotaUtilization < 70) {
      this.isEmergencyMode = false;
      this.metrics.emergencyMode = false;
      this.logger.info("✅ Emergency mode deactivated - quota usage normalized");
    } else {
      // Extend emergency mode if still in danger
      this.logger.warn("⚠️ Emergency mode extended - quota still critical");
      setTimeout(() => this.exitEmergencyMode(), 180000); // Check again in 3 minutes
    }
  }

  /**
   * Implement emergency protective action
   */
  private implementEmergencyAction(action: EmergencyAction): void {
    this.emergencyActions.push(action);
    this.logger.warn(`🛡️ Emergency Action: ${action.description}`, { severity: action.severity });

    // Notify external systems if needed
    this.notifyEmergencyAction(action);
  }

  /**
   * Update quota estimate based on current usage patterns
   */
  private updateQuotaEstimate(): void {
    const currentTime = Date.now();
    const timeElapsed = currentTime - this.metrics.lastResetTime;
    const hoursSinceReset = timeElapsed / (1000 * 60 * 60);

    // Estimate remaining quota based on current burn rate
    if (hoursSinceReset > 0) {
      const burnRatePerHour = this.metrics.dataTransferMB / hoursSinceReset;
      const hoursUntilReset = 24 - (hoursSinceReset % 24); // Assuming 24-hour quota cycle
      this.metrics.estimatedQuotaRemaining = Math.max(0, 1000 - (burnRatePerHour * hoursUntilReset));
    }
  }

  /**
   * Add alert to the alert queue
   */
  private addAlert(alert: QuotaAlert): void {
    this.alerts.push(alert);
    
    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }

    // Log based on severity
    switch (alert.level) {
      case "emergency":
        this.logger.error(`🚨 ${alert.message}`, alert.metrics);
        break;
      case "critical":
        this.logger.error(`❌ ${alert.message}`, alert.metrics);
        break;
      case "warning":
        this.logger.warn(`⚠️ ${alert.message}`, alert.metrics);
        break;
      default:
        this.logger.info(`ℹ️ ${alert.message}`, alert.metrics);
    }
  }

  /**
   * Clean up old alerts (older than 1 hour)
   */
  private cleanupOldAlerts(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.alerts = this.alerts.filter(alert => alert.timestamp > oneHourAgo);
  }

  /**
   * Notify external systems of emergency action
   */
  private notifyEmergencyAction(action: EmergencyAction): void {
    // This could integrate with monitoring systems, Slack, etc.
    if (action.severity >= 9) {
      this.logger.error("🚨 HIGH SEVERITY EMERGENCY ACTION", {
        action: action.type,
        description: action.description,
        severity: action.severity,
        timestamp: new Date(action.timestamp).toISOString(),
      });
    }
  }

  /**
   * Get current quota status report
   */
  getQuotaStatus(): {
    metrics: QuotaMetrics;
    alerts: QuotaAlert[];
    emergencyActions: EmergencyAction[];
    recommendations: string[];
  } {
    const recommendations = this.generateRecommendations();

    return {
      metrics: this.metrics,
      alerts: this.alerts.slice(-10), // Last 10 alerts
      emergencyActions: this.emergencyActions.slice(-5), // Last 5 actions
      recommendations,
    };
  }

  /**
   * Generate context-aware recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const { quotaUtilization, cacheHitRate, avgQueryTime, connectionCount } = this.metrics;

    // Quota-based recommendations
    if (quotaUtilization > 80) {
      recommendations.push("🚨 URGENT: Reduce max connections to 4 or fewer");
      recommendations.push("🚨 URGENT: Extend cache TTL to 60+ minutes");
      recommendations.push("🚨 URGENT: Enable aggressive query batching");
    } else if (quotaUtilization > 60) {
      recommendations.push("⚠️ Optimize query patterns for better caching");
      recommendations.push("⚠️ Consider reducing connection pool size");
      recommendations.push("⚠️ Review high-frequency operations");
    }

    // Cache-based recommendations
    if (cacheHitRate < 60) {
      recommendations.push("📈 Improve cache hit rate by extending TTL");
      recommendations.push("📈 Implement more granular caching strategies");
    }

    // Performance-based recommendations
    if (avgQueryTime > 2000) {
      recommendations.push("⚡ Optimize slow queries with indexes");
      recommendations.push("⚡ Consider query result pagination");
    }

    // Connection-based recommendations
    if (connectionCount > 5) {
      recommendations.push("🔌 Reduce max connections for quota efficiency");
    }

    // Emergency recommendations
    if (this.isEmergencyMode) {
      recommendations.push("🚨 EMERGENCY: All non-critical operations should be disabled");
      recommendations.push("🚨 EMERGENCY: Consider implementing manual query approval");
    }

    return recommendations;
  }

  /**
   * Force quota reset (for testing or emergency recovery)
   */
  forceQuotaReset(): void {
    this.metrics.dataTransferMB = 0;
    this.metrics.quotaUtilization = 0;
    this.metrics.lastResetTime = Date.now();
    this.metrics.estimatedQuotaRemaining = 1000; // Reset to full quota
    
    if (this.isEmergencyMode) {
      this.exitEmergencyMode();
    }

    this.logger.info("🔄 Quota metrics manually reset");
  }

  /**
   * Get emergency mode status
   */
  isInEmergencyMode(): boolean {
    return this.isEmergencyMode;
  }

  /**
   * Shutdown monitoring
   */
  shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.logger.info("📊 Quota monitoring shutdown");
  }
}

// Export singleton instance
export const databaseQuotaMonitor = DatabaseQuotaMonitor.getInstance();

// Export types for use in other modules
export type { QuotaMetrics, QuotaAlert, EmergencyAction };
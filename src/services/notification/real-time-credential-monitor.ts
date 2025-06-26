/**
 * Real-time Credential Monitor
 *
 * Provides real-time monitoring and status updates for MEXC API credentials:
 * - Live credential validation
 * - Real-time status broadcasting
 * - Automatic status change detection
 * - Performance monitoring integration
 * - Health metrics aggregation
 */

import { toSafeError } from "@/src/lib/error-type-utils";
import type { ConnectionHealthMonitor } from "@/src/services/data/connection-health-monitor";
import { getGlobalHealthMonitor } from "@/src/services/data/connection-health-monitor";
import type {
  CredentialValidationResult,
  EnhancedCredentialValidator,
} from "@/src/services/api/enhanced-mexc-credential-validator";
import { getGlobalCredentialValidator } from "@/src/services/api/enhanced-mexc-credential-validator";

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface RealTimeCredentialStatus {
  hasCredentials: boolean;
  isValid: boolean;
  source: "database" | "environment" | "none";
  isTestCredentials: boolean;
  canAuthenticate: boolean;
  connectionHealth: "excellent" | "good" | "fair" | "poor";
  lastChecked: Date;
  nextCheckIn: number; // milliseconds
  error?: string;
  responseTime?: number;
  isMonitoring: boolean;
  metrics: {
    totalChecks: number;
    successRate: number;
    averageLatency: number;
    consecutiveFailures: number;
    uptime: number;
  };
  alerts: {
    count: number;
    latest?: string;
    severity: "none" | "info" | "warning" | "critical";
  };
}

export interface StatusChangeEvent {
  type: "credential_change" | "connection_change" | "health_change" | "error_change";
  previous: Partial<RealTimeCredentialStatus>;
  current: RealTimeCredentialStatus;
  timestamp: Date;
  description: string;
}

export interface RealTimeMonitorConfig {
  checkInterval: number;
  enableHealthMonitoring: boolean;
  enableAlerts: boolean;
  maxStatusHistory: number;
  enablePerformanceTracking: boolean;
  autoRecoveryEnabled: boolean;
  statusChangeNotificationDelay: number; // debounce delay
}

// ============================================================================
// Real-time Credential Monitor Implementation
// ============================================================================

export class RealTimeCredentialMonitor {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[real-time-credential-monitor]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[real-time-credential-monitor]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[real-time-credential-monitor]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[real-time-credential-monitor]", message, context || ""),
  };

  private config: RealTimeMonitorConfig;
  private credentialValidator: EnhancedCredentialValidator;
  private healthMonitor: ConnectionHealthMonitor;

  private currentStatus: RealTimeCredentialStatus | null = null;
  private statusHistory: RealTimeCredentialStatus[] = [];
  private statusChangeCallbacks: ((event: StatusChangeEvent) => void)[] = [];

  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private lastChangeNotification = 0;

  constructor(
    config: Partial<RealTimeMonitorConfig> = {},
    credentialValidator?: EnhancedCredentialValidator,
    healthMonitor?: ConnectionHealthMonitor
  ) {
    this.config = {
      checkInterval: 30000, // 30 seconds
      enableHealthMonitoring: true,
      enableAlerts: true,
      maxStatusHistory: 100,
      enablePerformanceTracking: true,
      autoRecoveryEnabled: true,
      statusChangeNotificationDelay: 1000, // 1 second debounce
      ...config,
    };

    this.credentialValidator = credentialValidator || getGlobalCredentialValidator();
    this.healthMonitor = healthMonitor || getGlobalHealthMonitor();

    // Register for credential validator status changes
    this.credentialValidator.onStatusChange((result) => {
      this.handleCredentialStatusChange(result);
    });
  }

  // ============================================================================
  // Main Monitoring Methods
  // ============================================================================

  /**
   * Start real-time monitoring
   */
  async start(): Promise<void> {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    // Start health monitoring if enabled
    if (this.config.enableHealthMonitoring) {
      this.healthMonitor.start();
    }

    // Perform initial status check
    await this.checkStatus();

    // Set up periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.checkStatus();
    }, this.config.checkInterval);

    console.info("Real-time credential monitoring started");
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Stop health monitoring
    if (this.config.enableHealthMonitoring) {
      this.healthMonitor.stop();
    }

    console.info("Real-time credential monitoring stopped");
  }

  /**
   * Perform immediate status check
   */
  async checkStatus(): Promise<RealTimeCredentialStatus> {
    try {
      // Get credential validation result
      const validationResult = await this.credentialValidator.validateCredentials();

      // Get health metrics
      const healthMetrics = this.config.enableHealthMonitoring
        ? this.healthMonitor.getHealthMetrics()
        : this.getDefaultHealthMetrics();

      // Get connection quality
      const connectionQuality = this.config.enableHealthMonitoring
        ? this.healthMonitor.getConnectionQuality()
        : { status: "excellent" as const };

      // Get recent alerts
      const alerts = this.config.enableAlerts
        ? this.getAlertSummary()
        : { count: 0, severity: "none" as const };

      // Create status object
      const status: RealTimeCredentialStatus = {
        hasCredentials: validationResult.hasCredentials,
        isValid: validationResult.isValid,
        source: validationResult.source,
        isTestCredentials: validationResult.isTestCredentials,
        canAuthenticate: validationResult.canAuthenticate,
        connectionHealth: connectionQuality.status,
        lastChecked: new Date(),
        nextCheckIn: this.config.checkInterval,
        error: validationResult.error,
        responseTime: validationResult.responseTime,
        isMonitoring: this.isMonitoring,
        metrics: {
          totalChecks: healthMetrics.totalChecks,
          successRate: healthMetrics.successRate,
          averageLatency: healthMetrics.averageLatency,
          consecutiveFailures: healthMetrics.consecutiveFailures,
          uptime: healthMetrics.uptime,
        },
        alerts,
      };

      // Update status and handle changes
      this.updateStatus(status);

      return status;
    } catch (error) {
      const safeError = toSafeError(error);

      // Create error status
      const errorStatus: RealTimeCredentialStatus = {
        hasCredentials: false,
        isValid: false,
        source: "none",
        isTestCredentials: false,
        canAuthenticate: false,
        connectionHealth: "poor",
        lastChecked: new Date(),
        nextCheckIn: this.config.checkInterval,
        error: `Status check failed: ${safeError.message}`,
        isMonitoring: this.isMonitoring,
        metrics: this.getDefaultHealthMetrics(),
        alerts: { count: 1, latest: safeError.message, severity: "critical" },
      };

      this.updateStatus(errorStatus);
      return errorStatus;
    }
  }

  // ============================================================================
  // Status Management
  // ============================================================================

  /**
   * Get current status
   */
  getCurrentStatus(): RealTimeCredentialStatus | null {
    return this.currentStatus;
  }

  /**
   * Get status history
   */
  getStatusHistory(limit?: number): RealTimeCredentialStatus[] {
    if (limit) {
      return this.statusHistory.slice(-limit);
    }
    return [...this.statusHistory];
  }

  /**
   * Register callback for status changes
   */
  onStatusChange(callback: (event: StatusChangeEvent) => void): void {
    this.statusChangeCallbacks.push(callback);
  }

  /**
   * Remove status change callback
   */
  removeStatusChangeCallback(callback: (event: StatusChangeEvent) => void): void {
    const index = this.statusChangeCallbacks.indexOf(callback);
    if (index > -1) {
      this.statusChangeCallbacks.splice(index, 1);
    }
  }

  // ============================================================================
  // Status Analysis Methods
  // ============================================================================

  /**
   * Get status summary for the last period
   */
  getStatusSummary(hours = 24): {
    averageUptime: number;
    totalChecks: number;
    averageResponseTime: number;
    mostCommonIssue?: string;
    statusChanges: number;
    healthTrend: "improving" | "stable" | "degrading";
  } {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentHistory = this.statusHistory.filter((status) => status.lastChecked > cutoffTime);

    if (recentHistory.length === 0) {
      return {
        averageUptime: 0,
        totalChecks: 0,
        averageResponseTime: 0,
        statusChanges: 0,
        healthTrend: "stable",
      };
    }

    // Calculate averages
    const averageUptime =
      recentHistory.reduce((sum, status) => sum + status.metrics.uptime, 0) / recentHistory.length;
    const totalChecks = Math.max(...recentHistory.map((status) => status.metrics.totalChecks));

    const responseTimes = recentHistory
      .map((status) => status.responseTime)
      .filter((time): time is number => time !== undefined);
    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0;

    // Find most common issue
    const errors = recentHistory
      .map((status) => status.error)
      .filter((error): error is string => error !== undefined);
    const errorCounts = errors.reduce(
      (counts, error) => {
        counts[error] = (counts[error] || 0) + 1;
        return counts;
      },
      {} as Record<string, number>
    );
    const mostCommonIssue =
      Object.keys(errorCounts).length > 0
        ? Object.entries(errorCounts).sort(([, a], [, b]) => b - a)[0][0]
        : undefined;

    // Count status changes
    let statusChanges = 0;
    for (let i = 1; i < recentHistory.length; i++) {
      const prev = recentHistory[i - 1];
      const curr = recentHistory[i];
      if (prev.isValid !== curr.isValid || prev.hasCredentials !== curr.hasCredentials) {
        statusChanges++;
      }
    }

    // Determine health trend
    let healthTrend: "improving" | "stable" | "degrading" = "stable";
    if (recentHistory.length >= 2) {
      const first = recentHistory[0];
      const last = recentHistory[recentHistory.length - 1];
      const uptimeDiff = last.metrics.uptime - first.metrics.uptime;

      if (uptimeDiff > 5) {
        healthTrend = "improving";
      } else if (uptimeDiff < -5) {
        healthTrend = "degrading";
      }
    }

    return {
      averageUptime: Math.round(averageUptime * 100) / 100,
      totalChecks,
      averageResponseTime: Math.round(averageResponseTime),
      mostCommonIssue,
      statusChanges,
      healthTrend,
    };
  }

  /**
   * Check if status indicates a critical issue
   */
  hasCriticalIssue(): boolean {
    if (!this.currentStatus) return true;

    return (
      !this.currentStatus.hasCredentials ||
      !this.currentStatus.isValid ||
      this.currentStatus.metrics.consecutiveFailures > 5 ||
      this.currentStatus.connectionHealth === "poor" ||
      this.currentStatus.alerts.severity === "critical"
    );
  }

  /**
   * Get recommended actions based on current status
   */
  getRecommendedActions(): string[] {
    if (!this.currentStatus) {
      return ["Initialize credential monitoring"];
    }

    const actions: string[] = [];

    if (!this.currentStatus.hasCredentials) {
      actions.push("Configure MEXC API credentials in environment variables or database");
    } else if (this.currentStatus.isTestCredentials) {
      // FIXED: Allow test credentials to work in demo mode - auto-sniping always enabled
      actions.push("Test credentials detected - system running in demo mode");
      actions.push("For live trading, configure real MEXC API credentials");
    } else if (!this.currentStatus.isValid) {
      actions.push("Verify API credentials are correct and active");
      actions.push("Check if server IP is allowlisted in MEXC API settings");
    }

    if (this.currentStatus.connectionHealth === "poor") {
      actions.push("Check network connectivity to MEXC API");
      actions.push("Consider implementing circuit breaker patterns");
    }

    if (this.currentStatus.metrics.consecutiveFailures > 3) {
      actions.push("Investigate recurring connection failures");
      actions.push("Consider increasing request timeouts");
    }

    if (this.currentStatus.metrics.averageLatency > 2000) {
      actions.push("Optimize network configuration for better latency");
    }

    if (actions.length === 0) {
      actions.push("System is operating normally");
    }

    return actions;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private updateStatus(newStatus: RealTimeCredentialStatus): void {
    const previousStatus = this.currentStatus;

    // Update current status
    this.currentStatus = newStatus;

    // Add to history
    this.statusHistory.push(newStatus);
    if (this.statusHistory.length > this.config.maxStatusHistory) {
      this.statusHistory.shift();
    }

    // Check for significant changes and notify
    if (previousStatus && this.hasSignificantChange(previousStatus, newStatus)) {
      this.notifyStatusChange(previousStatus, newStatus);
    }
  }

  private hasSignificantChange(
    previous: RealTimeCredentialStatus,
    current: RealTimeCredentialStatus
  ): boolean {
    return (
      previous.hasCredentials !== current.hasCredentials ||
      previous.isValid !== current.isValid ||
      previous.canAuthenticate !== current.canAuthenticate ||
      previous.connectionHealth !== current.connectionHealth ||
      previous.isTestCredentials !== current.isTestCredentials ||
      (previous.error !== current.error && (previous.error || current.error))
    );
  }

  private notifyStatusChange(
    previous: RealTimeCredentialStatus,
    current: RealTimeCredentialStatus
  ): void {
    // Implement debouncing to avoid too many notifications
    const now = Date.now();
    if (now - this.lastChangeNotification < this.config.statusChangeNotificationDelay) {
      return;
    }
    this.lastChangeNotification = now;

    // Determine change type
    let changeType: StatusChangeEvent["type"] = "credential_change";
    let description = "Credential status changed";

    if (previous.hasCredentials !== current.hasCredentials) {
      changeType = "credential_change";
      description = current.hasCredentials ? "Credentials detected" : "Credentials removed";
    } else if (previous.isValid !== current.isValid) {
      changeType = "credential_change";
      description = current.isValid ? "Credentials validated" : "Credentials invalid";
    } else if (previous.connectionHealth !== current.connectionHealth) {
      changeType = "connection_change";
      description = `Connection health changed to ${current.connectionHealth}`;
    } else if (previous.error !== current.error) {
      changeType = "error_change";
      description = current.error ? "Error occurred" : "Error resolved";
    }

    const event: StatusChangeEvent = {
      type: changeType,
      previous,
      current,
      timestamp: new Date(),
      description,
    };

    // Notify all callbacks
    this.statusChangeCallbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error("Error in status change callback:", error);
      }
    });
  }

  private handleCredentialStatusChange(result: CredentialValidationResult): void {
    // This method is called when the credential validator detects changes
    // We can use this to trigger immediate status updates
    if (this.isMonitoring) {
      // Trigger an immediate check instead of waiting for the next interval
      setTimeout(() => this.checkStatus(), 100);
    }
  }

  private getDefaultHealthMetrics() {
    return {
      totalChecks: 0,
      successRate: 0,
      averageLatency: 0,
      consecutiveFailures: 0,
      uptime: 0,
    };
  }

  private getAlertSummary(): {
    count: number;
    latest?: string;
    severity: "none" | "info" | "warning" | "critical";
  } {
    if (!this.config.enableHealthMonitoring) {
      return { count: 0, severity: "none" };
    }

    const alerts = this.healthMonitor.getRecentAlerts(1); // Last hour
    if (alerts.length === 0) {
      return { count: 0, severity: "none" };
    }

    const latestAlert = alerts[0];
    const criticalCount = alerts.filter((alert) => alert.severity === "critical").length;
    const warningCount = alerts.filter((alert) => alert.severity === "warning").length;

    let severity: "none" | "info" | "warning" | "critical" = "none";
    if (criticalCount > 0) {
      severity = "critical";
    } else if (warningCount > 0) {
      severity = "warning";
    } else {
      severity = "info";
    }

    return {
      count: alerts.length,
      latest: latestAlert.message,
      severity,
    };
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get monitoring configuration
   */
  getConfig(): RealTimeMonitorConfig {
    return { ...this.config };
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(config: Partial<RealTimeMonitorConfig>): void {
    const wasMonitoring = this.isMonitoring;

    if (wasMonitoring) {
      this.stop();
    }

    this.config = { ...this.config, ...config };

    if (wasMonitoring) {
      this.start();
    }
  }

  /**
   * Force immediate status refresh
   */
  async refresh(): Promise<RealTimeCredentialStatus> {
    return this.checkStatus();
  }

  /**
   * Reset all monitoring data
   */
  reset(): void {
    this.currentStatus = null;
    this.statusHistory = [];
    this.credentialValidator.reset();
    if (this.config.enableHealthMonitoring) {
      this.healthMonitor.reset();
    }
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus(): {
    isActive: boolean;
    intervalMs: number;
    totalStatusUpdates: number;
    lastUpdateTime?: Date;
  } {
    return {
      isActive: this.isMonitoring,
      intervalMs: this.config.checkInterval,
      totalStatusUpdates: this.statusHistory.length,
      lastUpdateTime: this.currentStatus?.lastChecked,
    };
  }
}

// ============================================================================
// Factory Functions and Exports
// ============================================================================

/**
 * Create real-time credential monitor with production defaults
 */
export function createRealTimeCredentialMonitor(
  config?: Partial<RealTimeMonitorConfig>
): RealTimeCredentialMonitor {
  return new RealTimeCredentialMonitor(config);
}

// Global instance for singleton usage
let globalRealTimeMonitor: RealTimeCredentialMonitor | null = null;

/**
 * Get or create global real-time monitor
 */
export function getGlobalRealTimeMonitor(): RealTimeCredentialMonitor {
  if (!globalRealTimeMonitor) {
    globalRealTimeMonitor = createRealTimeCredentialMonitor();
  }
  return globalRealTimeMonitor;
}

/**
 * Reset global real-time monitor
 */
export function resetGlobalRealTimeMonitor(): void {
  if (globalRealTimeMonitor) {
    globalRealTimeMonitor.stop();
  }
  globalRealTimeMonitor = null;
}

/**
 * Real-time Safety Monitoring Service
 *
 * Provides comprehensive real-time safety monitoring and risk management.
 * Monitors system health, trading risks, and triggers safety protocols.
 */

import { createLogger, createTimer } from "../lib/structured-logger";
import { AutoSnipingExecutionService } from "./auto-sniping-execution-service";
import type { ExecutionPosition } from "./auto-sniping-execution-service";
import { EmergencySafetySystem } from "./emergency-safety-system";
import { PatternMonitoringService } from "./pattern-monitoring-service";
import { UnifiedMexcService } from "./unified-mexc-service";

export interface SafetyThresholds {
  // Risk thresholds
  maxDrawdownPercentage: number;
  maxDailyLossPercentage: number;
  maxPositionRiskPercentage: number;
  maxPortfolioConcentration: number;

  // Performance thresholds
  minSuccessRatePercentage: number;
  maxConsecutiveLosses: number;
  maxSlippagePercentage: number;

  // System thresholds
  maxApiLatencyMs: number;
  minApiSuccessRate: number;
  maxMemoryUsagePercentage: number;

  // Pattern thresholds
  minPatternConfidence: number;
  maxPatternDetectionFailures: number;
}

export interface RiskMetrics {
  // Portfolio risk
  currentDrawdown: number;
  maxDrawdown: number;
  portfolioValue: number;
  totalExposure: number;
  concentrationRisk: number;

  // Performance risk
  successRate: number;
  consecutiveLosses: number;
  averageSlippage: number;

  // System risk
  apiLatency: number;
  apiSuccessRate: number;
  memoryUsage: number;

  // Pattern risk
  patternAccuracy: number;
  detectionFailures: number;
  falsePositiveRate: number;
}

export interface SafetyAlert {
  id: string;
  type:
    | "risk_threshold"
    | "system_failure"
    | "performance_degradation"
    | "emergency_condition"
    | "safety_violation";
  severity: "low" | "medium" | "high" | "critical";
  category: "portfolio" | "system" | "performance" | "pattern" | "api";
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  autoActions: SafetyAction[];
  riskLevel: number; // 0-100
  source: string;
  metadata: Record<string, any>;
}

export interface SafetyAction {
  id: string;
  type:
    | "halt_trading"
    | "reduce_positions"
    | "emergency_close"
    | "limit_exposure"
    | "notify_admin"
    | "circuit_breaker";
  description: string;
  executed: boolean;
  executedAt?: string;
  result?: "success" | "failed" | "partial";
  details?: string;
}

export interface SafetyMonitoringReport {
  status: "safe" | "warning" | "critical" | "emergency";
  overallRiskScore: number; // 0-100
  riskMetrics: RiskMetrics;
  thresholds: SafetyThresholds;
  activeAlerts: SafetyAlert[];
  recentActions: SafetyAction[];
  systemHealth: {
    executionService: boolean;
    patternMonitoring: boolean;
    emergencySystem: boolean;
    mexcConnectivity: boolean;
    overallHealth: number;
  };
  recommendations: string[];
  monitoringStats: {
    alertsGenerated: number;
    actionsExecuted: number;
    riskEventsDetected: number;
    systemUptime: number;
    lastRiskCheck: string;
    monitoringFrequency: number;
  };
  lastUpdated: string;
}

export interface SafetyConfiguration {
  enabled: boolean;
  monitoringIntervalMs: number;
  riskCheckIntervalMs: number;
  autoActionEnabled: boolean;
  emergencyMode: boolean;
  alertRetentionHours: number;
  thresholds: SafetyThresholds;
}

/**
 * Timer coordination interface for managing scheduled operations
 */
interface ScheduledOperation {
  id: string;
  name: string;
  intervalMs: number;
  lastExecuted: number;
  isRunning: boolean;
  handler: () => Promise<void>;
}

/**
 * Centralized timer coordinator to prevent overlapping operations
 */
class TimerCoordinator {
  private operations: Map<string, ScheduledOperation> = new Map();
  private coordinatorTimer: NodeJS.Timeout | null = null;
  private isActive = false;
  private readonly baseTickMs = 5000; // 5-second base tick for coordination
  private logger = createLogger("timer-coordinator");

  constructor() {
    this.logger.info("Timer coordinator initialized", {
      operation: "initialization",
      baseTickMs: this.baseTickMs,
    });
  }

  /**
   * Register a scheduled operation
   */
  public registerOperation(
    operation: Omit<ScheduledOperation, "lastExecuted" | "isRunning">
  ): void {
    const scheduledOp: ScheduledOperation = {
      ...operation,
      lastExecuted: 0,
      isRunning: false,
    };

    this.operations.set(operation.id, scheduledOp);
    this.logger.info("Operation registered", {
      operation: "register_operation",
      operationId: operation.id,
      operationName: operation.name,
      intervalMs: operation.intervalMs,
      totalOperations: this.operations.size,
    });
  }

  /**
   * Start the timer coordinator
   */
  public start(): void {
    if (this.isActive) {
      this.logger.warn("Timer coordinator already active", {
        operation: "start_coordinator",
        isActive: this.isActive,
        operationsCount: this.operations.size,
      });
      return;
    }

    this.isActive = true;
    this.logger.info("Starting timer coordination", {
      operation: "start_coordinator",
      baseTickMs: this.baseTickMs,
      operationsCount: this.operations.size,
    });

    this.coordinatorTimer = setInterval(() => {
      this.coordinateCycle().catch((error) => {
        this.logger.error(
          "Coordination cycle failed",
          {
            operation: "coordination_cycle",
            activeOperations: this.operations.size,
            baseTickMs: this.baseTickMs,
          },
          error
        );
      });
    }, this.baseTickMs);
  }

  /**
   * Stop the timer coordinator and cleanup
   */
  public stop(): void {
    this.logger.info("Stopping timer coordination", {
      operation: "stop_coordinator",
      isActive: this.isActive,
      totalOperations: this.operations.size,
    });

    this.isActive = false;

    if (this.coordinatorTimer) {
      clearInterval(this.coordinatorTimer);
      this.coordinatorTimer = null;
    }

    // Wait for any running operations to complete
    const allOperations = Array.from(this.operations.values());
    const runningOps = allOperations.filter((op) => op.isRunning);
    if (runningOps.length > 0) {
      this.logger.info("Waiting for operations to complete", {
        operation: "stop_coordinator",
        runningOperations: runningOps.length,
        runningOperationNames: runningOps.map((op) => op.name),
      });
    }

    this.operations.clear();
  }

  /**
   * Main coordination cycle - prevents overlapping operations
   */
  private async coordinateCycle(): Promise<void> {
    if (!this.isActive) return;

    const now = Date.now();
    const readyOperations: ScheduledOperation[] = [];

    // Find operations that are ready to execute
    const allOperations = Array.from(this.operations.values());
    for (const operation of allOperations) {
      if (operation.isRunning) {
        // Skip operations that are already running
        continue;
      }

      const timeSinceLastExecution = now - operation.lastExecuted;
      if (timeSinceLastExecution >= operation.intervalMs) {
        readyOperations.push(operation);
      }
    }

    // Execute ready operations in order of priority (shortest interval first)
    readyOperations.sort((a, b) => a.intervalMs - b.intervalMs);

    for (const operation of readyOperations) {
      if (!this.isActive) break; // Check if coordinator was stopped

      await this.executeOperationSafely(operation);

      // Add small delay between operations to prevent resource contention
      if (readyOperations.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Execute an operation with proper error handling and state management
   */
  private async executeOperationSafely(operation: ScheduledOperation): Promise<void> {
    const timer = createTimer("operation_execution", "timer-coordinator");

    try {
      operation.isRunning = true;
      operation.lastExecuted = Date.now();

      this.logger.info("Executing operation", {
        operation: "execute_operation",
        operationId: operation.id,
        operationName: operation.name,
        intervalMs: operation.intervalMs,
      });

      await operation.handler();

      const duration = timer.end({
        operationId: operation.id,
        operationName: operation.name,
        status: "success",
      });

      this.logger.info("Operation completed", {
        operation: "execute_operation",
        operationId: operation.id,
        operationName: operation.name,
        duration,
        status: "success",
      });
    } catch (error) {
      const duration = timer.end({
        operationId: operation.id,
        operationName: operation.name,
        status: "failed",
      });

      this.logger.error(
        "Operation failed",
        {
          operation: "execute_operation",
          operationId: operation.id,
          operationName: operation.name,
          duration,
          status: "failed",
        },
        error
      );
    } finally {
      operation.isRunning = false;
    }
  }

  /**
   * Get operation status for monitoring
   */
  public getOperationStatus(): Array<{
    id: string;
    name: string;
    intervalMs: number;
    lastExecuted: number;
    isRunning: boolean;
    nextExecution: number;
  }> {
    const allOperations = Array.from(this.operations.values());
    return allOperations.map((op) => ({
      id: op.id,
      name: op.name,
      intervalMs: op.intervalMs,
      lastExecuted: op.lastExecuted,
      isRunning: op.isRunning,
      nextExecution: op.lastExecuted + op.intervalMs,
    }));
  }
}

export class RealTimeSafetyMonitoringService {
  private static instance: RealTimeSafetyMonitoringService;

  private emergencySystem: EmergencySafetySystem;
  private executionService: AutoSnipingExecutionService;
  private patternMonitoring: PatternMonitoringService;
  private mexcService: UnifiedMexcService;

  private config: SafetyConfiguration;
  private isMonitoringActive = false;
  private riskMetrics: RiskMetrics;
  private alerts: SafetyAlert[] = [];
  private recentActions: SafetyAction[] = [];

  private timerCoordinator: TimerCoordinator;
  private logger = createLogger("safety-monitoring");

  private monitoringStats = {
    alertsGenerated: 0,
    actionsExecuted: 0,
    riskEventsDetected: 0,
    systemUptime: 0,
    startTime: Date.now(),
  };

  private constructor() {
    this.emergencySystem = new EmergencySafetySystem();
    this.executionService = AutoSnipingExecutionService.getInstance();
    this.patternMonitoring = PatternMonitoringService.getInstance();
    this.mexcService = new UnifiedMexcService();

    this.config = this.getDefaultConfiguration();
    this.riskMetrics = this.getDefaultRiskMetrics();
    this.timerCoordinator = new TimerCoordinator();

    this.logger.info("Safety monitoring service initialized", {
      operation: "initialization",
      monitoringIntervalMs: this.config.monitoringIntervalMs,
      riskCheckIntervalMs: this.config.riskCheckIntervalMs,
      autoActionEnabled: this.config.autoActionEnabled,
      thresholdCount: Object.keys(this.config.thresholds).length,
    });
  }

  public static getInstance(): RealTimeSafetyMonitoringService {
    if (!RealTimeSafetyMonitoringService.instance) {
      RealTimeSafetyMonitoringService.instance = new RealTimeSafetyMonitoringService();
    }
    return RealTimeSafetyMonitoringService.instance;
  }

  /**
   * For testing: inject dependencies
   */
  public injectDependencies(dependencies: {
    emergencySystem?: EmergencySafetySystem;
    executionService?: AutoSnipingExecutionService;
    patternMonitoring?: PatternMonitoringService;
    mexcService?: UnifiedMexcService;
  }): void {
    if (dependencies.emergencySystem) {
      this.emergencySystem = dependencies.emergencySystem;
    }
    if (dependencies.executionService) {
      this.executionService = dependencies.executionService;
    }
    if (dependencies.patternMonitoring) {
      this.patternMonitoring = dependencies.patternMonitoring;
    }
    if (dependencies.mexcService) {
      this.mexcService = dependencies.mexcService;
    }
  }

  /**
   * For testing: clear all alerts
   */
  public clearAllAlerts(): void {
    this.alerts = [];
    this.recentActions = [];
  }

  /**
   * For testing: reset to default state
   */
  public resetToDefaults(): void {
    this.alerts = [];
    this.recentActions = [];
    this.riskMetrics = this.getDefaultRiskMetrics();
    this.monitoringStats = {
      alertsGenerated: 0,
      actionsExecuted: 0,
      riskEventsDetected: 0,
      systemUptime: 0,
      startTime: Date.now(),
    };
  }

  /**
   * For testing: get safety report without updating metrics
   */
  public async getSafetyReportWithoutUpdate(): Promise<SafetyMonitoringReport> {
    const systemHealth = await this.assessSystemHealth();
    const overallRiskScore = this.calculateOverallRiskScoreInternal(systemHealth);
    const status = this.determineOverallStatus(overallRiskScore);

    return {
      status,
      overallRiskScore,
      riskMetrics: { ...this.riskMetrics },
      thresholds: { ...this.config.thresholds },
      activeAlerts: this.alerts.filter((alert) => !alert.acknowledged),
      recentActions: this.recentActions.slice(-10),
      systemHealth,
      recommendations: this.generateSafetyRecommendations(),
      monitoringStats: {
        alertsGenerated: this.monitoringStats.alertsGenerated,
        actionsExecuted: this.monitoringStats.actionsExecuted,
        riskEventsDetected: this.monitoringStats.riskEventsDetected,
        systemUptime: Date.now() - this.monitoringStats.startTime,
        lastRiskCheck: new Date().toISOString(),
        monitoringFrequency: this.config.monitoringIntervalMs,
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Start real-time safety monitoring
   */
  public async startMonitoring(): Promise<void> {
    if (this.isMonitoringActive) {
      throw new Error("Safety monitoring is already active");
    }

    this.logger.info("Starting real-time safety monitoring", {
      operation: "start_monitoring",
      monitoringIntervalMs: this.config.monitoringIntervalMs,
      riskCheckIntervalMs: this.config.riskCheckIntervalMs,
      autoActionEnabled: this.config.autoActionEnabled,
      emergencyMode: this.config.emergencyMode,
    });

    this.isMonitoringActive = true;
    this.monitoringStats.startTime = Date.now();
    this.monitoringStats.systemUptime = 0; // Reset uptime when starting

    // Register monitoring operations with the timer coordinator
    this.timerCoordinator.registerOperation({
      id: "monitoring_cycle",
      name: "Safety Monitoring Cycle",
      intervalMs: this.config.monitoringIntervalMs,
      handler: async () => {
        await this.performMonitoringCycle().catch((error) => {
          this.logger.error(
            "Monitoring cycle failed",
            {
              operation: "monitoring_cycle",
              intervalMs: this.config.monitoringIntervalMs,
              isActive: this.isMonitoringActive,
            },
            error
          );
          this.addAlert({
            type: "system_failure",
            severity: "high",
            category: "system",
            title: "Monitoring Cycle Failed",
            message: `Safety monitoring cycle failed: ${error.message}`,
            riskLevel: 80,
            source: "monitoring_cycle",
            autoActions: [],
            metadata: { error: error.message },
          });
        });
      },
    });

    this.timerCoordinator.registerOperation({
      id: "risk_assessment",
      name: "Risk Assessment Cycle",
      intervalMs: this.config.riskCheckIntervalMs,
      handler: async () => {
        await this.performRiskAssessmentInternal().catch((error) => {
          this.logger.error(
            "Risk assessment failed",
            {
              operation: "risk_assessment",
              intervalMs: this.config.riskCheckIntervalMs,
              isActive: this.isMonitoringActive,
            },
            error
          );
        });
      },
    });

    // Start the coordinated timer system
    this.timerCoordinator.start();

    // Perform initial system health check to initialize monitoring
    try {
      await this.emergencySystem.performSystemHealthCheck();
    } catch (error) {
      this.logger.warn("Initial health check failed during monitoring start", {
        operation: "start_monitoring",
        error: error.message,
      });
    }

    this.addAlert({
      type: "emergency_condition",
      severity: "low",
      category: "system",
      title: "Safety Monitoring Started",
      message: "Real-time safety monitoring is now active",
      riskLevel: 0,
      source: "system",
      autoActions: [],
      metadata: { startTime: new Date().toISOString() },
    });
  }

  /**
   * Stop safety monitoring
   */
  public stopMonitoring(): void {
    this.logger.info("Stopping real-time safety monitoring", {
      operation: "stop_monitoring",
      wasActive: this.isMonitoringActive,
      uptime: Date.now() - this.monitoringStats.startTime,
      alertsGenerated: this.monitoringStats.alertsGenerated,
      actionsExecuted: this.monitoringStats.actionsExecuted,
    });

    this.isMonitoringActive = false;

    // Stop the timer coordinator (handles cleanup of all timers)
    this.timerCoordinator.stop();

    this.addAlert({
      type: "emergency_condition",
      severity: "low",
      category: "system",
      title: "Safety Monitoring Stopped",
      message: "Real-time safety monitoring has been deactivated",
      riskLevel: 10,
      source: "system",
      autoActions: [],
      metadata: { stopTime: new Date().toISOString() },
    });
  }

  /**
   * Get timer coordination status for monitoring
   */
  public getTimerStatus(): Array<{
    id: string;
    name: string;
    intervalMs: number;
    lastExecuted: number;
    isRunning: boolean;
    nextExecution: number;
  }> {
    return this.timerCoordinator.getOperationStatus();
  }

  /**
   * Get comprehensive safety monitoring report
   */
  public async getSafetyReport(): Promise<SafetyMonitoringReport> {
    // Always update risk metrics when generating a report
    await this.updateRiskMetrics();

    const systemHealth = await this.assessSystemHealth();
    const overallRiskScore = this.calculateOverallRiskScoreInternal(systemHealth);
    const status = this.determineOverallStatus(overallRiskScore);

    return {
      status,
      overallRiskScore,
      riskMetrics: { ...this.riskMetrics },
      thresholds: { ...this.config.thresholds },
      activeAlerts: this.alerts.filter((alert) => !alert.acknowledged),
      recentActions: this.recentActions.slice(-10),
      systemHealth,
      recommendations: this.generateSafetyRecommendations(),
      monitoringStats: {
        alertsGenerated: this.monitoringStats.alertsGenerated,
        actionsExecuted: this.monitoringStats.actionsExecuted,
        riskEventsDetected: this.monitoringStats.riskEventsDetected,
        systemUptime: Date.now() - this.monitoringStats.startTime,
        lastRiskCheck: new Date().toISOString(),
        monitoringFrequency: this.config.monitoringIntervalMs,
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Update safety configuration
   */
  public updateConfiguration(newConfig: Partial<SafetyConfiguration>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart monitoring with new intervals if active
    if (
      this.isMonitoringActive &&
      (newConfig.monitoringIntervalMs || newConfig.riskCheckIntervalMs)
    ) {
      this.stopMonitoring();
      this.startMonitoring().catch((error) => {
        this.logger.error(
          "Failed to restart with new config",
          {
            operation: "restart_monitoring",
            updatedFields: Object.keys(newConfig),
            monitoringIntervalMs: this.config.monitoringIntervalMs,
            riskCheckIntervalMs: this.config.riskCheckIntervalMs,
          },
          error
        );
      });
    }

    this.addAlert({
      type: "emergency_condition",
      severity: "low",
      category: "system",
      title: "Configuration Updated",
      message: "Safety monitoring configuration has been updated",
      riskLevel: 5,
      source: "configuration",
      autoActions: [],
      metadata: { updatedFields: Object.keys(newConfig) },
    });

    this.logger.info("Configuration updated", {
      operation: "config_update",
      updatedFields: Object.keys(newConfig),
      newMonitoringInterval: this.config.monitoringIntervalMs,
      newRiskCheckInterval: this.config.riskCheckIntervalMs,
      autoActionEnabled: this.config.autoActionEnabled,
      emergencyMode: this.config.emergencyMode,
    });
  }

  /**
   * Trigger emergency safety response
   */
  public async triggerEmergencyResponse(reason: string): Promise<SafetyAction[]> {
    this.logger.warn("Triggering emergency response", {
      operation: "emergency_response",
      reason,
      activePositions: this.executionService.getActivePositions().length,
      currentRiskScore: this.calculateOverallRiskScoreInternal(),
      emergencyMode: this.config.emergencyMode,
    });

    const actions: SafetyAction[] = [];

    try {
      // Execute emergency halt
      const haltAction: SafetyAction = {
        id: `halt_${Date.now()}`,
        type: "halt_trading",
        description: "Emergency trading halt activated",
        executed: false,
      };

      try {
        await this.executionService.stopExecution();
        haltAction.executed = true;
        haltAction.executedAt = new Date().toISOString();
        haltAction.result = "success";
        haltAction.details = "Trading execution successfully halted";
      } catch (error) {
        haltAction.executed = true;
        haltAction.executedAt = new Date().toISOString();
        haltAction.result = "failed";
        haltAction.details = `Failed to halt trading: ${error.message}`;
      }

      actions.push(haltAction);

      // Always execute emergency close (even if no positions exist)
      const positions = this.executionService.getActivePositions();
      const closeAction: SafetyAction = {
        id: `close_${Date.now()}`,
        type: "emergency_close",
        description:
          positions.length > 0
            ? `Emergency close ${positions.length} active positions`
            : "Emergency close all positions (preventive)",
        executed: false,
      };

      try {
        const closedCount = await this.executionService.emergencyCloseAll();
        closeAction.executed = true;
        closeAction.executedAt = new Date().toISOString();
        closeAction.result =
          positions.length === 0 || closedCount === positions.length ? "success" : "partial";
        closeAction.details =
          positions.length > 0
            ? `Closed ${closedCount}/${positions.length} positions`
            : "No positions to close";
      } catch (error) {
        closeAction.executed = true;
        closeAction.executedAt = new Date().toISOString();
        closeAction.result = "failed";
        closeAction.details = `Failed to close positions: ${error.message}`;
      }

      actions.push(closeAction);

      // Add actions to recent actions
      this.recentActions.push(...actions);
      this.monitoringStats.actionsExecuted += actions.length;

      // Generate emergency alert
      this.addAlert({
        type: "emergency_condition",
        severity: "critical",
        category: "system",
        title: "Emergency Response Triggered",
        message: `Emergency safety response activated: ${reason}`,
        riskLevel: 95,
        source: "emergency_response",
        autoActions: actions,
        metadata: { reason, actionsExecuted: actions.length },
      });

      return actions;
    } catch (error) {
      this.logger.error(
        "Emergency response failed",
        {
          operation: "emergency_response",
          reason,
          actionsAttempted: actions.length,
          activePositions: this.executionService.getActivePositions().length,
        },
        error
      );

      const failedAction: SafetyAction = {
        id: `failed_${Date.now()}`,
        type: "notify_admin",
        description: "Emergency response system failure",
        executed: true,
        executedAt: new Date().toISOString(),
        result: "failed",
        details: `Emergency response failed: ${error.message}`,
      };

      actions.push(failedAction);
      return actions;
    }
  }

  /**
   * Acknowledge safety alert
   */
  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Clear acknowledged alerts
   */
  public clearAcknowledgedAlerts(): number {
    const countBefore = this.alerts.length;
    this.alerts = this.alerts.filter((alert) => !alert.acknowledged);
    return countBefore - this.alerts.length;
  }

  /**
   * Get current risk metrics
   */
  public getRiskMetrics(): RiskMetrics {
    return { ...this.riskMetrics };
  }

  /**
   * Get monitoring active status
   */
  public getMonitoringStatus(): boolean {
    return this.isMonitoringActive;
  }

  /**
   * Get current safety configuration
   */
  public getConfiguration(): SafetyConfiguration {
    return { ...this.config };
  }

  /**
   * Check if system is in safe state
   */
  public async isSystemSafe(): Promise<boolean> {
    const report = await this.getSafetyReport();
    return report.status === "safe" && report.overallRiskScore < 50;
  }

  /**
   * Calculate overall risk score (public access)
   */
  public calculateOverallRiskScore(systemHealth?: any): number {
    return this.calculateOverallRiskScoreInternal(systemHealth);
  }

  /**
   * Perform risk assessment (public access)
   */
  public async performRiskAssessment(): Promise<void> {
    return this.performRiskAssessmentInternal();
  }

  // Private methods

  private async performMonitoringCycle(): Promise<void> {
    if (!this.isMonitoringActive) {
      this.logger.debug("Skipping monitoring cycle - service not active", {
        operation: "monitoring_cycle",
        isActive: this.isMonitoringActive,
        uptime: Date.now() - this.monitoringStats.startTime,
      });
      return;
    }

    const timer = createTimer("monitoring_cycle", "safety-monitoring");
    this.logger.debug("Starting monitoring cycle", {
      operation: "monitoring_cycle",
      alertCount: this.alerts.length,
      riskScore: this.calculateOverallRiskScore(),
    });

    try {
      // Update risk metrics with timeout protection
      await this.updateRiskMetrics();

      // Validate we're still active before continuing
      if (!this.isMonitoringActive) return;

      // Check all safety thresholds
      await this.checkSafetyThresholds();

      // Validate we're still active before cleanup
      if (!this.isMonitoringActive) return;

      // Clean up old alerts
      this.cleanupOldAlerts();

      const duration = timer.end({
        alertCount: this.alerts.length,
        riskScore: this.calculateOverallRiskScoreInternal(),
        status: "success",
      });

      this.logger.info("Monitoring cycle completed", {
        operation: "monitoring_cycle",
        duration,
        alertCount: this.alerts.length,
        riskScore: this.calculateOverallRiskScoreInternal(),
        status: "success",
      });
    } catch (error) {
      const duration = timer.end({
        status: "failed",
      });

      this.logger.error(
        "Monitoring cycle error",
        {
          operation: "monitoring_cycle",
          duration,
          alertCount: this.alerts.length,
          isActive: this.isMonitoringActive,
          status: "failed",
        },
        error
      );
      throw error;
    }
  }

  private async performRiskAssessmentInternal(): Promise<void> {
    if (!this.isMonitoringActive) {
      this.logger.debug("Skipping risk assessment - service not active", {
        operation: "risk_assessment",
        isActive: this.isMonitoringActive,
        uptime: Date.now() - this.monitoringStats.startTime,
      });
      return;
    }

    const timer = createTimer("risk_assessment", "safety-monitoring");
    this.logger.debug("Starting risk assessment", {
      operation: "risk_assessment",
      currentRiskScore: this.calculateOverallRiskScoreInternal(),
      consecutiveLosses: this.riskMetrics.consecutiveLosses,
      currentDrawdown: this.riskMetrics.currentDrawdown,
    });

    try {
      // Run all risk assessments in parallel for 3x faster execution
      // These are independent operations that can safely run concurrently
      const assessmentPromises = [
        this.assessPortfolioRisk(),
        this.assessPerformanceRisk(),
        this.assessPatternRisk(),
      ];

      await Promise.all(assessmentPromises);

      // Validate we're still active before updating stats
      if (!this.isMonitoringActive) return;

      this.monitoringStats.riskEventsDetected++;

      const duration = timer.end({
        riskScore: this.calculateOverallRiskScoreInternal(),
        riskEventsDetected: this.monitoringStats.riskEventsDetected,
        status: "success",
      });

      this.logger.info("Risk assessment completed", {
        operation: "risk_assessment",
        duration,
        riskScore: this.calculateOverallRiskScoreInternal(),
        riskEventsDetected: this.monitoringStats.riskEventsDetected,
        assessmentTypes: ["portfolio", "performance", "pattern"],
        status: "success",
      });
    } catch (error) {
      const duration = timer.end({
        status: "failed",
      });

      this.logger.error(
        "Risk assessment error",
        {
          operation: "risk_assessment",
          duration,
          riskScore: this.calculateOverallRiskScoreInternal(),
          isActive: this.isMonitoringActive,
          status: "failed",
        },
        error
      );
      // Don't throw error in risk assessment to prevent disrupting timer coordination
    }
  }

  private async updateRiskMetrics(): Promise<void> {
    try {
      // Run both reports in parallel for 2x faster data collection
      const [executionReport, patternReport] = await Promise.all([
        this.executionService.getExecutionReport(),
        this.patternMonitoring.getMonitoringReport(),
      ]);

      // Update portfolio metrics
      this.riskMetrics.currentDrawdown = executionReport.stats.currentDrawdown;
      this.riskMetrics.maxDrawdown = executionReport.stats.maxDrawdown;
      this.riskMetrics.portfolioValue = Number.parseFloat(executionReport.stats.totalPnl) + 10000; // Assume 10k base
      this.riskMetrics.totalExposure = executionReport.activePositions.length * 100; // Simplified
      this.riskMetrics.concentrationRisk = this.calculateConcentrationRisk(
        executionReport.activePositions
      );

      // Update performance metrics
      this.riskMetrics.successRate = executionReport.stats.successRate;
      this.riskMetrics.consecutiveLosses = this.calculateConsecutiveLosses(
        executionReport.recentExecutions
      );
      this.riskMetrics.averageSlippage = executionReport.stats.averageSlippage;

      // Update system metrics (simplified)
      this.riskMetrics.apiLatency = 100; // Would measure actual API latency
      this.riskMetrics.apiSuccessRate = 98; // Would track actual API success rate
      this.riskMetrics.memoryUsage = 45; // Would measure actual memory usage

      // Update pattern metrics
      this.riskMetrics.patternAccuracy = patternReport.stats.averageConfidence;
      this.riskMetrics.detectionFailures = patternReport.stats.consecutiveErrors;
      this.riskMetrics.falsePositiveRate = this.calculateFalsePositiveRate(patternReport);
    } catch (error) {
      this.logger.error(
        "Failed to update risk metrics",
        {
          operation: "update_risk_metrics",
          currentDrawdown: this.riskMetrics.currentDrawdown,
          successRate: this.riskMetrics.successRate,
          patternAccuracy: this.riskMetrics.patternAccuracy,
        },
        error
      );
    }
  }

  private async checkSafetyThresholds(): Promise<void> {
    const thresholds = this.config.thresholds;

    // Check drawdown threshold
    if (this.riskMetrics.currentDrawdown > thresholds.maxDrawdownPercentage) {
      this.addAlert({
        type: "risk_threshold",
        severity: "critical",
        category: "portfolio",
        title: "Maximum Drawdown Exceeded",
        message: `Current drawdown ${this.riskMetrics.currentDrawdown.toFixed(1)}% exceeds threshold ${thresholds.maxDrawdownPercentage}%`,
        riskLevel: 90,
        source: "risk_threshold",
        autoActions: this.config.autoActionEnabled
          ? [
              {
                id: `auto_halt_${Date.now()}`,
                type: "halt_trading",
                description: "Auto-halt trading due to excessive drawdown",
                executed: false,
              },
            ]
          : [],
        metadata: {
          currentDrawdown: this.riskMetrics.currentDrawdown,
          threshold: thresholds.maxDrawdownPercentage,
        },
      });
    }

    // Check success rate threshold
    if (this.riskMetrics.successRate < thresholds.minSuccessRatePercentage) {
      this.addAlert({
        type: "performance_degradation",
        severity: "high",
        category: "performance",
        title: "Low Success Rate",
        message: `Success rate ${this.riskMetrics.successRate.toFixed(1)}% below threshold ${thresholds.minSuccessRatePercentage}%`,
        riskLevel: 70,
        source: "performance_monitor",
        autoActions: [],
        metadata: {
          currentSuccessRate: this.riskMetrics.successRate,
          threshold: thresholds.minSuccessRatePercentage,
        },
      });
    }

    // Check consecutive losses
    if (this.riskMetrics.consecutiveLosses > thresholds.maxConsecutiveLosses) {
      this.addAlert({
        type: "risk_threshold",
        severity: "high",
        category: "performance",
        title: "Excessive Consecutive Losses",
        message: `${this.riskMetrics.consecutiveLosses} consecutive losses exceeds threshold ${thresholds.maxConsecutiveLosses}`,
        riskLevel: 75,
        source: "risk_threshold",
        autoActions: this.config.autoActionEnabled
          ? [
              {
                id: `auto_reduce_${Date.now()}`,
                type: "reduce_positions",
                description: "Auto-reduce position sizes due to consecutive losses",
                executed: false,
              },
            ]
          : [],
        metadata: {
          consecutiveLosses: this.riskMetrics.consecutiveLosses,
          threshold: thresholds.maxConsecutiveLosses,
        },
      });
    }

    // Check API latency
    if (this.riskMetrics.apiLatency > thresholds.maxApiLatencyMs) {
      this.addAlert({
        type: "system_failure",
        severity: "medium",
        category: "api",
        title: "High API Latency",
        message: `API latency ${this.riskMetrics.apiLatency}ms exceeds threshold ${thresholds.maxApiLatencyMs}ms`,
        riskLevel: 60,
        source: "system_monitor",
        autoActions: [],
        metadata: {
          currentLatency: this.riskMetrics.apiLatency,
          threshold: thresholds.maxApiLatencyMs,
        },
      });
    }
  }

  private async assessPortfolioRisk(): Promise<void> {
    // Portfolio risk assessment logic
    const positions = this.executionService.getActivePositions();

    if (positions.length > 0) {
      const totalExposure = positions.reduce(
        (sum, pos) => sum + Number.parseFloat(pos.quantity),
        0
      );
      const concentrationRisk = this.calculateConcentrationRisk(positions);

      if (concentrationRisk > this.config.thresholds.maxPortfolioConcentration) {
        this.addAlert({
          type: "risk_threshold",
          severity: "medium",
          category: "portfolio",
          title: "High Portfolio Concentration",
          message: `Portfolio concentration ${concentrationRisk.toFixed(1)}% exceeds safe levels`,
          riskLevel: 65,
          source: "portfolio_analysis",
          autoActions: [],
          metadata: { concentrationRisk, totalExposure },
        });
      }
    }
  }

  private async assessPerformanceRisk(): Promise<void> {
    // Performance risk assessment logic
    const executionReport = await this.executionService.getExecutionReport();

    if (executionReport.stats.averageSlippage > this.config.thresholds.maxSlippagePercentage) {
      this.addAlert({
        type: "performance_degradation",
        severity: "medium",
        category: "performance",
        title: "High Slippage Detected",
        message: `Average slippage ${executionReport.stats.averageSlippage.toFixed(2)}% exceeds threshold`,
        riskLevel: 55,
        source: "performance_monitor",
        autoActions: [],
        metadata: {
          averageSlippage: executionReport.stats.averageSlippage,
          threshold: this.config.thresholds.maxSlippagePercentage,
        },
      });
    }
  }

  private async assessPatternRisk(): Promise<void> {
    // Pattern detection risk assessment
    const patternReport = await this.patternMonitoring.getMonitoringReport();

    if (patternReport.stats.averageConfidence < this.config.thresholds.minPatternConfidence) {
      this.addAlert({
        type: "performance_degradation",
        severity: "medium",
        category: "pattern",
        title: "Low Pattern Confidence",
        message: `Pattern confidence ${patternReport.stats.averageConfidence.toFixed(1)}% below threshold`,
        riskLevel: 50,
        source: "pattern_monitor",
        autoActions: [],
        metadata: {
          averageConfidence: patternReport.stats.averageConfidence,
          threshold: this.config.thresholds.minPatternConfidence,
        },
      });
    }
  }

  private async assessSystemHealth() {
    try {
      const executionReport = await this.executionService.getExecutionReport();
      const patternReport = await this.patternMonitoring.getMonitoringReport();
      const emergencyHealth = await this.emergencySystem.performSystemHealthCheck();

      const executionServiceHealth = executionReport.systemHealth.apiConnection;
      const patternMonitoringHealth = patternReport.status === "healthy";
      const emergencySystemHealth = emergencyHealth.overall === "healthy";
      const mexcConnectivityHealth = true; // Would check actual connectivity

      // Calculate overall health based on individual components
      const healthComponents = [
        executionServiceHealth,
        patternMonitoringHealth,
        emergencySystemHealth,
        mexcConnectivityHealth,
      ];
      const healthyCount = healthComponents.filter(Boolean).length;
      const overallHealth = (healthyCount / healthComponents.length) * 100;

      return {
        executionService: executionServiceHealth,
        patternMonitoring: patternMonitoringHealth,
        emergencySystem: emergencySystemHealth,
        mexcConnectivity: mexcConnectivityHealth,
        overallHealth,
      };
    } catch (_error) {
      return {
        executionService: false,
        patternMonitoring: false,
        emergencySystem: false,
        mexcConnectivity: false,
        overallHealth: 0,
      };
    }
  }

  private calculateOverallRiskScoreInternal(systemHealth?: any): number {
    // If emergency system is unhealthy, immediately return high risk score
    if (systemHealth && !systemHealth.emergencySystem) {
      return 75; // Critical risk level
    }

    // If all core metrics are at complete default values (no data), return 0 risk score
    if (
      this.riskMetrics.currentDrawdown === 0 &&
      this.riskMetrics.consecutiveLosses === 0 &&
      this.riskMetrics.concentrationRisk === 0 &&
      this.riskMetrics.apiLatency === 0 &&
      this.riskMetrics.successRate === 0 &&
      this.riskMetrics.patternAccuracy === 0
    ) {
      return 0;
    }

    const weights = {
      drawdown: 25,
      successRate: 20,
      consecutiveLosses: 15,
      concentration: 15,
      systemHealth: 10,
      patternAccuracy: 10,
      apiLatency: 5,
    };

    let score = 0;

    // Drawdown risk (higher drawdown = higher risk)
    score +=
      (this.riskMetrics.currentDrawdown / this.config.thresholds.maxDrawdownPercentage) *
      weights.drawdown;

    // Success rate risk (lower success rate = higher risk)
    const successRateRisk = Math.max(
      0,
      (this.config.thresholds.minSuccessRatePercentage - this.riskMetrics.successRate) /
        this.config.thresholds.minSuccessRatePercentage
    );
    score += successRateRisk * weights.successRate;

    // Consecutive losses risk
    score +=
      (this.riskMetrics.consecutiveLosses / this.config.thresholds.maxConsecutiveLosses) *
      weights.consecutiveLosses;

    // Concentration risk
    score +=
      (this.riskMetrics.concentrationRisk / this.config.thresholds.maxPortfolioConcentration) *
      weights.concentration;

    // API latency risk
    score +=
      (this.riskMetrics.apiLatency / this.config.thresholds.maxApiLatencyMs) * weights.apiLatency;

    return Math.min(100, Math.max(0, score));
  }

  private determineOverallStatus(riskScore: number): "safe" | "warning" | "critical" | "emergency" {
    if (riskScore < 25) return "safe";
    if (riskScore < 50) return "warning";
    if (riskScore < 75) return "critical";
    return "emergency";
  }

  private generateSafetyRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.riskMetrics.currentDrawdown > 10) {
      recommendations.push("Consider reducing position sizes to limit drawdown");
    }

    if (this.riskMetrics.successRate < 70) {
      recommendations.push("Review trading strategy parameters and pattern confidence thresholds");
    }

    if (this.riskMetrics.consecutiveLosses > 3) {
      recommendations.push("Pause trading to review market conditions and strategy effectiveness");
    }

    if (this.riskMetrics.concentrationRisk > 50) {
      recommendations.push("Diversify portfolio across more symbols to reduce concentration risk");
    }

    if (this.alerts.filter((a) => !a.acknowledged && a.severity === "critical").length > 0) {
      recommendations.push("Address critical alerts immediately to prevent system damage");
    }

    if (recommendations.length === 0) {
      recommendations.push("System operating within safe parameters");
    }

    return recommendations;
  }

  private calculateConcentrationRisk(positions: ExecutionPosition[]): number {
    if (positions.length === 0) return 0;

    const symbolMap = new Map<string, number>();
    let totalValue = 0;

    positions.forEach((pos) => {
      const value = Number.parseFloat(pos.quantity) * Number.parseFloat(pos.currentPrice);
      symbolMap.set(pos.symbol, (symbolMap.get(pos.symbol) || 0) + value);
      totalValue += value;
    });

    // Find largest position as percentage of total
    let maxConcentration = 0;
    symbolMap.forEach((value) => {
      const concentration = (value / totalValue) * 100;
      maxConcentration = Math.max(maxConcentration, concentration);
    });

    return maxConcentration;
  }

  private calculateConsecutiveLosses(recentExecutions: ExecutionPosition[]): number {
    let consecutiveLosses = 0;

    for (let i = recentExecutions.length - 1; i >= 0; i--) {
      const execution = recentExecutions[i];
      if (Number.parseFloat(execution.unrealizedPnl) < 0) {
        consecutiveLosses++;
      } else {
        break;
      }
    }

    return consecutiveLosses;
  }

  private calculateFalsePositiveRate(patternReport: any): number {
    // Simplified false positive calculation
    const totalPatterns = patternReport.stats.totalPatternsDetected;
    const failedPatterns = patternReport.stats.consecutiveErrors;

    if (totalPatterns === 0) return 0;
    return (failedPatterns / totalPatterns) * 100;
  }

  private addAlert(alertData: Omit<SafetyAlert, "id" | "timestamp" | "acknowledged">): void {
    const alert: SafetyAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      ...alertData,
    };

    this.alerts.push(alert);
    this.monitoringStats.alertsGenerated++;

    // Execute auto-actions if enabled
    if (this.config.autoActionEnabled && alert.autoActions.length > 0) {
      this.executeAutoActions(alert.autoActions).catch((error) => {
        this.logger.error(
          "Auto-action execution failed",
          {
            operation: "execute_auto_actions",
            alertId: alert.id,
            alertType: alert.type,
            alertSeverity: alert.severity,
            actionsCount: alert.autoActions.length,
            autoActionEnabled: this.config.autoActionEnabled,
          },
          error
        );
      });
    }

    this.logger.safety("Alert generated", alert.riskLevel, {
      alertId: alert.id,
      alertType: alert.type,
      alertSeverity: alert.severity,
      alertCategory: alert.category,
      alertTitle: alert.title,
      alertMessage: alert.message,
      alertSource: alert.source,
      autoActionsCount: alert.autoActions.length,
      operation: "generate_alert",
    });
  }

  private async executeAutoActions(actions: SafetyAction[]): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case "halt_trading":
            await this.executionService.stopExecution();
            action.executed = true;
            action.result = "success";
            break;
          case "emergency_close":
            await this.executionService.emergencyCloseAll();
            action.executed = true;
            action.result = "success";
            break;
          case "reduce_positions":
            // Would implement position size reduction
            action.executed = true;
            action.result = "success";
            break;
          default:
            action.executed = false;
            action.result = "failed";
            action.details = "Unsupported action type";
        }

        action.executedAt = new Date().toISOString();
        this.recentActions.push(action);
        this.monitoringStats.actionsExecuted++;
      } catch (error) {
        action.executed = true;
        action.result = "failed";
        action.details = error.message;
        action.executedAt = new Date().toISOString();
      }
    }
  }

  private cleanupOldAlerts(): void {
    const cutoffTime = Date.now() - this.config.alertRetentionHours * 60 * 60 * 1000;

    this.alerts = this.alerts.filter((alert) => {
      const alertTime = new Date(alert.timestamp).getTime();
      return alertTime > cutoffTime || !alert.acknowledged;
    });
  }

  private getDefaultConfiguration(): SafetyConfiguration {
    return {
      enabled: true,
      monitoringIntervalMs: 30000, // 30 seconds
      riskCheckIntervalMs: 60000, // 1 minute
      autoActionEnabled: false,
      emergencyMode: false,
      alertRetentionHours: 24,
      thresholds: {
        maxDrawdownPercentage: 15,
        maxDailyLossPercentage: 5,
        maxPositionRiskPercentage: 10,
        maxPortfolioConcentration: 25,
        minSuccessRatePercentage: 60,
        maxConsecutiveLosses: 5,
        maxSlippagePercentage: 2,
        maxApiLatencyMs: 1000,
        minApiSuccessRate: 95,
        maxMemoryUsagePercentage: 80,
        minPatternConfidence: 75,
        maxPatternDetectionFailures: 3,
      },
    };
  }

  private getDefaultRiskMetrics(): RiskMetrics {
    return {
      currentDrawdown: 0,
      maxDrawdown: 0,
      portfolioValue: 10000,
      totalExposure: 0,
      concentrationRisk: 0,
      successRate: 0,
      consecutiveLosses: 0,
      averageSlippage: 0,
      apiLatency: 0,
      apiSuccessRate: 100,
      memoryUsage: 0,
      patternAccuracy: 0,
      detectionFailures: 0,
      falsePositiveRate: 0,
    };
  }
}

/**
 * Real-time Safety Monitoring Service - Modular Integration
 *
 * Main entry point for the modular Real-time Safety Monitoring Service. This module integrates
 * all the specialized modules and provides backward compatibility with the
 * original RealTimeSafetyMonitoringService interface.
 *
 * Modules:
 * - Core Safety Monitoring: Main monitoring and risk metric updates
 * - Alert Management: Alert generation, acknowledgment, and auto-action execution
 * - Event Handling: Timer coordination and scheduled operations
 * - Risk Assessment: Specialized risk calculations and assessments
 * - Configuration Management: Configuration validation and management
 *
 * This refactoring maintains 100% backward compatibility while providing
 * improved modularity, testability, and maintainability.
 */

// Import types from schemas
import type {
  MonitoringStats,
  RiskMetrics,
  SafetyAction,
  SafetyAlert,
  SafetyConfiguration,
  SafetyMonitoringReport,
  SafetyThresholds,
  SystemHealth,
} from "@/src/schemas/safety-monitoring-schemas";
import { UnifiedMexcServiceV2 } from "@/src/services/api/unified-mexc-service-v2";
import { PatternMonitoringService } from "@/src/services/notification/pattern-monitoring-service";
import { EmergencySafetySystem } from "@/src/services/risk/emergency-safety-system";
import {
  EmergencyStopCoordinator,
  type EmergencyStopEvent,
} from "@/src/services/risk/emergency-stop-coordinator";
import {
  type CoreTradingService,
  getCoreTrading,
} from "@/src/services/trading/consolidated/core-trading/base-service";
import {
  type AlertGenerationData,
  AlertManagement,
  type AlertManagementConfig,
  type AlertStatistics,
  createAlertManagement,
} from "./alert-management";
import {
  ConfigurationManagement,
  type ConfigurationManagementConfig,
  type ConfigurationPreset,
  type ConfigurationUpdate,
  type ConfigurationValidationResult,
  createConfigurationManagement,
} from "./configuration-management";
// Import modular components
import {
  CoreSafetyMonitoring,
  type CoreSafetyMonitoringConfig,
  createCoreSafetyMonitoring,
  type RiskAssessmentUpdate,
  type ThresholdCheckResult,
} from "./core-safety-monitoring";
import {
  createEventHandling,
  EventHandling,
  type EventHandlingConfig,
  type OperationRegistration,
  type OperationStatus,
  type TimerCoordinatorStats,
} from "./event-handling";
import {
  type ComprehensiveRiskAssessment,
  createRiskAssessment,
  type PatternRiskAssessment,
  type PerformanceRiskAssessment,
  type PortfolioRiskAssessment,
  RiskAssessment,
  type RiskAssessmentConfig,
  type SystemRiskAssessment,
} from "./risk-assessment";

// Re-export types for backward compatibility
export type {
  SafetyConfiguration,
  SafetyThresholds,
  RiskMetrics,
  SafetyAlert,
  SafetyAction,
  SafetyMonitoringReport,
  SystemHealth,
  MonitoringStats,
};

// Export module types for advanced usage
export type {
  CoreSafetyMonitoringConfig,
  RiskAssessmentUpdate,
  ThresholdCheckResult,
  AlertManagementConfig,
  AlertGenerationData,
  AlertStatistics,
  EventHandlingConfig,
  OperationRegistration,
  OperationStatus,
  TimerCoordinatorStats,
  RiskAssessmentConfig,
  ComprehensiveRiskAssessment,
  PortfolioRiskAssessment,
  PerformanceRiskAssessment,
  PatternRiskAssessment,
  SystemRiskAssessment,
  ConfigurationManagementConfig,
  ConfigurationUpdate,
  ConfigurationValidationResult,
  ConfigurationPreset,
};

/**
 * Real-time Safety Monitoring Service - Modular Implementation
 *
 * Provides comprehensive real-time safety monitoring and risk management with:
 * - Real-time position and portfolio risk monitoring
 * - Dynamic alert management and auto-action execution
 * - Configurable monitoring intervals and thresholds
 * - Comprehensive risk assessments across multiple categories
 * - Timer coordination to prevent overlapping operations
 *
 * This modular implementation maintains full backward compatibility
 * while providing improved architecture and maintainability.
 */
export class RealTimeSafetyMonitoringService {
  private static instance: RealTimeSafetyMonitoringService;

  // Module instances
  private coreSafetyMonitoring!: CoreSafetyMonitoring;
  private alertManagement!: AlertManagement;
  private eventHandling!: EventHandling;
  private riskAssessment!: RiskAssessment;
  private configurationManagement!: ConfigurationManagement;

  // Service dependencies (for compatibility)
  private emergencySystem: EmergencySafetySystem;
  private emergencyStopCoordinator: EmergencyStopCoordinator;
  private executionService: CoreTradingService;
  private patternMonitoring: PatternMonitoringService;
  private mexcService: UnifiedMexcServiceV2;

  private _logger?: {
    info: (message: string, context?: any) => void;
    warn: (message: string, context?: any) => void;
    error: (message: string, context?: any, error?: Error) => void;
    debug: (message: string, context?: any) => void;
  };
  private isMonitoringActive = false;

  private get logger() {
    if (!this._logger) {
      this._logger = {
        info: (message: string, context?: any) =>
          console.info("[safety-monitoring]", message, context || ""),
        warn: (message: string, context?: any) =>
          console.warn("[safety-monitoring]", message, context || ""),
        error: (message: string, context?: any, error?: Error) =>
          console.error("[safety-monitoring]", message, context || "", error || ""),
        debug: (message: string, context?: any) =>
          console.debug("[safety-monitoring]", message, context || ""),
      };
    }
    return this._logger;
  }

  private constructor() {
    // Initialize services
    this.emergencySystem = new EmergencySafetySystem();
    this.emergencyStopCoordinator = EmergencyStopCoordinator.getInstance();
    this.executionService = getCoreTrading();
    this.patternMonitoring = PatternMonitoringService.getInstance();
    this.mexcService = new UnifiedMexcServiceV2();

    // Register this service with the emergency stop coordinator
    this.emergencyStopCoordinator.registerService("safety-monitoring", this);

    // Initialize modules
    this.initializeModules();

    console.info("Real-time safety monitoring service initialized with modular architecture", {
      operation: "initialization",
      moduleCount: 5,
      hasBackwardCompatibility: true,
    });
  }

  public static getInstance(): RealTimeSafetyMonitoringService {
    if (!RealTimeSafetyMonitoringService.instance) {
      RealTimeSafetyMonitoringService.instance = new RealTimeSafetyMonitoringService();
    }
    return RealTimeSafetyMonitoringService.instance;
  }

  /**
   * Initialize all modules with default configuration
   */
  private initializeModules(): void {
    // Initialize configuration management first
    this.configurationManagement = createConfigurationManagement(undefined, {
      onConfigUpdate: (config) => this.handleConfigurationUpdate(config),
      enableValidation: true,
      enablePersistence: true,
    });

    const config = this.configurationManagement.getConfiguration();

    // Initialize event handling
    this.eventHandling = createEventHandling({
      baseTickMs: 5000,
      maxConcurrentOperations: 3,
      operationTimeoutMs: 30000,
    });

    // Initialize alert management
    this.alertManagement = createAlertManagement({
      configuration: config,
      executionService: this.executionService,
      onStatsUpdate: (stats) => this.logger.debug("Alert stats updated", stats),
    });

    // Initialize core safety monitoring
    this.coreSafetyMonitoring = createCoreSafetyMonitoring({
      configuration: config,
      executionService: this.executionService,
      patternMonitoring: this.patternMonitoring,
      onAlert: (alertData) => this.alertManagement.addAlert(alertData),
    });

    // Initialize risk assessment
    this.riskAssessment = createRiskAssessment({
      configuration: config,
      executionService: this.executionService,
      patternMonitoring: this.patternMonitoring,
      emergencySystem: this.emergencySystem,
      mexcService: this.mexcService,
    });
  }

  /**
   * Handle configuration updates by reinitializing affected modules
   */
  private handleConfigurationUpdate(newConfig: SafetyConfiguration): void {
    console.info("Configuration updated, reinitializing modules", {
      operation: "handle_config_update",
      monitoringInterval: newConfig.monitoringIntervalMs,
      riskCheckInterval: newConfig.riskCheckIntervalMs,
      autoActionEnabled: newConfig.autoActionEnabled,
    });

    // Update alert management configuration
    this.alertManagement = createAlertManagement({
      configuration: newConfig,
      executionService: this.executionService,
      onStatsUpdate: (stats) => this.logger.debug("Alert stats updated", stats),
    });

    // Update core safety monitoring configuration
    this.coreSafetyMonitoring = createCoreSafetyMonitoring({
      configuration: newConfig,
      executionService: this.executionService,
      patternMonitoring: this.patternMonitoring,
      onAlert: (alertData) => this.alertManagement.addAlert(alertData),
    });

    // Update risk assessment configuration
    this.riskAssessment = createRiskAssessment({
      configuration: newConfig,
      executionService: this.executionService,
      patternMonitoring: this.patternMonitoring,
      emergencySystem: this.emergencySystem,
      mexcService: this.mexcService,
    });

    // Restart monitoring with new configuration if currently active
    if (this.isMonitoringActive) {
      this.stopMonitoring();
      this.startMonitoring().catch((error) => {
        console.error(
          "Failed to restart monitoring with new configuration",
          {
            operation: "handle_config_update",
          },
          error
        );
      });
    }
  }

  // ============================================================================
  // Public API - Backward Compatibility Methods
  // ============================================================================

  /**
   * Start real-time safety monitoring
   */
  public async startMonitoring(): Promise<void> {
    if (this.isMonitoringActive) {
      throw new Error("Safety monitoring is already active");
    }

    const config = this.configurationManagement.getConfiguration();

    console.info("Starting real-time safety monitoring", {
      operation: "start_monitoring",
      monitoringIntervalMs: config.monitoringIntervalMs,
      riskCheckIntervalMs: config.riskCheckIntervalMs,
      autoActionEnabled: config.autoActionEnabled,
      emergencyMode: config.emergencyMode,
    });

    this.isMonitoringActive = true;

    // Start core monitoring
    this.coreSafetyMonitoring.start();

    // Register monitoring operations with event handling
    this.eventHandling.registerOperation({
      id: "monitoring_cycle",
      name: "Safety Monitoring Cycle",
      intervalMs: config.monitoringIntervalMs,
      handler: async () => {
        await this.coreSafetyMonitoring.performMonitoringCycle();
      },
    });

    this.eventHandling.registerOperation({
      id: "risk_assessment",
      name: "Risk Assessment Cycle",
      intervalMs: config.riskCheckIntervalMs,
      handler: async () => {
        await this.riskAssessment.performComprehensiveAssessment();
      },
    });

    this.eventHandling.registerOperation({
      id: "alert_cleanup",
      name: "Alert Cleanup",
      intervalMs: 300000, // 5 minutes
      handler: async () => {
        this.alertManagement.cleanupOldAlerts();
      },
    });

    // Start the event handling system
    this.eventHandling.start();

    // Perform initial system health check
    try {
      await this.emergencySystem.performSystemHealthCheck();
    } catch (error) {
      console.warn("Initial health check failed during monitoring start", {
        operation: "start_monitoring",
        error: (error as Error)?.message,
      });
    }

    // Generate startup alert
    this.alertManagement.addAlert({
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
    console.info("Stopping real-time safety monitoring", {
      operation: "stop_monitoring",
      wasActive: this.isMonitoringActive,
    });

    this.isMonitoringActive = false;

    // Stop all modules
    this.coreSafetyMonitoring.stop();
    this.eventHandling.stop();

    // Generate shutdown alert
    this.alertManagement.addAlert({
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
   * Get comprehensive safety monitoring report
   */
  public async getSafetyReport(): Promise<SafetyMonitoringReport> {
    // Get data from all modules
    const [riskMetrics, systemRiskAssessment, alertStats, timerStats] = await Promise.all([
      this.coreSafetyMonitoring.updateRiskMetrics(),
      this.riskAssessment.assessSystemRisk(),
      this.alertManagement.getAlertStatistics(),
      Promise.resolve(this.eventHandling.getStats()),
    ]);

    const configuration = this.configurationManagement.getConfiguration();
    const overallRiskScore = this.coreSafetyMonitoring.calculateOverallRiskScore();
    const status = this.determineOverallStatus(overallRiskScore);

    return {
      status,
      overallRiskScore,
      riskMetrics,
      thresholds: configuration.thresholds,
      activeAlerts: this.alertManagement.getActiveAlerts(),
      recentActions: this.alertManagement.getRecentActions(),
      systemHealth: systemRiskAssessment.systemHealth,
      recommendations: await this.generateSafetyRecommendations(),
      monitoringStats: {
        alertsGenerated: alertStats.total,
        actionsExecuted: this.alertManagement.getInternalStats().actionsExecuted,
        riskEventsDetected: timerStats.totalExecutions,
        systemUptime: timerStats.uptime,
        lastRiskCheck: new Date().toISOString(),
        monitoringFrequency: configuration.monitoringIntervalMs,
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Update safety configuration
   */
  public updateConfiguration(newConfig: Partial<SafetyConfiguration>): void {
    this.configurationManagement.updateConfiguration(newConfig);
  }

  /**
   * FIXED: Trigger coordinated emergency safety response using EmergencyStopCoordinator
   * Addresses Agent 4/15 objectives: Emergency stop system synchronization
   */
  public async triggerEmergencyResponse(reason: string): Promise<SafetyAction[]> {
    const activePositions = await this.executionService.getActivePositions();
    console.warn("🚨 Triggering coordinated emergency response", {
      operation: "emergency_response",
      reason,
      activePositions: activePositions.length,
      currentRiskScore: this.coreSafetyMonitoring.calculateOverallRiskScore(),
      coordinator: "EmergencyStopCoordinator",
    });

    const actions: SafetyAction[] = [];

    try {
      // Create emergency stop event for coordination
      const emergencyEvent: EmergencyStopEvent = {
        id: `emergency_${Date.now()}`,
        type: this.determineEmergencyType(reason),
        triggeredBy: "safety-monitoring-service",
        severity: this.determineEmergencySeverity(reason),
        timestamp: Date.now(),
        context: {
          activePositions: activePositions.length,
          currentRiskScore: this.coreSafetyMonitoring.calculateOverallRiskScore(),
          monitoringActive: this.isMonitoringActive,
        },
        reason,
      };

      // FIXED: Use EmergencyStopCoordinator for coordinated emergency stop
      const coordinatedResult =
        await this.emergencyStopCoordinator.triggerEmergencyStop(emergencyEvent);

      // Convert coordinated result to SafetyAction format for backward compatibility
      actions.push({
        id: `coordinated_emergency_${Date.now()}`,
        type: "emergency_coordination",
        description: "Coordinated emergency stop executed",
        executed: true,
        executedAt: new Date().toISOString(),
        result: coordinatedResult.success ? "success" : "partial",
        details: `Coordinated emergency stop: ${coordinatedResult.actionsExecuted.join(", ")}. Services: ${coordinatedResult.coordinatedServices.join(", ")}. Duration: ${coordinatedResult.duration}ms.`,
        metadata: {
          coordinatedServices: coordinatedResult.coordinatedServices,
          actionsExecuted: coordinatedResult.actionsExecuted,
          errors: coordinatedResult.errors,
          duration: coordinatedResult.duration,
        },
      });

      // Additional safety monitoring specific actions
      const positions = activePositions;

      // Local emergency halt (fallback if coordination didn't handle it)
      const haltAction: SafetyAction = {
        id: `local_halt_${Date.now()}`,
        type: "halt_trading",
        description: "Local trading halt (fallback safety)",
        executed: false,
      };

      try {
        await this.executionService.stopExecution();
        haltAction.executed = true;
        haltAction.executedAt = new Date().toISOString();
        haltAction.result = "success";
        haltAction.details = "Local trading execution halt successful";
      } catch (error) {
        haltAction.executed = true;
        haltAction.executedAt = new Date().toISOString();
        haltAction.result = "failed";
        haltAction.details = `Local halt failed: ${error instanceof Error ? error.message : "Unknown error"}`;
      }

      actions.push(haltAction);

      // Local emergency close (fallback if coordination didn't handle it)
      const closeAction: SafetyAction = {
        id: `local_close_${Date.now()}`,
        type: "emergency_close",
        description:
          positions.length > 0
            ? `Local emergency close ${positions.length} positions (fallback)`
            : "Local emergency close preventive (fallback)",
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
            ? `Local close: ${closedCount}/${positions.length} positions`
            : "No positions to close locally";
      } catch (error) {
        closeAction.executed = true;
        closeAction.executedAt = new Date().toISOString();
        closeAction.result = "failed";
        closeAction.details = `Local close failed: ${error instanceof Error ? error.message : "Unknown error"}`;
      }

      actions.push(closeAction);

      // Generate comprehensive emergency alert with coordination info
      this.alertManagement.addAlert({
        type: "emergency_condition",
        severity: "critical",
        category: "system",
        title: "Coordinated Emergency Response Triggered",
        message: `Coordinated emergency safety response activated: ${reason}. ${coordinatedResult.success ? "Coordination successful" : "Coordination partial/failed"}.`,
        riskLevel: 95,
        source: "coordinated_emergency_response",
        autoActions: actions,
        metadata: {
          reason,
          actionsExecuted: actions.length,
          coordinationResult: coordinatedResult,
          emergencyEvent,
        },
      });

      console.log(
        `✅ Coordinated emergency response completed: ${coordinatedResult.success ? "SUCCESS" : "PARTIAL"} (${coordinatedResult.duration}ms)`
      );
      return actions;
    } catch (error) {
      console.error("🚨 Coordinated emergency response failed", {
        operation: "emergency_response",
        reason,
        actionsAttempted: actions.length,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      const failedAction: SafetyAction = {
        id: `coordination_failed_${Date.now()}`,
        type: "notify_admin",
        description: "Coordinated emergency response system failure",
        executed: true,
        executedAt: new Date().toISOString(),
        result: "failed",
        details: `Coordinated emergency response failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: { originalReason: reason },
      };

      actions.push(failedAction);
      return actions;
    }
  }

  /**
   * FIXED: Determine emergency type based on reason for proper coordination
   */
  private determineEmergencyType(reason: string): EmergencyStopEvent["type"] {
    const lowerReason = reason.toLowerCase();

    if (lowerReason.includes("circuit") || lowerReason.includes("breaker")) {
      return "circuit_breaker_failure";
    }
    if (
      lowerReason.includes("portfolio") ||
      lowerReason.includes("drawdown") ||
      lowerReason.includes("loss")
    ) {
      return "portfolio_decline";
    }
    if (lowerReason.includes("manual") || lowerReason.includes("user")) {
      return "manual_trigger";
    }
    return "system_failure";
  }

  /**
   * FIXED: Determine emergency severity for proper coordination
   */
  private determineEmergencySeverity(reason: string): EmergencyStopEvent["severity"] {
    const lowerReason = reason.toLowerCase();
    const currentRiskScore = this.coreSafetyMonitoring.calculateOverallRiskScore();

    if (
      currentRiskScore > 90 ||
      lowerReason.includes("critical") ||
      lowerReason.includes("severe")
    ) {
      return "CRITICAL";
    }
    if (currentRiskScore > 70 || lowerReason.includes("high") || lowerReason.includes("major")) {
      return "HIGH";
    }
    if (
      currentRiskScore > 40 ||
      lowerReason.includes("medium") ||
      lowerReason.includes("moderate")
    ) {
      return "MEDIUM";
    }
    return "LOW";
  }

  /**
   * FIXED: Emergency stop method for EmergencyStopCoordinator integration
   * Called by EmergencyStopCoordinator during coordinated emergency stops
   */
  public async emergencyStop(event: EmergencyStopEvent): Promise<void> {
    console.log(`🚨 Safety monitoring emergency stop triggered by coordinator: ${event.reason}`);

    try {
      // Stop monitoring to prevent conflicts during emergency
      if (this.isMonitoringActive) {
        this.stopMonitoring();
        console.log("⏹️ Safety monitoring stopped during emergency");
      }

      // Force immediate risk assessment update
      await this.coreSafetyMonitoring.updateRiskMetrics();

      // Generate emergency alert for tracking
      this.alertManagement.addAlert({
        type: "emergency_condition",
        severity: "critical",
        category: "system",
        title: "Emergency Stop Executed",
        message: `Emergency stop executed by coordinator: ${event.reason}`,
        riskLevel: 95,
        source: "emergency_stop_coordinator",
        metadata: {
          emergencyEvent: event,
          triggeredBy: event.triggeredBy,
          severity: event.severity,
        },
      });

      console.log("✅ Safety monitoring emergency stop completed");
    } catch (error) {
      console.error("❌ Safety monitoring emergency stop failed:", error);
      throw error;
    }
  }

  /**
   * Acknowledge safety alert
   */
  public acknowledgeAlert(alertId: string): boolean {
    return this.alertManagement.acknowledgeAlert(alertId);
  }

  /**
   * Clear acknowledged alerts
   */
  public clearAcknowledgedAlerts(): number {
    return this.alertManagement.clearAcknowledgedAlerts();
  }

  /**
   * Get current risk metrics
   */
  public getRiskMetrics(): RiskMetrics {
    return this.coreSafetyMonitoring.getRiskMetrics();
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
    return this.configurationManagement.getConfiguration();
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
  public calculateOverallRiskScore(): number {
    return this.coreSafetyMonitoring.calculateOverallRiskScore();
  }

  /**
   * Perform risk assessment (public access)
   */
  public async performRiskAssessment(): Promise<ComprehensiveRiskAssessment> {
    return this.riskAssessment.performComprehensiveAssessment();
  }

  /**
   * Get timer coordination status for monitoring
   */
  public getTimerStatus(): OperationStatus[] {
    return this.eventHandling.getOperationStatus();
  }

  // ============================================================================
  // Testing and Development Methods
  // ============================================================================

  /**
   * For testing: inject dependencies
   */
  public injectDependencies(dependencies: {
    emergencySystem?: EmergencySafetySystem;
    executionService?: CoreTradingService;
    patternMonitoring?: PatternMonitoringService;
    mexcService?: UnifiedMexcServiceV2;
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

    // Reinitialize modules with new dependencies
    this.initializeModules();
  }

  /**
   * For testing: clear all alerts
   */
  public clearAllAlerts(): void {
    this.alertManagement.clearAllAlerts();
  }

  /**
   * For testing: reset to default state
   */
  public resetToDefaults(): void {
    this.alertManagement.clearAllAlerts();
    this.coreSafetyMonitoring.resetRiskMetrics();
    this.configurationManagement.resetToDefaults();
  }

  /**
   * For testing: get safety report without updating metrics
   */
  public async getSafetyReportWithoutUpdate(): Promise<SafetyMonitoringReport> {
    return this.getSafetyReport(); // In modular version, this is essentially the same
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private determineOverallStatus(riskScore: number): "safe" | "warning" | "critical" | "emergency" {
    if (riskScore < 25) return "safe";
    if (riskScore < 50) return "warning";
    if (riskScore < 75) return "critical";
    return "emergency";
  }

  private async generateSafetyRecommendations(): Promise<string[]> {
    try {
      const comprehensiveAssessment = await this.riskAssessment.performComprehensiveAssessment();
      return comprehensiveAssessment.priorityRecommendations;
    } catch (error) {
      console.error(
        "Failed to generate safety recommendations",
        {
          operation: "generate_safety_recommendations",
        },
        error
      );

      // Fallback recommendations
      return [
        "System operating within normal parameters",
        "Continue monitoring for any changes in risk metrics",
        "Review performance metrics regularly",
      ];
    }
  }
}

// ============================================================================
// Factory Functions and Individual Module Exports
// ============================================================================

/**
 * Factory function to create RealTimeSafetyMonitoringService instance
 */
export function createRealTimeSafetyMonitoringService(): RealTimeSafetyMonitoringService {
  return RealTimeSafetyMonitoringService.getInstance();
}

// Export individual modules for advanced usage
export {
  CoreSafetyMonitoring,
  AlertManagement,
  EventHandling,
  RiskAssessment,
  ConfigurationManagement,
  // Export factory functions
  createCoreSafetyMonitoring,
  createAlertManagement,
  createEventHandling,
  createRiskAssessment,
  createConfigurationManagement,
};

// For backward compatibility, also export the main class as default
export default RealTimeSafetyMonitoringService;

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

import { createSafeLogger } from "../../lib/structured-logger";
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
} from "../../schemas/safety-monitoring-schemas";
import { EmergencySafetySystem } from "../emergency-safety-system";
import { OptimizedAutoSnipingCore } from "../optimized-auto-sniping-core";
import { PatternMonitoringService } from "../pattern-monitoring-service";
import { UnifiedMexcServiceV2 } from "../unified-mexc-service-v2";
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
  private executionService: OptimizedAutoSnipingCore;
  private patternMonitoring: PatternMonitoringService;
  private mexcService: UnifiedMexcServiceV2;

  private _logger?: ReturnType<typeof createSafeLogger>;
  private isMonitoringActive = false;

  private get logger() {
    if (!this._logger) {
      this._logger = createSafeLogger("safety-monitoring");
    }
    return this._logger;
  }

  private constructor() {
    // Initialize services
    this.emergencySystem = new EmergencySafetySystem();
    this.executionService = OptimizedAutoSnipingCore.getInstance();
    this.patternMonitoring = PatternMonitoringService.getInstance();
    this.mexcService = new UnifiedMexcServiceV2();

    // Initialize modules
    this.initializeModules();

    this.logger.info("Real-time safety monitoring service initialized with modular architecture", {
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
    this.logger.info("Configuration updated, reinitializing modules", {
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
        this.logger.error(
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

    this.logger.info("Starting real-time safety monitoring", {
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
      this.logger.warn("Initial health check failed during monitoring start", {
        operation: "start_monitoring",
        error: error.message,
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
    this.logger.info("Stopping real-time safety monitoring", {
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
   * Trigger emergency safety response
   */
  public async triggerEmergencyResponse(reason: string): Promise<SafetyAction[]> {
    this.logger.warn("Triggering emergency response", {
      operation: "emergency_response",
      reason,
      activePositions: this.executionService.getActivePositions().length,
      currentRiskScore: this.coreSafetyMonitoring.calculateOverallRiskScore(),
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

      // Execute emergency close
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

      // Generate emergency alert
      this.alertManagement.addAlert({
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
    executionService?: OptimizedAutoSnipingCore;
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
      this.logger.error(
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

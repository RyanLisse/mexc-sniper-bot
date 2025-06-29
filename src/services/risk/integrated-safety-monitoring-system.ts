/**
 * Integrated Safety Monitoring System
 *
 * Comprehensive safety monitoring integration that orchestrates all safety modules
 * to provide unified, real-time safety oversight for the trading system.
 *
 * This system integrates:
 * - Core Safety Monitoring (real-time metrics and threshold checking)
 * - Alert Management (auto-actions and emergency responses)
 * - Risk Assessment (comprehensive analysis across all categories)
 * - Event Handling (timer coordination and operation management)
 * - Enhanced Real-time Safety Monitor (ML insights and anomaly detection)
 * - Advanced Emergency Coordinator (sophisticated emergency protocols)
 */

import EventEmitter from "node:events";
import type { SafetyConfiguration } from "@/src/schemas/safety-monitoring-schemas";
import { validateSafetyConfiguration } from "@/src/schemas/safety-monitoring-schemas";
import { AdvancedEmergencyCoordinator } from "./advanced-emergency-coordinator";
import { EnhancedRealTimeSafetyMonitor } from "./enhanced-real-time-safety-monitor";
import {
  type AlertGenerationData,
  type AlertManagement,
  type AlertManagementConfig,
  createAlertManagement,
} from "./real-time-safety-monitoring-modules/alert-management";
// Import all safety modules
import {
  type CoreSafetyMonitoring,
  type CoreSafetyMonitoringConfig,
  createCoreSafetyMonitoring,
  type RiskAssessmentUpdate,
} from "./real-time-safety-monitoring-modules/core-safety-monitoring";
import {
  createEventHandling,
  type EventHandling,
  type EventHandlingConfig,
  type OperationRegistration,
} from "./real-time-safety-monitoring-modules/event-handling";
import {
  type ComprehensiveRiskAssessment,
  createRiskAssessment,
  type RiskAssessment,
  type RiskAssessmentConfig,
} from "./real-time-safety-monitoring-modules/risk-assessment";

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface IntegratedSafetyConfig {
  // Core configuration
  configuration: SafetyConfiguration;

  // Service dependencies
  executionService: any;
  patternMonitoring: any;
  emergencySystem: any;
  mexcService: any;

  // Module-specific configs
  coreMonitoringConfig?: Partial<CoreSafetyMonitoringConfig>;
  alertManagementConfig?: Partial<AlertManagementConfig>;
  riskAssessmentConfig?: Partial<RiskAssessmentConfig>;
  eventHandlingConfig?: Partial<EventHandlingConfig>;

  // Integration settings
  enableEnhancedMonitoring?: boolean;
  enableAdvancedEmergency?: boolean;
  coordinated?: boolean;
  enableCrossModuleValidation?: boolean;
}

export interface SafetySystemStatus {
  overall: {
    status: "healthy" | "warning" | "critical" | "emergency";
    riskScore: number;
    lastUpdate: string;
    activeAlerts: number;
  };
  modules: {
    coreMonitoring: { active: boolean; lastCycle: string };
    alertManagement: { active: boolean; alertsCount: number; actionsExecuted: number };
    riskAssessment: { active: boolean; lastAssessment: string };
    eventHandling: { active: boolean; operationsCount: number };
    enhancedMonitoring: { active: boolean; anomaliesDetected: number };
    emergencyCoordinator: { active: boolean; protocolsActive: number };
  };
  performance: {
    cycleTime: number;
    throughput: number;
    errorRate: number;
    uptime: number;
  };
}

export interface SafetySystemMetrics {
  realTimeMetrics: {
    riskScore: number;
    alertsGenerated: number;
    emergencyActions: number;
    systemHealth: number;
  };
  performanceMetrics: {
    averageCycleTime: number;
    operationsPerSecond: number;
    errorCount: number;
    successRate: number;
  };
  thresholdMetrics: {
    violationsCount: number;
    criticalThresholds: number;
    warningThresholds: number;
    complianceRate: number;
  };
}

// ============================================================================
// Integrated Safety Monitoring System
// ============================================================================

export class IntegratedSafetyMonitoringSystem extends EventEmitter {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[integrated-safety-system]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[integrated-safety-system]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[integrated-safety-system]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[integrated-safety-system]", message, context || ""),
  };

  // Core safety modules
  private coreMonitoring!: CoreSafetyMonitoring;
  private alertManagement!: AlertManagement;
  private riskAssessment!: RiskAssessment;
  private eventHandling!: EventHandling;

  // Enhanced safety modules
  private enhancedMonitoring?: EnhancedRealTimeSafetyMonitor;
  private emergencyCoordinator?: AdvancedEmergencyCoordinator;

  // System state
  private isActive = false;
  private config: IntegratedSafetyConfig;
  private startTime = 0;
  private lastHealthCheck = 0;

  // Metrics tracking
  private metrics: SafetySystemMetrics = {
    realTimeMetrics: {
      riskScore: 0,
      alertsGenerated: 0,
      emergencyActions: 0,
      systemHealth: 100,
    },
    performanceMetrics: {
      averageCycleTime: 0,
      operationsPerSecond: 0,
      errorCount: 0,
      successRate: 100,
    },
    thresholdMetrics: {
      violationsCount: 0,
      criticalThresholds: 0,
      warningThresholds: 0,
      complianceRate: 100,
    },
  };

  constructor(config: IntegratedSafetyConfig) {
    super();

    // Validate configuration
    validateSafetyConfiguration(config.configuration);
    this.config = config;

    // Initialize core safety modules
    this.initializeCoreModules();

    // Initialize enhanced modules if enabled
    if (config.enableEnhancedMonitoring) {
      this.initializeEnhancedModules();
    }

    // Set up cross-module event coordination
    this.setupCrossModuleCoordination();

    this.logger.info("Integrated safety monitoring system initialized", {
      coreModulesCount: 4,
      enhancedModulesEnabled: !!config.enableEnhancedMonitoring,
      coordinatedMode: !!config.coordinated,
    });
  }

  // ============================================================================
  // System Lifecycle Management
  // ============================================================================

  /**
   * Start the integrated safety monitoring system
   */
  async start(): Promise<void> {
    if (this.isActive) {
      this.logger.warn("Safety monitoring system already active");
      return;
    }

    this.logger.info("Starting integrated safety monitoring system");
    this.isActive = true;
    this.startTime = Date.now();

    try {
      // Start core modules
      this.coreMonitoring.start();
      this.eventHandling.start();

      // Start enhanced modules if available
      if (this.enhancedMonitoring) {
        await this.enhancedMonitoring.startMonitoring();
      }

      if (this.emergencyCoordinator) {
        await this.emergencyCoordinator.initialize();
      }

      // Register monitoring operations
      this.registerMonitoringOperations();

      // Perform initial health check
      await this.performSystemHealthCheck();

      this.logger.info("Integrated safety monitoring system started successfully");
      this.emit("system-started", { timestamp: new Date().toISOString() });
    } catch (error) {
      this.isActive = false;
      this.logger.error("Failed to start safety monitoring system", {}, error as Error);
      throw error;
    }
  }

  /**
   * Stop the integrated safety monitoring system
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    this.logger.info("Stopping integrated safety monitoring system");
    this.isActive = false;

    try {
      // Stop enhanced modules first
      if (this.enhancedMonitoring) {
        await this.enhancedMonitoring.stopMonitoring();
      }

      if (this.emergencyCoordinator) {
        await this.emergencyCoordinator.stopEmergencySystem();
      }

      // Stop core modules
      this.eventHandling.stop();
      this.coreMonitoring.stop();

      this.logger.info("Integrated safety monitoring system stopped");
      this.emit("system-stopped", {
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime,
      });
    } catch (error) {
      this.logger.error("Error stopping safety monitoring system", {}, error as Error);
      throw error;
    }
  }

  // ============================================================================
  // Core Monitoring Operations
  // ============================================================================

  /**
   * Perform comprehensive safety monitoring cycle
   */
  async performMonitoringCycle(): Promise<{
    riskAssessment: ComprehensiveRiskAssessment;
    alertsGenerated: number;
    emergencyActions: number;
    systemHealth: number;
  }> {
    const cycleStart = Date.now();

    try {
      // Perform core monitoring cycle
      const coreUpdate = await this.coreMonitoring.performMonitoringCycle();

      // Perform comprehensive risk assessment
      const riskAssessment = await this.riskAssessment.performComprehensiveAssessment();

      // Enhanced monitoring if available
      let enhancedResults: any = null;
      if (this.enhancedMonitoring && this.isActive) {
        enhancedResults = await this.enhancedMonitoring.performComprehensiveMonitoring();
      }

      // Process threshold violations and generate alerts
      const alertsGenerated = await this.processThresholdViolations(coreUpdate, riskAssessment);

      // Check for emergency conditions
      const emergencyActions = await this.checkEmergencyConditions(riskAssessment);

      // Calculate system health
      const systemHealth = this.calculateSystemHealth(riskAssessment, enhancedResults);

      // Update metrics
      this.updateMetrics({
        riskScore: riskAssessment.overallRiskScore,
        alertsGenerated,
        emergencyActions,
        systemHealth,
        cycleTime: Date.now() - cycleStart,
      });

      this.emit("monitoring-cycle-complete", {
        riskAssessment,
        alertsGenerated,
        emergencyActions,
        systemHealth,
        timestamp: new Date().toISOString(),
      });

      return {
        riskAssessment,
        alertsGenerated,
        emergencyActions,
        systemHealth,
      };
    } catch (error) {
      this.metrics.performanceMetrics.errorCount++;
      this.logger.error("Monitoring cycle failed", {}, error as Error);
      throw error;
    }
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus(): SafetySystemStatus {
    const now = new Date().toISOString();
    const alertStats = this.alertManagement.getInternalStats();
    const eventStats = this.eventHandling.getStats();

    return {
      overall: {
        status: this.determineOverallStatus(),
        riskScore: this.metrics.realTimeMetrics.riskScore,
        lastUpdate: now,
        activeAlerts: this.alertManagement.getActiveAlerts().length,
      },
      modules: {
        coreMonitoring: {
          active: this.coreMonitoring.getStatus().isActive,
          lastCycle: now,
        },
        alertManagement: {
          active: true,
          alertsCount: alertStats.alertsGenerated,
          actionsExecuted: alertStats.actionsExecuted,
        },
        riskAssessment: {
          active: true,
          lastAssessment: now,
        },
        eventHandling: {
          active: eventStats.isActive,
          operationsCount: eventStats.totalOperations,
        },
        enhancedMonitoring: {
          active: !!this.enhancedMonitoring,
          anomaliesDetected: this.enhancedMonitoring?.getAnomalyCount?.() || 0,
        },
        emergencyCoordinator: {
          active: !!this.emergencyCoordinator,
          protocolsActive: this.emergencyCoordinator?.getActiveProtocolsCount?.() || 0,
        },
      },
      performance: {
        cycleTime: this.metrics.performanceMetrics.averageCycleTime,
        throughput: this.metrics.performanceMetrics.operationsPerSecond,
        errorRate: this.calculateErrorRate(),
        uptime: this.isActive ? Date.now() - this.startTime : 0,
      },
    };
  }

  /**
   * Get current safety metrics
   */
  getMetrics(): SafetySystemMetrics {
    return { ...this.metrics };
  }

  /**
   * Perform emergency stop across all systems
   */
  async performEmergencyStop(reason: string): Promise<{
    success: boolean;
    actionsExecuted: string[];
    errors: string[];
  }> {
    this.logger.warn("Emergency stop initiated", { reason });

    const actionsExecuted: string[] = [];
    const errors: string[] = [];

    try {
      // Core monitoring emergency stop
      if (this.coreMonitoring) {
        actionsExecuted.push("Core monitoring halted");
      }

      // Enhanced monitoring emergency stop
      if (this.enhancedMonitoring) {
        const result = await this.enhancedMonitoring.executeEnhancedEmergencyStop(
          reason,
          "critical"
        );
        if (result) {
          actionsExecuted.push("Enhanced monitoring emergency stop executed");
        } else {
          errors.push("Enhanced monitoring emergency stop failed");
        }
      }

      // Emergency coordinator activation
      if (this.emergencyCoordinator) {
        try {
          const protocolId = await this.emergencyCoordinator.activateEmergencyProtocol(
            "system_emergency_stop",
            "integrated_safety_system",
            reason
          );
          actionsExecuted.push(`Emergency protocol activated: ${protocolId}`);
        } catch (error) {
          errors.push(`Emergency protocol activation failed: ${(error as Error).message}`);
        }
      }

      // Generate critical alert
      const alertData: AlertGenerationData = {
        type: "system_failure",
        severity: "critical",
        category: "system",
        title: "Emergency Stop Executed",
        message: `Emergency stop initiated: ${reason}`,
        riskLevel: 100,
        source: "integrated_safety_system",
        autoActions: [
          {
            type: "halt_trading",
            description: "Emergency trading halt",
          },
          {
            type: "notify_admin",
            description: "Critical system alert notification",
          },
        ],
      };

      this.alertManagement.addAlert(alertData);
      actionsExecuted.push("Critical alert generated");

      const success = errors.length === 0;

      this.emit("emergency-stop-executed", {
        reason,
        success,
        actionsExecuted,
        errors,
        timestamp: new Date().toISOString(),
      });

      return { success, actionsExecuted, errors };
    } catch (error) {
      const errorMessage = (error as Error).message;
      errors.push(errorMessage);
      this.logger.error("Emergency stop execution failed", { reason }, error as Error);

      return {
        success: false,
        actionsExecuted,
        errors,
      };
    }
  }

  // ============================================================================
  // Private Implementation Methods
  // ============================================================================

  private initializeCoreModules(): void {
    // Initialize core safety monitoring
    const coreConfig: CoreSafetyMonitoringConfig = {
      configuration: this.config.configuration,
      executionService: this.config.executionService,
      patternMonitoring: this.config.patternMonitoring,
      onAlert: (alert) => this.handleCoreAlert(alert),
      ...this.config.coreMonitoringConfig,
    };
    this.coreMonitoring = createCoreSafetyMonitoring(coreConfig);

    // Initialize alert management
    const alertConfig: AlertManagementConfig = {
      configuration: this.config.configuration,
      executionService: this.config.executionService,
      onStatsUpdate: (stats) => this.handleAlertStatsUpdate(stats),
      ...this.config.alertManagementConfig,
    };
    this.alertManagement = createAlertManagement(alertConfig);

    // Initialize risk assessment
    const riskConfig: RiskAssessmentConfig = {
      configuration: this.config.configuration,
      executionService: this.config.executionService,
      patternMonitoring: this.config.patternMonitoring,
      emergencySystem: this.config.emergencySystem,
      mexcService: this.config.mexcService,
      ...this.config.riskAssessmentConfig,
    };
    this.riskAssessment = createRiskAssessment(riskConfig);

    // Initialize event handling
    const eventConfig: EventHandlingConfig = {
      baseTickMs: this.config.configuration.monitoringIntervalMs,
      maxConcurrentOperations: 5,
      operationTimeoutMs: 30000,
      ...this.config.eventHandlingConfig,
    };
    this.eventHandling = createEventHandling(eventConfig);
  }

  private initializeEnhancedModules(): void {
    try {
      // Initialize enhanced real-time safety monitor
      this.enhancedMonitoring = new EnhancedRealTimeSafetyMonitor({
        monitoringIntervalMs: this.config.configuration.monitoringIntervalMs,
        criticalRiskThreshold: 80,
        emergencyRiskThreshold: 95,
      }, {
        alertManagement: this.alertManagement,
        coreMonitoring: this.coreMonitoring,
        riskAssessment: this.riskAssessment,
        eventHandling: this.eventHandling,
        emergencySystem: this.config.emergencySystem,
        safetyCoordinator: this.config.emergencySystem, // Using emergency system as coordinator
      });

      // Initialize advanced emergency coordinator
      this.emergencyCoordinator = new AdvancedEmergencyCoordinator({
        maxConcurrentEmergencies: 3,
        autoEscalationEnabled: true,
        autoRecoveryEnabled: true,
      }, this.config.emergencySystem, this.config.emergencySystem);

      this.logger.info("Enhanced safety modules initialized");
    } catch (error) {
      this.logger.error("Failed to initialize enhanced modules", {}, error as Error);
    }
  }

  private setupCrossModuleCoordination(): void {
    // Core monitoring alerts trigger alert management
    try {
      if (this.coreMonitoring && 'on' in this.coreMonitoring && typeof this.coreMonitoring.on === 'function') {
        this.coreMonitoring.on("threshold-violation", (violation: any) => {
          this.handleThresholdViolation(violation);
        });
      }
    } catch (error) {
      this.logger.debug("Core monitoring does not support events");
    }

    // Alert management events trigger risk reassessment
    try {
      if (this.alertManagement && 'on' in this.alertManagement && typeof this.alertManagement.on === 'function') {
        this.alertManagement.on("critical-alert", () => {
          this.triggerRiskReassessment();
        });
      }
    } catch (error) {
      this.logger.debug("Alert management does not support events");
    }

    // Risk assessment events trigger emergency checks
    try {
      if (this.riskAssessment && 'on' in this.riskAssessment && typeof this.riskAssessment.on === 'function') {
        this.riskAssessment.on("high-risk-detected", (assessment: any) => {
          this.handleHighRiskDetection(assessment);
        });
      }
    } catch (error) {
      this.logger.debug("Risk assessment does not support events");
    }
  }

  private registerMonitoringOperations(): void {
    // Register core monitoring cycle
    const monitoringOperation: OperationRegistration = {
      id: "core-monitoring-cycle",
      name: "Core Safety Monitoring",
      intervalMs: this.config.configuration.monitoringIntervalMs,
      handler: async () => {
        await this.performMonitoringCycle();
      },
    };
    this.eventHandling.registerOperation(monitoringOperation);

    // Register health check operation
    const healthCheckOperation: OperationRegistration = {
      id: "system-health-check",
      name: "System Health Check",
      intervalMs: 120000, // 2 minutes
      handler: async () => {
        await this.performSystemHealthCheck();
      },
    };
    this.eventHandling.registerOperation(healthCheckOperation);
  }

  private async processThresholdViolations(
    coreUpdate: RiskAssessmentUpdate,
    riskAssessment: ComprehensiveRiskAssessment
  ): Promise<number> {
    let alertsGenerated = 0;

    // Process core threshold violations
    for (const violation of coreUpdate.thresholdViolations) {
      const alertData: AlertGenerationData = {
        type: "risk_threshold",
        severity: violation.severity,
        category: "portfolio",
        title: `Threshold Violation: ${violation.threshold}`,
        message: `Current: ${violation.current}, Limit: ${violation.limit}`,
        riskLevel: (violation.current / violation.limit) * 100,
        source: "core_monitoring",
      };

      this.alertManagement.addAlert(alertData);
      alertsGenerated++;
    }

    // Process risk assessment findings
    if (riskAssessment.overallRiskScore > 75) {
      const alertData: AlertGenerationData = {
        type: "risk_threshold",
        severity: "high",
        category: "system",
        title: "High Risk Score Detected",
        message: `Overall risk score: ${riskAssessment.overallRiskScore}`,
        riskLevel: riskAssessment.overallRiskScore,
        source: "risk_assessment",
        autoActions: [
          {
            type: "reduce_positions",
            description: "Reduce positions due to high risk",
          },
        ],
      };

      this.alertManagement.addAlert(alertData);
      alertsGenerated++;
    }

    return alertsGenerated;
  }

  private async checkEmergencyConditions(
    riskAssessment: ComprehensiveRiskAssessment
  ): Promise<number> {
    let emergencyActions = 0;

    // Check for emergency risk levels
    if (riskAssessment.riskStatus === "emergency") {
      if (this.emergencyCoordinator) {
        try {
          await this.emergencyCoordinator.activateEmergencyProtocol(
            "high_risk_emergency",
            "integrated_safety_system",
            `Emergency risk level detected: ${riskAssessment.overallRiskScore}`
          );
          emergencyActions++;
        } catch (error) {
          this.logger.error("Failed to activate emergency protocol", {}, error as Error);
        }
      }
    }

    return emergencyActions;
  }

  private calculateSystemHealth(
    riskAssessment: ComprehensiveRiskAssessment,
    enhancedResults?: any
  ): number {
    let health = 100;

    // Deduct based on risk status
    switch (riskAssessment.riskStatus) {
      case "warning":
        health -= 20;
        break;
      case "critical":
        health -= 50;
        break;
      case "emergency":
        health -= 80;
        break;
    }

    // Factor in system performance
    if (riskAssessment.system.connectivityStatus === "degraded") {
      health -= 15;
    } else if (riskAssessment.system.connectivityStatus === "poor") {
      health -= 30;
    }

    // Factor in enhanced monitoring results
    if (enhancedResults?.anomaliesDetected > 0) {
      health -= Math.min(20, enhancedResults.anomaliesDetected * 5);
    }

    return Math.max(0, health);
  }

  private updateMetrics(data: {
    riskScore: number;
    alertsGenerated: number;
    emergencyActions: number;
    systemHealth: number;
    cycleTime: number;
  }): void {
    // Update real-time metrics
    this.metrics.realTimeMetrics.riskScore = data.riskScore;
    this.metrics.realTimeMetrics.alertsGenerated += data.alertsGenerated;
    this.metrics.realTimeMetrics.emergencyActions += data.emergencyActions;
    this.metrics.realTimeMetrics.systemHealth = data.systemHealth;

    // Update performance metrics
    this.metrics.performanceMetrics.averageCycleTime =
      (this.metrics.performanceMetrics.averageCycleTime + data.cycleTime) / 2;
    this.metrics.performanceMetrics.operationsPerSecond =
      1000 / this.metrics.performanceMetrics.averageCycleTime;
  }

  private determineOverallStatus(): "healthy" | "warning" | "critical" | "emergency" {
    const riskScore = this.metrics.realTimeMetrics.riskScore;
    const systemHealth = this.metrics.realTimeMetrics.systemHealth;

    if (riskScore > 90 || systemHealth < 20) return "emergency";
    if (riskScore > 75 || systemHealth < 40) return "critical";
    if (riskScore > 50 || systemHealth < 70) return "warning";
    return "healthy";
  }

  private calculateErrorRate(): number {
    const totalOperations = this.metrics.performanceMetrics.operationsPerSecond * 60; // per minute
    const errorCount = this.metrics.performanceMetrics.errorCount;
    return totalOperations > 0 ? (errorCount / totalOperations) * 100 : 0;
  }

  private async performSystemHealthCheck(): Promise<void> {
    try {
      const status = this.getSystemStatus();
      this.lastHealthCheck = Date.now();

      this.emit("health-check-complete", {
        status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error("System health check failed", {}, error as Error);
    }
  }

  // Event handlers
  private handleCoreAlert(alert: any): void {
    this.alertManagement.addAlert(alert);
  }

  private handleAlertStatsUpdate(stats: {
    alertsGenerated: number;
    actionsExecuted: number;
  }): void {
    this.metrics.realTimeMetrics.alertsGenerated = stats.alertsGenerated;
  }

  private handleThresholdViolation(violation: any): void {
    this.logger.warn("Threshold violation detected", { violation });
  }

  private triggerRiskReassessment(): void {
    // Trigger immediate risk reassessment
    this.eventHandling.forceExecution("core-monitoring-cycle").catch((error) => {
      this.logger.error("Failed to trigger risk reassessment", {}, error as Error);
    });
  }

  private handleHighRiskDetection(assessment: any): void {
    this.logger.warn("High risk detected", { assessment });
  }
}

/**
 * Factory function to create integrated safety monitoring system
 */
export function createIntegratedSafetyMonitoringSystem(
  config: IntegratedSafetyConfig
): IntegratedSafetyMonitoringSystem {
  return new IntegratedSafetyMonitoringSystem(config);
}

/**
 * Default configuration for integrated safety monitoring
 */
export const DEFAULT_INTEGRATED_SAFETY_CONFIG: Partial<IntegratedSafetyConfig> = {
  enableEnhancedMonitoring: true,
  enableAdvancedEmergency: true,
  coordinated: true,
  enableCrossModuleValidation: true,
  eventHandlingConfig: {
    baseTickMs: 5000,
    maxConcurrentOperations: 5,
    operationTimeoutMs: 30000,
  },
};

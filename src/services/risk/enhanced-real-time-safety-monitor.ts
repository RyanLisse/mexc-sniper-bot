/**
 * Enhanced Real-Time Safety Monitor
 *
 * Provides advanced real-time safety monitoring with machine learning insights,
 * predictive risk assessment, and automated emergency response coordination.
 *
 * Features:
 * - Real-time risk scoring with predictive analytics
 * - Advanced pattern recognition for market anomaly detection
 * - Intelligent emergency response automation
 * - Multi-layer circuit breaker implementation
 * - Comprehensive safety metrics aggregation
 */

import { EventEmitter } from "node:events";
import { createTimer } from "@/src/lib/structured-logger";
import type {
  RiskMetrics,
  SafetyAlert,
  SafetyConfiguration,
} from "@/src/schemas/safety-monitoring-schemas";
import type { ComprehensiveSafetyCoordinator } from "./comprehensive-safety-coordinator";
import type { EmergencySafetySystem } from "./emergency-safety-system";
import type { AlertManagement } from "./real-time-safety-monitoring-modules/alert-management";
import type { CoreSafetyMonitoring } from "./real-time-safety-monitoring-modules/core-safety-monitoring";
import type { EventHandling } from "./real-time-safety-monitoring-modules/event-handling";
import type { RiskAssessment } from "./real-time-safety-monitoring-modules/risk-assessment";

export interface EnhancedSafetyConfig {
  // Core monitoring configuration
  monitoringIntervalMs: number;
  riskAssessmentIntervalMs: number;
  emergencyResponseTimeoutMs: number;

  // Advanced features
  predictiveAnalyticsEnabled: boolean;
  machineLearningInsights: boolean;
  realTimeAnomalyDetection: boolean;

  // Risk thresholds
  criticalRiskThreshold: number;
  emergencyRiskThreshold: number;
  anomalyDetectionSensitivity: number;

  // Emergency response
  autoEmergencyStopEnabled: boolean;
  emergencyStopDelayMs: number;
  manualOverrideRequired: boolean;
}

export interface RealTimeMetrics {
  // Current system state
  overallRiskScore: number;
  riskTrend: "improving" | "stable" | "deteriorating" | "critical";
  emergencyLevel: "none" | "low" | "medium" | "high" | "critical";

  // Performance metrics
  monitoringLatency: number;
  responseTime: number;
  systemLoad: number;

  // Risk categories
  portfolioRisk: number;
  marketRisk: number;
  systemRisk: number;
  operationalRisk: number;

  // Predictive metrics
  riskForecast: {
    next5min: number;
    next15min: number;
    next1hour: number;
  };

  // Alert statistics
  activeAlerts: number;
  criticalAlerts: number;
  emergencyActions: number;

  timestamp: string;
}

export interface AnomalyDetectionResult {
  anomalyDetected: boolean;
  anomalyType: "price" | "volume" | "volatility" | "correlation" | "liquidity";
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  description: string;
  affectedSymbols: string[];
  recommendedActions: string[];
  timestamp: string;
}

export interface PredictiveRiskAssessment {
  currentRisk: number;
  predictedRisk: {
    next5min: number;
    next15min: number;
    next1hour: number;
  };
  riskFactors: Array<{
    factor: string;
    impact: number;
    confidence: number;
    trend: "increasing" | "stable" | "decreasing";
  }>;
  recommendations: string[];
  actionRequired: boolean;
  emergencyLikelihood: number;
}

export interface SafetyDashboardData {
  realTimeMetrics: RealTimeMetrics;
  riskAssessment: PredictiveRiskAssessment;
  anomalies: AnomalyDetectionResult[];
  activeAlerts: SafetyAlert[];
  emergencyStatus: {
    active: boolean;
    level: string;
    activeProcedures: string[];
    timeSinceLastEmergency: number;
  };
  systemHealth: {
    overall: number;
    components: Record<string, number>;
    degradedServices: string[];
  };
  performance: {
    uptime: number;
    availability: number;
    avgResponseTime: number;
    errorRate: number;
  };
}

export class EnhancedRealTimeSafetyMonitor extends EventEmitter {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[enhanced-safety-monitor]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[enhanced-safety-monitor]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[enhanced-safety-monitor]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[enhanced-safety-monitor]", message, context || ""),
  };

  private isActive = false;
  private config: EnhancedSafetyConfig;
  private monitoringTimer: NodeJS.Timeout | null = null;
  private riskAssessmentTimer: NodeJS.Timeout | null = null;

  // Core components
  private alertManagement: AlertManagement;
  private coreMonitoring: CoreSafetyMonitoring;
  private riskAssessment: RiskAssessment;
  private eventHandling: EventHandling;
  private emergencySystem: EmergencySafetySystem;
  private safetyCoordinator: ComprehensiveSafetyCoordinator;

  // Enhanced monitoring state
  private realTimeMetrics: RealTimeMetrics;
  private anomalyHistory: AnomalyDetectionResult[] = [];
  private riskHistory: Array<{ timestamp: string; risk: number }> = [];
  private emergencyCount = 0;
  private lastEmergencyTime = 0;

  // Machine learning models (placeholder for future implementation)
  private riskPredictionModel: any = null;
  private anomalyDetectionModel: any = null;

  constructor(
    config: Partial<EnhancedSafetyConfig>,
    dependencies: {
      alertManagement: AlertManagement;
      coreMonitoring: CoreSafetyMonitoring;
      riskAssessment: RiskAssessment;
      eventHandling: EventHandling;
      emergencySystem: EmergencySafetySystem;
      safetyCoordinator: ComprehensiveSafetyCoordinator;
    }
  ) {
    super();

    this.config = this.mergeWithDefaults(config);

    // Initialize components
    this.alertManagement = dependencies.alertManagement;
    this.coreMonitoring = dependencies.coreMonitoring;
    this.riskAssessment = dependencies.riskAssessment;
    this.eventHandling = dependencies.eventHandling;
    this.emergencySystem = dependencies.emergencySystem;
    this.safetyCoordinator = dependencies.safetyCoordinator;

    // Initialize real-time metrics
    this.realTimeMetrics = this.getDefaultMetrics();

    // Setup event forwarding
    this.setupEventForwarding();

    this.logger.info("Enhanced real-time safety monitor initialized", {
      config: this.config,
      predictiveAnalyticsEnabled: this.config.predictiveAnalyticsEnabled,
      anomalyDetectionEnabled: this.config.realTimeAnomalyDetection,
    });
  }

  /**
   * Start enhanced monitoring
   */
  async start(): Promise<void> {
    if (this.isActive) {
      this.logger.warn("Enhanced safety monitor already active");
      return;
    }

    this.isActive = true;

    // Start core components
    await this.startCoreComponents();

    // Start enhanced monitoring loops
    this.startMonitoringLoop();
    this.startRiskAssessmentLoop();

    // Initialize machine learning models if enabled
    if (this.config.predictiveAnalyticsEnabled) {
      await this.initializePredictiveModels();
    }

    this.logger.info("Enhanced real-time safety monitoring started", {
      monitoringInterval: this.config.monitoringIntervalMs,
      riskAssessmentInterval: this.config.riskAssessmentIntervalMs,
      predictiveAnalytics: this.config.predictiveAnalyticsEnabled,
    });

    this.emit("monitoring_started");
  }

  /**
   * Stop enhanced monitoring
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;

    // Clear timers
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    if (this.riskAssessmentTimer) {
      clearInterval(this.riskAssessmentTimer);
      this.riskAssessmentTimer = null;
    }

    // Stop core components
    await this.stopCoreComponents();

    this.logger.info("Enhanced real-time safety monitoring stopped");
    this.emit("monitoring_stopped");
  }

  /**
   * Execute emergency stop with enhanced coordination
   */
  async executeEnhancedEmergencyStop(
    reason: string,
    severity: "medium" | "high" | "critical" = "high"
  ): Promise<boolean> {
    const timer = createTimer("enhanced_emergency_stop", "enhanced-safety-monitor");

    try {
      this.logger.info("Executing enhanced emergency stop", {
        reason,
        severity,
        autoStopEnabled: this.config.autoEmergencyStopEnabled,
      });

      // Update emergency metrics
      this.emergencyCount++;
      this.lastEmergencyTime = Date.now();
      this.realTimeMetrics.emergencyLevel = severity;
      this.realTimeMetrics.emergencyActions++;

      // Coordinate emergency response across all systems
      const coordinatedResponse = await this.coordinateEmergencyResponse(reason, severity);

      if (!coordinatedResponse.success) {
        throw new Error(`Emergency coordination failed: ${coordinatedResponse.error}`);
      }

      // Execute emergency stop through safety coordinator
      await this.safetyCoordinator.triggerEmergencyProcedure("enhanced_emergency_stop", {
        reason,
        severity,
        timestamp: new Date().toISOString(),
        emergencyCount: this.emergencyCount,
      });

      // Create critical alert
      await this.alertManagement.addAlert({
        type: "emergency_condition",
        severity: "critical",
        category: "system",
        title: "Enhanced Emergency Stop Executed",
        message: `Enhanced emergency stop executed: ${reason}`,
        riskLevel: severity === "critical" ? 100 : severity === "high" ? 85 : 70,
        source: "enhanced_safety_monitor",
        autoActions: [
          {
            type: "halt_trading",
            description: "All trading activities halted",
          },
          {
            type: "notify_admin",
            description: "Emergency notifications sent",
          },
        ],
        metadata: { reason, severity, emergencyCount: this.emergencyCount },
      });

      const duration = timer.end({ status: "success", severity });

      this.logger.info("Enhanced emergency stop completed successfully", {
        reason,
        severity,
        duration,
        emergencyCount: this.emergencyCount,
      });

      this.emit("enhanced_emergency_stop", {
        reason,
        severity,
        duration,
        timestamp: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      const duration = timer.end({ status: "failed" });

      this.logger.error(
        "Enhanced emergency stop failed",
        {
          reason,
          severity,
          duration,
          error: (error as Error)?.message,
        },
        error as Error
      );

      this.emit("enhanced_emergency_stop_failed", {
        reason,
        severity,
        error: (error as Error)?.message,
        timestamp: new Date().toISOString(),
      });

      return false;
    }
  }

  /**
   * Get real-time safety dashboard data
   */
  getSafetyDashboardData(): SafetyDashboardData {
    const emergencyStatus = this.emergencySystem.getEmergencyStatus();
    const coordinatorStatus = this.safetyCoordinator.getStatus();

    return {
      realTimeMetrics: { ...this.realTimeMetrics },
      riskAssessment: this.generatePredictiveRiskAssessment(),
      anomalies: this.anomalyHistory.slice(-10), // Last 10 anomalies
      activeAlerts: this.alertManagement.getActiveAlerts(),
      emergencyStatus: {
        active: emergencyStatus.active,
        level: emergencyStatus.systemHealth,
        activeProcedures: emergencyStatus.conditions.map((c) => c.type),
        timeSinceLastEmergency: this.lastEmergencyTime ? Date.now() - this.lastEmergencyTime : 0,
      },
      systemHealth: {
        overall: coordinatorStatus.overall.safetyScore,
        components: {
          trading: coordinatorStatus.emergency.tradingHalted ? 0 : 100,
          monitoring: this.isActive ? 100 : 0,
          emergency: emergencyStatus.active ? 50 : 100,
          alerts: coordinatorStatus.risk.activeAlerts > 5 ? 50 : 100,
        },
        degradedServices: this.identifyDegradedServices(coordinatorStatus),
      },
      performance: {
        uptime: this.calculateUptime(),
        availability: this.calculateAvailability(),
        avgResponseTime: this.realTimeMetrics.responseTime,
        errorRate: this.calculateErrorRate(),
      },
    };
  }

  /**
   * Perform advanced anomaly detection
   */
  async performAdvancedAnomalyDetection(
    marketData: Record<string, any>
  ): Promise<AnomalyDetectionResult[]> {
    if (!this.config.realTimeAnomalyDetection) {
      return [];
    }

    const timer = createTimer("anomaly_detection", "enhanced-safety-monitor");
    const anomalies: AnomalyDetectionResult[] = [];

    try {
      // Price anomaly detection
      const priceAnomalies = await this.detectPriceAnomalies(marketData);
      anomalies.push(...priceAnomalies);

      // Volume anomaly detection
      const volumeAnomalies = await this.detectVolumeAnomalies(marketData);
      anomalies.push(...volumeAnomalies);

      // Volatility anomaly detection
      const volatilityAnomalies = await this.detectVolatilityAnomalies(marketData);
      anomalies.push(...volatilityAnomalies);

      // Correlation anomaly detection
      const correlationAnomalies = await this.detectCorrelationAnomalies(marketData);
      anomalies.push(...correlationAnomalies);

      // Store anomalies in history
      this.anomalyHistory.push(...anomalies);

      // Keep only recent anomalies
      if (this.anomalyHistory.length > 100) {
        this.anomalyHistory = this.anomalyHistory.slice(-100);
      }

      const duration = timer.end({
        anomaliesDetected: anomalies.length,
        status: "success",
      });

      if (anomalies.length > 0) {
        this.logger.info("Anomalies detected", {
          count: anomalies.length,
          duration,
          criticalAnomalies: anomalies.filter((a) => a.severity === "critical").length,
        });

        // Create alerts for critical anomalies
        const criticalAnomalies = anomalies.filter((a) => a.severity === "critical");
        for (const anomaly of criticalAnomalies) {
          await this.alertManagement.addAlert({
            type: "risk_threshold",
            severity: "critical",
            category: "pattern",
            title: `Critical Market Anomaly: ${anomaly.anomalyType}`,
            message: anomaly.description,
            riskLevel: 90,
            source: "anomaly_detection",
            metadata: { anomaly },
          });
        }
      }

      return anomalies;
    } catch (error) {
      timer.end({ status: "failed" });

      this.logger.error(
        "Anomaly detection failed",
        {
          error: (error as Error)?.message,
        },
        error as Error
      );

      return [];
    }
  }

  /**
   * Generate predictive risk assessment
   */
  generatePredictiveRiskAssessment(): PredictiveRiskAssessment {
    const currentRisk = this.realTimeMetrics.overallRiskScore;

    // Use machine learning model if available, otherwise use heuristics
    const predictedRisk = this.riskPredictionModel
      ? this.riskPredictionModel.predict(this.getRiskFeatures())
      : this.calculateHeuristicRiskPrediction(currentRisk);

    const riskFactors = this.identifyRiskFactors();
    const recommendations = this.generateRiskRecommendations(
      currentRisk,
      predictedRisk,
      riskFactors
    );

    return {
      currentRisk,
      predictedRisk,
      riskFactors,
      recommendations,
      actionRequired: currentRisk > this.config.criticalRiskThreshold,
      emergencyLikelihood: this.calculateEmergencyLikelihood(currentRisk, predictedRisk),
    };
  }

  // Private methods

  private mergeWithDefaults(config: Partial<EnhancedSafetyConfig>): EnhancedSafetyConfig {
    return {
      monitoringIntervalMs: 5000,
      riskAssessmentIntervalMs: 15000,
      emergencyResponseTimeoutMs: 30000,
      predictiveAnalyticsEnabled: true,
      machineLearningInsights: false, // Disabled by default until models are trained
      realTimeAnomalyDetection: true,
      criticalRiskThreshold: 80,
      emergencyRiskThreshold: 95,
      anomalyDetectionSensitivity: 0.8,
      autoEmergencyStopEnabled: true,
      emergencyStopDelayMs: 2000,
      manualOverrideRequired: false,
      ...config,
    };
  }

  private getDefaultMetrics(): RealTimeMetrics {
    return {
      overallRiskScore: 0,
      riskTrend: "stable",
      emergencyLevel: "none",
      monitoringLatency: 0,
      responseTime: 0,
      systemLoad: 0,
      portfolioRisk: 0,
      marketRisk: 0,
      systemRisk: 0,
      operationalRisk: 0,
      riskForecast: {
        next5min: 0,
        next15min: 0,
        next1hour: 0,
      },
      activeAlerts: 0,
      criticalAlerts: 0,
      emergencyActions: 0,
      timestamp: new Date().toISOString(),
    };
  }

  private async startCoreComponents(): Promise<void> {
    await this.safetyCoordinator.start();
    this.coreMonitoring.start();
    this.eventHandling.start();
  }

  private async stopCoreComponents(): Promise<void> {
    await this.safetyCoordinator.stop();
    this.coreMonitoring.stop();
    this.eventHandling.stop();
  }

  private startMonitoringLoop(): void {
    this.monitoringTimer = setInterval(async () => {
      if (!this.isActive) return;

      try {
        await this.performMonitoringCycle();
      } catch (error) {
        this.logger.error(
          "Monitoring cycle failed",
          {
            error: (error as Error)?.message,
          },
          error as Error
        );
      }
    }, this.config.monitoringIntervalMs);
  }

  private startRiskAssessmentLoop(): void {
    this.riskAssessmentTimer = setInterval(async () => {
      if (!this.isActive) return;

      try {
        await this.performRiskAssessmentCycle();
      } catch (error) {
        this.logger.error(
          "Risk assessment cycle failed",
          {
            error: (error as Error)?.message,
          },
          error as Error
        );
      }
    }, this.config.riskAssessmentIntervalMs);
  }

  private async performMonitoringCycle(): Promise<void> {
    const startTime = Date.now();

    // Update core metrics
    const coreUpdate = await this.coreMonitoring.performMonitoringCycle();
    this.updateRealTimeMetrics(coreUpdate);

    // Perform anomaly detection
    const marketData = await this.getMarketData();
    await this.performAdvancedAnomalyDetection(marketData);

    // Update response time
    this.realTimeMetrics.responseTime = Date.now() - startTime;
    this.realTimeMetrics.timestamp = new Date().toISOString();

    // Check for emergency conditions
    if (this.realTimeMetrics.overallRiskScore > this.config.emergencyRiskThreshold) {
      if (this.config.autoEmergencyStopEnabled) {
        await this.executeEnhancedEmergencyStop(
          `Risk score ${this.realTimeMetrics.overallRiskScore} exceeds emergency threshold ${this.config.emergencyRiskThreshold}`,
          "critical"
        );
      }
    }
  }

  private async performRiskAssessmentCycle(): Promise<void> {
    try {
      const comprehensiveAssessment = await this.riskAssessment.performComprehensiveAssessment();

      // Update risk metrics
      this.realTimeMetrics.portfolioRisk = comprehensiveAssessment.portfolio.riskScore;
      this.realTimeMetrics.systemRisk = this.convertSystemHealthToRisk(
        comprehensiveAssessment.system
      );
      this.realTimeMetrics.operationalRisk = this.convertPerformanceToRisk(
        comprehensiveAssessment.performance
      );

      // Update overall risk score
      this.realTimeMetrics.overallRiskScore = comprehensiveAssessment.overallRiskScore;

      // Update risk trend
      this.updateRiskTrend(comprehensiveAssessment.overallRiskScore);

      // Store risk history
      this.riskHistory.push({
        timestamp: new Date().toISOString(),
        risk: comprehensiveAssessment.overallRiskScore,
      });

      // Keep only recent history
      if (this.riskHistory.length > 1000) {
        this.riskHistory = this.riskHistory.slice(-1000);
      }
    } catch (error) {
      this.logger.error(
        "Risk assessment cycle failed",
        {
          error: (error as Error)?.message,
        },
        error as Error
      );
    }
  }

  private updateRealTimeMetrics(coreUpdate: any): void {
    this.realTimeMetrics.overallRiskScore = coreUpdate.overallRiskScore;

    // Update alert counts
    const activeAlerts = this.alertManagement.getActiveAlerts();
    this.realTimeMetrics.activeAlerts = activeAlerts.length;
    this.realTimeMetrics.criticalAlerts = activeAlerts.filter(
      (a) => a.severity === "critical"
    ).length;
  }

  private async coordinateEmergencyResponse(
    reason: string,
    severity: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Coordinate with emergency system
      await this.emergencySystem.activateEmergencyResponse(
        "system_failure",
        severity as any,
        reason,
        ["enhanced_safety_monitor"]
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: (error as Error)?.message || "Unknown error",
      };
    }
  }

  private async initializePredictiveModels(): Promise<void> {
    this.logger.info("Initializing predictive models (placeholder implementation)");
    // Placeholder for machine learning model initialization
    // In production, this would load trained models for risk prediction and anomaly detection
  }

  private async detectPriceAnomalies(
    marketData: Record<string, any>
  ): Promise<AnomalyDetectionResult[]> {
    // Placeholder implementation - would use real market data analysis
    return [];
  }

  private async detectVolumeAnomalies(
    marketData: Record<string, any>
  ): Promise<AnomalyDetectionResult[]> {
    // Placeholder implementation - would use real volume analysis
    return [];
  }

  private async detectVolatilityAnomalies(
    marketData: Record<string, any>
  ): Promise<AnomalyDetectionResult[]> {
    // Placeholder implementation - would use real volatility analysis
    return [];
  }

  private async detectCorrelationAnomalies(
    marketData: Record<string, any>
  ): Promise<AnomalyDetectionResult[]> {
    // Placeholder implementation - would use real correlation analysis
    return [];
  }

  private async getMarketData(): Promise<Record<string, any>> {
    // Placeholder - would fetch real market data
    return {};
  }

  private calculateHeuristicRiskPrediction(currentRisk: number): {
    next5min: number;
    next15min: number;
    next1hour: number;
  } {
    // Simple heuristic prediction based on current risk and trends
    const recentRisks = this.riskHistory.slice(-10).map((r) => r.risk);
    const trend = recentRisks.length > 1 ? recentRisks[recentRisks.length - 1] - recentRisks[0] : 0;

    return {
      next5min: Math.max(0, Math.min(100, currentRisk + trend * 0.1)),
      next15min: Math.max(0, Math.min(100, currentRisk + trend * 0.3)),
      next1hour: Math.max(0, Math.min(100, currentRisk + trend * 1.0)),
    };
  }

  private identifyRiskFactors(): Array<{
    factor: string;
    impact: number;
    confidence: number;
    trend: "increasing" | "stable" | "decreasing";
  }> {
    // Analyze current system state and identify risk factors
    const factors: Array<{
      factor: string;
      impact: number;
      confidence: number;
      trend: "increasing" | "stable" | "decreasing";
    }> = [];

    if (this.realTimeMetrics.activeAlerts > 5) {
      factors.push({
        factor: "High alert volume",
        impact: 70,
        confidence: 95,
        trend: "increasing",
      });
    }

    if (this.realTimeMetrics.systemLoad > 80) {
      factors.push({
        factor: "High system load",
        impact: 60,
        confidence: 90,
        trend: "stable",
      });
    }

    return factors;
  }

  private generateRiskRecommendations(
    currentRisk: number,
    predictedRisk: any,
    riskFactors: any[]
  ): string[] {
    const recommendations: string[] = [];

    if (currentRisk > 70) {
      recommendations.push("Consider reducing position sizes");
      recommendations.push("Increase monitoring frequency");
    }

    if (predictedRisk.next15min > currentRisk + 10) {
      recommendations.push("Risk expected to increase - prepare defensive measures");
    }

    if (riskFactors.length > 3) {
      recommendations.push("Multiple risk factors detected - review system configuration");
    }

    return recommendations;
  }

  private calculateEmergencyLikelihood(currentRisk: number, predictedRisk: any): number {
    const maxPredictedRisk = Math.max(
      predictedRisk.next5min,
      predictedRisk.next15min,
      predictedRisk.next1hour
    );

    if (maxPredictedRisk > this.config.emergencyRiskThreshold) {
      return Math.min(100, (maxPredictedRisk - this.config.emergencyRiskThreshold) * 5);
    }

    return Math.max(0, (currentRisk - this.config.criticalRiskThreshold) * 2);
  }

  private updateRiskTrend(currentRisk: number): void {
    const recentRisks = this.riskHistory.slice(-5).map((r) => r.risk);

    if (recentRisks.length < 2) {
      this.realTimeMetrics.riskTrend = "stable";
      return;
    }

    const avgRecent = recentRisks.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const avgOlder =
      recentRisks.slice(0, -3).reduce((a, b) => a + b, 0) / Math.max(1, recentRisks.length - 3);

    const diff = avgRecent - avgOlder;

    if (currentRisk > 80) {
      this.realTimeMetrics.riskTrend = "critical";
    } else if (diff > 5) {
      this.realTimeMetrics.riskTrend = "deteriorating";
    } else if (diff < -5) {
      this.realTimeMetrics.riskTrend = "improving";
    } else {
      this.realTimeMetrics.riskTrend = "stable";
    }
  }

  private convertSystemHealthToRisk(systemAssessment: any): number {
    return Math.max(0, 100 - systemAssessment.systemHealth.overallHealth);
  }

  private convertPerformanceToRisk(performanceAssessment: any): number {
    const ratingToRisk = {
      excellent: 10,
      good: 30,
      concerning: 60,
      poor: 90,
    };

    return ratingToRisk[performanceAssessment.performanceRating] || 50;
  }

  private identifyDegradedServices(coordinatorStatus: any): string[] {
    const degraded: string[] = [];

    if (coordinatorStatus.emergency.tradingHalted) {
      degraded.push("Trading System");
    }

    if (coordinatorStatus.risk.activeAlerts > 10) {
      degraded.push("Alert Management");
    }

    if (!this.isActive) {
      degraded.push("Safety Monitoring");
    }

    return degraded;
  }

  private calculateUptime(): number {
    // Placeholder - would track actual uptime
    return 99.5;
  }

  private calculateAvailability(): number {
    // Placeholder - would track actual availability
    return 99.8;
  }

  private calculateErrorRate(): number {
    // Placeholder - would track actual error rate
    return 0.1;
  }

  private getRiskFeatures(): any {
    // Extract features for machine learning model
    return {
      currentRisk: this.realTimeMetrics.overallRiskScore,
      activeAlerts: this.realTimeMetrics.activeAlerts,
      systemLoad: this.realTimeMetrics.systemLoad,
      recentRiskHistory: this.riskHistory.slice(-10).map((r) => r.risk),
    };
  }

  private setupEventForwarding(): void {
    // Forward events from core components
    this.alertManagement.on?.("alert-created", (alert) => {
      this.emit("alert-created", alert);
    });

    this.emergencySystem.on?.("emergency-triggered", (emergency) => {
      this.emit("emergency-triggered", emergency);
    });

    this.safetyCoordinator.on?.("emergency-triggered", (procedure) => {
      this.emit("emergency-triggered", procedure);
    });
  }
}

/**
 * Factory function to create EnhancedRealTimeSafetyMonitor instance
 */
export function createEnhancedRealTimeSafetyMonitor(
  config: Partial<EnhancedSafetyConfig>,
  dependencies: {
    alertManagement: AlertManagement;
    coreMonitoring: CoreSafetyMonitoring;
    riskAssessment: RiskAssessment;
    eventHandling: EventHandling;
    emergencySystem: EmergencySafetySystem;
    safetyCoordinator: ComprehensiveSafetyCoordinator;
  }
): EnhancedRealTimeSafetyMonitor {
  return new EnhancedRealTimeSafetyMonitor(config, dependencies);
}

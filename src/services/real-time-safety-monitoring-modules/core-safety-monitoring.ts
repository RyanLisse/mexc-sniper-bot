/**
 * Core Safety Monitoring Module
 *
 * Provides core safety monitoring functionality including risk metric updates,
 * threshold checking, and monitoring cycle management. This module handles
 * the primary monitoring logic for the Real-time Safety Monitoring Service.
 *
 * Part of the modular refactoring of real-time-safety-monitoring-service.ts
 */

import { createTimer } from "../../lib/structured-logger";
import type {
  RiskMetrics,
  SafetyAlert,
  SafetyConfiguration,
} from "../../schemas/safety-monitoring-schemas";
import {
  validateRiskMetrics,
  validateSafetyThresholds,
} from "../../schemas/safety-monitoring-schemas";
import type {
  AutoSnipingExecutionService,
  ExecutionPosition,
} from "../auto-sniping-execution-service";
import type { PatternMonitoringService } from "../pattern-monitoring-service";

export interface CoreSafetyMonitoringConfig {
  configuration: SafetyConfiguration;
  executionService: AutoSnipingExecutionService;
  patternMonitoring: PatternMonitoringService;
  onAlert?: (alert: Omit<SafetyAlert, "id" | "timestamp" | "acknowledged">) => void;
}

export interface RiskAssessmentUpdate {
  riskMetrics: RiskMetrics;
  thresholdViolations: Array<{
    threshold: string;
    current: number;
    limit: number;
    severity: "low" | "medium" | "high" | "critical";
  }>;
  overallRiskScore: number;
}

export interface ThresholdCheckResult {
  violations: Array<{
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    message: string;
    currentValue: number;
    thresholdValue: number;
    category: "portfolio" | "system" | "performance" | "pattern" | "api";
  }>;
  riskScore: number;
}

export class CoreSafetyMonitoring {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[core-safety-monitoring]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[core-safety-monitoring]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[core-safety-monitoring]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[core-safety-monitoring]", message, context || ""),
  };
  private riskMetrics: RiskMetrics;
  private isActive = false;

  constructor(private config: CoreSafetyMonitoringConfig) {
    this.riskMetrics = this.getDefaultRiskMetrics();

    console.info("Core safety monitoring initialized", {
      operation: "initialization",
      monitoringInterval: config.configuration.monitoringIntervalMs,
      autoActionEnabled: config.configuration.autoActionEnabled,
      thresholdCount: Object.keys(config.configuration.thresholds).length,
    });
  }

  /**
   * Start monitoring operations
   */
  public start(): void {
    if (this.isActive) {
      console.warn("Core monitoring already active", {
        operation: "start_monitoring",
        isActive: this.isActive,
      });
      return;
    }

    this.isActive = true;
    console.info("Core safety monitoring started", {
      operation: "start_monitoring",
      monitoringInterval: this.config.configuration.monitoringIntervalMs,
    });
  }

  /**
   * Stop monitoring operations
   */
  public stop(): void {
    this.isActive = false;
    console.info("Core safety monitoring stopped", {
      operation: "stop_monitoring",
    });
  }

  /**
   * Get current monitoring status
   */
  public getStatus(): { isActive: boolean; lastUpdate: string } {
    return {
      isActive: this.isActive,
      lastUpdate: new Date().toISOString(),
    };
  }

  /**
   * Perform comprehensive monitoring cycle
   */
  public async performMonitoringCycle(): Promise<RiskAssessmentUpdate> {
    if (!this.isActive) {
      throw new Error("Monitoring not active");
    }

    const timer = createTimer("monitoring_cycle", "core-safety-monitoring");

    try {
      this.logger.debug("Starting monitoring cycle", {
        operation: "monitoring_cycle",
        currentRiskScore: this.calculateOverallRiskScore(),
      });

      // Update risk metrics
      await this.updateRiskMetrics();

      // Check safety thresholds
      const thresholdResults = await this.checkSafetyThresholds();

      // Calculate overall risk score
      const overallRiskScore = this.calculateOverallRiskScore();

      const result: RiskAssessmentUpdate = {
        riskMetrics: { ...this.riskMetrics },
        thresholdViolations: thresholdResults.violations.map((v) => ({
          threshold: v.type,
          current: v.currentValue,
          limit: v.thresholdValue,
          severity: v.severity,
        })),
        overallRiskScore,
      };

      const duration = timer.end({
        riskScore: overallRiskScore,
        violationsCount: thresholdResults.violations.length,
        status: "success",
      });

      console.info("Monitoring cycle completed", {
        operation: "monitoring_cycle",
        duration,
        riskScore: overallRiskScore,
        violationsCount: thresholdResults.violations.length,
      });

      return result;
    } catch (error) {
      const duration = timer.end({ status: "failed" });

      console.error(
        "Monitoring cycle failed",
        {
          operation: "monitoring_cycle",
          duration,
          isActive: this.isActive,
        },
        error
      );

      throw error;
    }
  }

  /**
   * Update risk metrics from various sources
   */
  public async updateRiskMetrics(): Promise<RiskMetrics> {
    try {
      // Get reports in parallel for better performance
      const [executionReport, patternReport] = await Promise.all([
        this.config.executionService.getExecutionReport(),
        this.config.patternMonitoring.getMonitoringReport(),
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

      // Update system metrics (would be real measurements in production)
      this.riskMetrics.apiLatency = 100;
      this.riskMetrics.apiSuccessRate = 98;
      this.riskMetrics.memoryUsage = 45;

      // Update pattern metrics
      this.riskMetrics.patternAccuracy = patternReport.stats.averageConfidence;
      this.riskMetrics.detectionFailures = patternReport.stats.consecutiveErrors;
      this.riskMetrics.falsePositiveRate = this.calculateFalsePositiveRate(patternReport);

      // Validate updated metrics
      const validatedMetrics = validateRiskMetrics(this.riskMetrics);
      this.riskMetrics = validatedMetrics;
      return { ...this.riskMetrics };
    } catch (error) {
      console.error(
        "Failed to update risk metrics",
        {
          operation: "update_risk_metrics",
          currentDrawdown: this.riskMetrics.currentDrawdown,
          successRate: this.riskMetrics.successRate,
        },
        error
      );

      throw error;
    }
  }

  /**
   * Check all safety thresholds and generate violations
   */
  public async checkSafetyThresholds(): Promise<ThresholdCheckResult> {
    const thresholds = this.config.configuration.thresholds;
    const violations: ThresholdCheckResult["violations"] = [];

    // Validate thresholds
    validateSafetyThresholds(thresholds);

    // Check drawdown threshold
    if (this.riskMetrics.currentDrawdown > thresholds.maxDrawdownPercentage) {
      violations.push({
        type: "max_drawdown_exceeded",
        severity: "critical",
        message: `Current drawdown ${this.riskMetrics.currentDrawdown.toFixed(1)}% exceeds threshold ${thresholds.maxDrawdownPercentage}%`,
        currentValue: this.riskMetrics.currentDrawdown,
        thresholdValue: thresholds.maxDrawdownPercentage,
        category: "portfolio",
      });

      // Trigger alert if callback provided
      if (this.config.onAlert) {
        this.config.onAlert({
          type: "risk_threshold",
          severity: "critical",
          category: "portfolio",
          title: "Maximum Drawdown Exceeded",
          message: `Current drawdown ${this.riskMetrics.currentDrawdown.toFixed(1)}% exceeds threshold ${thresholds.maxDrawdownPercentage}%`,
          riskLevel: 90,
          source: "core_monitoring",
          autoActions: [],
          metadata: {
            currentDrawdown: this.riskMetrics.currentDrawdown,
            threshold: thresholds.maxDrawdownPercentage,
          },
        });
      }
    }

    // Check success rate threshold
    if (this.riskMetrics.successRate < thresholds.minSuccessRatePercentage) {
      violations.push({
        type: "low_success_rate",
        severity: "high",
        message: `Success rate ${this.riskMetrics.successRate.toFixed(1)}% below threshold ${thresholds.minSuccessRatePercentage}%`,
        currentValue: this.riskMetrics.successRate,
        thresholdValue: thresholds.minSuccessRatePercentage,
        category: "performance",
      });

      if (this.config.onAlert) {
        this.config.onAlert({
          type: "performance_degradation",
          severity: "high",
          category: "performance",
          title: "Low Success Rate",
          message: `Success rate ${this.riskMetrics.successRate.toFixed(1)}% below threshold ${thresholds.minSuccessRatePercentage}%`,
          riskLevel: 70,
          source: "core_monitoring",
          autoActions: [],
          metadata: {
            currentSuccessRate: this.riskMetrics.successRate,
            threshold: thresholds.minSuccessRatePercentage,
          },
        });
      }
    }

    // Check consecutive losses
    if (this.riskMetrics.consecutiveLosses > thresholds.maxConsecutiveLosses) {
      violations.push({
        type: "excessive_consecutive_losses",
        severity: "high",
        message: `${this.riskMetrics.consecutiveLosses} consecutive losses exceeds threshold ${thresholds.maxConsecutiveLosses}`,
        currentValue: this.riskMetrics.consecutiveLosses,
        thresholdValue: thresholds.maxConsecutiveLosses,
        category: "performance",
      });

      if (this.config.onAlert) {
        this.config.onAlert({
          type: "risk_threshold",
          severity: "high",
          category: "performance",
          title: "Excessive Consecutive Losses",
          message: `${this.riskMetrics.consecutiveLosses} consecutive losses exceeds threshold ${thresholds.maxConsecutiveLosses}`,
          riskLevel: 75,
          source: "core_monitoring",
          autoActions: [],
          metadata: {
            consecutiveLosses: this.riskMetrics.consecutiveLosses,
            threshold: thresholds.maxConsecutiveLosses,
          },
        });
      }
    }

    // Check API latency
    if (this.riskMetrics.apiLatency > thresholds.maxApiLatencyMs) {
      violations.push({
        type: "high_api_latency",
        severity: "medium",
        message: `API latency ${this.riskMetrics.apiLatency}ms exceeds threshold ${thresholds.maxApiLatencyMs}ms`,
        currentValue: this.riskMetrics.apiLatency,
        thresholdValue: thresholds.maxApiLatencyMs,
        category: "api",
      });

      if (this.config.onAlert) {
        this.config.onAlert({
          type: "system_failure",
          severity: "medium",
          category: "api",
          title: "High API Latency",
          message: `API latency ${this.riskMetrics.apiLatency}ms exceeds threshold ${thresholds.maxApiLatencyMs}ms`,
          riskLevel: 60,
          source: "core_monitoring",
          autoActions: [],
          metadata: {
            currentLatency: this.riskMetrics.apiLatency,
            threshold: thresholds.maxApiLatencyMs,
          },
        });
      }
    }

    const riskScore = this.calculateOverallRiskScore();

    return {
      violations,
      riskScore,
    };
  }

  /**
   * Get current risk metrics
   */
  public getRiskMetrics(): RiskMetrics {
    return { ...this.riskMetrics };
  }

  /**
   * Set risk metrics directly (for testing purposes)
   */
  public setRiskMetrics(riskMetrics: Partial<RiskMetrics>): void {
    Object.assign(this.riskMetrics, riskMetrics);
  }

  /**
   * Calculate overall risk score based on current metrics
   */
  public calculateOverallRiskScore(): number {
    // If all core metrics are at default values (no data), return 0
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

    const thresholds = this.config.configuration.thresholds;
    const weights = {
      drawdown: 25,
      successRate: 20,
      consecutiveLosses: 15,
      concentration: 15,
      apiLatency: 10,
      patternAccuracy: 10,
      memoryUsage: 5,
    };

    let score = 0;

    // Drawdown risk (higher drawdown = higher risk)
    score +=
      (this.riskMetrics.currentDrawdown / thresholds.maxDrawdownPercentage) * weights.drawdown;

    // Success rate risk (lower success rate = higher risk)
    const successRateRisk = Math.max(
      0,
      (thresholds.minSuccessRatePercentage - this.riskMetrics.successRate) /
        thresholds.minSuccessRatePercentage
    );
    score += successRateRisk * weights.successRate;

    // Consecutive losses risk
    score +=
      (this.riskMetrics.consecutiveLosses / thresholds.maxConsecutiveLosses) *
      weights.consecutiveLosses;

    // Concentration risk
    score +=
      (this.riskMetrics.concentrationRisk / thresholds.maxPortfolioConcentration) *
      weights.concentration;

    // API latency risk
    score += (this.riskMetrics.apiLatency / thresholds.maxApiLatencyMs) * weights.apiLatency;

    // Pattern accuracy risk (lower accuracy = higher risk)
    const patternRisk = Math.max(
      0,
      (thresholds.minPatternConfidence - this.riskMetrics.patternAccuracy) /
        thresholds.minPatternConfidence
    );
    score += patternRisk * weights.patternAccuracy;

    // Memory usage risk
    score +=
      (this.riskMetrics.memoryUsage / thresholds.maxMemoryUsagePercentage) * weights.memoryUsage;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Reset risk metrics to default values
   */
  public resetRiskMetrics(): void {
    this.riskMetrics = this.getDefaultRiskMetrics();
    console.info("Risk metrics reset to defaults", {
      operation: "reset_risk_metrics",
    });
  }

  // Private helper methods

  private calculateConcentrationRisk(positions: ExecutionPosition[]): number {
    if (positions.length === 0) return 0;

    const symbolMap = new Map<string, number>();
    let totalValue = 0;

    positions.forEach((pos) => {
      const value = Number.parseFloat(pos.quantity) * Number.parseFloat(pos.currentPrice);
      symbolMap.set(pos.symbol, (symbolMap.get(pos.symbol) || 0) + value);
      totalValue += value;
    });

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
    const totalPatterns = patternReport.stats.totalPatternsDetected || 0;
    const failedPatterns = patternReport.stats.consecutiveErrors || 0;

    if (totalPatterns === 0) return 0;
    return (failedPatterns / totalPatterns) * 100;
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

/**
 * Factory function to create CoreSafetyMonitoring instance
 */
export function createCoreSafetyMonitoring(
  config: CoreSafetyMonitoringConfig
): CoreSafetyMonitoring {
  return new CoreSafetyMonitoring(config);
}

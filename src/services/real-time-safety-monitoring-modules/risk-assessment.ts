/**
 * Risk Assessment Module
 *
 * Provides specialized risk assessment functionality including portfolio risk analysis,
 * performance risk evaluation, pattern risk assessment, and system health monitoring.
 *
 * Part of the modular refactoring of real-time-safety-monitoring-service.ts
 */

import { createLogger, createTimer } from "../../lib/structured-logger";
import type { SafetyConfiguration, SystemHealth } from "../../schemas/safety-monitoring-schemas";
import { validateSystemHealth } from "../../schemas/safety-monitoring-schemas";
import type {
  AutoSnipingExecutionService,
  ExecutionPosition,
} from "../auto-sniping-execution-service";
import type { EmergencySafetySystem } from "../emergency-safety-system";
import type { PatternMonitoringService } from "../pattern-monitoring-service";
import type { UnifiedMexcServiceV2 } from "../unified-mexc-service-v2";

export interface RiskAssessmentConfig {
  configuration: SafetyConfiguration;
  executionService: AutoSnipingExecutionService;
  patternMonitoring: PatternMonitoringService;
  emergencySystem: EmergencySafetySystem;
  mexcService: UnifiedMexcServiceV2;
}

export interface PortfolioRiskAssessment {
  totalValue: number;
  totalExposure: number;
  concentrationRisk: number;
  positionCount: number;
  largestPositionRatio: number;
  diversificationScore: number;
  riskScore: number;
  recommendations: string[];
}

export interface PerformanceRiskAssessment {
  successRate: number;
  consecutiveLosses: number;
  averageSlippage: number;
  drawdownRisk: number;
  performanceRating: "excellent" | "good" | "concerning" | "poor";
  recommendations: string[];
}

export interface PatternRiskAssessment {
  patternAccuracy: number;
  detectionFailures: number;
  falsePositiveRate: number;
  confidenceLevel: number;
  patternReliability: "high" | "medium" | "low" | "unreliable";
  recommendations: string[];
}

export interface SystemRiskAssessment {
  systemHealth: SystemHealth;
  apiLatency: number;
  apiSuccessRate: number;
  memoryUsage: number;
  connectivityStatus: "excellent" | "good" | "degraded" | "poor";
  recommendations: string[];
}

export interface ComprehensiveRiskAssessment {
  portfolio: PortfolioRiskAssessment;
  performance: PerformanceRiskAssessment;
  pattern: PatternRiskAssessment;
  system: SystemRiskAssessment;
  overallRiskScore: number;
  riskStatus: "safe" | "warning" | "critical" | "emergency";
  priorityRecommendations: string[];
  timestamp: string;
}

export class RiskAssessment {
  private logger = createLogger("risk-assessment");

  constructor(private config: RiskAssessmentConfig) {
    this.logger.info("Risk assessment module initialized", {
      operation: "initialization",
      hasExecutionService: !!config.executionService,
      hasPatternMonitoring: !!config.patternMonitoring,
      hasEmergencySystem: !!config.emergencySystem,
      hasMexcService: !!config.mexcService,
    });
  }

  /**
   * Perform comprehensive risk assessment across all categories
   */
  public async performComprehensiveAssessment(): Promise<ComprehensiveRiskAssessment> {
    const timer = createTimer("comprehensive_assessment", "risk-assessment");

    try {
      this.logger.debug("Starting comprehensive risk assessment", {
        operation: "comprehensive_assessment",
      });

      // Run all assessments in parallel for better performance
      const [portfolio, performance, pattern, system] = await Promise.all([
        this.assessPortfolioRisk(),
        this.assessPerformanceRisk(),
        this.assessPatternRisk(),
        this.assessSystemRisk(),
      ]);

      // Calculate overall risk score
      const overallRiskScore = this.calculateOverallRiskScore(
        portfolio,
        performance,
        pattern,
        system
      );
      const riskStatus = this.determineRiskStatus(overallRiskScore);

      // Generate priority recommendations
      const priorityRecommendations = this.generatePriorityRecommendations(
        portfolio,
        performance,
        pattern,
        system,
        overallRiskScore
      );

      const assessment: ComprehensiveRiskAssessment = {
        portfolio,
        performance,
        pattern,
        system,
        overallRiskScore,
        riskStatus,
        priorityRecommendations,
        timestamp: new Date().toISOString(),
      };

      const duration = timer.end({
        overallRiskScore,
        riskStatus,
        portfolioScore: portfolio.riskScore,
        recommendationsCount: priorityRecommendations.length,
        status: "success",
      });

      this.logger.info("Comprehensive risk assessment completed", {
        operation: "comprehensive_assessment",
        duration,
        overallRiskScore,
        riskStatus,
        recommendationsCount: priorityRecommendations.length,
      });

      return assessment;
    } catch (error) {
      const duration = timer.end({ status: "failed" });

      this.logger.error(
        "Comprehensive risk assessment failed",
        {
          operation: "comprehensive_assessment",
          duration,
        },
        error
      );

      throw error;
    }
  }

  /**
   * Assess portfolio-specific risks
   */
  public async assessPortfolioRisk(): Promise<PortfolioRiskAssessment> {
    try {
      const executionReport = await this.config.executionService.getExecutionReport();
      const positions = executionReport.activePositions;

      const totalValue = this.calculatePortfolioValue(positions);
      const totalExposure = positions.reduce(
        (sum, pos) => sum + Number.parseFloat(pos.quantity),
        0
      );
      const concentrationRisk = this.calculateConcentrationRisk(positions);
      const positionCount = positions.length;

      const { largestPositionRatio, diversificationScore } =
        this.calculateDiversificationMetrics(positions);

      // Calculate portfolio risk score (0-100)
      let riskScore = 0;
      riskScore += concentrationRisk * 0.4; // 40% weight on concentration
      riskScore += (100 - diversificationScore) * 0.3; // 30% weight on diversification
      riskScore +=
        Math.min(
          (positionCount / this.config.configuration.thresholds.maxPortfolioConcentration) * 100,
          100
        ) * 0.2; // 20% weight on position count
      riskScore += largestPositionRatio * 0.1; // 10% weight on largest position

      const recommendations = this.generatePortfolioRecommendations(
        concentrationRisk,
        diversificationScore,
        positionCount,
        largestPositionRatio
      );

      return {
        totalValue,
        totalExposure,
        concentrationRisk,
        positionCount,
        largestPositionRatio,
        diversificationScore,
        riskScore: Math.min(riskScore, 100),
        recommendations,
      };
    } catch (error) {
      this.logger.error(
        "Portfolio risk assessment failed",
        {
          operation: "assess_portfolio_risk",
        },
        error
      );
      throw error;
    }
  }

  /**
   * Assess performance-specific risks
   */
  public async assessPerformanceRisk(): Promise<PerformanceRiskAssessment> {
    try {
      const executionReport = await this.config.executionService.getExecutionReport();

      const successRate = executionReport.stats.successRate;
      const consecutiveLosses = this.calculateConsecutiveLosses(executionReport.recentExecutions);
      const averageSlippage = executionReport.stats.averageSlippage;
      const drawdownRisk = executionReport.stats.currentDrawdown;

      const performanceRating = this.calculatePerformanceRating(
        successRate,
        consecutiveLosses,
        averageSlippage,
        drawdownRisk
      );

      const recommendations = this.generatePerformanceRecommendations(
        successRate,
        consecutiveLosses,
        averageSlippage,
        drawdownRisk
      );

      return {
        successRate,
        consecutiveLosses,
        averageSlippage,
        drawdownRisk,
        performanceRating,
        recommendations,
      };
    } catch (error) {
      this.logger.error(
        "Performance risk assessment failed",
        {
          operation: "assess_performance_risk",
        },
        error
      );
      throw error;
    }
  }

  /**
   * Assess pattern detection risks
   */
  public async assessPatternRisk(): Promise<PatternRiskAssessment> {
    try {
      const patternReport = await this.config.patternMonitoring.getMonitoringReport();

      const patternAccuracy = patternReport.stats.averageConfidence;
      const detectionFailures = patternReport.stats.consecutiveErrors;
      const falsePositiveRate = this.calculateFalsePositiveRate(patternReport);
      const confidenceLevel = patternAccuracy;

      const patternReliability = this.calculatePatternReliability(
        patternAccuracy,
        detectionFailures,
        falsePositiveRate
      );

      const recommendations = this.generatePatternRecommendations(
        patternAccuracy,
        detectionFailures,
        falsePositiveRate
      );

      return {
        patternAccuracy,
        detectionFailures,
        falsePositiveRate,
        confidenceLevel,
        patternReliability,
        recommendations,
      };
    } catch (error) {
      this.logger.error(
        "Pattern risk assessment failed",
        {
          operation: "assess_pattern_risk",
        },
        error
      );
      throw error;
    }
  }

  /**
   * Assess system health and connectivity risks
   */
  public async assessSystemRisk(): Promise<SystemRiskAssessment> {
    try {
      const [executionReport, patternReport, emergencyHealth] = await Promise.all([
        this.config.executionService.getExecutionReport(),
        this.config.patternMonitoring.getMonitoringReport(),
        this.config.emergencySystem.performSystemHealthCheck(),
      ]);

      const systemHealth: SystemHealth = {
        executionService: executionReport.systemHealth.apiConnection,
        patternMonitoring: patternReport.status === "healthy",
        emergencySystem: emergencyHealth.overall === "healthy",
        mexcConnectivity: true, // Would check actual connectivity
        overallHealth: this.calculateOverallSystemHealth(
          executionReport.systemHealth.apiConnection,
          patternReport.status === "healthy",
          emergencyHealth.overall === "healthy",
          true
        ),
      };

      // Validate system health structure
      validateSystemHealth(systemHealth);

      const apiLatency = 100; // Would measure actual API latency
      const apiSuccessRate = 98; // Would track actual API success rate
      const memoryUsage = 45; // Would measure actual memory usage

      const connectivityStatus = this.calculateConnectivityStatus(
        systemHealth.overallHealth,
        apiLatency,
        apiSuccessRate
      );

      const recommendations = this.generateSystemRecommendations(
        systemHealth,
        apiLatency,
        apiSuccessRate,
        memoryUsage
      );

      return {
        systemHealth,
        apiLatency,
        apiSuccessRate,
        memoryUsage,
        connectivityStatus,
        recommendations,
      };
    } catch (error) {
      this.logger.error(
        "System risk assessment failed",
        {
          operation: "assess_system_risk",
        },
        error
      );
      throw error;
    }
  }

  // Private helper methods

  private calculatePortfolioValue(positions: ExecutionPosition[]): number {
    return positions.reduce((total, pos) => {
      return total + Number.parseFloat(pos.quantity) * Number.parseFloat(pos.currentPrice);
    }, 0);
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

    let maxConcentration = 0;
    symbolMap.forEach((value) => {
      const concentration = (value / totalValue) * 100;
      maxConcentration = Math.max(maxConcentration, concentration);
    });

    return maxConcentration;
  }

  private calculateDiversificationMetrics(positions: ExecutionPosition[]): {
    largestPositionRatio: number;
    diversificationScore: number;
  } {
    if (positions.length === 0) {
      return { largestPositionRatio: 0, diversificationScore: 100 };
    }

    const totalValue = this.calculatePortfolioValue(positions);
    const positionValues = positions.map(
      (pos) => Number.parseFloat(pos.quantity) * Number.parseFloat(pos.currentPrice)
    );

    const largestPosition = Math.max(...positionValues);
    const largestPositionRatio = (largestPosition / totalValue) * 100;

    // Calculate diversification score based on position count and distribution
    const idealPositionCount = Math.min(10, positions.length);
    const positionCountScore = (positions.length / idealPositionCount) * 50;
    const distributionScore = Math.max(0, 50 - (largestPositionRatio - 10)); // Ideal max position is 10%

    const diversificationScore = Math.min(100, positionCountScore + distributionScore);

    return { largestPositionRatio, diversificationScore };
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

  private calculatePerformanceRating(
    successRate: number,
    consecutiveLosses: number,
    averageSlippage: number,
    drawdownRisk: number
  ): "excellent" | "good" | "concerning" | "poor" {
    const thresholds = this.config.configuration.thresholds;

    if (
      successRate >= thresholds.minSuccessRatePercentage * 1.2 &&
      consecutiveLosses <= thresholds.maxConsecutiveLosses * 0.5 &&
      averageSlippage <= thresholds.maxSlippagePercentage * 0.5 &&
      drawdownRisk <= thresholds.maxDrawdownPercentage * 0.3
    ) {
      return "excellent";
    }

    if (
      successRate >= thresholds.minSuccessRatePercentage &&
      consecutiveLosses <= thresholds.maxConsecutiveLosses &&
      averageSlippage <= thresholds.maxSlippagePercentage &&
      drawdownRisk <= thresholds.maxDrawdownPercentage * 0.7
    ) {
      return "good";
    }

    if (
      successRate >= thresholds.minSuccessRatePercentage * 0.8 &&
      consecutiveLosses <= thresholds.maxConsecutiveLosses * 1.5 &&
      drawdownRisk <= thresholds.maxDrawdownPercentage
    ) {
      return "concerning";
    }

    return "poor";
  }

  private calculatePatternReliability(
    patternAccuracy: number,
    detectionFailures: number,
    falsePositiveRate: number
  ): "high" | "medium" | "low" | "unreliable" {
    const thresholds = this.config.configuration.thresholds;

    if (
      patternAccuracy >= thresholds.minPatternConfidence * 1.2 &&
      detectionFailures <= thresholds.maxPatternDetectionFailures * 0.5 &&
      falsePositiveRate <= 5
    ) {
      return "high";
    }

    if (
      patternAccuracy >= thresholds.minPatternConfidence &&
      detectionFailures <= thresholds.maxPatternDetectionFailures &&
      falsePositiveRate <= 15
    ) {
      return "medium";
    }

    if (
      patternAccuracy >= thresholds.minPatternConfidence * 0.8 &&
      detectionFailures <= thresholds.maxPatternDetectionFailures * 2 &&
      falsePositiveRate <= 30
    ) {
      return "low";
    }

    return "unreliable";
  }

  private calculateOverallSystemHealth(
    executionService: boolean,
    patternMonitoring: boolean,
    emergencySystem: boolean,
    mexcConnectivity: boolean
  ): number {
    const healthComponents = [
      executionService,
      patternMonitoring,
      emergencySystem,
      mexcConnectivity,
    ];
    const healthyCount = healthComponents.filter(Boolean).length;
    return (healthyCount / healthComponents.length) * 100;
  }

  private calculateConnectivityStatus(
    overallHealth: number,
    apiLatency: number,
    apiSuccessRate: number
  ): "excellent" | "good" | "degraded" | "poor" {
    const thresholds = this.config.configuration.thresholds;

    if (
      overallHealth >= 95 &&
      apiLatency <= thresholds.maxApiLatencyMs * 0.5 &&
      apiSuccessRate >= thresholds.minApiSuccessRate
    ) {
      return "excellent";
    }

    if (
      overallHealth >= 80 &&
      apiLatency <= thresholds.maxApiLatencyMs &&
      apiSuccessRate >= thresholds.minApiSuccessRate * 0.9
    ) {
      return "good";
    }

    if (overallHealth >= 60 && apiSuccessRate >= thresholds.minApiSuccessRate * 0.8) {
      return "degraded";
    }

    return "poor";
  }

  private calculateOverallRiskScore(
    portfolio: PortfolioRiskAssessment,
    performance: PerformanceRiskAssessment,
    pattern: PatternRiskAssessment,
    system: SystemRiskAssessment
  ): number {
    const weights = {
      portfolio: 0.3,
      performance: 0.3,
      pattern: 0.2,
      system: 0.2,
    };

    const performanceScore = this.convertPerformanceToScore(performance.performanceRating);
    const patternScore = this.convertPatternReliabilityToScore(pattern.patternReliability);
    const systemScore = this.convertConnectivityToScore(system.connectivityStatus);

    const overallScore =
      portfolio.riskScore * weights.portfolio +
      performanceScore * weights.performance +
      patternScore * weights.pattern +
      systemScore * weights.system;

    return Math.min(100, Math.max(0, overallScore));
  }

  private convertPerformanceToScore(
    rating: PerformanceRiskAssessment["performanceRating"]
  ): number {
    switch (rating) {
      case "excellent":
        return 10;
      case "good":
        return 30;
      case "concerning":
        return 60;
      case "poor":
        return 90;
    }
  }

  private convertPatternReliabilityToScore(
    reliability: PatternRiskAssessment["patternReliability"]
  ): number {
    switch (reliability) {
      case "high":
        return 10;
      case "medium":
        return 30;
      case "low":
        return 60;
      case "unreliable":
        return 90;
    }
  }

  private convertConnectivityToScore(status: SystemRiskAssessment["connectivityStatus"]): number {
    switch (status) {
      case "excellent":
        return 10;
      case "good":
        return 30;
      case "degraded":
        return 60;
      case "poor":
        return 90;
    }
  }

  private determineRiskStatus(
    overallRiskScore: number
  ): "safe" | "warning" | "critical" | "emergency" {
    if (overallRiskScore < 25) return "safe";
    if (overallRiskScore < 50) return "warning";
    if (overallRiskScore < 75) return "critical";
    return "emergency";
  }

  private generatePortfolioRecommendations(
    concentrationRisk: number,
    diversificationScore: number,
    positionCount: number,
    largestPositionRatio: number
  ): string[] {
    const recommendations: string[] = [];

    if (concentrationRisk > 50) {
      recommendations.push(
        "High concentration risk detected - consider diversifying across more symbols"
      );
    }

    if (diversificationScore < 60) {
      recommendations.push(
        "Poor diversification - increase number of positions or rebalance allocation"
      );
    }

    if (positionCount < 3) {
      recommendations.push("Consider increasing position count for better risk distribution");
    }

    if (largestPositionRatio > 25) {
      recommendations.push("Largest position is too dominant - consider reducing position size");
    }

    return recommendations;
  }

  private generatePerformanceRecommendations(
    successRate: number,
    consecutiveLosses: number,
    averageSlippage: number,
    drawdownRisk: number
  ): string[] {
    const recommendations: string[] = [];
    const thresholds = this.config.configuration.thresholds;

    if (successRate < thresholds.minSuccessRatePercentage) {
      recommendations.push("Low success rate - review trading strategy and entry criteria");
    }

    if (consecutiveLosses > thresholds.maxConsecutiveLosses * 0.7) {
      recommendations.push(
        "High consecutive losses - consider reducing position sizes or pausing trading"
      );
    }

    if (averageSlippage > thresholds.maxSlippagePercentage * 0.7) {
      recommendations.push("High slippage detected - review execution timing and market liquidity");
    }

    if (drawdownRisk > thresholds.maxDrawdownPercentage * 0.5) {
      recommendations.push("Elevated drawdown risk - implement stricter risk controls");
    }

    return recommendations;
  }

  private generatePatternRecommendations(
    patternAccuracy: number,
    detectionFailures: number,
    falsePositiveRate: number
  ): string[] {
    const recommendations: string[] = [];
    const thresholds = this.config.configuration.thresholds;

    if (patternAccuracy < thresholds.minPatternConfidence) {
      recommendations.push("Low pattern confidence - review pattern detection parameters");
    }

    if (detectionFailures > thresholds.maxPatternDetectionFailures * 0.7) {
      recommendations.push("High detection failures - check pattern monitoring system health");
    }

    if (falsePositiveRate > 20) {
      recommendations.push("High false positive rate - refine pattern recognition criteria");
    }

    return recommendations;
  }

  private generateSystemRecommendations(
    systemHealth: SystemHealth,
    apiLatency: number,
    apiSuccessRate: number,
    memoryUsage: number
  ): string[] {
    const recommendations: string[] = [];
    const thresholds = this.config.configuration.thresholds;

    if (systemHealth.overallHealth < 80) {
      recommendations.push("System health degraded - check individual service status");
    }

    if (apiLatency > thresholds.maxApiLatencyMs * 0.7) {
      recommendations.push("High API latency - check network connectivity and server load");
    }

    if (apiSuccessRate < thresholds.minApiSuccessRate * 0.9) {
      recommendations.push("Low API success rate - investigate connection issues");
    }

    if (memoryUsage > thresholds.maxMemoryUsagePercentage * 0.7) {
      recommendations.push("High memory usage - consider system optimization");
    }

    return recommendations;
  }

  private generatePriorityRecommendations(
    portfolio: PortfolioRiskAssessment,
    performance: PerformanceRiskAssessment,
    pattern: PatternRiskAssessment,
    system: SystemRiskAssessment,
    overallRiskScore: number
  ): string[] {
    const priority: string[] = [];

    // High priority recommendations based on overall risk
    if (overallRiskScore > 75) {
      priority.push("CRITICAL: Overall risk score is very high - immediate action required");
    }

    // Add critical recommendations from each category
    if (portfolio.concentrationRisk > 80) {
      priority.push("URGENT: Extremely high portfolio concentration - diversify immediately");
    }

    if (performance.performanceRating === "poor") {
      priority.push("URGENT: Poor performance rating - halt trading and review strategy");
    }

    if (pattern.patternReliability === "unreliable") {
      priority.push("URGENT: Pattern detection unreliable - disable automated trading");
    }

    if (system.connectivityStatus === "poor") {
      priority.push("URGENT: Poor system connectivity - check all connections");
    }

    // If no urgent issues, provide top recommendations
    if (priority.length === 0) {
      const allRecommendations = [
        ...portfolio.recommendations,
        ...performance.recommendations,
        ...pattern.recommendations,
        ...system.recommendations,
      ];

      priority.push(...allRecommendations.slice(0, 3));
    }

    return priority;
  }
}

/**
 * Factory function to create RiskAssessment instance
 */
export function createRiskAssessment(config: RiskAssessmentConfig): RiskAssessment {
  return new RiskAssessment(config);
}

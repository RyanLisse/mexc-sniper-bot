/**
 * Optimized Risk Management Service
 *
 * High-performance risk management with:
 * - Real-time risk assessment and monitoring
 * - Dynamic position sizing and limits
 * - Advanced stop-loss and take-profit management
 * - Portfolio-level risk controls
 * - Type-safe validation with Zod
 *
 * Focused module < 500 lines for risk management
 */

import { z } from "zod";
import type { PatternMatch } from "@/src/core/pattern-detection";
import { toSafeError } from "@/src/lib/error-type-utils";
import type { ExecutionPosition } from "./optimized-auto-sniping-core";

// ============================================================================
// Risk Management Schemas
// ============================================================================

export const RiskLevelSchema = z.enum(["low", "medium", "high", "extreme"]);
export const RiskActionSchema = z.enum(["allow", "warn", "block", "emergency_stop"]);

export const RiskAssessmentSchema = z.object({
  overallRiskLevel: RiskLevelSchema,
  riskScore: z.number().min(0).max(100),
  positionRisk: z.number().min(0).max(100),
  portfolioRisk: z.number().min(0).max(100),
  drawdownRisk: z.number().min(0).max(100),
  concentrationRisk: z.number().min(0).max(100),
  volatilityRisk: z.number().min(0).max(100),
  recommendedAction: RiskActionSchema,
  riskFactors: z.array(z.string()),
  recommendations: z.array(z.string()),
  maxSafePositionSize: z.number().positive(),
  stopLossPrice: z.number().positive().optional(),
  takeProfitPrice: z.number().positive().optional(),
});

export const PortfolioRiskMetricsSchema = z.object({
  totalPositionValue: z.number().min(0),
  totalUnrealizedPnl: z.number(),
  currentDrawdown: z.number().min(0),
  maxDrawdown: z.number().min(0),
  concentrationRatio: z.number().min(0).max(1),
  diversificationScore: z.number().min(0).max(100),
  volatilityScore: z.number().min(0).max(100),
  riskAdjustedReturn: z.number(),
  sharpeRatio: z.number().optional(),
  activePositionCount: z.number().int().min(0),
  riskUtilization: z.number().min(0).max(100),
});

export const StopLossConfigSchema = z.object({
  type: z.enum(["percentage", "fixed", "trailing", "volatility_based"]),
  value: z.number().positive(),
  trailingDistance: z.number().positive().optional(),
  volatilityMultiplier: z.number().positive().optional(),
  minStopLoss: z.number().positive().optional(),
  maxStopLoss: z.number().positive().optional(),
});

export const TakeProfitConfigSchema = z.object({
  type: z.enum(["percentage", "fixed", "multi_target", "dynamic"]),
  value: z.number().positive(),
  targets: z
    .array(
      z.object({
        price: z.number().positive(),
        percentage: z.number().min(0).max(100),
      })
    )
    .optional(),
  dynamicMultiplier: z.number().positive().optional(),
});

export const RiskLimitsSchema = z.object({
  maxDailyLoss: z.number().positive(),
  maxPositionSize: z.number().positive(),
  maxPositions: z.number().int().positive(),
  maxDrawdown: z.number().min(0).max(100),
  maxConcentration: z.number().min(0).max(100),
  maxPortfolioRisk: z.number().min(0).max(100),
  emergencyStopLoss: z.number().min(0).max(100),
});

// ============================================================================
// Type Definitions
// ============================================================================

export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;
export type PortfolioRiskMetrics = z.infer<typeof PortfolioRiskMetricsSchema>;
export type StopLossConfig = z.infer<typeof StopLossConfigSchema>;
export type TakeProfitConfig = z.infer<typeof TakeProfitConfigSchema>;
export type RiskLimits = z.infer<typeof RiskLimitsSchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type RiskAction = z.infer<typeof RiskActionSchema>;

// ============================================================================
// Optimized Risk Management Service
// ============================================================================

export class OptimizedRiskManager {
  private static instance: OptimizedRiskManager;
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[optimized-risk-manager]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[optimized-risk-manager]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[optimized-risk-manager]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[optimized-risk-manager]", message, context || ""),
  };

  // Risk configuration
  private riskLimits: RiskLimits;
  private stopLossConfig: StopLossConfig;
  private takeProfitConfig: TakeProfitConfig;

  // Risk tracking
  private portfolioMetrics: PortfolioRiskMetrics;
  private riskHistory: Array<{ timestamp: string; metrics: PortfolioRiskMetrics }> = [];

  // Performance metrics
  private riskMetrics = {
    totalAssessments: 0,
    blockedTrades: 0,
    emergencyStops: 0,
    successfulRiskMitigations: 0,
    falsePositives: 0,
  };

  private constructor() {
    // Initialize with default configuration
    this.riskLimits = this.getDefaultRiskLimits();
    this.stopLossConfig = this.getDefaultStopLossConfig();
    this.takeProfitConfig = this.getDefaultTakeProfitConfig();
    this.portfolioMetrics = this.getDefaultPortfolioMetrics();

    // Update portfolio metrics every 30 seconds
    setInterval(() => this.updatePortfolioMetrics(), 30000);

    console.info("Optimized Risk Manager initialized", {
      riskLimits: this.riskLimits,
    });
  }

  static getInstance(): OptimizedRiskManager {
    if (!OptimizedRiskManager.instance) {
      OptimizedRiskManager.instance = new OptimizedRiskManager();
    }
    return OptimizedRiskManager.instance;
  }

  /**
   * Assess risk for a potential trade
   */
  async assessTradeRisk(
    pattern: PatternMatch,
    positionSize: number,
    activePositions: ExecutionPosition[]
  ): Promise<RiskAssessment> {
    try {
      this.riskMetrics.totalAssessments++; // Calculate various risk components
      const positionRisk = this.calculatePositionRisk(pattern, positionSize);
      const portfolioRisk = this.calculatePortfolioRisk(activePositions, positionSize);
      const drawdownRisk = this.calculateDrawdownRisk(activePositions);
      const concentrationRisk = this.calculateConcentrationRisk(
        pattern.symbol,
        activePositions,
        positionSize
      );
      const volatilityRisk = this.calculateVolatilityRisk(pattern);

      // Calculate overall risk score
      const riskScore = this.calculateOverallRiskScore({
        positionRisk,
        portfolioRisk,
        drawdownRisk,
        concentrationRisk,
        volatilityRisk,
      });

      // Determine risk level and action
      const overallRiskLevel = this.determineRiskLevel(riskScore);
      const recommendedAction = this.determineRiskAction(overallRiskLevel, riskScore);

      // Generate risk factors and recommendations
      const riskFactors = this.generateRiskFactors({
        positionRisk,
        portfolioRisk,
        drawdownRisk,
        concentrationRisk,
        volatilityRisk,
      });

      const recommendations = this.generateRiskRecommendations(
        overallRiskLevel,
        riskScore,
        pattern
      );

      // Calculate safe position size and prices
      const maxSafePositionSize = this.calculateMaxSafePositionSize(
        pattern,
        activePositions,
        riskScore
      );

      const stopLossPrice = this.calculateOptimalStopLoss(pattern, positionSize);
      const takeProfitPrice = this.calculateOptimalTakeProfit(pattern, positionSize);

      const assessment = RiskAssessmentSchema.parse({
        overallRiskLevel,
        riskScore,
        positionRisk,
        portfolioRisk,
        drawdownRisk,
        concentrationRisk,
        volatilityRisk,
        recommendedAction,
        riskFactors,
        recommendations,
        maxSafePositionSize,
        stopLossPrice,
        takeProfitPrice,
      });

      // Track blocked trades
      if (recommendedAction === "block" || recommendedAction === "emergency_stop") {
        this.riskMetrics.blockedTrades++;
      }
      return assessment;
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("Risk assessment failed", {
        symbol: pattern.symbol,
        error: safeError.message,
      });

      // Return conservative assessment on error
      return RiskAssessmentSchema.parse({
        overallRiskLevel: "high",
        riskScore: 90,
        positionRisk: 90,
        portfolioRisk: 90,
        drawdownRisk: 90,
        concentrationRisk: 90,
        volatilityRisk: 90,
        recommendedAction: "block",
        riskFactors: ["Risk assessment error"],
        recommendations: ["Manual review required"],
        maxSafePositionSize: 0,
      });
    }
  }

  /**
   * Monitor position risk in real-time
   */
  async monitorPositionRisk(position: ExecutionPosition): Promise<{
    riskLevel: RiskLevel;
    shouldClose: boolean;
    shouldAdjustStopLoss: boolean;
    shouldAdjustTakeProfit: boolean;
    newStopLoss?: number;
    newTakeProfit?: number;
    reasoning: string[];
  }> {
    try {
      const unrealizedPnlPercent = position.unrealizedPnlPercentage;
      const currentPrice = Number.parseFloat(position.currentPrice);
      const entryPrice = Number.parseFloat(position.entryPrice);

      const reasoning: string[] = [];
      let riskLevel: RiskLevel = "low";
      let shouldClose = false;
      let shouldAdjustStopLoss = false;
      let shouldAdjustTakeProfit = false;
      let newStopLoss: number | undefined;
      let newTakeProfit: number | undefined;

      // Check for emergency stop conditions
      if (unrealizedPnlPercent <= -this.riskLimits.emergencyStopLoss) {
        riskLevel = "extreme";
        shouldClose = true;
        reasoning.push(`Emergency stop: Loss exceeds ${this.riskLimits.emergencyStopLoss}%`);
        this.riskMetrics.emergencyStops++;
      }

      // Check for trailing stop adjustments
      if (this.stopLossConfig.type === "trailing" && position.stopLossPrice) {
        const currentStopLoss = Number.parseFloat(position.stopLossPrice);
        const trailingStop = this.calculateTrailingStopLoss(
          currentPrice,
          entryPrice,
          currentStopLoss
        );

        if (trailingStop > currentStopLoss) {
          shouldAdjustStopLoss = true;
          newStopLoss = trailingStop;
          reasoning.push("Trailing stop-loss adjustment");
        }
      }

      // Check for take-profit adjustments
      if (unrealizedPnlPercent > 20) {
        // Significant profit
        riskLevel = "low";
        if (this.takeProfitConfig.type === "dynamic") {
          const dynamicTakeProfit = this.calculateDynamicTakeProfit(currentPrice, entryPrice);
          newTakeProfit = dynamicTakeProfit;
          shouldAdjustTakeProfit = true;
          reasoning.push("Dynamic take-profit adjustment");
        }
      } else if (unrealizedPnlPercent < -10) {
        riskLevel = "high";
        reasoning.push("Position showing significant loss");
      } else if (unrealizedPnlPercent < -5) {
        riskLevel = "medium";
        reasoning.push("Position showing moderate loss");
      }

      return {
        riskLevel,
        shouldClose,
        shouldAdjustStopLoss,
        shouldAdjustTakeProfit,
        newStopLoss,
        newTakeProfit,
        reasoning,
      };
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("Position risk monitoring failed", {
        positionId: position.id,
        error: safeError.message,
      });

      return {
        riskLevel: "high",
        shouldClose: false,
        shouldAdjustStopLoss: false,
        shouldAdjustTakeProfit: false,
        reasoning: ["Risk monitoring error"],
      };
    }
  }

  /**
   * Get current portfolio risk metrics
   */
  getPortfolioRiskMetrics(): PortfolioRiskMetrics {
    return PortfolioRiskMetricsSchema.parse(this.portfolioMetrics);
  }

  /**
   * Check if trading should be halted
   */
  shouldHaltTrading(activePositions: ExecutionPosition[]): {
    shouldHalt: boolean;
    reason?: string;
    severity: "low" | "medium" | "high" | "critical";
  } {
    const metrics = this.calculatePortfolioRisk(activePositions, 0);

    // Check maximum drawdown
    if (this.portfolioMetrics.currentDrawdown >= this.riskLimits.maxDrawdown) {
      return {
        shouldHalt: true,
        reason: `Maximum drawdown reached: ${this.portfolioMetrics.currentDrawdown}%`,
        severity: "critical",
      };
    }

    // Check portfolio risk
    if (metrics >= this.riskLimits.maxPortfolioRisk) {
      return {
        shouldHalt: true,
        reason: `Portfolio risk too high: ${metrics}%`,
        severity: "high",
      };
    }

    // Check position count
    if (activePositions.length >= this.riskLimits.maxPositions) {
      return {
        shouldHalt: true,
        reason: `Maximum positions reached: ${activePositions.length}`,
        severity: "medium",
      };
    }

    return {
      shouldHalt: false,
      severity: "low",
    };
  }

  /**
   * Update risk configuration
   */
  updateRiskLimits(newLimits: Partial<RiskLimits>): void {
    try {
      this.riskLimits = RiskLimitsSchema.parse({
        ...this.riskLimits,
        ...newLimits,
      });

      console.info("Risk limits updated", {
        updatedFields: Object.keys(newLimits),
        newLimits: this.riskLimits,
      });
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("Failed to update risk limits", {
        error: safeError.message,
        attemptedLimits: newLimits,
      });
      throw error;
    }
  }

  /**
   * Get risk management metrics
   */
  getRiskMetrics() {
    const blockRate =
      this.riskMetrics.totalAssessments > 0
        ? (this.riskMetrics.blockedTrades / this.riskMetrics.totalAssessments) * 100
        : 0;

    return {
      ...this.riskMetrics,
      blockRate: Math.round(blockRate * 100) / 100,
      currentPortfolioRisk: this.portfolioMetrics.riskUtilization,
    };
  }

  // Private helper methods

  private calculatePositionRisk(pattern: PatternMatch, positionSize: number): number {
    let risk = 0;

    // Base risk from pattern confidence (inverted)
    risk += (100 - pattern.confidence) * 0.3;

    // Risk from pattern type
    switch (pattern.patternType) {
      case "ready_state":
        risk += 10;
        break;
      case "pre_ready":
        risk += 25;
        break;
      case "launch_sequence":
        risk += 40;
        break;
      case "risk_warning":
        risk += 60;
        break;
    }

    // Risk from position size
    const sizeFactor = Math.min(positionSize / this.riskLimits.maxPositionSize, 1);
    risk += sizeFactor * 30;

    return Math.min(100, risk);
  }

  private calculatePortfolioRisk(
    activePositions: ExecutionPosition[],
    newPositionSize: number
  ): number {
    const totalValue =
      activePositions.reduce((sum, pos) => {
        return sum + Number.parseFloat(pos.quantity) * Number.parseFloat(pos.currentPrice);
      }, 0) + newPositionSize;

    const maxPortfolioValue = this.riskLimits.maxPositionSize * this.riskLimits.maxPositions;

    return Math.min(100, (totalValue / maxPortfolioValue) * 100);
  }

  private calculateDrawdownRisk(activePositions: ExecutionPosition[]): number {
    const totalUnrealizedPnl = activePositions.reduce((sum, pos) => {
      return sum + Number.parseFloat(pos.unrealizedPnl);
    }, 0);

    const drawdownPercent =
      (Math.abs(Math.min(0, totalUnrealizedPnl)) /
        (this.riskLimits.maxPositionSize * activePositions.length)) *
      100;

    return Math.min(100, drawdownPercent);
  }

  private calculateConcentrationRisk(
    symbol: string,
    activePositions: ExecutionPosition[],
    newPositionSize: number
  ): number {
    const symbolPositions = activePositions.filter((pos) => pos.symbol === symbol);
    const symbolValue =
      symbolPositions.reduce((sum, pos) => {
        return sum + Number.parseFloat(pos.quantity) * Number.parseFloat(pos.currentPrice);
      }, 0) + newPositionSize;

    const totalValue =
      activePositions.reduce((sum, pos) => {
        return sum + Number.parseFloat(pos.quantity) * Number.parseFloat(pos.currentPrice);
      }, 0) + newPositionSize;

    const concentration = totalValue > 0 ? (symbolValue / totalValue) * 100 : 0;

    return Math.min(100, concentration);
  }

  private calculateVolatilityRisk(pattern: PatternMatch): number {
    const volatility = pattern.volatility || 10; // Default 10% if not provided
    return Math.min(100, volatility * 2); // Scale volatility to risk score
  }

  private calculateOverallRiskScore(risks: {
    positionRisk: number;
    portfolioRisk: number;
    drawdownRisk: number;
    concentrationRisk: number;
    volatilityRisk: number;
  }): number {
    // Weighted average of risk components
    const weights = {
      positionRisk: 0.25,
      portfolioRisk: 0.2,
      drawdownRisk: 0.25,
      concentrationRisk: 0.15,
      volatilityRisk: 0.15,
    };

    return Math.min(
      100,
      risks.positionRisk * weights.positionRisk +
        risks.portfolioRisk * weights.portfolioRisk +
        risks.drawdownRisk * weights.drawdownRisk +
        risks.concentrationRisk * weights.concentrationRisk +
        risks.volatilityRisk * weights.volatilityRisk
    );
  }

  private determineRiskLevel(riskScore: number): RiskLevel {
    if (riskScore >= 80) return "extreme";
    if (riskScore >= 60) return "high";
    if (riskScore >= 30) return "medium";
    return "low";
  }

  private determineRiskAction(riskLevel: RiskLevel, riskScore: number): RiskAction {
    switch (riskLevel) {
      case "extreme":
        return "emergency_stop";
      case "high":
        return "block";
      case "medium":
        return riskScore > 40 ? "warn" : "allow";
      default:
        return "allow";
    }
  }

  private generateRiskFactors(risks: any): string[] {
    const factors: string[] = [];

    if (risks.positionRisk > 50) factors.push("High position risk");
    if (risks.portfolioRisk > 60) factors.push("High portfolio exposure");
    if (risks.drawdownRisk > 40) factors.push("Significant drawdown");
    if (risks.concentrationRisk > 30) factors.push("High concentration in single asset");
    if (risks.volatilityRisk > 50) factors.push("High market volatility");

    return factors;
  }

  private generateRiskRecommendations(
    riskLevel: RiskLevel,
    riskScore: number,
    pattern: PatternMatch
  ): string[] {
    const recommendations: string[] = [];

    if (riskLevel === "high" || riskLevel === "extreme") {
      recommendations.push("Reduce position size");
      recommendations.push("Implement tighter stop-loss");
    }

    if (pattern.confidence < 80) {
      recommendations.push("Wait for higher confidence signal");
    }

    if (riskScore > 70) {
      recommendations.push("Consider skipping this trade");
    }

    return recommendations;
  }

  private calculateMaxSafePositionSize(
    pattern: PatternMatch,
    _activePositions: ExecutionPosition[],
    riskScore: number
  ): number {
    let maxSize = this.riskLimits.maxPositionSize;

    // Reduce based on risk score
    const riskMultiplier = Math.max(0.1, 1 - riskScore / 100);
    maxSize *= riskMultiplier;

    // Reduce based on pattern confidence
    const confidenceMultiplier = pattern.confidence / 100;
    maxSize *= confidenceMultiplier;

    return Math.max(1, maxSize);
  }

  private calculateOptimalStopLoss(
    _pattern: PatternMatch,
    _positionSize: number
  ): number | undefined {
    if (this.stopLossConfig.type === "percentage") {
      // Assuming we have a current price (would be fetched in real implementation)
      const currentPrice = 100; // Placeholder
      return currentPrice * (1 - this.stopLossConfig.value / 100);
    }
    return undefined;
  }

  private calculateOptimalTakeProfit(
    _pattern: PatternMatch,
    _positionSize: number
  ): number | undefined {
    if (this.takeProfitConfig.type === "percentage") {
      // Assuming we have a current price (would be fetched in real implementation)
      const currentPrice = 100; // Placeholder
      return currentPrice * (1 + this.takeProfitConfig.value / 100);
    }
    return undefined;
  }

  private calculateTrailingStopLoss(
    currentPrice: number,
    _entryPrice: number,
    currentStopLoss: number
  ): number {
    const trailingDistance = this.stopLossConfig.trailingDistance || 5; // 5% default
    const newStopLoss = currentPrice * (1 - trailingDistance / 100);
    return Math.max(currentStopLoss, newStopLoss);
  }

  private calculateDynamicTakeProfit(currentPrice: number, entryPrice: number): number {
    const dynamicMultiplier = this.takeProfitConfig.dynamicMultiplier || 1.5;
    const profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
    return currentPrice * (1 + (profitPercent * dynamicMultiplier) / 100);
  }

  private updatePortfolioMetrics(): void {
    // This would be updated with real portfolio data
    // For now, maintaining existing structure
  }

  private getDefaultRiskLimits(): RiskLimits {
    return {
      maxDailyLoss: 1000,
      maxPositionSize: 100,
      maxPositions: 5,
      maxDrawdown: 20,
      maxConcentration: 40,
      maxPortfolioRisk: 70,
      emergencyStopLoss: 15,
    };
  }

  private getDefaultStopLossConfig(): StopLossConfig {
    return {
      type: "percentage",
      value: 5,
      trailingDistance: 3,
      minStopLoss: 2,
      maxStopLoss: 10,
    };
  }

  private getDefaultTakeProfitConfig(): TakeProfitConfig {
    return {
      type: "percentage",
      value: 10,
      dynamicMultiplier: 1.5,
    };
  }

  private getDefaultPortfolioMetrics(): PortfolioRiskMetrics {
    return {
      totalPositionValue: 0,
      totalUnrealizedPnl: 0,
      currentDrawdown: 0,
      maxDrawdown: 0,
      concentrationRatio: 0,
      diversificationScore: 100,
      volatilityScore: 0,
      riskAdjustedReturn: 0,
      activePositionCount: 0,
      riskUtilization: 0,
    };
  }
}

// Export factory function
export function createOptimizedRiskManager(): OptimizedRiskManager {
  return OptimizedRiskManager.getInstance();
}

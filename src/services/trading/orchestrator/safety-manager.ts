/**
 * Safety Manager Module
 *
 * Handles safety checks and risk management for auto-sniping operations.
 * Extracted from the original monolithic implementation for better maintainability.
 */

import { toSafeError } from "../../../lib/error-type-utils";
import type {
  ModuleContext,
  ModuleState,
  RiskAssessment,
  SafetyCheck,
  ServiceResponse,
  SnipeTarget,
} from "./types";

export class SafetyManager {
  private context: ModuleContext;
  private state: ModuleState;

  // Safety tracking
  private safetyViolations = 0;
  private emergencyStops = 0;
  private lastSafetyCheck: Date | null = null;
  private currentRiskScore = 0;

  // Risk thresholds
  private readonly RISK_THRESHOLDS = {
    low: 30,
    medium: 60,
    high: 85,
    critical: 95,
  };

  // Safety limits
  private readonly SAFETY_LIMITS = {
    maxDailyLoss: 1000, // $1000
    maxPositionSize: 0.2, // 20% of portfolio
    maxDrawdownPercent: 25, // 25%
    maxConcurrentPositions: 5,
    minAccountBalance: 100, // $100
  };

  constructor(context: ModuleContext) {
    this.context = context;
    this.state = {
      isInitialized: false,
      isHealthy: true,
      lastActivity: new Date(),
      metrics: {
        safetyViolations: 0,
        emergencyStops: 0,
        lastSafetyCheck: "",
        currentRiskScore: 0,
        safetyChecksPerformed: 0,
      },
    };
  }

  /**
   * Initialize the safety manager module
   */
  async initialize(): Promise<void> {
    this.context.logger.info("Initializing Safety Manager Module");

    // Perform initial safety check
    await this.performSafetyCheck();

    this.state.isInitialized = true;
    this.state.lastActivity = new Date();
    this.context.logger.info("Safety Manager Module initialized successfully", {
      initialRiskScore: this.currentRiskScore,
    });
  }

  /**
   * Shutdown the safety manager module
   */
  async shutdown(): Promise<void> {
    this.context.logger.info("Shutting down Safety Manager Module");
    this.state.isInitialized = false;
  }

  /**
   * Update configuration
   */
  async updateConfig(newContext: ModuleContext): Promise<void> {
    this.context = newContext;
    this.context.logger.info("Safety Manager Module configuration updated");
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<"operational" | "degraded" | "offline"> {
    if (!this.state.isInitialized) return "offline";
    if (
      !this.state.isHealthy ||
      this.currentRiskScore > this.RISK_THRESHOLDS.high
    )
      return "degraded";
    return "operational";
  }

  /**
   * Perform comprehensive safety check
   */
  async performSafetyCheck(): Promise<ServiceResponse<SafetyCheck[]>> {
    try {
      this.context.logger.debug("Performing safety check");

      const checks: SafetyCheck[] = [];
      let overallSafe = true;

      // Check 1: Account balance
      const balanceCheck = await this.checkAccountBalance();
      checks.push(balanceCheck);
      if (!balanceCheck.passed) overallSafe = false;

      // Check 2: Position limits
      const positionCheck = await this.checkPositionLimits();
      checks.push(positionCheck);
      if (!positionCheck.passed) overallSafe = false;

      // Check 3: Risk exposure
      const riskCheck = await this.checkRiskExposure();
      checks.push(riskCheck);
      if (!riskCheck.passed) overallSafe = false;

      // Check 4: Drawdown limits
      const drawdownCheck = await this.checkDrawdownLimits();
      checks.push(drawdownCheck);
      if (!drawdownCheck.passed) overallSafe = false;

      // Check 5: Market conditions
      const marketCheck = await this.checkMarketConditions();
      checks.push(marketCheck);
      if (!marketCheck.passed) overallSafe = false;

      // Update risk score
      this.currentRiskScore = this.calculateRiskScore(checks);
      this.lastSafetyCheck = new Date();

      // Update metrics
      const currentChecks =
        (this.state.metrics.safetyChecksPerformed as number) || 0;
      this.state.metrics.safetyChecksPerformed = currentChecks + 1;
      this.state.metrics.lastSafetyCheck = this.lastSafetyCheck.toISOString();
      this.state.metrics.currentRiskScore = this.currentRiskScore;

      // Handle critical issues
      const criticalChecks = checks.filter(
        (check) => !check.passed && check.severity === "critical"
      );
      if (criticalChecks.length > 0) {
        this.handleCriticalSafetyViolation(criticalChecks);
      }

      this.state.lastActivity = new Date();

      this.context.logger.info("Safety check completed", {
        overallSafe,
        riskScore: this.currentRiskScore,
        checksPerformed: checks.length,
        criticalIssues: criticalChecks.length,
      });

      return {
        success: overallSafe,
        data: checks,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error(`Safety check failed: ${safeError.message}`);

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Validate a snipe target for safety
   */
  async validateTarget(target: SnipeTarget): Promise<ServiceResponse<void>> {
    try {
      this.context.logger.debug("Validating target safety", { target });

      const issues: string[] = [];

      // Check position size
      if (
        target.positionSizeUsdt >
        this.SAFETY_LIMITS.maxPositionSize * 10000
      ) {
        // Assuming $10k portfolio
        issues.push(
          `Position size too large: ${target.positionSizeUsdt} > ${this.SAFETY_LIMITS.maxPositionSize * 10000}`
        );
      }

      // Check confidence score
      if (target.confidenceScore < this.context.config.confidenceThreshold) {
        issues.push(
          `Confidence score too low: ${target.confidenceScore} < ${this.context.config.confidenceThreshold}`
        );
      }

      // Check if symbol is blacklisted (simulated)
      const blacklistedSymbols = ["SCAMCOIN", "RUGPULL", "HONEYPOT"];
      if (
        blacklistedSymbols.some((symbol) => target.symbolName.includes(symbol))
      ) {
        issues.push(`Symbol is blacklisted: ${target.symbolName}`);
      }

      // Check market volatility
      const volatility = await this.getSymbolVolatility(target.symbolName);
      if (volatility > 0.5) {
        // 50% volatility
        issues.push(`Symbol too volatile: ${(volatility * 100).toFixed(1)}%`);
      }

      // Check if we're already at position limits
      const currentPositions = await this.getCurrentPositionCount();
      if (currentPositions >= this.context.config.maxConcurrentPositions) {
        issues.push(
          `Maximum concurrent positions reached: ${currentPositions}/${this.context.config.maxConcurrentPositions}`
        );
      }

      const isValid = issues.length === 0;

      if (!isValid) {
        this.safetyViolations++;
        this.state.metrics.safetyViolations = this.safetyViolations;

        this.context.eventEmitter.emit("safety_violation", {
          target,
          issues,
          severity: "warning",
        });
      }

      this.context.logger.debug("Target validation completed", {
        targetSymbol: target.symbolName,
        isValid,
        issues: issues.length,
      });

      return {
        success: isValid,
        error: isValid ? undefined : issues.join("; "),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error(
        `Target validation failed for ${target.symbolName}: ${safeError.message}`
      );

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check if it's safe to operate
   */
  async isSafeToOperate(): Promise<boolean> {
    if (!this.state.isInitialized) return false;
    if (!this.state.isHealthy) return false;
    if (this.currentRiskScore > this.RISK_THRESHOLDS.critical) return false;

    // Check if recent safety check passed
    if (this.lastSafetyCheck) {
      const timeSinceCheck = Date.now() - this.lastSafetyCheck.getTime();
      if (timeSinceCheck > 300000) {
        // 5 minutes
        const safetyResult = await this.performSafetyCheck();
        return safetyResult.success;
      }
    }

    return this.currentRiskScore <= this.RISK_THRESHOLDS.high;
  }

  /**
   * Get current risk assessment
   */
  async getRiskAssessment(): Promise<RiskAssessment> {
    const factors = {
      positionCount: await this.getCurrentPositionCount(),
      portfolioExposure: await this.getPortfolioExposure(),
      volatility: await this.getMarketVolatility(),
      marketConditions: await this.getMarketConditionsString(),
    };

    let overallRisk: "low" | "medium" | "high" | "critical" = "low";
    if (this.currentRiskScore > this.RISK_THRESHOLDS.critical) {
      overallRisk = "critical";
    } else if (this.currentRiskScore > this.RISK_THRESHOLDS.high) {
      overallRisk = "high";
    } else if (this.currentRiskScore > this.RISK_THRESHOLDS.medium) {
      overallRisk = "medium";
    }

    const recommendations: string[] = [];
    if (overallRisk === "critical") {
      recommendations.push("STOP ALL TRADING IMMEDIATELY");
      recommendations.push("Review risk management settings");
    } else if (overallRisk === "high") {
      recommendations.push("Reduce position sizes");
      recommendations.push("Close some positions");
      recommendations.push("Increase stop-loss levels");
    } else if (overallRisk === "medium") {
      recommendations.push("Monitor positions closely");
      recommendations.push("Consider tightening risk controls");
    } else {
      recommendations.push("Continue normal operations");
    }

    return {
      overallRisk,
      factors,
      recommendations,
    };
  }

  /**
   * Get safety metrics
   */
  async getSafetyViolationsCount(): Promise<number> {
    return this.safetyViolations;
  }

  async getEmergencyStopsCount(): Promise<number> {
    return this.emergencyStops;
  }

  async getLastSafetyCheckTime(): Promise<string> {
    return this.lastSafetyCheck?.toISOString() || "";
  }

  async getCurrentRiskScore(): Promise<number> {
    return this.currentRiskScore;
  }

  getMetrics() {
    return {
      ...this.state.metrics,
      isOperational: this.currentRiskScore <= this.RISK_THRESHOLDS.high,
      riskLevel: this.getRiskLevel(this.currentRiskScore),
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Check account balance safety
   */
  private async checkAccountBalance(): Promise<SafetyCheck> {
    try {
      // Simulate account balance check
      const balance = 5000 + Math.random() * 10000; // $5k-$15k

      const passed = balance >= this.SAFETY_LIMITS.minAccountBalance;

      return {
        checkType: "account_balance",
        passed,
        message: passed
          ? `Account balance sufficient: $${balance.toFixed(2)}`
          : `Account balance too low: $${balance.toFixed(2)} < $${this.SAFETY_LIMITS.minAccountBalance}`,
        severity: passed ? "info" : "critical",
        timestamp: new Date().toISOString(),
      };
    } catch (_error) {
      return {
        checkType: "account_balance",
        passed: false,
        message: "Failed to check account balance",
        severity: "error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check position limits
   */
  private async checkPositionLimits(): Promise<SafetyCheck> {
    try {
      const currentPositions = await this.getCurrentPositionCount();
      const maxPositions = this.context.config.maxConcurrentPositions;

      const passed = currentPositions < maxPositions;

      return {
        checkType: "position_limits",
        passed,
        message: passed
          ? `Position count within limits: ${currentPositions}/${maxPositions}`
          : `Too many positions: ${currentPositions}/${maxPositions}`,
        severity: passed ? "info" : "warning",
        timestamp: new Date().toISOString(),
      };
    } catch (_error) {
      return {
        checkType: "position_limits",
        passed: false,
        message: "Failed to check position limits",
        severity: "error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check risk exposure
   */
  private async checkRiskExposure(): Promise<SafetyCheck> {
    try {
      const exposure = await this.getPortfolioExposure();
      const maxExposure = this.SAFETY_LIMITS.maxPositionSize;

      const passed = exposure <= maxExposure;

      return {
        checkType: "risk_exposure",
        passed,
        message: passed
          ? `Risk exposure acceptable: ${(exposure * 100).toFixed(1)}%`
          : `Risk exposure too high: ${(exposure * 100).toFixed(1)}% > ${(maxExposure * 100).toFixed(1)}%`,
        severity: passed ? "info" : "critical",
        timestamp: new Date().toISOString(),
      };
    } catch (_error) {
      return {
        checkType: "risk_exposure",
        passed: false,
        message: "Failed to check risk exposure",
        severity: "error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check drawdown limits
   */
  private async checkDrawdownLimits(): Promise<SafetyCheck> {
    try {
      // Simulate drawdown calculation
      const currentDrawdown = Math.random() * 30; // 0-30%
      const maxDrawdown = this.SAFETY_LIMITS.maxDrawdownPercent;

      const passed = currentDrawdown <= maxDrawdown;

      return {
        checkType: "drawdown_limits",
        passed,
        message: passed
          ? `Drawdown within limits: ${currentDrawdown.toFixed(1)}%`
          : `Drawdown exceeded: ${currentDrawdown.toFixed(1)}% > ${maxDrawdown}%`,
        severity: passed ? "info" : "critical",
        timestamp: new Date().toISOString(),
      };
    } catch (_error) {
      return {
        checkType: "drawdown_limits",
        passed: false,
        message: "Failed to check drawdown limits",
        severity: "error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check market conditions
   */
  private async checkMarketConditions(): Promise<SafetyCheck> {
    try {
      // Simulate market conditions check
      const volatility = Math.random(); // 0-100%
      const liquidityScore = 50 + Math.random() * 50; // 50-100

      const highVolatility = volatility > 0.5;
      const lowLiquidity = liquidityScore < 60;

      const passed = !highVolatility && !lowLiquidity;

      let message = "Market conditions favorable";
      if (highVolatility && lowLiquidity) {
        message = "High volatility and low liquidity detected";
      } else if (highVolatility) {
        message = "High market volatility detected";
      } else if (lowLiquidity) {
        message = "Low market liquidity detected";
      }

      return {
        checkType: "market_conditions",
        passed,
        message,
        severity: passed ? "info" : "warning",
        timestamp: new Date().toISOString(),
      };
    } catch (_error) {
      return {
        checkType: "market_conditions",
        passed: false,
        message: "Failed to check market conditions",
        severity: "error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Calculate overall risk score from safety checks
   */
  private calculateRiskScore(checks: SafetyCheck[]): number {
    let score = 0;
    let weight = 0;

    checks.forEach((check) => {
      let checkWeight = 1;
      let checkScore = check.passed ? 0 : 100;

      // Adjust weight and score based on severity
      switch (check.severity) {
        case "critical":
          checkWeight = 3;
          checkScore = check.passed ? 0 : 100;
          break;
        case "error":
          checkWeight = 2;
          checkScore = check.passed ? 0 : 80;
          break;
        case "warning":
          checkWeight = 1.5;
          checkScore = check.passed ? 0 : 60;
          break;
        case "info":
          checkWeight = 1;
          checkScore = check.passed ? 0 : 20;
          break;
      }

      score += checkScore * checkWeight;
      weight += checkWeight;
    });

    return weight > 0 ? Math.min(100, score / weight) : 0;
  }

  /**
   * Handle critical safety violations
   */
  private handleCriticalSafetyViolation(criticalChecks: SafetyCheck[]): void {
    this.emergencyStops++;
    this.state.metrics.emergencyStops = this.emergencyStops;

    const reason = criticalChecks.map((check) => check.message).join("; ");

    this.context.logger.error(
      "Critical safety violation - triggering emergency stop",
      {
        criticalChecks: criticalChecks.length,
        reason,
      }
    );

    this.context.eventEmitter.emit("emergency_stop", reason);
  }

  /**
   * Get current position count (simulated)
   */
  private async getCurrentPositionCount(): Promise<number> {
    return Math.floor(Math.random() * 5); // 0-4 positions
  }

  /**
   * Get portfolio exposure (simulated)
   */
  private async getPortfolioExposure(): Promise<number> {
    return Math.random() * 0.3; // 0-30% exposure
  }

  /**
   * Get market volatility (simulated)
   */
  private async getMarketVolatility(): Promise<number> {
    return Math.random() * 0.5; // 0-50% volatility
  }

  /**
   * Get symbol volatility (simulated)
   */
  private async getSymbolVolatility(_symbol: string): Promise<number> {
    return Math.random() * 0.6; // 0-60% volatility
  }

  /**
   * Get market conditions string
   */
  private async getMarketConditionsString(): Promise<string> {
    const conditions = ["bullish", "bearish", "sideways", "volatile"];
    return conditions[Math.floor(Math.random() * conditions.length)];
  }

  /**
   * Get risk level from score
   */
  private getRiskLevel(score: number): string {
    if (score <= this.RISK_THRESHOLDS.low) return "low";
    if (score <= this.RISK_THRESHOLDS.medium) return "medium";
    if (score <= this.RISK_THRESHOLDS.high) return "high";
    return "critical";
  }

  /**
   * Emergency stop - halt all safety operations
   */
  async emergencyStop(): Promise<ServiceResponse<boolean>> {
    try {
      this.context.logger.warn("EMERGENCY: Stopping safety manager");

      // Mark as not healthy
      this.state.isHealthy = false;

      // Increment emergency stops counter
      this.emergencyStops++;
      this.state.metrics.emergencyStops = this.emergencyStops;

      // Clear last safety check
      this.lastSafetyCheck = null;

      this.context.logger.warn("Safety manager emergency stopped");

      return {
        success: true,
        data: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

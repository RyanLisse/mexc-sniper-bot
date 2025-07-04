/**
 * Enhanced Risk Manager - Refactored
 *
 * Lightweight orchestrator that coordinates specialized risk management modules.
 * Replaces the original monolithic implementation with focused, maintainable modules.
 */

import { BrowserCompatibleEventEmitter } from "@/src/lib/browser-compatible-events";
import { toSafeError } from "@/src/lib/error-type-utils";
import {
  PortfolioRiskMonitor,
  type RiskAlert,
  type RiskMetrics,
} from "./modules/portfolio-risk-monitor";

// Import specialized modules
import {
  type RiskLimits,
  type RiskValidationResult,
  RiskValidator,
} from "./modules/risk-validator";
import type { ModuleContext, ServiceResponse, TradeParameters } from "./types";

/**
 * Enhanced Risk Manager - Refactored Implementation
 *
 * Coordinates risk validation, portfolio monitoring, and emergency management
 * through specialized modules for improved maintainability and testability.
 */
export class EnhancedRiskManagerRefactored extends BrowserCompatibleEventEmitter {
  private context: ModuleContext;
  private riskLimits: RiskLimits;

  // Specialized modules
  private riskValidator: RiskValidator;
  private portfolioMonitor: PortfolioRiskMonitor;

  // State
  private isInitialized = false;
  private emergencyStopActive = false;

  constructor(context: ModuleContext, riskLimits: RiskLimits) {
    super();
    this.context = context;
    this.riskLimits = riskLimits;

    // Initialize modules
    this.riskValidator = new RiskValidator(context, riskLimits);
    this.portfolioMonitor = new PortfolioRiskMonitor(context, riskLimits);

    // Set up event forwarding
    this.setupEventForwarding();
  }

  async initialize(): Promise<ServiceResponse<void>> {
    try {
      if (this.isInitialized) {
        return {
          success: true,
          data: undefined,
          timestamp: new Date().toISOString(),
        };
      }

      // Initialize modules
      await this.portfolioMonitor.initialize();

      this.isInitialized = true;
      this.emit("initialized");

      this.context.logger.info("Enhanced Risk Manager initialized");

      return {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = toSafeError(error).message;
      this.context.logger.error("Risk manager initialization failed", {
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async shutdown(): Promise<ServiceResponse<void>> {
    try {
      if (!this.isInitialized) {
        return {
          success: true,
          data: undefined,
          timestamp: new Date().toISOString(),
        };
      }

      // Shutdown modules
      await this.portfolioMonitor.shutdown();

      this.isInitialized = false;
      this.emit("shutdown");

      this.context.logger.info("Enhanced Risk Manager shutdown");

      return {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = toSafeError(error).message;
      this.context.logger.error("Risk manager shutdown failed", {
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Main risk validation method
  async validateTradeRisk(
    params: TradeParameters
  ): Promise<RiskValidationResult> {
    try {
      if (!this.isInitialized) {
        throw new Error("Risk manager not initialized");
      }

      if (this.emergencyStopActive) {
        return {
          passed: false,
          riskScore: 100,
          warnings: [],
          errors: ["Emergency stop is active - all trading disabled"],
          checks: {
            portfolioRisk: {
              passed: false,
              critical: true,
              score: 100,
              message: "Emergency stop active",
              warnings: [],
            },
            concentrationRisk: {
              passed: false,
              critical: true,
              score: 100,
              message: "Emergency stop active",
              warnings: [],
            },
            correlationRisk: {
              passed: false,
              critical: true,
              score: 100,
              message: "Emergency stop active",
              warnings: [],
            },
            dailyLossLimit: {
              passed: false,
              critical: true,
              score: 100,
              message: "Emergency stop active",
              warnings: [],
            },
            marketConditions: {
              passed: false,
              critical: true,
              score: 100,
              message: "Emergency stop active",
              warnings: [],
            },
            accountBalance: {
              passed: false,
              critical: true,
              score: 100,
              message: "Emergency stop active",
              warnings: [],
            },
          },
        };
      }

      // Delegate to risk validator
      const result = await this.riskValidator.validateTradeRisk(params);

      // Log validation result
      this.context.logger.info("Trade risk validation completed", {
        symbol: params.symbol,
        passed: result.passed,
        riskScore: result.riskScore,
        warnings: result.warnings.length,
        errors: result.errors.length,
      });

      // Emit validation event
      this.emit("tradeRiskValidated", {
        params,
        result,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      const errorMessage = toSafeError(error).message;
      this.context.logger.error("Trade risk validation failed", {
        params,
        error: errorMessage,
      });

      return {
        passed: false,
        riskScore: 100,
        warnings: [],
        errors: [`Risk validation failed: ${errorMessage}`],
        checks: {
          portfolioRisk: {
            passed: false,
            critical: true,
            score: 100,
            message: "Validation failed",
            warnings: [],
          },
          concentrationRisk: {
            passed: false,
            critical: true,
            score: 100,
            message: "Validation failed",
            warnings: [],
          },
          correlationRisk: {
            passed: false,
            critical: true,
            score: 100,
            message: "Validation failed",
            warnings: [],
          },
          dailyLossLimit: {
            passed: false,
            critical: true,
            score: 100,
            message: "Validation failed",
            warnings: [],
          },
          marketConditions: {
            passed: false,
            critical: true,
            score: 100,
            message: "Validation failed",
            warnings: [],
          },
          accountBalance: {
            passed: false,
            critical: true,
            score: 100,
            message: "Validation failed",
            warnings: [],
          },
        },
      };
    }
  }

  // Portfolio monitoring methods
  async monitorPortfolioRisk(): Promise<ServiceResponse<RiskMetrics>> {
    try {
      if (!this.isInitialized) {
        throw new Error("Risk manager not initialized");
      }

      return await this.portfolioMonitor.monitorPortfolioRisk();
    } catch (error) {
      const errorMessage = toSafeError(error).message;
      this.context.logger.error("Portfolio risk monitoring failed", {
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getCurrentRiskMetrics(): Promise<RiskMetrics> {
    try {
      if (!this.isInitialized) {
        throw new Error("Risk manager not initialized");
      }

      return await this.portfolioMonitor.getCurrentRiskMetrics();
    } catch (error) {
      const errorMessage = toSafeError(error).message;
      this.context.logger.error("Failed to get current risk metrics", {
        error: errorMessage,
      });

      // Return safe defaults
      return {
        currentPortfolioRisk: 0,
        currentDrawdown: 0,
        dailyPnL: 0,
        activePositionsRisk: 0,
        correlationRisk: 0,
        liquidityRisk: 0,
        concentrationRisk: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Emergency management methods
  async checkEmergencyStop(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        return false;
      }

      const shouldStop = await this.portfolioMonitor.checkEmergencyConditions();

      if (shouldStop && !this.emergencyStopActive) {
        await this.activateEmergencyStop();
      }

      return shouldStop;
    } catch (error) {
      this.context.logger.error("Emergency stop check failed", { error });
      return false;
    }
  }

  async activateEmergencyStop(): Promise<ServiceResponse<void>> {
    try {
      if (this.emergencyStopActive) {
        return {
          success: true,
          data: undefined,
          timestamp: new Date().toISOString(),
        };
      }

      this.emergencyStopActive = true;

      // Emit emergency stop event
      this.emit("emergencyStopActivated", {
        timestamp: new Date().toISOString(),
        reason: "Risk limits exceeded",
      });

      this.context.logger.error("Emergency stop activated");

      return {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = toSafeError(error).message;
      this.context.logger.error("Failed to activate emergency stop", {
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async deactivateEmergencyStop(): Promise<ServiceResponse<void>> {
    try {
      if (!this.emergencyStopActive) {
        return {
          success: true,
          data: undefined,
          timestamp: new Date().toISOString(),
        };
      }

      this.emergencyStopActive = false;

      // Emit emergency stop deactivation event
      this.emit("emergencyStopDeactivated", {
        timestamp: new Date().toISOString(),
      });

      this.context.logger.info("Emergency stop deactivated");

      return {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = toSafeError(error).message;
      this.context.logger.error("Failed to deactivate emergency stop", {
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Alert management methods
  getActiveAlerts(): RiskAlert[] {
    return this.portfolioMonitor.getActiveAlerts();
  }

  acknowledgeAlert(alertId: string): boolean {
    return this.portfolioMonitor.acknowledgeAlert(alertId);
  }

  clearAlert(alertId: string): boolean {
    return this.portfolioMonitor.clearAlert(alertId);
  }

  // Risk metrics history
  getRiskMetricsHistory(): RiskMetrics[] {
    return this.portfolioMonitor.getRiskMetricsHistory();
  }

  // Configuration methods
  updateRiskLimits(newLimits: Partial<RiskLimits>): void {
    this.riskLimits = { ...this.riskLimits, ...newLimits };
    this.emit("riskLimitsUpdated", this.riskLimits);
  }

  getRiskLimits(): RiskLimits {
    return { ...this.riskLimits };
  }

  // Status methods
  get initialized(): boolean {
    return this.isInitialized;
  }

  get emergencyStopStatus(): boolean {
    return this.emergencyStopActive;
  }

  get isMonitoring(): boolean {
    return this.portfolioMonitor.isMonitoringActive;
  }

  async getStatus(): Promise<{
    initialized: boolean;
    emergencyStopActive: boolean;
    isMonitoring: boolean;
    activeAlerts: number;
    riskLimits: RiskLimits;
    timestamp: string;
  }> {
    return {
      initialized: this.isInitialized,
      emergencyStopActive: this.emergencyStopActive,
      isMonitoring: this.portfolioMonitor.isMonitoringActive,
      activeAlerts: this.portfolioMonitor.getActiveAlerts().length,
      riskLimits: this.riskLimits,
      timestamp: new Date().toISOString(),
    };
  }

  // Event forwarding setup
  private setupEventForwarding(): void {
    // Forward events from portfolio monitor
    this.portfolioMonitor.on("riskMetricsUpdated", (metrics) => {
      this.emit("riskMetricsUpdated", metrics);
    });

    this.portfolioMonitor.on("emergencyAlert", (alert) => {
      this.emit("emergencyAlert", alert);
    });

    this.portfolioMonitor.on("criticalAlert", (alert) => {
      this.emit("criticalAlert", alert);
    });

    this.portfolioMonitor.on("warningAlert", (alert) => {
      this.emit("warningAlert", alert);
    });

    this.portfolioMonitor.on("alertCleared", (data) => {
      this.emit("alertCleared", data);
    });

    this.portfolioMonitor.on("alertAcknowledged", (alert) => {
      this.emit("alertAcknowledged", alert);
    });
  }

  // Utility methods
  async healthCheck(): Promise<boolean> {
    try {
      const status = await this.getStatus();
      return status.initialized && status.isMonitoring;
    } catch {
      return false;
    }
  }

  async generateRiskReport(): Promise<any> {
    try {
      const [status, metrics, alerts, history] = await Promise.all([
        this.getStatus(),
        this.getCurrentRiskMetrics(),
        this.getActiveAlerts(),
        this.getRiskMetricsHistory(),
      ]);

      return {
        timestamp: new Date().toISOString(),
        reportType: "risk-report",
        status,
        currentMetrics: metrics,
        activeAlerts: alerts,
        historicalMetrics: history.slice(-10), // Last 10 metrics
        riskLimits: this.riskLimits,
        recommendations: this.generateRecommendations(metrics, alerts),
      };
    } catch (error) {
      throw new Error(
        `Failed to generate risk report: ${toSafeError(error).message}`
      );
    }
  }

  private generateRecommendations(
    metrics: RiskMetrics,
    alerts: RiskAlert[]
  ): string[] {
    const recommendations: string[] = [];

    if (metrics.currentPortfolioRisk > this.riskLimits.maxPortfolioRisk * 0.8) {
      recommendations.push(
        "Consider reducing position sizes to lower portfolio risk"
      );
    }

    if (
      metrics.concentrationRisk >
      this.riskLimits.maxSinglePositionRisk * 0.7
    ) {
      recommendations.push(
        "Portfolio is highly concentrated - consider diversification"
      );
    }

    if (metrics.correlationRisk > this.riskLimits.maxCorrelatedExposure * 0.8) {
      recommendations.push(
        "High correlation between positions - consider reducing correlated exposure"
      );
    }

    if (alerts.filter((a) => a.type === "CRITICAL").length > 0) {
      recommendations.push(
        "Critical alerts active - immediate attention required"
      );
    }

    if (metrics.liquidityRisk > 50) {
      recommendations.push(
        "High liquidity risk detected - consider more liquid assets"
      );
    }

    return recommendations;
  }

  // Cleanup
  async cleanup(): Promise<void> {
    await this.shutdown();
    this.removeAllListeners();
  }
}

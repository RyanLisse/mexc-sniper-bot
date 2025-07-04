/**
 * Portfolio Risk Monitor
 * Handles real-time portfolio risk monitoring and metrics calculation
 */

import { BrowserCompatibleEventEmitter } from "@/src/lib/browser-compatible-events";
import { toSafeError } from "@/src/lib/error-type-utils";
import type { ModuleContext, Position, ServiceResponse } from "../types";
import type { RiskLimits } from "./risk-validator";

export interface RiskMetrics {
  currentPortfolioRisk: number;
  currentDrawdown: number;
  dailyPnL: number;
  activePositionsRisk: number;
  correlationRisk: number;
  liquidityRisk: number;
  concentrationRisk: number;
  timestamp: string;
}

export interface RiskAlert {
  id: string;
  type: "WARNING" | "CRITICAL" | "EMERGENCY";
  message: string;
  metric: string;
  currentValue: number;
  threshold: number;
  timestamp: string;
  acknowledged: boolean;
}

export class PortfolioRiskMonitor extends BrowserCompatibleEventEmitter {
  private context: ModuleContext;
  private riskLimits: RiskLimits;
  private riskMetricsHistory: RiskMetrics[] = [];
  private activeAlerts: Map<string, RiskAlert> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  constructor(context: ModuleContext, riskLimits: RiskLimits) {
    super();
    this.context = context;
    this.riskLimits = riskLimits;
  }

  async initialize(): Promise<void> {
    await this.startMonitoring();
  }

  async shutdown(): Promise<void> {
    await this.stopMonitoring();
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.monitorPortfolioRisk();
        await this.checkEmergencyConditions();
      } catch (error) {
        this.context.logger.error("Risk monitoring error", { error });
      }
    }, 30000); // Monitor every 30 seconds

    this.context.logger.info("Portfolio risk monitoring started");
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.context.logger.info("Portfolio risk monitoring stopped");
  }

  async monitorPortfolioRisk(): Promise<ServiceResponse<RiskMetrics>> {
    try {
      const metrics = await this.calculateCurrentRiskMetrics();

      // Store metrics in history
      this.riskMetricsHistory.push(metrics);

      // Limit history size
      if (this.riskMetricsHistory.length > 100) {
        this.riskMetricsHistory = this.riskMetricsHistory.slice(-100);
      }

      // Check for alerts
      await this.checkRiskAlerts(metrics);

      // Emit metrics update
      this.emit("riskMetricsUpdated", metrics);

      return {
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
      };
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

  async checkEmergencyConditions(): Promise<boolean> {
    try {
      const metrics = await this.calculateCurrentRiskMetrics();
      const shouldStop = this.shouldTriggerEmergencyStop(metrics);

      if (shouldStop) {
        const alert: RiskAlert = {
          id: `emergency-${Date.now()}`,
          type: "EMERGENCY",
          message: "Emergency stop conditions met - immediate action required",
          metric: "multiple",
          currentValue: metrics.currentPortfolioRisk,
          threshold: this.riskLimits.maxPortfolioRisk,
          timestamp: new Date().toISOString(),
          acknowledged: false,
        };

        this.activeAlerts.set(alert.id, alert);
        this.emit("emergencyAlert", alert);

        this.context.logger.error("Emergency stop triggered", {
          metrics,
          alert,
        });
      }

      return shouldStop;
    } catch (error) {
      this.context.logger.error("Emergency condition check failed", { error });
      return false;
    }
  }

  private async calculateCurrentRiskMetrics(): Promise<RiskMetrics> {
    try {
      const positions = await this.getActivePositions();
      const portfolioValue = await this.getPortfolioValue();

      const [
        currentPortfolioRisk,
        currentDrawdown,
        dailyPnL,
        activePositionsRisk,
        correlationRisk,
        liquidityRisk,
        concentrationRisk,
      ] = await Promise.all([
        this.calculatePortfolioRisk(positions, portfolioValue),
        this.calculateCurrentDrawdown(positions),
        this.calculateDailyPnL(),
        this.calculateActivePositionsRisk(positions),
        this.calculateCorrelationRisk(positions),
        this.calculateLiquidityRisk(positions),
        this.calculateConcentrationRisk(positions, portfolioValue),
      ]);

      return {
        currentPortfolioRisk,
        currentDrawdown,
        dailyPnL,
        activePositionsRisk,
        correlationRisk,
        liquidityRisk,
        concentrationRisk,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(
        `Failed to calculate risk metrics: ${toSafeError(error).message}`
      );
    }
  }

  private shouldTriggerEmergencyStop(metrics: RiskMetrics): boolean {
    const emergencyConditions = [
      metrics.currentPortfolioRisk > this.riskLimits.maxPortfolioRisk * 1.5,
      metrics.currentDrawdown > this.riskLimits.maxDrawdown * 1.2,
      Math.abs(metrics.dailyPnL) > this.riskLimits.maxDailyLoss * 1.1,
      metrics.concentrationRisk > this.riskLimits.maxSinglePositionRisk * 1.5,
    ];

    return emergencyConditions.some((condition) => condition);
  }

  private async checkRiskAlerts(metrics: RiskMetrics): Promise<void> {
    const checks = [
      {
        metric: "portfolioRisk",
        current: metrics.currentPortfolioRisk,
        threshold: this.riskLimits.maxPortfolioRisk,
        warningThreshold: this.riskLimits.maxPortfolioRisk * 0.8,
        name: "Portfolio Risk",
      },
      {
        metric: "drawdown",
        current: metrics.currentDrawdown,
        threshold: this.riskLimits.maxDrawdown,
        warningThreshold: this.riskLimits.maxDrawdown * 0.8,
        name: "Drawdown",
      },
      {
        metric: "dailyPnL",
        current: Math.abs(metrics.dailyPnL),
        threshold: this.riskLimits.maxDailyLoss,
        warningThreshold: this.riskLimits.maxDailyLoss * 0.8,
        name: "Daily Loss",
      },
      {
        metric: "concentrationRisk",
        current: metrics.concentrationRisk,
        threshold: this.riskLimits.maxSinglePositionRisk,
        warningThreshold: this.riskLimits.maxSinglePositionRisk * 0.8,
        name: "Concentration Risk",
      },
    ];

    for (const check of checks) {
      const alertId = `${check.metric}-alert`;

      if (check.current > check.threshold) {
        // Critical alert
        const alert: RiskAlert = {
          id: alertId,
          type: "CRITICAL",
          message: `${check.name} exceeds critical threshold`,
          metric: check.metric,
          currentValue: check.current,
          threshold: check.threshold,
          timestamp: new Date().toISOString(),
          acknowledged: false,
        };

        this.activeAlerts.set(alertId, alert);
        this.emit("criticalAlert", alert);
      } else if (check.current > check.warningThreshold) {
        // Warning alert
        const alert: RiskAlert = {
          id: alertId,
          type: "WARNING",
          message: `${check.name} approaching threshold`,
          metric: check.metric,
          currentValue: check.current,
          threshold: check.warningThreshold,
          timestamp: new Date().toISOString(),
          acknowledged: false,
        };

        this.activeAlerts.set(alertId, alert);
        this.emit("warningAlert", alert);
      } else {
        // Clear alert if it exists
        if (this.activeAlerts.has(alertId)) {
          this.activeAlerts.delete(alertId);
          this.emit("alertCleared", { alertId, metric: check.metric });
        }
      }
    }
  }

  // Risk calculation methods
  private async calculatePortfolioRisk(
    positions: Position[],
    portfolioValue: number
  ): Promise<number> {
    if (positions.length === 0 || portfolioValue === 0) return 0;

    const totalRisk = positions.reduce((sum, position) => {
      const positionValue = position.entryPrice * position.quantity;
      const estimatedRisk = positionValue * 0.1; // Assume 10% max loss per position
      return sum + estimatedRisk;
    }, 0);

    return (totalRisk / portfolioValue) * 100;
  }

  private async calculateCurrentDrawdown(
    positions: Position[]
  ): Promise<number> {
    if (positions.length === 0) return 0;

    const currentPnL = positions.reduce((sum, position) => {
      const unrealizedPnL = this.calculateUnrealizedPnL(position);
      return sum + unrealizedPnL;
    }, 0);

    const portfolioValue = await this.getPortfolioValue();
    return portfolioValue > 0
      ? Math.abs(Math.min(0, currentPnL) / portfolioValue) * 100
      : 0;
  }

  private async calculateDailyPnL(): Promise<number> {
    try {
      const trades = await this.context.mexcService.getRecentTrades();
      const today = new Date().toDateString();

      return trades
        .filter((trade) => new Date(trade.timestamp).toDateString() === today)
        .reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    } catch (error) {
      this.context.logger.error("Failed to calculate daily PnL", { error });
      return 0;
    }
  }

  private async calculateActivePositionsRisk(
    positions: Position[]
  ): Promise<number> {
    if (positions.length === 0) return 0;

    const totalUnrealizedPnL = positions.reduce((sum, position) => {
      return sum + this.calculateUnrealizedPnL(position);
    }, 0);

    const portfolioValue = await this.getPortfolioValue();
    return portfolioValue > 0
      ? (Math.abs(totalUnrealizedPnL) / portfolioValue) * 100
      : 0;
  }

  private async calculateCorrelationRisk(
    positions: Position[]
  ): Promise<number> {
    if (positions.length === 0) return 0;

    // Simplified correlation calculation
    const symbolGroups = this.groupPositionsByCategory(positions);
    const maxGroupExposure = Math.max(...Object.values(symbolGroups));
    const portfolioValue = await this.getPortfolioValue();

    return portfolioValue > 0 ? (maxGroupExposure / portfolioValue) * 100 : 0;
  }

  private async calculateLiquidityRisk(positions: Position[]): Promise<number> {
    if (positions.length === 0) return 0;

    let totalLiquidityRisk = 0;
    for (const position of positions) {
      try {
        const orderBook = await this.context.mexcService.getOrderBook({
          symbol: position.symbol,
        });
        const liquidityScore = this.calculateLiquidityScore(orderBook);
        totalLiquidityRisk +=
          (1 - liquidityScore) * position.entryPrice * position.quantity;
      } catch (error) {
        // Assume high liquidity risk if can't get order book
        totalLiquidityRisk += position.entryPrice * position.quantity * 0.5;
      }
    }

    const portfolioValue = await this.getPortfolioValue();
    return portfolioValue > 0 ? (totalLiquidityRisk / portfolioValue) * 100 : 0;
  }

  private async calculateConcentrationRisk(
    positions: Position[],
    portfolioValue: number
  ): Promise<number> {
    if (positions.length === 0 || portfolioValue === 0) return 0;

    const symbolExposure = new Map<string, number>();

    positions.forEach((position) => {
      const exposure = position.entryPrice * position.quantity;
      symbolExposure.set(
        position.symbol,
        (symbolExposure.get(position.symbol) || 0) + exposure
      );
    });

    const maxExposure = Math.max(...Array.from(symbolExposure.values()));
    return (maxExposure / portfolioValue) * 100;
  }

  // Helper methods
  private calculateUnrealizedPnL(position: Position): number {
    // Simplified PnL calculation - would need current market price
    // For now, assume break-even
    return 0;
  }

  private groupPositionsByCategory(
    positions: Position[]
  ): Record<string, number> {
    const groups: Record<string, number> = {};

    positions.forEach((position) => {
      const category = position.symbol.includes("BTC")
        ? "Bitcoin"
        : position.symbol.includes("ETH")
          ? "Ethereum"
          : position.symbol.includes("USDT")
            ? "Stablecoin"
            : "Other";

      const exposure = position.entryPrice * position.quantity;
      groups[category] = (groups[category] || 0) + exposure;
    });

    return groups;
  }

  private calculateLiquidityScore(orderBook: any): number {
    if (!orderBook || !orderBook.bids || !orderBook.asks) return 0;

    const bidDepth = orderBook.bids.length;
    const askDepth = orderBook.asks.length;
    const avgDepth = (bidDepth + askDepth) / 2;

    return Math.min(1, avgDepth / 20); // Normalize to 0-1 scale
  }

  private async getActivePositions(): Promise<Position[]> {
    return Array.from(
      this.context.positionManager.getActivePositions().values()
    );
  }

  private async getPortfolioValue(): Promise<number> {
    try {
      const balance = await this.context.mexcService.getAccountBalance();
      return balance.totalBalance || 0;
    } catch (error) {
      this.context.logger.error("Failed to get portfolio value", { error });
      return 0;
    }
  }

  // Public methods
  getRiskMetricsHistory(): RiskMetrics[] {
    return [...this.riskMetricsHistory];
  }

  getActiveAlerts(): RiskAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit("alertAcknowledged", alert);
      return true;
    }
    return false;
  }

  clearAlert(alertId: string): boolean {
    const deleted = this.activeAlerts.delete(alertId);
    if (deleted) {
      this.emit("alertCleared", { alertId });
    }
    return deleted;
  }

  async getCurrentRiskMetrics(): Promise<RiskMetrics> {
    return this.calculateCurrentRiskMetrics();
  }

  get isMonitoringActive(): boolean {
    return this.isMonitoring;
  }
}

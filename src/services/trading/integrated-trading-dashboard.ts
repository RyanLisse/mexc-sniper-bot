/**
 * Integrated Trading Dashboard Service
 *
 * Unified interface for all trading operations, bringing together:
 * - Real-time portfolio tracking
 * - Risk management
 * - Stop-loss/take-profit automation
 * - Emergency safety systems
 * - Order execution
 */

import { EventEmitter } from "node:events";
import { getRecommendedMexcService } from "../api/mexc-unified-exports";
import { EmergencySafetySystem } from "../risk/emergency-safety-system";
import { enhancedRiskManagementService } from "../risk/enhanced-risk-management-service";
import { mexcTradingService } from "./mexc-trading-service";
import {
  type PortfolioSummary,
  portfolioTrackingService,
} from "./portfolio-tracking-service";
import {
  type PositionProtection,
  stopLossTakeProfitService,
} from "./stop-loss-take-profit-service";

export interface TradingDashboardState {
  portfolio: PortfolioSummary | null;
  protections: PositionProtection[];
  riskStatus: {
    healthy: boolean;
    riskLevel: "low" | "medium" | "high" | "extreme";
    activeAlerts: number;
  };
  emergencyStatus: {
    active: boolean;
    tradingHalted: boolean;
    systemHealth: "healthy" | "degraded" | "critical" | "emergency";
  };
  connectivity: {
    mexcConnected: boolean;
    lastCheck: string;
    latency?: number;
  };
  performance: {
    totalTrades: number;
    successRate: number;
    avgExecutionTime: number;
    totalPnl: number;
  };
  lastUpdated: string;
}

export interface TradeRequest {
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  quantity: string;
  price?: string;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  trailingStopPercent?: number;
}

export interface DashboardAlert {
  id: string;
  type: "portfolio" | "risk" | "emergency" | "trade" | "protection";
  level: "info" | "warning" | "error" | "critical";
  message: string;
  timestamp: string;
  userId: string;
  data?: any;
}

export class IntegratedTradingDashboard extends EventEmitter {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[trading-dashboard]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[trading-dashboard]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[trading-dashboard]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[trading-dashboard]", message, context || ""),
  };

  private mexcService = getRecommendedMexcService();
  private emergencySystem = new EmergencySafetySystem({
    autoResponseEnabled: true,
    priceDeviationThreshold: 10,
    emergencyHaltThreshold: 85,
  });

  private dashboardState = new Map<string, TradingDashboardState>();
  private alerts = new Map<string, DashboardAlert[]>(); // userId -> alerts
  private updateInterval?: NodeJS.Timeout;
  private isRunning = false;

  constructor() {
    super();
    this.setupEventListeners();
    this.logger.info("Integrated Trading Dashboard initialized");
  }

  /**
   * Setup event listeners for all trading services
   */
  private setupEventListeners(): void {
    // Portfolio updates
    portfolioTrackingService.on("portfolioUpdate", (data) => {
      this.handlePortfolioUpdate(data.userId, data.summary);
    });

    // Price alerts
    portfolioTrackingService.on("priceAlert", (alert) => {
      this.addAlert(alert.userId, {
        type: "portfolio",
        level: "warning",
        message: `Price alert triggered for ${alert.symbol}`,
        data: alert,
      });
    });

    // Protection alerts
    stopLossTakeProfitService.on("protectionAlert", (alert) => {
      const level = alert.type.includes("error") ? "error" : "info";
      this.addAlert(alert.userId, {
        type: "protection",
        level,
        message: alert.message,
        data: alert,
      });
    });

    // Emergency system alerts
    this.emergencySystem.on("emergency_stop", (data) => {
      this.handleEmergencyStop(data);
    });

    this.emergencySystem.on("circuit_breaker_activated", (data) => {
      this.handleCircuitBreakerActivation(data);
    });
  }

  /**
   * Start the dashboard for a user
   */
  async startDashboard(userId: string): Promise<TradingDashboardState> {
    this.logger.info("Starting trading dashboard", { userId });

    try {
      // Initialize services
      await this.initializeServices();

      // Get initial state
      const state = await this.buildDashboardState(userId);
      this.dashboardState.set(userId, state);

      // Start monitoring if not already running
      if (!this.isRunning) {
        this.startRealTimeUpdates();
      }

      // Start portfolio and protection monitoring
      portfolioTrackingService.startRealTimeMonitoring();
      stopLossTakeProfitService.startMonitoring();

      this.emit("dashboardStarted", { userId, state });
      return state;
    } catch (error) {
      this.logger.error("Failed to start dashboard:", error);
      throw error;
    }
  }

  /**
   * Stop the dashboard for a user
   */
  stopDashboard(userId: string): void {
    this.logger.info("Stopping trading dashboard", { userId });

    this.dashboardState.delete(userId);
    this.alerts.delete(userId);

    // If no users left, stop monitoring
    if (this.dashboardState.size === 0) {
      this.stopRealTimeUpdates();
      portfolioTrackingService.stopRealTimeMonitoring();
      stopLossTakeProfitService.stopMonitoring();
    }

    this.emit("dashboardStopped", { userId });
  }

  /**
   * Get current dashboard state for a user
   */
  getDashboardState(userId: string): TradingDashboardState | null {
    return this.dashboardState.get(userId) || null;
  }

  /**
   * Execute a trade with integrated risk management and protection setup
   */
  async executeTrade(
    userId: string,
    request: TradeRequest
  ): Promise<{
    success: boolean;
    orderId?: string;
    protectionId?: string;
    error?: string;
    riskAssessment?: any;
  }> {
    this.logger.info("Executing integrated trade", {
      userId,
      symbol: request.symbol,
      side: request.side,
      quantity: request.quantity,
    });

    try {
      // Pre-flight checks
      const emergencyStatus = this.emergencySystem.getEmergencyStatus();
      if (emergencyStatus.tradingHalted) {
        throw new Error(
          "Trading is currently halted due to emergency conditions"
        );
      }

      // Execute the trade
      const tradeResult = await mexcTradingService.executeTrade({
        userId,
        symbol: request.symbol,
        side: request.side,
        type: request.type,
        quantity: request.quantity,
        price: request.price,
      });

      if (!tradeResult.success) {
        this.addAlert(userId, {
          type: "trade",
          level: "error",
          message: `Trade failed: ${tradeResult.error}`,
          data: { request, error: tradeResult.error },
        });

        return {
          success: false,
          error: tradeResult.error,
        };
      }

      const { orderId, executedQty, price } = tradeResult.data;

      // Set up position protection if requested (only for BUY orders)
      let protectionId: string | undefined;
      if (
        request.side === "BUY" &&
        (request.stopLossPercent ||
          request.takeProfitPercent ||
          request.trailingStopPercent)
      ) {
        const entryPrice = parseFloat(price || "0");
        const quantity = parseFloat(executedQty || request.quantity);

        if (entryPrice > 0 && quantity > 0) {
          protectionId = stopLossTakeProfitService.setPositionProtection(
            userId,
            request.symbol,
            request.symbol.replace("USDT", ""),
            quantity,
            entryPrice,
            {
              stopLossPercent: request.stopLossPercent,
              takeProfitPercent: request.takeProfitPercent,
              trailingStopPercent: request.trailingStopPercent,
            }
          );

          this.logger.info("Position protection set up", {
            userId,
            symbol: request.symbol,
            protectionId,
          });
        }
      }

      // Record trade result for emergency system
      this.emergencySystem.recordTradeResult({
        success: true,
        symbol: request.symbol,
        amount: parseFloat(executedQty || request.quantity),
      });

      this.addAlert(userId, {
        type: "trade",
        level: "info",
        message: `Trade executed: ${request.side} ${request.quantity} ${request.symbol}`,
        data: { orderId, executedQty, price },
      });

      // Refresh dashboard state
      await this.refreshDashboardState(userId);

      return {
        success: true,
        orderId,
        protectionId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      this.logger.error("Trade execution failed:", error);

      // Record failed trade
      this.emergencySystem.recordTradeResult({
        success: false,
        symbol: request.symbol,
        amount: parseFloat(request.quantity),
      });

      this.addAlert(userId, {
        type: "trade",
        level: "error",
        message: `Trade execution failed: ${errorMessage}`,
        data: { request, error: errorMessage },
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get user alerts
   */
  getUserAlerts(userId: string, limit = 50): DashboardAlert[] {
    const userAlerts = this.alerts.get(userId) || [];
    return userAlerts.slice(-limit);
  }

  /**
   * Clear user alerts
   */
  clearUserAlerts(userId: string): void {
    this.alerts.set(userId, []);
  }

  /**
   * Emergency halt all trading
   */
  async emergencyHalt(reason: string): Promise<void> {
    this.logger.info("EMERGENCY HALT TRIGGERED", { reason });

    try {
      await this.emergencySystem.forceEmergencyHalt(reason);

      // Notify all active users
      for (const userId of this.dashboardState.keys()) {
        this.addAlert(userId, {
          type: "emergency",
          level: "critical",
          message: `EMERGENCY: Trading halted - ${reason}`,
          data: { reason },
        });

        // Refresh their dashboard state
        await this.refreshDashboardState(userId);
      }

      this.emit("emergencyHalt", { reason });
    } catch (error) {
      this.logger.error("Failed to execute emergency halt:", error);
      throw error;
    }
  }

  /**
   * Resume normal operations
   */
  async resumeOperations(): Promise<boolean> {
    this.logger.info("Attempting to resume normal operations");

    try {
      const resumed = await this.emergencySystem.resumeNormalOperations();

      if (resumed) {
        // Notify all active users
        for (const userId of this.dashboardState.keys()) {
          this.addAlert(userId, {
            type: "emergency",
            level: "info",
            message: "Normal trading operations resumed",
            data: {},
          });

          // Refresh their dashboard state
          await this.refreshDashboardState(userId);
        }

        this.emit("operationsResumed");
      }

      return resumed;
    } catch (error) {
      this.logger.error("Failed to resume operations:", error);
      return false;
    }
  }

  /**
   * Private helper methods
   */
  private async initializeServices(): Promise<void> {
    try {
      // Initialize risk management service
      await enhancedRiskManagementService.initialize();
      this.logger.info("Risk management service initialized");
    } catch (error) {
      this.logger.warn("Risk management initialization failed:", error);
    }
  }

  private async buildDashboardState(
    userId: string
  ): Promise<TradingDashboardState> {
    try {
      // Get portfolio
      const portfolio =
        await portfolioTrackingService.getPortfolioSummary(userId);

      // Get protections
      const protections = stopLossTakeProfitService.getUserProtections(userId);

      // Get emergency status
      const emergencyStatus = this.emergencySystem.getEmergencyStatus();

      // Test connectivity
      const connectivityResult =
        await this.mexcService.testConnectivityWithResponse();

      // Get performance stats (simplified)
      const slStats = stopLossTakeProfitService.getStats();

      return {
        portfolio,
        protections,
        riskStatus: {
          healthy: true, // Simplified
          riskLevel: "medium",
          activeAlerts: 0,
        },
        emergencyStatus: {
          active: emergencyStatus.active,
          tradingHalted: emergencyStatus.tradingHalted,
          systemHealth: emergencyStatus.systemHealth,
        },
        connectivity: {
          mexcConnected: connectivityResult.success,
          lastCheck: new Date().toISOString(),
          latency: connectivityResult.data?.latency,
        },
        performance: {
          totalTrades: slStats.totalOrders,
          successRate:
            slStats.totalOrders > 0
              ? (slStats.filledOrders / slStats.totalOrders) * 100
              : 0,
          avgExecutionTime: 250, // Simplified
          totalPnl: portfolio?.totalPnl || 0,
        },
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error("Failed to build dashboard state:", error);
      throw error;
    }
  }

  private async refreshDashboardState(userId: string): Promise<void> {
    try {
      const state = await this.buildDashboardState(userId);
      this.dashboardState.set(userId, state);
      this.emit("stateUpdated", { userId, state });
    } catch (error) {
      this.logger.error("Failed to refresh dashboard state:", error);
    }
  }

  private startRealTimeUpdates(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.logger.info("Starting real-time dashboard updates");

    this.updateInterval = setInterval(async () => {
      for (const userId of this.dashboardState.keys()) {
        await this.refreshDashboardState(userId);
      }
    }, 30000); // Update every 30 seconds
  }

  private stopRealTimeUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
    this.isRunning = false;
    this.logger.info("Stopped real-time dashboard updates");
  }

  private handlePortfolioUpdate(
    userId: string,
    portfolio: PortfolioSummary
  ): void {
    const state = this.dashboardState.get(userId);
    if (state) {
      state.portfolio = portfolio;
      state.lastUpdated = new Date().toISOString();
      this.emit("stateUpdated", { userId, state });
    }
  }

  private addAlert(
    userId: string,
    alertData: Omit<DashboardAlert, "id" | "timestamp" | "userId">
  ): void {
    const alert: DashboardAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      userId,
      ...alertData,
    };

    let userAlerts = this.alerts.get(userId) || [];
    userAlerts.push(alert);

    // Keep only last 100 alerts per user
    if (userAlerts.length > 100) {
      userAlerts = userAlerts.slice(-100);
    }

    this.alerts.set(userId, userAlerts);
    this.emit("newAlert", alert);
  }

  private handleEmergencyStop(data: any): void {
    this.logger.warn("Emergency stop triggered", data);

    for (const userId of this.dashboardState.keys()) {
      this.addAlert(userId, {
        type: "emergency",
        level: "critical",
        message: `Emergency stop: ${data.reason} (${data.count} consecutive losses)`,
        data,
      });
    }
  }

  private handleCircuitBreakerActivation(data: any): void {
    this.logger.warn("Circuit breaker activated", data);

    for (const userId of this.dashboardState.keys()) {
      this.addAlert(userId, {
        type: "emergency",
        level: "warning",
        message: `Circuit breaker activated: ${data.reason}`,
        data,
      });
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopRealTimeUpdates();
    portfolioTrackingService.stopRealTimeMonitoring();
    stopLossTakeProfitService.stopMonitoring();

    this.dashboardState.clear();
    this.alerts.clear();
    this.removeAllListeners();

    this.logger.info("Integrated Trading Dashboard destroyed");
  }
}

// Export singleton instance
export const integratedTradingDashboard = new IntegratedTradingDashboard();

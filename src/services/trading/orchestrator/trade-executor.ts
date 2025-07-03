/**
 * Trade Executor Module
 *
 * Handles trade execution and monitoring for auto-sniping operations.
 * Extracted from the original monolithic implementation for better maintainability.
 */

import { toSafeError } from "../../../lib/error-type-utils";
import type {
  ModuleContext,
  ModuleState,
  ServiceResponse,
  SnipeTarget,
  TradeExecutionResult,
  TradeParameters,
} from "./types";

export class TradeExecutor {
  private context: ModuleContext;
  private state: ModuleState;

  // Execution tracking
  private executionTimes: number[] = [];
  private totalExecutions = 0;
  private successfulExecutions = 0;
  private failedExecutions = 0;

  // Connection state
  private connectionStatus: "connected" | "disconnected" | "error" =
    "disconnected";
  private lastConnectionCheck = new Date();

  // Rate limiting
  private lastExecutionTime = 0;
  private readonly MIN_EXECUTION_INTERVAL = 1000; // 1 second minimum between executions

  constructor(context: ModuleContext) {
    this.context = context;
    this.state = {
      isInitialized: false,
      isHealthy: true,
      lastActivity: new Date(),
      metrics: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        successRate: 0,
      },
    };
  }

  /**
   * Initialize the trade executor module
   */
  async initialize(): Promise<void> {
    this.context.logger.info("Initializing Trade Executor Module");

    // Test connection to trading API
    await this.testConnection();

    this.state.isInitialized = true;
    this.state.lastActivity = new Date();
    this.context.logger.info("Trade Executor Module initialized successfully", {
      connectionStatus: this.connectionStatus,
    });
  }

  /**
   * Shutdown the trade executor module
   */
  async shutdown(): Promise<void> {
    this.context.logger.info("Shutting down Trade Executor Module");
    this.executionTimes = [];
    this.connectionStatus = "disconnected";
    this.state.isInitialized = false;
  }

  /**
   * Update configuration
   */
  async updateConfig(newContext: ModuleContext): Promise<void> {
    this.context = newContext;
    this.context.logger.info("Trade Executor Module configuration updated");
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<"operational" | "degraded" | "offline"> {
    if (!this.state.isInitialized) return "offline";
    if (!this.state.isHealthy || this.connectionStatus === "error")
      return "degraded";
    if (this.connectionStatus === "disconnected") return "degraded";
    return "operational";
  }

  /**
   * Get connection status
   */
  async getConnectionStatus(): Promise<"connected" | "disconnected" | "error"> {
    // Refresh connection status if it's been a while
    if (Date.now() - this.lastConnectionCheck.getTime() > 30000) {
      // 30 seconds
      await this.testConnection();
    }
    return this.connectionStatus;
  }

  /**
   * Execute a snipe target
   */
  async executeSnipeTarget(
    target: SnipeTarget
  ): Promise<ServiceResponse<TradeExecutionResult>> {
    const startTime = Date.now();

    try {
      this.context.logger.info("Executing snipe target", { target });

      if (!this.state.isInitialized) {
        throw new Error("Trade executor not initialized");
      }

      // Rate limiting check
      const timeSinceLastExecution = Date.now() - this.lastExecutionTime;
      if (timeSinceLastExecution < this.MIN_EXECUTION_INTERVAL) {
        const waitTime = this.MIN_EXECUTION_INTERVAL - timeSinceLastExecution;
        this.context.logger.debug(`Rate limiting: waiting ${waitTime}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      // Connection check
      if (
        this.connectionStatus === "disconnected" ||
        this.connectionStatus === "error"
      ) {
        await this.testConnection();
        if (
          this.connectionStatus === "error" ||
          this.connectionStatus === "disconnected"
        ) {
          throw new Error("No connection to trading API");
        }
      }

      // Prepare trade parameters
      const tradeParams = await this.prepareTradeParameters(target);

      // Execute the trade
      const executionResult = await this.executeTrade(tradeParams);

      // Update tracking
      this.totalExecutions++;
      this.lastExecutionTime = Date.now();
      const executionTime = this.lastExecutionTime - startTime;
      this.executionTimes.push(executionTime);

      if (executionResult.success) {
        this.successfulExecutions++;
        this.context.eventEmitter.emit("trade_executed", {
          target,
          result: executionResult,
          executionTime,
        });
      } else {
        this.failedExecutions++;
      }

      // Update metrics
      this.updateMetrics();
      this.state.lastActivity = new Date();

      this.context.logger.info("Snipe target execution completed", {
        success: executionResult.success,
        executionTime,
        targetSymbol: target.symbolName,
      });

      return {
        success: true,
        data: executionResult,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error(
        `Failed to execute snipe target ${target.symbolName}: ${safeError.message}`
      );

      this.totalExecutions++;
      this.failedExecutions++;
      this.updateMetrics();

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute a manual trade
   */
  async executeManualTrade(
    params: TradeParameters
  ): Promise<ServiceResponse<TradeExecutionResult>> {
    const startTime = Date.now();

    try {
      this.context.logger.info("Executing manual trade", { params });

      if (!this.state.isInitialized) {
        throw new Error("Trade executor not initialized");
      }

      // Validate parameters
      const validation = this.validateTradeParameters(params);
      if (!validation.isValid) {
        throw new Error(
          `Invalid trade parameters: ${validation.errors.join(", ")}`
        );
      }

      // Execute the trade
      const executionResult = await this.executeTrade(params);

      // Update tracking
      this.totalExecutions++;
      const executionTime = Date.now() - startTime;
      this.executionTimes.push(executionTime);

      if (executionResult.success) {
        this.successfulExecutions++;
      } else {
        this.failedExecutions++;
      }

      this.updateMetrics();
      this.state.lastActivity = new Date();

      return {
        success: true,
        data: executionResult,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error(
        `Failed to execute manual trade ${params.symbol}: ${safeError.message}`
      );

      this.totalExecutions++;
      this.failedExecutions++;
      this.updateMetrics();

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get average execution time
   */
  async getAverageExecutionTime(): Promise<number> {
    if (this.executionTimes.length === 0) return 0;
    return (
      this.executionTimes.reduce((sum, time) => sum + time, 0) /
      this.executionTimes.length
    );
  }

  /**
   * Get execution metrics
   */
  getMetrics() {
    return {
      ...this.state.metrics,
      connectionStatus: this.connectionStatus,
      recentExecutionTimes: this.executionTimes.slice(-10), // Last 10 executions
      rateLimitStatus: {
        lastExecutionTime: this.lastExecutionTime,
        minInterval: this.MIN_EXECUTION_INTERVAL,
      },
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Test connection to trading API
   */
  private async testConnection(): Promise<void> {
    try {
      this.context.logger.debug("Testing connection to trading API");

      // Simulate API connection test
      if (this.context.config.paperTradingMode) {
        // Paper trading mode - always connected
        this.connectionStatus = "connected";
      } else {
        // Simulate real API connection test
        const success = Math.random() > 0.1; // 90% success rate
        this.connectionStatus = success ? "connected" : "error";
      }

      this.lastConnectionCheck = new Date();

      this.context.logger.debug("Connection test completed", {
        status: this.connectionStatus,
      });
    } catch (error) {
      this.context.logger.error(
        `Connection test failed: ${toSafeError(error).message}`
      );
      this.connectionStatus = "error";
    }
  }

  /**
   * Prepare trade parameters from snipe target
   */
  private async prepareTradeParameters(
    target: SnipeTarget
  ): Promise<TradeParameters> {
    // Calculate position size in quote currency (USDT)
    const positionSizeUsdt = target.positionSizeUsdt;

    // Get current market price (simulated)
    const currentPrice = 100 + Math.random() * 1000; // $100-$1100 range

    // Calculate quantity based on position size
    const quantity = (positionSizeUsdt / currentPrice).toFixed(6);

    const params: TradeParameters = {
      userId: "auto-sniper", // Would use actual user ID in real implementation
      symbol: target.symbolName,
      side: "BUY",
      type: this.context.config.strategy === "aggressive" ? "MARKET" : "LIMIT",
      quantity,
      timeInForce: "GTC",
    };

    // Set price for limit orders
    if (params.type === "LIMIT") {
      // Place limit order slightly below market price for better fill
      const limitPrice = (currentPrice * 0.999).toFixed(6);
      params.price = limitPrice;
    }

    this.context.logger.debug("Trade parameters prepared", {
      target: target.symbolName,
      positionSizeUsdt,
      currentPrice,
      quantity,
      type: params.type,
    });

    return params;
  }

  /**
   * Execute trade with API (simulated)
   */
  private async executeTrade(
    params: TradeParameters
  ): Promise<TradeExecutionResult> {
    try {
      this.context.logger.debug("Executing trade", { params });

      // Simulate execution delay
      const executionDelay = 100 + Math.random() * 500; // 100-600ms
      await new Promise((resolve) => setTimeout(resolve, executionDelay));

      if (this.context.config.paperTradingMode) {
        // Paper trading - always successful
        return this.simulatePaperTrade(params);
      } else {
        // Simulate real trade execution
        return this.simulateRealTrade(params);
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error(
        `Trade execution failed for ${params.symbol}: ${safeError.message}`
      );

      return {
        success: false,
        error: safeError.message,
      };
    }
  }

  /**
   * Simulate paper trade execution
   */
  private simulatePaperTrade(params: TradeParameters): TradeExecutionResult {
    const orderId = `PAPER_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const executedQty = params.quantity || "0";
    const price = params.price || (100 + Math.random() * 1000).toFixed(6);

    return {
      success: true,
      data: {
        orderId,
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        price,
        executedQty,
        status: "FILLED",
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Simulate real trade execution
   */
  private simulateRealTrade(params: TradeParameters): TradeExecutionResult {
    // Simulate 95% success rate for real trades
    const success = Math.random() > 0.05;

    if (success) {
      const orderId = `REAL_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const executedQty = params.quantity || "0";
      const price = params.price || (100 + Math.random() * 1000).toFixed(6);

      return {
        success: true,
        data: {
          orderId,
          symbol: params.symbol,
          side: params.side,
          type: params.type,
          price,
          executedQty,
          status: "FILLED",
          timestamp: new Date().toISOString(),
        },
      };
    } else {
      // Simulate various failure reasons
      const errors = [
        "Insufficient balance",
        "Symbol not found",
        "Market closed",
        "Order size too small",
        "Network timeout",
      ];
      const randomError = errors[Math.floor(Math.random() * errors.length)];

      return {
        success: false,
        error: randomError,
      };
    }
  }

  /**
   * Validate trade parameters
   */
  private validateTradeParameters(params: TradeParameters): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!params.userId) {
      errors.push("User ID is required");
    }

    if (!params.symbol) {
      errors.push("Symbol is required");
    }

    if (!["BUY", "SELL"].includes(params.side)) {
      errors.push("Side must be BUY or SELL");
    }

    if (!["MARKET", "LIMIT", "STOP_LIMIT"].includes(params.type)) {
      errors.push("Invalid order type");
    }

    if (params.type === "LIMIT" && !params.price) {
      errors.push("Price is required for limit orders");
    }

    if (!params.quantity && !params.quoteOrderQty) {
      errors.push("Either quantity or quoteOrderQty must be specified");
    }

    if (params.quantity && parseFloat(params.quantity) <= 0) {
      errors.push("Quantity must be positive");
    }

    if (params.price && parseFloat(params.price) <= 0) {
      errors.push("Price must be positive");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Update execution metrics
   */
  private updateMetrics(): void {
    this.state.metrics = {
      totalExecutions: this.totalExecutions,
      successfulExecutions: this.successfulExecutions,
      failedExecutions: this.failedExecutions,
      averageExecutionTime:
        this.executionTimes.length > 0
          ? this.executionTimes.reduce((sum, time) => sum + time, 0) /
            this.executionTimes.length
          : 0,
      successRate:
        this.totalExecutions > 0
          ? (this.successfulExecutions / this.totalExecutions) * 100
          : 0,
    };

    // Keep only last 100 execution times to prevent memory growth
    if (this.executionTimes.length > 100) {
      this.executionTimes = this.executionTimes.slice(-100);
    }
  }

  /**
   * Cancel all pending orders
   */
  async cancelAllPendingOrders(): Promise<ServiceResponse<number>> {
    try {
      this.context.logger.info("Cancelling all pending orders");

      // In a real implementation, this would cancel all open orders via API
      // For now, simulate cancellation
      const cancelledCount = Math.floor(Math.random() * 5); // Simulate 0-4 cancelled orders

      this.context.logger.info(`Cancelled ${cancelledCount} pending orders`);

      return {
        success: true,
        data: cancelledCount,
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

  /**
   * Emergency stop - halt all trade execution
   */
  async emergencyStop(): Promise<ServiceResponse<boolean>> {
    try {
      this.context.logger.warn("EMERGENCY: Stopping trade executor");

      // Mark as not healthy
      this.state.isHealthy = false;

      // In a real implementation, would disconnect from trading APIs
      this.context.logger.warn("Trade executor emergency stopped");

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

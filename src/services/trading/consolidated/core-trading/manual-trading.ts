/**
 * Manual Trading Module
 *
 * Handles manual trading operations and multi-phase strategies.
 * Extracted from the original monolithic core-trading.service.ts for modularity.
 */

import { toSafeError } from "@/src/lib/error-type-utils";
import type { TradingOrderData } from "@/src/services/api/unified-mexc-trading";
import {
  type BalanceSnapshotData,
  type TradeExecutionData,
  type TransactionData,
  tradePersistenceService,
} from "@/src/services/database/trade-persistence-service";
import type {
  ModuleContext,
  ModuleState,
  MultiPhaseConfig,
  MultiPhaseResult,
  TradeParameters,
  TradeResult,
  TradingStrategy,
} from "./types";
import { validateTradeParams } from "./types";

export class ManualTradingModule {
  private context: ModuleContext;
  private state: ModuleState;

  // Circuit breaker state
  private circuitBreakerOpen = false;
  private circuitBreakerFailures = 0;
  private circuitBreakerResetTime: Date | null = null;

  // Performance tracking
  private totalTrades = 0;
  private successfulTrades = 0;
  private failedTrades = 0;

  constructor(context: ModuleContext) {
    this.context = context;
    this.state = {
      isInitialized: false,
      isHealthy: true,
      lastActivity: new Date(),
      metrics: {
        totalTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        totalVolume: 0,
      },
    };
  }

  /**
   * Initialize the manual trading module
   */
  async initialize(): Promise<void> {
    this.context.logger.info("Initializing Manual Trading Module");

    // Reset circuit breaker
    this.resetCircuitBreaker();

    this.state.isInitialized = true;
    this.context.logger.info("Manual Trading Module initialized successfully");
  }

  /**
   * Shutdown the manual trading module
   */
  async shutdown(): Promise<void> {
    this.context.logger.info("Shutting down Manual Trading Module");
    this.state.isInitialized = false;
  }

  /**
   * Update configuration
   */
  async updateConfig(config: any): Promise<void> {
    this.context.config = config;
    this.context.logger.info("Manual Trading Module configuration updated");
  }

  /**
   * Execute a manual trade
   */
  async executeTrade(params: TradeParameters): Promise<TradeResult> {
    const requestedAt = new Date();
    let _balanceBeforeTrade: BalanceSnapshotData[] = [];
    let executionHistoryId: string | null = null;
    let transactionId: string | null = null;

    try {
      // Validate parameters
      const validatedParams = validateTradeParams(params);

      // Check circuit breaker
      if (this.circuitBreakerOpen) {
        return {
          success: false,
          error: "Circuit breaker is open - trading temporarily disabled",
          timestamp: new Date().toISOString(),
        };
      }

      // Check safety coordinator
      if (this.context.safetyCoordinator) {
        const safetyStatus = this.context.safetyCoordinator.getStatus();
        if (safetyStatus.overall.safetyLevel !== "safe") {
          return {
            success: false,
            error: `Trading blocked by safety system: ${safetyStatus.overall.safetyLevel}`,
            timestamp: new Date().toISOString(),
          };
        }
      }

      // Get user ID for database operations
      const userId = await this.getCurrentUserId();

      // Capture balance snapshots before trade
      try {
        _balanceBeforeTrade = await this.captureBalanceSnapshots(
          userId,
          "before_trade"
        );
      } catch (balanceError) {
        this.context.logger.warn(
          "Failed to capture balance snapshots before trade",
          {
            error:
              balanceError instanceof Error
                ? balanceError.message
                : "Unknown error",
          }
        );
      }

      // Execute trade based on paper trading mode
      const result = this.context.config.enablePaperTrading
        ? await this.executePaperTrade(validatedParams)
        : await this.executeRealTrade(validatedParams);

      // Save execution history to database
      try {
        const executionData: TradeExecutionData = {
          userId,
          snipeTargetId: validatedParams.snipeTargetId,
          vcoinId: validatedParams.vcoinId || validatedParams.symbol,
          symbolName: validatedParams.symbol,
          action: validatedParams.side.toLowerCase() as "buy" | "sell",
          orderType: validatedParams.type.toLowerCase() as "market" | "limit",
          orderSide: validatedParams.side.toLowerCase() as "buy" | "sell",
          requestedQuantity: validatedParams.quantity || 0,
          requestedPrice: validatedParams.price,
          executedQuantity: result.data?.executedQty
            ? parseFloat(result.data.executedQty)
            : undefined,
          executedPrice: result.data?.price
            ? parseFloat(result.data.price)
            : undefined,
          totalCost: result.data?.cummulativeQuoteQty
            ? parseFloat(result.data.cummulativeQuoteQty)
            : undefined,
          fees: 0, // Would need to calculate from exchange response
          exchangeOrderId: result.data?.orderId,
          exchangeStatus: result.data?.status,
          exchangeResponse: JSON.stringify(result.data),
          executionLatencyMs: result.executionTime,
          slippagePercent: this.calculateSlippage(validatedParams, result),
          status: result.success ? "success" : "failed",
          errorCode: result.success ? undefined : "EXECUTION_FAILED",
          errorMessage: result.success ? undefined : result.error,
          requestedAt,
          executedAt: result.success ? new Date() : undefined,
        };

        const executionResult =
          await tradePersistenceService.saveExecutionHistory(executionData);
        executionHistoryId = executionResult.id;

        this.context.logger.info("Trade execution history saved", {
          executionHistoryId,
          symbolName: validatedParams.symbol,
        });
      } catch (persistenceError) {
        this.context.logger.error("Failed to save execution history", {
          error:
            persistenceError instanceof Error
              ? persistenceError.message
              : "Unknown error",
        });
      }

      // Save transaction data for buy orders
      if (result.success && validatedParams.side.toLowerCase() === "buy") {
        try {
          const transactionData: TransactionData = {
            userId,
            transactionType: "buy",
            symbolName: validatedParams.symbol,
            vcoinId: validatedParams.vcoinId || validatedParams.symbol,
            buyPrice: result.data?.price
              ? parseFloat(result.data.price)
              : undefined,
            buyQuantity: result.data?.executedQty
              ? parseFloat(result.data.executedQty)
              : undefined,
            buyTotalCost: result.data?.cummulativeQuoteQty
              ? parseFloat(result.data.cummulativeQuoteQty)
              : undefined,
            buyTimestamp: new Date(),
            buyOrderId: result.data?.orderId,
            fees: 0, // Would need to calculate from exchange response
            status: "completed",
            snipeTargetId: validatedParams.snipeTargetId,
            notes: validatedParams.isAutoSnipe
              ? "Auto-snipe execution"
              : "Manual trade execution",
          };

          const transactionResult =
            await tradePersistenceService.saveTransaction(transactionData);
          transactionId = transactionResult.id;

          this.context.logger.info("Transaction data saved", {
            transactionId,
            symbolName: validatedParams.symbol,
          });
        } catch (persistenceError) {
          this.context.logger.error("Failed to save transaction data", {
            error:
              persistenceError instanceof Error
                ? persistenceError.message
                : "Unknown error",
          });
        }
      }

      // Capture balance snapshots after trade
      try {
        await this.captureBalanceSnapshots(userId, "after_trade");
      } catch (balanceError) {
        this.context.logger.warn(
          "Failed to capture balance snapshots after trade",
          {
            error:
              balanceError instanceof Error
                ? balanceError.message
                : "Unknown error",
          }
        );
      }

      // Update metrics and emit events
      this.updateTradeMetrics(result, validatedParams);
      this.context.eventEmitter.emit("trade_executed", {
        ...result,
        executionHistoryId,
        transactionId,
      });
      this.state.lastActivity = new Date();

      return result;
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Trade execution failed", {
        params,
        error: safeError,
      });

      // Save failed execution history
      if (!executionHistoryId) {
        try {
          const userId = await this.getCurrentUserId();
          const executionData: TradeExecutionData = {
            userId,
            snipeTargetId: params.snipeTargetId,
            vcoinId: params.vcoinId || params.symbol,
            symbolName: params.symbol,
            action: params.side.toLowerCase() as "buy" | "sell",
            orderType: params.type.toLowerCase() as "market" | "limit",
            orderSide: params.side.toLowerCase() as "buy" | "sell",
            requestedQuantity: params.quantity || 0,
            requestedPrice: params.price,
            status: "failed",
            errorCode: "EXECUTION_ERROR",
            errorMessage: safeError.message,
            requestedAt,
          };

          await tradePersistenceService.saveExecutionHistory(executionData);
        } catch (persistenceError) {
          this.context.logger.error("Failed to save failed execution history", {
            error:
              persistenceError instanceof Error
                ? persistenceError.message
                : "Unknown error",
          });
        }
      }

      this.handleTradeFailure(safeError);

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute a multi-phase trading strategy
   */
  async executeMultiPhaseStrategy(
    config: MultiPhaseConfig
  ): Promise<MultiPhaseResult> {
    const startTime = Date.now();

    try {
      this.context.logger.info("Executing multi-phase strategy", {
        symbol: config.symbol,
        totalAmount: config.totalAmount,
        strategy: config.strategy,
        phases: config.phaseCount,
      });

      // Get strategy configuration
      const strategy = this.getStrategy(config.strategy);
      if (!strategy) {
        throw new Error(`Strategy '${config.strategy}' not found`);
      }

      // Calculate phase allocations
      const allocations =
        config.phaseAllocation ||
        this.calculatePhaseAllocations(config.phaseCount);

      const phases: MultiPhaseResult["phases"] = [];
      let totalExecuted = 0;
      const totalFees = 0;
      let priceSum = 0;
      let priceCount = 0;

      // Execute each phase
      for (let i = 0; i < config.phaseCount; i++) {
        const phaseAmount = config.totalAmount * allocations[i];

        const phaseParams: TradeParameters = {
          symbol: config.symbol,
          side: "BUY",
          type: strategy.orderType,
          quoteOrderQty: phaseAmount,
          timeInForce: strategy.timeInForce,
          strategy: config.strategy,
        };

        const phase: {
          phaseId: number;
          status: "executing" | "completed" | "failed";
          allocation: number;
          result?: TradeResult;
          executionTime: Date;
        } = {
          phaseId: i + 1,
          status: "executing",
          allocation: allocations[i],
          executionTime: new Date(),
        };

        try {
          // Execute phase trade
          const result = await this.executeTrade(phaseParams);

          if (result.success && result.data) {
            phase.status = "completed";
            phase.result = result;

            totalExecuted += parseFloat(result.data.executedQty || "0");

            if (result.data.price) {
              priceSum += parseFloat(result.data.price);
              priceCount++;
            }
          } else {
            phase.status = "failed";
            phase.result = result;
          }
        } catch (error) {
          const safeError = toSafeError(error);
          phase.status = "failed";
          this.context.logger.error(`Phase ${i + 1} failed`, safeError);
        }

        phases.push(phase);

        // Wait between phases if not the last phase
        if (i < config.phaseCount - 1 && config.phaseDelayMs > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, config.phaseDelayMs)
          );
        }
      }

      const result: MultiPhaseResult = {
        success: phases.some((p) => p.status === "completed"),
        totalPhases: config.phaseCount,
        completedPhases: phases.filter((p) => p.status === "completed").length,
        strategy: config.strategy,
        phases,
        totalExecuted,
        averagePrice: priceCount > 0 ? priceSum / priceCount : undefined,
        totalFees,
        executionTimeMs: Date.now() - startTime,
      };

      this.context.logger.info("Multi-phase strategy completed", {
        symbol: config.symbol,
        completedPhases: result.completedPhases,
        totalPhases: result.totalPhases,
        totalExecuted: result.totalExecuted,
      });

      return result;
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Multi-phase strategy failed", safeError);
      throw error;
    }
  }

  /**
   * Get module status
   */
  getStatus() {
    return {
      isHealthy: this.state.isHealthy,
      tradingEnabled: !this.circuitBreakerOpen,
      circuitBreakerOpen: this.circuitBreakerOpen,
      circuitBreakerFailures: this.circuitBreakerFailures,
      circuitBreakerResetTime: this.circuitBreakerResetTime,
      totalTrades: this.totalTrades,
      successfulTrades: this.successfulTrades,
      failedTrades: this.failedTrades,
      successRate:
        this.totalTrades > 0
          ? (this.successfulTrades / this.totalTrades) * 100
          : 0,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Execute a paper trade (simulation)
   */
  private async executePaperTrade(
    params: TradeParameters
  ): Promise<TradeResult> {
    const startTime = Date.now();

    // Simulate trade execution
    const simulatedPrice = await this.getSimulatedPrice(params.symbol);
    const orderId = `paper-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const result: TradeResult = {
      success: true,
      data: {
        orderId,
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        quantity: params.quantity?.toString() || "0",
        price: simulatedPrice.toString(),
        status: "FILLED",
        executedQty: params.quantity?.toString() || "0",
        timestamp: new Date().toISOString(),
        paperTrade: true,
        simulatedPrice,
        autoSnipe: params.isAutoSnipe,
        confidenceScore: params.confidenceScore,
      },
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };

    this.context.logger.info("Paper trade executed successfully", {
      orderId,
      symbol: params.symbol,
      side: params.side,
      price: simulatedPrice,
    });

    return result;
  }

  /**
   * Execute a real trade through MEXC API
   */
  private async executeRealTrade(
    params: TradeParameters
  ): Promise<TradeResult> {
    const startTime = Date.now();

    try {
      // Convert unsupported order types to supported ones
      let mexcOrderType: "MARKET" | "LIMIT";
      if (params.type === "STOP_LIMIT") {
        mexcOrderType = "LIMIT";
      } else if (params.type === "LIMIT") {
        mexcOrderType = "LIMIT";
      } else {
        mexcOrderType = "MARKET";
      }

      // Prepare MEXC API parameters
      const mexcParams: TradingOrderData = {
        symbol: params.symbol,
        side: params.side.toUpperCase() as "BUY" | "SELL",
        type: mexcOrderType,
        quantity: params.quantity?.toString() || "",
        price: params.price?.toString(),
        timeInForce: params.timeInForce,
      };

      // Execute through MEXC service
      const mexcResult = await this.context.mexcService.placeOrder(mexcParams);

      if (!mexcResult.success || !mexcResult.data) {
        throw new Error(mexcResult.error || "Trade execution failed");
      }

      const result: TradeResult = {
        success: true,
        data: {
          orderId: mexcResult.data.orderId.toString(),
          clientOrderId: mexcResult.data.clientOrderId,
          symbol: mexcResult.data.symbol,
          side: mexcResult.data.side,
          type: mexcResult.data.type,
          quantity: mexcResult.data.origQty,
          price: mexcResult.data.price,
          status: mexcResult.data.status,
          executedQty: mexcResult.data.executedQty,
          cummulativeQuoteQty: mexcResult.data.cummulativeQuoteQty,
          timestamp: new Date(mexcResult.data.transactTime).toISOString(),
          autoSnipe: params.isAutoSnipe,
          confidenceScore: params.confidenceScore,
        },
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      this.context.logger.info("Real trade executed successfully", {
        orderId: result.data?.orderId,
        symbol: params.symbol,
        side: params.side,
        executedQty: result.data?.executedQty,
      });

      return result;
    } catch (error) {
      const safeError = toSafeError(error);
      this.handleTradeFailure(safeError);
      throw error;
    }
  }

  /**
   * Get simulated price for paper trading
   */
  private async getSimulatedPrice(symbol: string): Promise<number> {
    try {
      // Try to get real market price for simulation
      const ticker = await this.context.mexcService.getTicker(symbol);
      if (ticker.success && ticker.data?.price) {
        return parseFloat(ticker.data.price);
      }
    } catch (_error) {
      this.context.logger.debug("Could not get real price for simulation", {
        symbol,
      });
    }

    // Fallback to mock price
    return 100 + Math.random() * 1000;
  }

  /**
   * Get strategy by name (simplified - would integrate with strategy manager)
   */
  private getStrategy(name: string): TradingStrategy | null {
    // This would integrate with the StrategyManager module
    const defaultStrategies = {
      conservative: {
        name: "conservative",
        description: "Low-risk strategy",
        maxPositionSize: 0.05,
        positionSizingMethod: "fixed" as const,
        stopLossPercent: 10,
        takeProfitPercent: 20,
        maxDrawdownPercent: 15,
        orderType: "LIMIT" as const,
        timeInForce: "GTC" as const,
        slippageTolerance: 0.5,
        enableMultiPhase: true,
        phaseCount: 3,
        phaseDelayMs: 5000,
        confidenceThreshold: 85,
        enableAutoSnipe: false,
        snipeDelayMs: 1000,
        enableTrailingStop: false,
        enablePartialTakeProfit: true,
        partialTakeProfitPercent: 50,
      },
      balanced: {
        name: "balanced",
        description: "Balanced risk/reward strategy",
        maxPositionSize: 0.1,
        positionSizingMethod: "fixed" as const,
        stopLossPercent: 15,
        takeProfitPercent: 25,
        maxDrawdownPercent: 20,
        orderType: "MARKET" as const,
        timeInForce: "IOC" as const,
        slippageTolerance: 1.0,
        enableMultiPhase: true,
        phaseCount: 2,
        phaseDelayMs: 3000,
        confidenceThreshold: 75,
        enableAutoSnipe: true,
        snipeDelayMs: 500,
        enableTrailingStop: true,
        trailingStopPercent: 5,
        enablePartialTakeProfit: false,
      },
    };

    return defaultStrategies[name as keyof typeof defaultStrategies] || null;
  }

  /**
   * Calculate phase allocations for multi-phase strategy
   */
  private calculatePhaseAllocations(phaseCount: number): number[] {
    // Default equal allocation
    const baseAllocation = 1 / phaseCount;
    return Array(phaseCount).fill(baseAllocation);
  }

  /**
   * Update trade metrics
   */
  private updateTradeMetrics(
    result: TradeResult,
    _params: TradeParameters
  ): void {
    this.totalTrades++;
    this.state.metrics.totalTrades++;

    if (result.success) {
      this.successfulTrades++;
      this.state.metrics.successfulTrades++;

      if (result.data?.quantity && result.data?.price) {
        const volume =
          parseFloat(result.data.quantity) * parseFloat(result.data.price);
        this.state.metrics.totalVolume += volume;
      }
    } else {
      this.failedTrades++;
      this.state.metrics.failedTrades++;
    }
  }

  /**
   * Handle trade failure for circuit breaker
   */
  private handleTradeFailure(_error: Error): void {
    this.circuitBreakerFailures++;

    if (
      this.context.config.enableCircuitBreaker &&
      this.circuitBreakerFailures >= this.context.config.circuitBreakerThreshold
    ) {
      this.openCircuitBreaker("Too many trade failures");
    }
  }

  /**
   * Open circuit breaker
   */
  private openCircuitBreaker(reason: string): void {
    this.circuitBreakerOpen = true;
    this.circuitBreakerResetTime = new Date(
      Date.now() + this.context.config.circuitBreakerResetTime
    );

    this.context.logger.warn("Circuit breaker opened", {
      reason,
      resetTime: this.circuitBreakerResetTime,
    });

    this.context.eventEmitter.emit("circuit_breaker_triggered", {
      reason,
      timestamp: new Date(),
    });

    // Auto-reset after timeout
    setTimeout(() => {
      this.resetCircuitBreaker();
    }, this.context.config.circuitBreakerResetTime);
  }

  /**
   * Reset circuit breaker
   */
  private resetCircuitBreaker(): void {
    this.circuitBreakerOpen = false;
    this.circuitBreakerFailures = 0;
    this.circuitBreakerResetTime = null;

    this.context.logger.info("Circuit breaker reset");
  }

  /**
   * Get current user ID for database operations
   */
  private async getCurrentUserId(): Promise<string> {
    // For now, return a default user ID or get from config
    // In a real implementation, this would come from authentication context
    const userId = this.context.config.userId || "default-user-id";

    if (!userId || userId === "default-user-id") {
      this.context.logger.warn("Using default user ID for trade persistence", {
        userId,
      });
    }

    return userId;
  }

  /**
   * Capture balance snapshots for trade tracking
   */
  private async captureBalanceSnapshots(
    userId: string,
    snapshotType: "before_trade" | "after_trade"
  ): Promise<BalanceSnapshotData[]> {
    try {
      // Get account balance from MEXC API
      const balanceResult = await this.context.mexcService.getAccountInfo();

      if (!balanceResult.success || !balanceResult.data?.balances) {
        this.context.logger.warn("Failed to get account balance for snapshot", {
          error: balanceResult.error,
        });
        return [];
      }

      const snapshots: BalanceSnapshotData[] = [];
      const _currentTime = new Date();

      // Create snapshots for all non-zero balances
      for (const balance of balanceResult.data.balances) {
        const freeAmount = parseFloat(balance.free || "0");
        const lockedAmount = parseFloat(balance.locked || "0");
        const totalAmount = freeAmount + lockedAmount;

        // Only snapshot assets with non-zero balances
        if (totalAmount > 0) {
          const snapshot: BalanceSnapshotData = {
            userId,
            asset: balance.asset,
            freeAmount,
            lockedAmount,
            totalAmount,
            usdValue: 0, // Would need price conversion
            priceSource: "mexc",
            snapshotType: "triggered",
            dataSource: "api",
          };

          snapshots.push(snapshot);
        }
      }

      // Save snapshots to database
      if (snapshots.length > 0) {
        await tradePersistenceService.saveBalanceSnapshots(snapshots);
        this.context.logger.debug(
          `Saved ${snapshots.length} balance snapshots`,
          {
            snapshotType,
            assets: snapshots.map((s) => s.asset),
          }
        );
      }

      return snapshots;
    } catch (error) {
      this.context.logger.error("Failed to capture balance snapshots", {
        error: error instanceof Error ? error.message : "Unknown error",
        snapshotType,
      });
      return [];
    }
  }

  /**
   * Calculate slippage percentage
   */
  private calculateSlippage(
    params: TradeParameters,
    result: TradeResult
  ): number | undefined {
    if (!params.price || !result.data?.price) {
      return undefined;
    }

    const requestedPrice = params.price;
    const executedPrice = parseFloat(result.data.price);

    if (requestedPrice === 0) {
      return undefined;
    }

    const slippage =
      Math.abs((executedPrice - requestedPrice) / requestedPrice) * 100;
    return slippage;
  }
}

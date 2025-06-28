/**
 * Auto-Sniping Module
 *
 * Handles auto-sniping execution and monitoring.
 * Extracted from the original monolithic core-trading.service.ts for modularity.
 */

import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "@/src/db";
import { snipeTargets } from "@/src/db/schemas/trading";
import { toSafeError } from "@/src/lib/error-type-utils";
import { TradingStrategyManager } from "@/src/services/trading/trading-strategy-manager";

import type {
  AutoSnipeTarget,
  CoreTradingConfig,
  ModuleContext,
  ModuleState,
  Position,
  ServiceResponse,
  TradeParameters,
  TradeResult,
  TradingStrategy,
} from "./types";

// Extended strategy interface for multi-phase strategies
interface MultiPhaseStrategy extends TradingStrategy {
  id: string;
  levels: Array<{
    percentage: number;
    action: string;
    delay?: number;
  }>;
}

// Statistics interface for updateStats method
interface StatsUpdate {
  totalTrades?: number;
  successfulTrades?: number;
  failedTrades?: number;
  averageConfidence?: number;
  timestamp?: number;
}

export class AutoSnipingModule {
  private context: ModuleContext;
  private state: ModuleState;

  // Auto-sniping state
  private autoSnipingInterval: NodeJS.Timeout | null = null;
  private lastSnipeCheck: Date | null = null;
  private isActive = false;

  // Metrics
  private processedTargets = 0;
  private successfulSnipes = 0;
  private failedSnipes = 0;

  // Position tracking
  private activePositions = new Map<string, Position>();
  private pendingStopLosses = new Map<string, NodeJS.Timeout>();
  private pendingTakeProfits = new Map<string, NodeJS.Timeout>();

  constructor(context: ModuleContext) {
    this.context = context;
    this.state = {
      isInitialized: false,
      isHealthy: true,
      lastActivity: new Date(),
      metrics: {
        processedTargets: 0,
        successfulSnipes: 0,
        failedSnipes: 0,
        averageConfidence: 0,
      },
    };
  }

  /**
   * Initialize the auto-sniping module
   */
  async initialize(): Promise<void> {
    this.context.logger.info("Initializing Auto-Sniping Module");
    this.state.isInitialized = true;
    this.context.logger.info("Auto-Sniping Module initialized successfully");
  }

  /**
   * Shutdown the auto-sniping module
   */
  async shutdown(): Promise<void> {
    this.context.logger.info("Shutting down Auto-Sniping Module");

    // Stop auto-sniping
    await this.stop();

    // Clear all pending timers
    this.pendingStopLosses.forEach((timer) => clearTimeout(timer));
    this.pendingTakeProfits.forEach((timer) => clearTimeout(timer));
    this.pendingStopLosses.clear();
    this.pendingTakeProfits.clear();

    // Log active positions that need manual handling
    if (this.activePositions.size > 0) {
      this.context.logger.warn(`Shutting down with ${this.activePositions.size} active positions`, {
        positions: Array.from(this.activePositions.keys()),
      });
    }

    this.state.isInitialized = false;
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<CoreTradingConfig>): Promise<void> {
    this.context.config = config;

    // Restart auto-sniping if active with new configuration
    if (this.isActive) {
      await this.stop();
      if (config.autoSnipingEnabled) {
        await this.start();
      }
    }

    this.context.logger.info("Auto-Sniping Module configuration updated");
  }

  /**
   * Start auto-sniping monitoring
   */
  async start(): Promise<ServiceResponse<void>> {
    if (this.isActive) {
      return {
        success: false,
        error: "Auto-sniping is already active",
        timestamp: new Date().toISOString(),
      };
    }

    try {
      this.context.logger.info("Starting auto-sniping monitoring", {
        interval: this.context.config.snipeCheckInterval,
        confidenceThreshold: this.context.config.confidenceThreshold,
      });

      this.isActive = true;
      this.autoSnipingInterval = setInterval(
        () => this.processSnipeTargets(),
        this.context.config.snipeCheckInterval
      );

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to start auto-sniping", safeError);

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Stop auto-sniping monitoring
   */
  async stop(): Promise<ServiceResponse<void>> {
    try {
      if (this.autoSnipingInterval) {
        clearInterval(this.autoSnipingInterval);
        this.autoSnipingInterval = null;
      }

      this.isActive = false;
      this.context.logger.info("Auto-sniping monitoring stopped");

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to stop auto-sniping", safeError);

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Pause auto-sniping monitoring
   */
  async pause(): Promise<ServiceResponse<void>> {
    if (!this.isActive) {
      return {
        success: false,
        error: "Auto-sniping is not active",
        timestamp: new Date().toISOString(),
      };
    }

    try {
      if (this.autoSnipingInterval) {
        clearInterval(this.autoSnipingInterval);
        this.autoSnipingInterval = null;
      }

      this.context.logger.info("Auto-sniping monitoring paused");
      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to pause auto-sniping", safeError);

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Resume auto-sniping monitoring
   */
  async resume(): Promise<ServiceResponse<void>> {
    if (!this.isActive) {
      return {
        success: false,
        error: "Auto-sniping is not active",
        timestamp: new Date().toISOString(),
      };
    }

    if (this.autoSnipingInterval) {
      return {
        success: false,
        error: "Auto-sniping is already running",
        timestamp: new Date().toISOString(),
      };
    }

    try {
      // Resume the interval
      this.autoSnipingInterval = setInterval(
        () => this.processSnipeTargets(),
        this.context.config.snipeCheckInterval
      );

      this.context.logger.info("Auto-sniping monitoring resumed");
      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to resume auto-sniping", safeError);

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get module status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      isHealthy: this.state.isHealthy,
      lastSnipeCheck: this.lastSnipeCheck,
      processedTargets: this.processedTargets,
      successfulSnipes: this.successfulSnipes,
      failedSnipes: this.failedSnipes,
      successRate:
        this.processedTargets > 0 ? (this.successfulSnipes / this.processedTargets) * 100 : 0,
    };
  }

  /**
   * Execute auto-sniping (main entry point)
   * This method is the primary execution point for auto-sniping operations
   */
  async execute(): Promise<ServiceResponse<{ processedCount: number; successCount: number }>> {
    try {
      if (!this.isActive) {
        return {
          success: false,
          error: "Auto-sniping module is not active",
          timestamp: new Date().toISOString(),
        };
      }

      this.context.logger.info("Starting auto-sniping execution cycle");

      // Delegate to processSnipeTargets for the actual execution
      const result = await this.processSnipeTargets();

      this.context.logger.info("Auto-sniping execution cycle completed", {
        processedCount: result.data?.processedCount || 0,
        successCount: result.data?.successCount || 0,
      });

      return result;
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Auto-sniping execution failed", safeError);

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Process individual snipe target
   * This method handles the execution of a single snipe target
   */
  async processTarget(target: AutoSnipeTarget): Promise<ServiceResponse<TradeResult>> {
    try {
      this.context.logger.info(`Processing individual snipe target: ${target.symbolName}`, {
        confidence: target.confidenceScore,
        amount: target.positionSizeUsdt,
        strategy: target.strategy || "normal",
      });

      // Validate target before processing
      if (target.confidenceScore < this.context.config.confidenceThreshold) {
        return {
          success: false,
          error: `Target confidence score ${target.confidenceScore} below threshold ${this.context.config.confidenceThreshold}`,
          timestamp: new Date().toISOString(),
        };
      }

      // Execute the snipe target
      const result = await this.executeSnipeTarget(target);

      this.context.logger.info(`Individual snipe target processed successfully: ${target.symbolName}`, {
        orderId: result.data?.orderId,
        executedQty: result.data?.executedQty,
      });

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error(`Failed to process individual snipe target: ${target.symbolName}`, {
        error: safeError.message,
        target,
      });

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Manually process snipe targets
   */
  async processSnipeTargets(): Promise<
    ServiceResponse<{ processedCount: number; successCount: number }>
  > {
    try {
      this.lastSnipeCheck = new Date();
      this.state.lastActivity = new Date();

      // Get ready snipe targets from database
      const readyTargets = await this.getReadySnipeTargets();

      if (readyTargets.length === 0) {
        return {
          success: true,
          data: { processedCount: 0, successCount: 0 },
          timestamp: new Date().toISOString(),
        };
      }

      this.context.logger.info(`Processing ${readyTargets.length} ready snipe targets`);

      let successCount = 0;

      // Process each target
      for (const target of readyTargets) {
        if (target.confidenceScore >= this.context.config.confidenceThreshold) {
          try {
            await this.executeSnipeTarget(target);
            successCount++;
            this.successfulSnipes++;
          } catch (error) {
            const safeError = toSafeError(error);
            this.context.logger.error("Failed to execute snipe target", {
              target,
              error: safeError,
            });
            await this.updateSnipeTargetStatus(target.id, "failed", safeError.message);
            this.failedSnipes++;
          }
        } else {
          this.context.logger.debug("Skipping low confidence target", {
            symbol: target.symbolName,
            confidence: target.confidenceScore,
            threshold: this.context.config.confidenceThreshold,
          });
        }

        this.processedTargets++;
      }

      // Update metrics
      this.state.metrics.processedTargets = this.processedTargets;
      this.state.metrics.successfulSnipes = this.successfulSnipes;
      this.state.metrics.failedSnipes = this.failedSnipes;

      return {
        success: true,
        data: { processedCount: readyTargets.length, successCount },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to process snipe targets", safeError);

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute a specific snipe target
   */
  async executeSnipeTarget(target: AutoSnipeTarget): Promise<TradeResult> {
    this.context.logger.info(`Executing snipe target: ${target.symbolName}`, {
      confidence: target.confidenceScore,
      amount: target.positionSizeUsdt,
      strategy: target.strategy || "normal",
    });

    // Update target status to executing
    await this.updateSnipeTargetStatus(target.id, "executing");

    try {
      // Initialize trading strategy manager
      const strategyManager = new TradingStrategyManager(target.strategy || "normal");
      const strategy = strategyManager.getActiveStrategy();

      this.context.logger.info(`Using strategy: ${strategy.name}`, {
        levels: strategy.levels.length,
        firstPhaseTarget: strategy.levels[0]?.percentage,
      });

      // Prepare trade parameters for initial buy order
      const tradeParams: TradeParameters = {
        symbol: target.symbolName,
        side: "BUY",
        type: "MARKET",
        quoteOrderQty: target.positionSizeUsdt,
        timeInForce: "IOC",
        isAutoSnipe: true,
        confidenceScore: target.confidenceScore,
        stopLossPercent: target.stopLossPercent,
        takeProfitPercent: target.takeProfitCustom,
        strategy: target.strategy || "normal",
      };

      // Execute the initial buy order
      const result = await this.executeTradeViaManualModule(tradeParams);

      if (result.success) {
        // Update target status to completed (initial order)
        await this.updateSnipeTargetStatus(target.id, "completed");

        // Set up multi-phase strategy monitoring if trade was successful
        if (result.data?.executedQty && result.data?.price) {
          await this.setupMultiPhaseMonitoring(target, strategy, {
            entryPrice: parseFloat(result.data.price),
            quantity: parseFloat(result.data.executedQty),
            orderId: result.data.orderId,
          });
        }

        // Emit auto-snipe event with strategy info
        this.context.eventEmitter.emit("auto_snipe_executed", {
          target,
          result,
          strategy: strategy.name,
        });

        this.context.logger.info("Snipe target executed successfully with strategy", {
          symbol: target.symbolName,
          orderId: result.data?.orderId,
          strategy: strategy.name,
          entryPrice: result.data?.price,
          quantity: result.data?.executedQty,
        });
      } else {
        // Update target status to failed
        await this.updateSnipeTargetStatus(target.id, "failed", result.error);
      }

      return result;
    } catch (error) {
      const safeError = toSafeError(error);
      await this.updateSnipeTargetStatus(target.id, "failed", safeError.message);
      throw error;
    }
  }

  /**
   * Set up multi-phase strategy monitoring for executed positions
   */
  private async setupMultiPhaseMonitoring(
    target: AutoSnipeTarget,
    strategy: MultiPhaseStrategy,
    tradeInfo: { entryPrice: number; quantity: number; orderId: string }
  ): Promise<void> {
    try {
      this.context.logger.info(`Setting up multi-phase monitoring for ${target.symbolName}`, {
        strategy: strategy.name,
        entryPrice: tradeInfo.entryPrice,
        quantity: tradeInfo.quantity,
        levels: strategy.levels.length,
      });

      // Create monitoring context for this position
      const monitoringContext = {
        symbol: target.symbolName,
        strategyId: strategy.id,
        entryPrice: tradeInfo.entryPrice,
        totalQuantity: tradeInfo.quantity,
        remainingQuantity: tradeInfo.quantity,
        originalOrderId: tradeInfo.orderId,
        levels: strategy.levels,
        executedLevels: [] as number[],
        createdAt: new Date().toISOString(),
      };

      // Emit event to start strategy monitoring
      // This would be handled by a separate strategy monitoring service
      this.context.eventEmitter.emit("multi_phase_strategy_started", {
        target,
        strategy,
        tradeInfo,
        monitoringContext,
      });

      this.context.logger.info(`Multi-phase monitoring initiated for ${target.symbolName}`, {
        targetLevels: strategy.levels.map((level) => `${level.percentage}%`),
        firstTarget: strategy.levels[0]?.percentage,
      });
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error(`Failed to setup multi-phase monitoring for ${target.symbolName}`, {
        error: safeError.message,
        strategy: strategy.name,
      });
      // Continue execution even if monitoring setup fails
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get ready snipe targets from database
   */
  private async getReadySnipeTargets(): Promise<AutoSnipeTarget[]> {
    try {
      const now = new Date();
      const targets = await db
        .select()
        .from(snipeTargets)
        .where(
          and(
            eq(snipeTargets.status, "ready"),
            or(isNull(snipeTargets.targetExecutionTime), lt(snipeTargets.targetExecutionTime, now))
          )
        )
        .orderBy(snipeTargets.priority, snipeTargets.createdAt)
        .limit(10);

      return targets;
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to fetch ready snipe targets", safeError);
      return [];
    }
  }

  /**
   * Update snipe target status in database
   */
  private async updateSnipeTargetStatus(
    targetId: number,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateData: {
        status: string;
        updatedAt: Date;
        actualExecutionTime?: Date;
        errorMessage?: string;
      } = {
        status,
        updatedAt: new Date(),
      };

      if (status === "executing") {
        updateData.actualExecutionTime = new Date();
      }

      if (errorMessage) {
        updateData.errorMessage = errorMessage;
      }

      await db.update(snipeTargets).set(updateData).where(eq(snipeTargets.id, targetId));
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to update snipe target status", {
        targetId,
        status,
        error: safeError,
      });
    }
  }

  /**
   * Execute trade via manual trading module
   * This would typically call the manual trading module's executeTrade method
   */
  private async executeTradeViaManualModule(params: TradeParameters): Promise<TradeResult> {
    try {
      // Simulate trade execution for now
      // In a real implementation, this would call the manual trading module

      if (this.context.config.enablePaperTrading) {
        return await this.executePaperSnipe(params);
      } else {
        return await this.executeRealSnipe(params);
      }
    } catch (error) {
      const safeError = toSafeError(error);
      throw safeError;
    }
  }

  /**
   * Execute paper snipe trade
   */
  private async executePaperSnipe(params: TradeParameters): Promise<TradeResult> {
    const startTime = Date.now();
    const simulatedPrice = 100 + Math.random() * 1000; // Mock price
    const orderId = `paper-snipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      data: {
        orderId,
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        quantity: (params.quoteOrderQty! / simulatedPrice).toString(),
        price: simulatedPrice.toString(),
        status: "FILLED",
        executedQty: (params.quoteOrderQty! / simulatedPrice).toString(),
        timestamp: new Date().toISOString(),
        paperTrade: true,
        simulatedPrice,
        autoSnipe: true,
        confidenceScore: params.confidenceScore,
      },
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Execute real snipe trade
   */
  private async executeRealSnipe(params: TradeParameters): Promise<TradeResult> {
    const startTime = Date.now();

    try {
      // Enhanced safety checks before trading
      await this.performPreTradeValidation(params);

      // Get current market price for validation
      const currentPrice = await this.getCurrentMarketPrice(params.symbol);
      if (!currentPrice) {
        throw new Error(`Unable to get current price for ${params.symbol}`);
      }

      // Prepare MEXC API parameters with enhanced validation
      const mexcParams = {
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        quoteOrderQty: params.quoteOrderQty,
        timeInForce: params.timeInForce || "IOC",
      };

      // Validate order parameters
      await this.validateOrderParameters(mexcParams, currentPrice);

      // Execute through MEXC service with retry logic
      const mexcResult = await this.executeOrderWithRetry(mexcParams);

      if (!mexcResult.success || !mexcResult.data) {
        throw new Error(mexcResult.error || "Snipe trade execution failed");
      }

      // Create position tracking entry
      const position = await this.createPositionEntry(mexcResult.data, params, currentPrice);

      // Setup stop-loss and take-profit monitoring
      await this.setupPositionMonitoring(position, params);

      const result: TradeResult = {
        success: true,
        data: {
          orderId: mexcResult.data.orderId.toString(),
          clientOrderId: mexcResult.data.clientOrderId,
          symbol: mexcResult.data.symbol,
          side: mexcResult.data.side,
          type: mexcResult.data.type,
          quantity: mexcResult.data.origQty,
          price: mexcResult.data.price || currentPrice.toString(),
          status: mexcResult.data.status,
          executedQty: mexcResult.data.executedQty,
          cummulativeQuoteQty: mexcResult.data.cummulativeQuoteQty,
          timestamp: new Date(mexcResult.data.transactTime || Date.now()).toISOString(),
          autoSnipe: true,
          confidenceScore: params.confidenceScore,
        },
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      this.context.logger.info("Real snipe trade executed successfully", {
        orderId: result.data?.orderId,
        symbol: params.symbol,
        executedQty: result.data?.executedQty,
        entryPrice: result.data?.price,
        positionId: position.id,
      });

      // Emit position opened event
      this.context.eventEmitter.emit("position_opened", position);

      return result;
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Real snipe trade execution failed", {
        symbol: params.symbol,
        error: safeError.message,
        params: {
          side: params.side,
          type: params.type,
          quoteOrderQty: params.quoteOrderQty,
        },
      });
      throw safeError;
    }
  }

  // ============================================================================
  // Enhanced Trading Helper Methods
  // ============================================================================

  /**
   * Perform comprehensive pre-trade validation
   */
  private async performPreTradeValidation(params: TradeParameters): Promise<void> {
    // Check safety coordinator
    if (this.context.safetyCoordinator) {
      const safetyStatus = this.context.safetyCoordinator.getCurrentStatus();
      if (safetyStatus.overall.safetyLevel !== "safe") {
        throw new Error(`Trading blocked by safety system: ${safetyStatus.overall.safetyLevel}`);
      }
    }

    // Check module health
    if (!this.state.isHealthy || !this.state.isInitialized) {
      throw new Error("Auto-sniping module is not healthy or not initialized");
    }

    // Check position limits
    if (this.activePositions.size >= this.context.config.maxConcurrentPositions) {
      throw new Error(`Maximum concurrent positions reached: ${this.activePositions.size}`);
    }

    // Validate required parameters
    if (!params.symbol || !params.side || !params.type) {
      throw new Error("Missing required trading parameters");
    }

    if (!params.quoteOrderQty || params.quoteOrderQty <= 0) {
      throw new Error("Invalid position size");
    }
  }

  /**
   * Get current market price for a symbol
   */
  private async getCurrentMarketPrice(symbol: string): Promise<number | null> {
    try {
      // Enhanced price fetching with multiple fallback options
      let price: number | null = null;

      // Primary method: Try to get ticker data from MEXC service
      if (this.context.mexcService && typeof this.context.mexcService.getTicker === "function") {
        try {
          const ticker = await this.context.mexcService.getTicker(symbol);
          if (ticker.success && ticker.data) {
            // Try different price fields that might be available
            const priceFields = ['price', 'lastPrice', 'close', 'last'];
            for (const field of priceFields) {
              if (ticker.data[field]) {
                const priceValue = parseFloat(ticker.data[field]);
                if (priceValue > 0) {
                  price = priceValue;
                  break;
                }
              }
            }
          }
        } catch (tickerError) {
          this.context.logger.warn(`Failed to get ticker for ${symbol}`, {
            error: tickerError instanceof Error ? tickerError.message : String(tickerError)
          });
        }
      }

      // Fallback: Try getCurrentPrice method if available
      if (!price && this.context.mexcService && typeof this.context.mexcService.getCurrentPrice === "function") {
        try {
          const priceResult = await this.context.mexcService.getCurrentPrice(symbol);
          if (typeof priceResult === "number" && priceResult > 0) {
            price = priceResult;
          }
        } catch (priceError) {
          this.context.logger.warn(`Failed to get current price for ${symbol}`, {
            error: priceError instanceof Error ? priceError.message : String(priceError)
          });
        }
      }

      // Additional fallback: Try order book data
      if (!price && this.context.mexcService && typeof this.context.mexcService.getOrderBook === "function") {
        try {
          const orderBook = await this.context.mexcService.getOrderBook(symbol, 5);
          if (orderBook.success && orderBook.data) {
            const { bids, asks } = orderBook.data;
            if (bids && bids.length > 0 && asks && asks.length > 0) {
              const bidPrice = parseFloat(bids[0][0]);
              const askPrice = parseFloat(asks[0][0]);
              if (bidPrice > 0 && askPrice > 0) {
                price = (bidPrice + askPrice) / 2; // Mid-price
              }
            }
          }
        } catch (orderBookError) {
          this.context.logger.warn(`Failed to get order book for ${symbol}`, {
            error: orderBookError instanceof Error ? orderBookError.message : String(orderBookError)
          });
        }
      }

      if (price && price > 0) {
        this.context.logger.debug(`Got current price for ${symbol}: ${price}`);
        return price;
      }

      this.context.logger.error(`Unable to get current price for ${symbol} from any source`);
      return null;
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error(`Critical error getting current price for ${symbol}`, safeError);
      return null;
    }
  }

  /**
   * Validate order parameters before execution
   */
  private async validateOrderParameters(
    orderParams: TradeParameters,
    currentPrice: number
  ): Promise<void> {
    // Validate symbol format
    if (!orderParams.symbol || typeof orderParams.symbol !== "string") {
      throw new Error("Invalid symbol format");
    }

    // Validate side
    if (!["BUY", "SELL"].includes(orderParams.side)) {
      throw new Error("Invalid order side");
    }

    // Validate order type
    if (!["MARKET", "LIMIT", "STOP_LIMIT"].includes(orderParams.type)) {
      throw new Error("Invalid order type");
    }

    // Validate time in force
    if (orderParams.timeInForce && !["GTC", "IOC", "FOK"].includes(orderParams.timeInForce)) {
      throw new Error("Invalid time in force");
    }

    // Validate quote order quantity
    if (orderParams.quoteOrderQty) {
      const minOrderValue = 5; // USDT minimum
      if (orderParams.quoteOrderQty < minOrderValue) {
        throw new Error(`Order value too small. Minimum: ${minOrderValue} USDT`);
      }
    }

    // Market price sanity check
    if (currentPrice <= 0) {
      throw new Error("Invalid market price");
    }
  }

  /**
   * Execute order with retry logic
   */
  private async executeOrderWithRetry(
    orderParams: TradeParameters,
    maxRetries: number = 3
  ): Promise<ServiceResponse<any>> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Convert TradeParameters to the format expected by MEXC service
        const mexcOrderData = {
          symbol: orderParams.symbol,
          side: orderParams.side,
          type: orderParams.type,
          quantity: orderParams.quantity?.toString(),
          price: orderParams.price?.toString(),
          timeInForce: orderParams.timeInForce,
        };

        // If using quoteOrderQty (for market orders), we need to handle this differently
        if (orderParams.quoteOrderQty && orderParams.type === "MARKET") {
          // For market buy orders with quoteOrderQty, we need to calculate the quantity
          if (orderParams.side === "BUY") {
            // Get current market price to calculate quantity
            const currentPrice = await this.getCurrentMarketPrice(orderParams.symbol);
            if (!currentPrice) {
              throw new Error(`Unable to get current price for ${orderParams.symbol}`);
            }
            mexcOrderData.quantity = (orderParams.quoteOrderQty / currentPrice).toString();
          } else {
            // For sell orders, quantity should be provided directly
            if (!orderParams.quantity) {
              throw new Error("Quantity required for SELL orders");
            }
            mexcOrderData.quantity = orderParams.quantity.toString();
          }
        }

        const result = await this.context.mexcService.placeOrder(mexcOrderData);

        if (result.success) {
          return {
            success: true,
            data: result.data,
            timestamp: new Date().toISOString(),
          };
        } else {
          throw new Error(result.error || "Order execution failed");
        }
      } catch (error) {
        lastError = toSafeError(error);

        this.context.logger.warn(`Order attempt ${attempt}/${maxRetries} failed`, {
          symbol: orderParams.symbol,
          error: lastError.message,
        });

        // Don't retry on certain errors
        if (
          lastError.message.includes("insufficient balance") ||
          lastError.message.includes("invalid symbol") ||
          lastError.message.includes("trading disabled") ||
          lastError.message.includes("MARKET_LOT_SIZE") ||
          lastError.message.includes("MIN_NOTIONAL")
        ) {
          throw lastError;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * 2 ** (attempt - 1), 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error("Order execution failed after all retries");
  }

  /**
   * Create position tracking entry
   */
  private async createPositionEntry(
    orderResult: any,
    params: TradeParameters,
    currentPrice: number
  ): Promise<Position> {
    const positionId = `${params.symbol}-${orderResult.orderId}-${Date.now()}`;
    const entryPrice = parseFloat(orderResult.price) || currentPrice;
    const quantity = parseFloat(orderResult.executedQty || orderResult.origQty);

    const position: Position = {
      id: positionId,
      symbol: params.symbol,
      side: params.side,
      orderId: orderResult.orderId.toString(),
      clientOrderId: orderResult.clientOrderId,
      entryPrice,
      quantity,
      currentPrice: entryPrice,
      stopLossPercent: params.stopLossPercent,
      takeProfitPercent: params.takeProfitPercent,
      status: "open",
      openTime: new Date(),
      strategy: params.strategy || "auto-snipe",
      confidenceScore: params.confidenceScore,
      autoSnipe: true,
      paperTrade: this.context.config.enablePaperTrading,
      tags: ["auto-snipe"],
    };

    // Calculate stop-loss and take-profit prices
    if (params.stopLossPercent && params.stopLossPercent > 0) {
      if (params.side === "BUY") {
        position.stopLossPrice = entryPrice * (1 - params.stopLossPercent / 100);
      } else {
        position.stopLossPrice = entryPrice * (1 + params.stopLossPercent / 100);
      }
    }

    if (params.takeProfitPercent && params.takeProfitPercent > 0) {
      if (params.side === "BUY") {
        position.takeProfitPrice = entryPrice * (1 + params.takeProfitPercent / 100);
      } else {
        position.takeProfitPrice = entryPrice * (1 - params.takeProfitPercent / 100);
      }
    }

    // Store position in active positions map
    this.activePositions.set(positionId, position);

    this.context.logger.info("Position created", {
      positionId,
      symbol: params.symbol,
      side: params.side,
      entryPrice,
      quantity,
      stopLossPrice: position.stopLossPrice,
      takeProfitPrice: position.takeProfitPrice,
    });

    return position;
  }

  /**
   * Setup stop-loss and take-profit monitoring for a position
   */
  private async setupPositionMonitoring(
    position: Position,
    params: TradeParameters
  ): Promise<void> {
    try {
      // Setup stop-loss monitoring
      if (position.stopLossPrice) {
        this.setupStopLossMonitoring(position);
      }

      // Setup take-profit monitoring
      if (position.takeProfitPrice) {
        this.setupTakeProfitMonitoring(position);
      }

      this.context.logger.info("Position monitoring setup completed", {
        positionId: position.id,
        hasStopLoss: !!position.stopLossPrice,
        hasTakeProfit: !!position.takeProfitPrice,
      });
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to setup position monitoring", {
        positionId: position.id,
        error: safeError.message,
      });
    }
  }

  /**
   * Setup stop-loss monitoring for a position
   */
  private setupStopLossMonitoring(position: Position): void {
    const checkInterval = 5000; // Check every 5 seconds

    const monitorStopLoss = async () => {
      try {
        const currentPrice = await this.getCurrentMarketPrice(position.symbol);
        if (!currentPrice) {
          return;
        }

        // Update position current price
        position.currentPrice = currentPrice;

        // Check if stop-loss should trigger
        let shouldTrigger = false;
        if (position.side === "BUY" && currentPrice <= (position.stopLossPrice || 0)) {
          shouldTrigger = true;
        } else if (position.side === "SELL" && currentPrice >= (position.stopLossPrice || 0)) {
          shouldTrigger = true;
        }

        if (shouldTrigger) {
          await this.executeStopLoss(position);
        } else {
          // Continue monitoring
          const timer = setTimeout(monitorStopLoss, checkInterval);
          this.pendingStopLosses.set(position.id, timer);
        }
      } catch (error) {
        const safeError = toSafeError(error);
        this.context.logger.error("Stop-loss monitoring error", {
          positionId: position.id,
          error: safeError.message,
        });
      }
    };

    // Start monitoring
    const timer = setTimeout(monitorStopLoss, checkInterval);
    this.pendingStopLosses.set(position.id, timer);
  }

  /**
   * Setup take-profit monitoring for a position
   */
  private setupTakeProfitMonitoring(position: Position): void {
    const checkInterval = 5000; // Check every 5 seconds

    const monitorTakeProfit = async () => {
      try {
        const currentPrice = await this.getCurrentMarketPrice(position.symbol);
        if (!currentPrice) {
          return;
        }

        // Update position current price
        position.currentPrice = currentPrice;

        // Check if take-profit should trigger
        let shouldTrigger = false;
        if (position.side === "BUY" && currentPrice >= (position.takeProfitPrice || 0)) {
          shouldTrigger = true;
        } else if (position.side === "SELL" && currentPrice <= (position.takeProfitPrice || 0)) {
          shouldTrigger = true;
        }

        if (shouldTrigger) {
          await this.executeTakeProfit(position);
        } else {
          // Continue monitoring
          const timer = setTimeout(monitorTakeProfit, checkInterval);
          this.pendingTakeProfits.set(position.id, timer);
        }
      } catch (error) {
        const safeError = toSafeError(error);
        this.context.logger.error("Take-profit monitoring error", {
          positionId: position.id,
          error: safeError.message,
        });
      }
    };

    // Start monitoring
    const timer = setTimeout(monitorTakeProfit, checkInterval);
    this.pendingTakeProfits.set(position.id, timer);
  }

  /**
   * Execute stop-loss for a position
   */
  private async executeStopLoss(position: Position): Promise<void> {
    try {
      this.context.logger.info("Executing stop-loss", {
        positionId: position.id,
        symbol: position.symbol,
        currentPrice: position.currentPrice,
        stopLossPrice: position.stopLossPrice,
      });

      // Place opposite order to close position
      const closeParams: TradeParameters = {
        symbol: position.symbol,
        side: position.side === "BUY" ? "SELL" : "BUY",
        type: "MARKET",
        quantity: position.quantity,
        timeInForce: "IOC",
      };

      const closeResult = await this.executeOrderWithRetry(closeParams);

      if (closeResult.success) {
        // Calculate realized PnL
        const entryValue = position.entryPrice * position.quantity;
        const exitValue = (position.currentPrice || 0) * position.quantity;
        const realizedPnL =
          position.side === "BUY" ? exitValue - entryValue : entryValue - exitValue;

        // Update position
        position.status = "closed";
        position.closeTime = new Date();
        position.realizedPnL = realizedPnL;

        // Clean up monitoring
        this.cleanupPositionMonitoring(position.id);
        this.activePositions.delete(position.id);

        // Emit position closed event
        this.context.eventEmitter.emit("position_closed", position);

        this.context.logger.info("Stop-loss executed successfully", {
          positionId: position.id,
          realizedPnL,
          closeOrderId: closeResult.data?.orderId,
        });
      } else {
        throw new Error(closeResult.error || "Failed to execute stop-loss order");
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Stop-loss execution failed", {
        positionId: position.id,
        error: safeError.message,
      });
    }
  }

  /**
   * Execute take-profit for a position
   */
  private async executeTakeProfit(position: Position): Promise<void> {
    try {
      this.context.logger.info("Executing take-profit", {
        positionId: position.id,
        symbol: position.symbol,
        currentPrice: position.currentPrice,
        takeProfitPrice: position.takeProfitPrice,
      });

      // Place opposite order to close position
      const closeParams: TradeParameters = {
        symbol: position.symbol,
        side: position.side === "BUY" ? "SELL" : "BUY",
        type: "MARKET",
        quantity: position.quantity,
        timeInForce: "IOC",
      };

      const closeResult = await this.executeOrderWithRetry(closeParams);

      if (closeResult.success) {
        // Calculate realized PnL
        const entryValue = position.entryPrice * position.quantity;
        const exitValue = (position.currentPrice || 0) * position.quantity;
        const realizedPnL =
          position.side === "BUY" ? exitValue - entryValue : entryValue - exitValue;

        // Update position
        position.status = "closed";
        position.closeTime = new Date();
        position.realizedPnL = realizedPnL;

        // Clean up monitoring
        this.cleanupPositionMonitoring(position.id);
        this.activePositions.delete(position.id);

        // Emit position closed event
        this.context.eventEmitter.emit("position_closed", position);

        this.context.logger.info("Take-profit executed successfully", {
          positionId: position.id,
          realizedPnL,
          closeOrderId: closeResult.data?.orderId,
        });
      } else {
        throw new Error(closeResult.error || "Failed to execute take-profit order");
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Take-profit execution failed", {
        positionId: position.id,
        error: safeError.message,
      });
    }
  }

  /**
   * Cleanup position monitoring timers
   */
  private cleanupPositionMonitoring(positionId: string): void {
    // Clear stop-loss timer
    const stopLossTimer = this.pendingStopLosses.get(positionId);
    if (stopLossTimer) {
      clearTimeout(stopLossTimer);
      this.pendingStopLosses.delete(positionId);
    }

    // Clear take-profit timer
    const takeProfitTimer = this.pendingTakeProfits.get(positionId);
    if (takeProfitTimer) {
      clearTimeout(takeProfitTimer);
      this.pendingTakeProfits.delete(positionId);
    }
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return this.context.config;
  }

  /**
   * Check if ready for trading
   */
  isReadyForTrading(): boolean {
    return this.state.isInitialized && this.state.isHealthy;
  }

  /**
   * Validate configuration
   */
  async validateConfiguration(): Promise<boolean> {
    try {
      // Basic validation logic
      const config = this.context.config;
      return (
        config &&
        typeof config.autoSnipingEnabled === "boolean" &&
        typeof config.confidenceThreshold === "number" &&
        config.confidenceThreshold >= 0 &&
        config.confidenceThreshold <= 100
      );
    } catch (_error) {
      return false;
    }
  }

  /**
   * Perform health checks
   */
  async performHealthChecks(): Promise<boolean> {
    try {
      // Basic health check logic
      return this.state.isInitialized && this.state.isHealthy;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    const totalPnL = Array.from(this.activePositions.values()).reduce(
      (sum, pos) => sum + (pos.realizedPnL || 0),
      0
    );

    return {
      activePositions: this.activePositions.size,
      totalTrades: this.processedTargets,
      successfulTrades: this.successfulSnipes,
      failedTrades: this.failedSnipes,
      successRate:
        this.processedTargets > 0 ? (this.successfulSnipes / this.processedTargets) * 100 : 0,
      totalPnL,
      averagePnL: this.processedTargets > 0 ? totalPnL / this.processedTargets : 0,
      pendingStopLosses: this.pendingStopLosses.size,
      pendingTakeProfits: this.pendingTakeProfits.size,
      timestamp: Date.now(),
    };
  }

  /**
   * Update statistics
   */
  updateStats(stats: StatsUpdate): void {
    // Update internal metrics with provided stats
    if (stats.totalTrades !== undefined) {
      this.processedTargets = stats.totalTrades;
    }
    if (stats.successfulTrades !== undefined) {
      this.successfulSnipes = stats.successfulTrades;
    }
    if (stats.failedTrades !== undefined) {
      this.failedSnipes = stats.failedTrades;
    }
    if (stats.timestamp !== undefined) {
      this.state.lastActivity = new Date(stats.timestamp);
    }

    // Update state metrics
    this.state.metrics.processedTargets = this.processedTargets;
    this.state.metrics.successfulSnipes = this.successfulSnipes;
    this.state.metrics.failedSnipes = this.failedSnipes;
    this.state.metrics.averageConfidence =
      this.processedTargets > 0 ? (this.successfulSnipes / this.processedTargets) * 100 : 0;
  }

  /**
   * Check if execution is active
   */
  isExecutionActive(): boolean {
    return this.isActive;
  }

  /**
   * Get active positions
   */
  getActivePositions(): Position[] {
    return Array.from(this.activePositions.values());
  }

  /**
   * Manually close a position
   */
  async closePosition(
    positionId: string,
    reason: string = "manual"
  ): Promise<ServiceResponse<void>> {
    try {
      const position = this.activePositions.get(positionId);
      if (!position) {
        return {
          success: false,
          error: `Position ${positionId} not found`,
          timestamp: new Date().toISOString(),
        };
      }

      // Place opposite order to close position
      const closeParams: TradeParameters = {
        symbol: position.symbol,
        side: position.side === "BUY" ? "SELL" : "BUY",
        type: "MARKET",
        quantity: position.quantity,
        timeInForce: "IOC",
      };

      const closeResult = await this.executeOrderWithRetry(closeParams);

      if (closeResult.success) {
        // Calculate realized PnL
        const currentPrice =
          (await this.getCurrentMarketPrice(position.symbol)) ||
          position.currentPrice ||
          position.entryPrice;
        const entryValue = position.entryPrice * position.quantity;
        const exitValue = currentPrice * position.quantity;
        const realizedPnL =
          position.side === "BUY" ? exitValue - entryValue : entryValue - exitValue;

        // Update position
        position.status = "closed";
        position.closeTime = new Date();
        position.realizedPnL = realizedPnL;
        position.notes = `Closed manually: ${reason}`;

        // Clean up monitoring
        this.cleanupPositionMonitoring(position.id);
        this.activePositions.delete(position.id);

        // Emit position closed event
        this.context.eventEmitter.emit("position_closed", position);

        this.context.logger.info("Position closed manually", {
          positionId,
          reason,
          realizedPnL,
          closeOrderId: closeResult.data?.orderId,
        });

        return {
          success: true,
          timestamp: new Date().toISOString(),
        };
      } else {
        return {
          success: false,
          error: closeResult.error || "Failed to close position",
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to close position manually", {
        positionId,
        error: safeError.message,
      });

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Close all active positions
   */
  async closeAllPositions(
    reason: string = "shutdown"
  ): Promise<ServiceResponse<{ closed: number; failed: number }>> {
    const positions = Array.from(this.activePositions.keys());
    let closed = 0;
    let failed = 0;

    for (const positionId of positions) {
      try {
        const result = await this.closePosition(positionId, reason);
        if (result.success) {
          closed++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        const safeError = toSafeError(error);
        this.context.logger.error(`Failed to close position ${positionId}`, safeError);
      }
    }

    this.context.logger.info("Batch position close completed", {
      total: positions.length,
      closed,
      failed,
      reason,
    });

    return {
      success: true,
      data: { closed, failed },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get position by ID
   */
  getPosition(positionId: string): Position | null {
    return this.activePositions.get(positionId) || null;
  }

  /**
   * Get positions by symbol
   */
  getPositionsBySymbol(symbol: string): Position[] {
    return Array.from(this.activePositions.values()).filter((pos) => pos.symbol === symbol);
  }

  /**
   * Update position stop-loss
   */
  async updatePositionStopLoss(
    positionId: string,
    newStopLossPercent: number
  ): Promise<ServiceResponse<void>> {
    try {
      const position = this.activePositions.get(positionId);
      if (!position) {
        return {
          success: false,
          error: `Position ${positionId} not found`,
          timestamp: new Date().toISOString(),
        };
      }

      // Clear existing stop-loss monitoring
      const stopLossTimer = this.pendingStopLosses.get(positionId);
      if (stopLossTimer) {
        clearTimeout(stopLossTimer);
        this.pendingStopLosses.delete(positionId);
      }

      // Update stop-loss price
      position.stopLossPercent = newStopLossPercent;
      if (newStopLossPercent > 0) {
        if (position.side === "BUY") {
          position.stopLossPrice = position.entryPrice * (1 - newStopLossPercent / 100);
        } else {
          position.stopLossPrice = position.entryPrice * (1 + newStopLossPercent / 100);
        }

        // Setup new monitoring
        this.setupStopLossMonitoring(position);
      } else {
        position.stopLossPrice = undefined;
      }

      this.context.logger.info("Position stop-loss updated", {
        positionId,
        newStopLossPercent,
        newStopLossPrice: position.stopLossPrice,
      });

      return {
        success: true,
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
   * Update position take-profit
   */
  async updatePositionTakeProfit(
    positionId: string,
    newTakeProfitPercent: number
  ): Promise<ServiceResponse<void>> {
    try {
      const position = this.activePositions.get(positionId);
      if (!position) {
        return {
          success: false,
          error: `Position ${positionId} not found`,
          timestamp: new Date().toISOString(),
        };
      }

      // Clear existing take-profit monitoring
      const takeProfitTimer = this.pendingTakeProfits.get(positionId);
      if (takeProfitTimer) {
        clearTimeout(takeProfitTimer);
        this.pendingTakeProfits.delete(positionId);
      }

      // Update take-profit price
      position.takeProfitPercent = newTakeProfitPercent;
      if (newTakeProfitPercent > 0) {
        if (position.side === "BUY") {
          position.takeProfitPrice = position.entryPrice * (1 + newTakeProfitPercent / 100);
        } else {
          position.takeProfitPrice = position.entryPrice * (1 - newTakeProfitPercent / 100);
        }

        // Setup new monitoring
        this.setupTakeProfitMonitoring(position);
      } else {
        position.takeProfitPrice = undefined;
      }

      this.context.logger.info("Position take-profit updated", {
        positionId,
        newTakeProfitPercent,
        newTakeProfitPrice: position.takeProfitPrice,
      });

      return {
        success: true,
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

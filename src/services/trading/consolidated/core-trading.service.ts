/**
 * Core Trading Service - Consolidated Implementation
 * 
 * This service consolidates all trading-related functionality including:
 * - Manual trading operations
 * - Auto-sniping execution and orchestration
 * - Multi-phase trading strategies
 * - Position management and analytics
 * - Risk management integration
 * - Performance tracking and reporting
 * 
 * Replaces 25+ fragmented trading services with a single, cohesive interface.
 */

import { EventEmitter } from "events";
import { and, eq, lt } from "drizzle-orm";
import { toSafeError } from "../../lib/error-type-utils";
import { db } from "../../db";
import { snipeTargets } from "../../db/schemas/trading";

// Import consolidated types
import type {
  CoreTradingConfig,
  CoreTradingEvents,
  MultiPhaseConfig,
  MultiPhaseResult,
  PerformanceMetrics,
  Position,
  ServiceResponse,
  ServiceStatus,
  TradeParameters,
  TradeResult,
  TradingStrategy,
  AutoSnipeTarget,
} from "./core-trading.types";

import {
  CoreTradingConfigSchema,
  TradeParametersSchema,
  ServiceStatusSchema,
} from "./core-trading.types";

// Import existing components that will be integrated
import { UnifiedMexcServiceV2 } from "../unified-mexc-service-v2";
import { ComprehensiveSafetyCoordinator } from "../comprehensive-safety-coordinator";

/**
 * Core Trading Service
 * 
 * Consolidated trading service that provides a unified interface for all
 * trading operations, auto-sniping, strategy management, and analytics.
 */
export class CoreTradingService extends EventEmitter<CoreTradingEvents> {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[core-trading-service]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[core-trading-service]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[core-trading-service]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[core-trading-service]", message, context || ""),
  };

  private static instance: CoreTradingService | null = null;

  // Core configuration and state
  private config: CoreTradingConfig;
  private isInitialized = false;
  private isHealthy = true;

  // Integrated services
  private mexcService: UnifiedMexcServiceV2;
  private safetyCoordinator: ComprehensiveSafetyCoordinator | null = null;

  // Position and strategy management
  private activePositions = new Map<string, Position>();
  private tradingStrategies = new Map<string, TradingStrategy>();
  private performanceMetrics: PerformanceMetrics | null = null;

  // Circuit breaker state
  private circuitBreakerOpen = false;
  private circuitBreakerFailures = 0;
  private circuitBreakerResetTime: Date | null = null;

  // Auto-sniping state
  private autoSnipingInterval: NodeJS.Timeout | null = null;
  private lastSnipeCheck: Date | null = null;

  // Performance tracking
  private startTime = new Date();
  private totalTrades = 0;
  private successfulTrades = 0;
  private failedTrades = 0;
  private totalVolume = 0;
  private totalPnL = 0;

  constructor(config: Partial<CoreTradingConfig> = {}) {
    super();

    // Validate and set configuration
    this.config = CoreTradingConfigSchema.parse({
      apiKey: process.env.MEXC_API_KEY || "",
      secretKey: process.env.MEXC_SECRET_KEY || "",
      ...config,
    });

    // Initialize MEXC service
    this.mexcService = new UnifiedMexcServiceV2({
      apiKey: this.config.apiKey,
      secretKey: this.config.secretKey,
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      enableCaching: this.config.enableCaching,
      cacheTTL: this.config.cacheTTL,
    });

    // Initialize default strategies
    this.initializeDefaultStrategies();

    this.logger.info("Core Trading Service initialized", {
      paperTrading: this.config.enablePaperTrading,
      maxPositions: this.config.maxConcurrentPositions,
      strategy: this.config.defaultStrategy,
    });
  }

  // ============================================================================
  // Singleton Pattern
  // ============================================================================

  public static getInstance(config?: Partial<CoreTradingConfig>): CoreTradingService {
    if (!CoreTradingService.instance) {
      CoreTradingService.instance = new CoreTradingService(config);
    }
    return CoreTradingService.instance;
  }

  public static resetInstance(): void {
    if (CoreTradingService.instance) {
      CoreTradingService.instance.cleanup();
    }
    CoreTradingService.instance = null;
  }

  // ============================================================================
  // Lifecycle Management
  // ============================================================================

  /**
   * Initialize the service and all dependencies
   */
  async initialize(): Promise<ServiceResponse<void>> {
    try {
      this.logger.info("Initializing Core Trading Service...");

      // Initialize safety coordinator if risk management is enabled
      if (this.config.enableCircuitBreaker) {
        this.safetyCoordinator = new ComprehensiveSafetyCoordinator();
        await this.safetyCoordinator.start();
      }

      // Start auto-sniping if enabled
      if (this.config.autoSnipingEnabled) {
        this.startAutoSniping();
      }

      // Initialize performance metrics
      await this.initializePerformanceMetrics();

      this.isInitialized = true;
      this.logger.info("Core Trading Service initialized successfully");

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to initialize Core Trading Service", safeError);
      
      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Shutdown the service gracefully
   */
  async shutdown(): Promise<ServiceResponse<void>> {
    try {
      this.logger.info("Shutting down Core Trading Service...");

      // Stop auto-sniping
      this.stopAutoSniping();

      // Close all positions if not in paper trading mode
      if (!this.config.enablePaperTrading && this.activePositions.size > 0) {
        await this.closeAllPositions("Service shutdown");
      }

      // Stop safety coordinator
      if (this.safetyCoordinator) {
        await this.safetyCoordinator.stop();
      }

      // Clean up resources
      this.cleanup();

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Error during shutdown", safeError);
      
      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ============================================================================
  // Manual Trading Operations
  // ============================================================================

  /**
   * Execute a manual trade
   */
  async executeTrade(params: TradeParameters): Promise<TradeResult> {
    try {
      // Validate parameters
      const validatedParams = TradeParametersSchema.parse(params);

      // Check circuit breaker
      if (this.circuitBreakerOpen) {
        return {
          success: false,
          error: "Circuit breaker is open - trading temporarily disabled",
          timestamp: new Date().toISOString(),
        };
      }

      // Check position limits
      if (this.activePositions.size >= this.config.maxConcurrentPositions) {
        return {
          success: false,
          error: `Maximum concurrent positions reached (${this.config.maxConcurrentPositions})`,
          timestamp: new Date().toISOString(),
        };
      }

      // Check safety coordinator
      if (this.safetyCoordinator) {
        const safetyStatus = this.safetyCoordinator.getCurrentStatus();
        if (safetyStatus.overall.safetyLevel !== "safe") {
          return {
            success: false,
            error: `Trading blocked by safety system: ${safetyStatus.overall.safetyLevel}`,
            timestamp: new Date().toISOString(),
          };
        }
      }

      // Execute trade based on paper trading mode
      if (this.config.enablePaperTrading) {
        return await this.executePaperTrade(validatedParams);
      } else {
        return await this.executeRealTrade(validatedParams);
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Trade execution failed", { params, error: safeError });
      
      this.handleTradeFailure(safeError);
      
      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute a paper trade (simulation)
   */
  private async executePaperTrade(params: TradeParameters): Promise<TradeResult> {
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
    };

    // Track position if it's a buy order
    if (params.side === "BUY") {
      await this.trackPosition(result, params);
    }

    // Update metrics
    this.updateTradeMetrics(result, params);
    
    // Emit event
    this.emit("trade_executed", result);

    this.logger.info("Paper trade executed successfully", {
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
  private async executeRealTrade(params: TradeParameters): Promise<TradeResult> {
    const startTime = Date.now();
    
    try {
      // Prepare MEXC API parameters
      const mexcParams = {
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        quantity: params.quantity,
        quoteOrderQty: params.quoteOrderQty,
        price: params.price,
        stopPrice: params.stopPrice,
        timeInForce: params.timeInForce,
        newClientOrderId: params.newClientOrderId,
      };

      // Execute through MEXC service
      const mexcResult = await this.mexcService.placeOrder(mexcParams);
      
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
      };

      // Track position if it's a buy order
      if (params.side === "BUY") {
        await this.trackPosition(result, params);
      }

      // Update metrics
      this.updateTradeMetrics(result, params);
      
      // Emit event
      this.emit("trade_executed", result);

      this.logger.info("Real trade executed successfully", {
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

  // ============================================================================
  // Auto-Sniping Operations
  // ============================================================================

  /**
   * Start auto-sniping monitoring
   */
  startAutoSniping(): void {
    if (this.autoSnipingInterval) {
      this.logger.warn("Auto-sniping already running");
      return;
    }

    this.logger.info("Starting auto-sniping monitoring", {
      interval: this.config.snipeCheckInterval,
      confidenceThreshold: this.config.confidenceThreshold,
    });

    this.autoSnipingInterval = setInterval(
      () => this.processSnipeTargets(),
      this.config.snipeCheckInterval
    );
  }

  /**
   * Stop auto-sniping monitoring
   */
  stopAutoSniping(): void {
    if (this.autoSnipingInterval) {
      clearInterval(this.autoSnipingInterval);
      this.autoSnipingInterval = null;
      this.logger.info("Auto-sniping monitoring stopped");
    }
  }

  /**
   * Process ready snipe targets from database
   */
  async processSnipeTargets(): Promise<ServiceResponse<{ processedCount: number; successCount: number }>> {
    try {
      this.lastSnipeCheck = new Date();
      
      // Get ready snipe targets from database
      const readyTargets = await this.getReadySnipeTargets();
      
      if (readyTargets.length === 0) {
        return {
          success: true,
          data: { processedCount: 0, successCount: 0 },
          timestamp: new Date().toISOString(),
        };
      }

      this.logger.info(`Processing ${readyTargets.length} ready snipe targets`);

      let successCount = 0;
      
      // Process each target
      for (const target of readyTargets) {
        if (target.confidenceScore >= this.config.confidenceThreshold) {
          try {
            await this.executeSnipeTarget(target);
            successCount++;
          } catch (error) {
            const safeError = toSafeError(error);
            this.logger.error("Failed to execute snipe target", { target, error: safeError });
            await this.updateSnipeTargetStatus(target.id, "failed", safeError.message);
          }
        } else {
          this.logger.debug("Skipping low confidence target", {
            symbol: target.symbolName,
            confidence: target.confidenceScore,
            threshold: this.config.confidenceThreshold,
          });
        }
      }

      return {
        success: true,
        data: { processedCount: readyTargets.length, successCount },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to process snipe targets", safeError);
      
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
    this.logger.info(`Executing snipe target: ${target.symbolName}`, {
      confidence: target.confidenceScore,
      amount: target.positionSizeUsdt,
    });

    // Update target status to executing
    await this.updateSnipeTargetStatus(target.id, "executing");

    try {
      // Prepare trade parameters
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
      };

      // Execute the trade
      const result = await this.executeTrade(tradeParams);

      if (result.success) {
        // Update target status to completed
        await this.updateSnipeTargetStatus(target.id, "completed");
        
        // Emit auto-snipe event
        this.emit("auto_snipe_executed", { target, result });
        
        this.logger.info("Snipe target executed successfully", {
          symbol: target.symbolName,
          orderId: result.data?.orderId,
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

  // ============================================================================
  // Multi-Phase Trading Strategies
  // ============================================================================

  /**
   * Execute a multi-phase trading strategy
   */
  async executeMultiPhaseStrategy(config: MultiPhaseConfig): Promise<MultiPhaseResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info("Executing multi-phase strategy", {
        symbol: config.symbol,
        totalAmount: config.totalAmount,
        strategy: config.strategy,
        phases: config.phaseCount,
      });

      // Get strategy configuration
      const strategy = this.tradingStrategies.get(config.strategy);
      if (!strategy) {
        throw new Error(`Strategy '${config.strategy}' not found`);
      }

      // Calculate phase allocations
      const allocations = config.phaseAllocation || this.calculatePhaseAllocations(config.phaseCount, strategy);
      
      const phases: MultiPhaseResult["phases"] = [];
      let totalExecuted = 0;
      let totalFees = 0;
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

        const phase = {
          phaseId: i + 1,
          status: "executing" as const,
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
          this.logger.error(`Phase ${i + 1} failed`, safeError);
        }

        phases.push(phase);

        // Wait between phases if not the last phase
        if (i < config.phaseCount - 1 && config.phaseDelayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, config.phaseDelayMs));
        }
      }

      const result: MultiPhaseResult = {
        success: phases.some(p => p.status === "completed"),
        totalPhases: config.phaseCount,
        completedPhases: phases.filter(p => p.status === "completed").length,
        strategy: config.strategy,
        phases,
        totalExecuted,
        averagePrice: priceCount > 0 ? priceSum / priceCount : undefined,
        totalFees,
        executionTimeMs: Date.now() - startTime,
      };

      this.logger.info("Multi-phase strategy completed", {
        symbol: config.symbol,
        completedPhases: result.completedPhases,
        totalPhases: result.totalPhases,
        totalExecuted: result.totalExecuted,
      });

      return result;
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Multi-phase strategy failed", safeError);
      throw error;
    }
  }

  // ============================================================================
  // Strategy Management
  // ============================================================================

  /**
   * Get available trading strategies
   */
  getAvailableStrategies(): TradingStrategy[] {
    return Array.from(this.tradingStrategies.values());
  }

  /**
   * Get a specific strategy by name
   */
  getStrategy(name: string): TradingStrategy | undefined {
    return this.tradingStrategies.get(name);
  }

  /**
   * Add a custom trading strategy
   */
  addCustomStrategy(strategy: TradingStrategy): ServiceResponse<void> {
    try {
      // Validate strategy
      if (strategy.maxPositionSize <= 0 || strategy.maxPositionSize > 1) {
        throw new Error("Max position size must be between 0 and 1");
      }
      
      if (strategy.stopLossPercent < 0 || strategy.stopLossPercent > 100) {
        throw new Error("Stop loss percent must be between 0 and 100");
      }

      this.tradingStrategies.set(strategy.name, strategy);
      
      this.logger.info("Custom strategy added", { name: strategy.name });
      
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

  // ============================================================================
  // Position Management
  // ============================================================================

  /**
   * Get all active positions
   */
  async getActivePositions(): Promise<Position[]> {
    return Array.from(this.activePositions.values());
  }

  /**
   * Get a specific position by ID
   */
  async getPosition(positionId: string): Promise<Position | undefined> {
    return this.activePositions.get(positionId);
  }

  /**
   * Close all positions
   */
  async closeAllPositions(reason: string): Promise<ServiceResponse<{ closedCount: number }>> {
    try {
      this.logger.info(`Closing all positions: ${reason}`);
      
      let closedCount = 0;
      
      for (const [positionId, position] of this.activePositions) {
        try {
          if (this.config.enablePaperTrading) {
            // Close paper position
            this.closePaperPosition(positionId, reason);
            closedCount++;
          } else {
            // Close real position
            await this.closeRealPosition(position, reason);
            closedCount++;
          }
        } catch (error) {
          const safeError = toSafeError(error);
          this.logger.error(`Failed to close position ${positionId}`, safeError);
        }
      }

      return {
        success: true,
        data: { closedCount },
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

  // ============================================================================
  // Analytics and Performance
  // ============================================================================

  /**
   * Get comprehensive performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const timeframe = "session";
    const startDate = this.startTime;
    const endDate = new Date();
    const tradingDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const metrics: PerformanceMetrics = {
      // Trading Statistics
      totalTrades: this.totalTrades,
      successfulTrades: this.successfulTrades,
      failedTrades: this.failedTrades,
      successRate: this.totalTrades > 0 ? (this.successfulTrades / this.totalTrades) * 100 : 0,
      
      // Financial Performance
      totalPnL: this.totalPnL,
      realizedPnL: this.totalPnL, // For now, same as total
      unrealizedPnL: 0, // Would calculate from open positions
      totalVolume: this.totalVolume,
      averageTradeSize: this.totalTrades > 0 ? this.totalVolume / this.totalTrades : 0,
      
      // Risk Metrics
      maxDrawdown: 0, // Would calculate from historical data
      sharpeRatio: undefined, // Would calculate with more data
      sortinoRatio: undefined,
      calmarRatio: undefined,
      maxConsecutiveLosses: 0, // Would track
      maxConsecutiveWins: 0, // Would track
      
      // Execution Metrics
      averageExecutionTime: 0, // Would track
      slippageAverage: 0, // Would calculate
      fillRate: 100, // Assume 100% for now
      
      // Auto-Sniping Metrics
      autoSnipeCount: 0, // Would track
      autoSnipeSuccessRate: 0, // Would calculate
      averageConfidenceScore: 0, // Would track
      
      // Time-based Metrics
      timeframe,
      startDate,
      endDate,
      tradingDays,
      
      // Strategy Performance
      strategyPerformance: {},
    };

    this.performanceMetrics = metrics;
    return metrics;
  }

  /**
   * Get current service status
   */
  async getServiceStatus(): Promise<ServiceStatus> {
    const status: ServiceStatus = {
      // Service Health
      isHealthy: this.isHealthy,
      isConnected: true, // Would check MEXC connection
      isAuthenticated: this.config.apiKey.length > 0,
      
      // Trading Status
      tradingEnabled: !this.circuitBreakerOpen,
      autoSnipingEnabled: this.config.autoSnipingEnabled && this.autoSnipingInterval !== null,
      paperTradingMode: this.config.enablePaperTrading,
      
      // Position Status
      activePositions: this.activePositions.size,
      maxPositions: this.config.maxConcurrentPositions,
      availableCapacity: (this.config.maxConcurrentPositions - this.activePositions.size) / this.config.maxConcurrentPositions,
      
      // Circuit Breaker Status
      circuitBreakerOpen: this.circuitBreakerOpen,
      circuitBreakerFailures: this.circuitBreakerFailures,
      circuitBreakerResetTime: this.circuitBreakerResetTime,
      
      // Performance Status
      lastTradeTime: undefined, // Would track
      averageResponseTime: 0, // Would track
      cacheHitRate: 0, // Would get from MEXC service
      
      // Risk Status
      currentRiskLevel: "low", // Would calculate
      dailyPnL: 0, // Would calculate
      dailyVolume: 0, // Would calculate
      
      // System Status
      uptime: Date.now() - this.startTime.getTime(),
      lastHealthCheck: new Date(),
      version: "1.0.0",
    };

    return ServiceStatusSchema.parse(status);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Initialize default trading strategies
   */
  private initializeDefaultStrategies(): void {
    const conservativeStrategy: TradingStrategy = {
      name: "conservative",
      description: "Low-risk strategy with tight risk controls",
      maxPositionSize: 0.05, // 5% max position
      positionSizingMethod: "fixed",
      stopLossPercent: 10,
      takeProfitPercent: 20,
      maxDrawdownPercent: 15,
      orderType: "LIMIT",
      timeInForce: "GTC",
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
    };

    const balancedStrategy: TradingStrategy = {
      name: "balanced",
      description: "Balanced risk/reward strategy",
      maxPositionSize: 0.1, // 10% max position
      positionSizingMethod: "fixed",
      stopLossPercent: 15,
      takeProfitPercent: 25,
      maxDrawdownPercent: 20,
      orderType: "MARKET",
      timeInForce: "IOC",
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
    };

    const aggressiveStrategy: TradingStrategy = {
      name: "aggressive",
      description: "High-risk, high-reward strategy",
      maxPositionSize: 0.2, // 20% max position
      positionSizingMethod: "kelly",
      stopLossPercent: 20,
      takeProfitPercent: 40,
      maxDrawdownPercent: 30,
      orderType: "MARKET",
      timeInForce: "IOC",
      slippageTolerance: 2.0,
      enableMultiPhase: false,
      phaseCount: 1,
      phaseDelayMs: 0,
      confidenceThreshold: 65,
      enableAutoSnipe: true,
      snipeDelayMs: 0,
      enableTrailingStop: true,
      trailingStopPercent: 8,
      enablePartialTakeProfit: false,
    };

    this.tradingStrategies.set("conservative", conservativeStrategy);
    this.tradingStrategies.set("balanced", balancedStrategy);
    this.tradingStrategies.set("aggressive", aggressiveStrategy);

    this.logger.info("Default trading strategies initialized", {
      strategies: Array.from(this.tradingStrategies.keys()),
    });
  }

  /**
   * Initialize performance metrics
   */
  private async initializePerformanceMetrics(): Promise<void> {
    this.performanceMetrics = await this.getPerformanceMetrics();
  }

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
            snipeTargets.targetExecutionTime.isNull().or(lt(snipeTargets.targetExecutionTime, now))
          )
        )
        .orderBy(snipeTargets.priority, snipeTargets.createdAt)
        .limit(10);

      return targets;
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to fetch ready snipe targets", safeError);
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
      const updateData: any = {
        status,
        updatedAt: new Date(),
      };

      if (status === "executing") {
        updateData.actualExecutionTime = new Date();
      }

      if (errorMessage) {
        updateData.errorMessage = errorMessage;
      }

      await db
        .update(snipeTargets)
        .set(updateData)
        .where(eq(snipeTargets.id, targetId));
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to update snipe target status", { targetId, status, error: safeError });
    }
  }

  /**
   * Get simulated price for paper trading
   */
  private async getSimulatedPrice(symbol: string): Promise<number> {
    try {
      // Try to get real market price for simulation
      const ticker = await this.mexcService.getTickerPrice(symbol);
      if (ticker.success && ticker.data?.price) {
        return parseFloat(ticker.data.price);
      }
    } catch (error) {
      this.logger.debug("Could not get real price for simulation", { symbol });
    }

    // Fallback to mock price
    return 100 + Math.random() * 1000;
  }

  /**
   * Track a new position
   */
  private async trackPosition(result: TradeResult, params: TradeParameters): Promise<void> {
    if (!result.data) return;

    const position: Position = {
      id: result.data.orderId,
      symbol: params.symbol,
      side: params.side,
      orderId: result.data.orderId,
      clientOrderId: result.data.clientOrderId,
      entryPrice: parseFloat(result.data.price),
      quantity: parseFloat(result.data.executedQty),
      stopLossPercent: params.stopLossPercent,
      takeProfitPercent: params.takeProfitPercent,
      status: "open",
      openTime: new Date(),
      strategy: params.strategy || this.config.defaultStrategy,
      confidenceScore: params.confidenceScore,
      autoSnipe: params.isAutoSnipe,
      paperTrade: this.config.enablePaperTrading,
      tags: [],
    };

    this.activePositions.set(position.id, position);
    this.emit("position_opened", position);

    this.logger.info("Position tracked", {
      positionId: position.id,
      symbol: position.symbol,
      entryPrice: position.entryPrice,
      quantity: position.quantity,
    });
  }

  /**
   * Update trade metrics
   */
  private updateTradeMetrics(result: TradeResult, params: TradeParameters): void {
    this.totalTrades++;
    
    if (result.success) {
      this.successfulTrades++;
      
      if (result.data?.quantity && result.data?.price) {
        const volume = parseFloat(result.data.quantity) * parseFloat(result.data.price);
        this.totalVolume += volume;
      }
    } else {
      this.failedTrades++;
    }
  }

  /**
   * Handle trade failure for circuit breaker
   */
  private handleTradeFailure(error: Error): void {
    this.circuitBreakerFailures++;
    
    if (this.config.enableCircuitBreaker && 
        this.circuitBreakerFailures >= this.config.circuitBreakerThreshold) {
      this.openCircuitBreaker("Too many trade failures");
    }
  }

  /**
   * Open circuit breaker
   */
  private openCircuitBreaker(reason: string): void {
    this.circuitBreakerOpen = true;
    this.circuitBreakerResetTime = new Date(Date.now() + this.config.circuitBreakerResetTime);
    
    this.logger.warn("Circuit breaker opened", { reason, resetTime: this.circuitBreakerResetTime });
    this.emit("circuit_breaker_triggered", { reason, timestamp: new Date() });
    
    // Auto-reset after timeout
    setTimeout(() => {
      this.resetCircuitBreaker();
    }, this.config.circuitBreakerResetTime);
  }

  /**
   * Reset circuit breaker
   */
  private resetCircuitBreaker(): void {
    this.circuitBreakerOpen = false;
    this.circuitBreakerFailures = 0;
    this.circuitBreakerResetTime = null;
    
    this.logger.info("Circuit breaker reset");
  }

  /**
   * Calculate phase allocations for multi-phase strategy
   */
  private calculatePhaseAllocations(phaseCount: number, strategy: TradingStrategy): number[] {
    // Default equal allocation
    const baseAllocation = 1 / phaseCount;
    return Array(phaseCount).fill(baseAllocation);
  }

  /**
   * Close a paper trading position
   */
  private closePaperPosition(positionId: string, reason: string): void {
    const position = this.activePositions.get(positionId);
    if (!position) return;

    // Simulate P&L
    const currentPrice = position.entryPrice * (1 + (Math.random() - 0.5) * 0.1); // ±5% random
    const pnl = (currentPrice - position.entryPrice) * position.quantity;
    
    position.status = "closed";
    position.closeTime = new Date();
    position.realizedPnL = pnl;
    position.pnlPercentage = (pnl / (position.entryPrice * position.quantity)) * 100;
    position.notes = reason;

    this.activePositions.delete(positionId);
    this.totalPnL += pnl;

    this.emit("position_closed", position);
    
    this.logger.info("Paper position closed", {
      positionId,
      pnl,
      pnlPercentage: position.pnlPercentage,
      reason,
    });
  }

  /**
   * Close a real trading position
   */
  private async closeRealPosition(position: Position, reason: string): Promise<void> {
    try {
      const closeParams: TradeParameters = {
        symbol: position.symbol,
        side: position.side === "BUY" ? "SELL" : "BUY",
        type: "MARKET",
        quantity: position.quantity,
        timeInForce: "IOC",
      };

      const result = await this.executeTrade(closeParams);
      
      if (result.success && result.data) {
        const exitPrice = parseFloat(result.data.price);
        const pnl = position.side === "BUY" 
          ? (exitPrice - position.entryPrice) * position.quantity
          : (position.entryPrice - exitPrice) * position.quantity;

        position.status = "closed";
        position.closeTime = new Date();
        position.currentPrice = exitPrice;
        position.realizedPnL = pnl;
        position.pnlPercentage = (pnl / (position.entryPrice * position.quantity)) * 100;
        position.notes = reason;

        this.activePositions.delete(position.id);
        this.totalPnL += pnl;

        this.emit("position_closed", position);
        
        this.logger.info("Real position closed", {
          positionId: position.id,
          exitPrice,
          pnl,
          pnlPercentage: position.pnlPercentage,
          reason,
        });
      } else {
        throw new Error(result.error || "Failed to close position");
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to close real position", { positionId: position.id, error: safeError });
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    this.stopAutoSniping();
    this.activePositions.clear();
    this.isInitialized = false;
    this.removeAllListeners();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

let globalCoreTrading: CoreTradingService | null = null;

/**
 * Get the global Core Trading Service instance (singleton)
 */
export function getCoreTrading(config?: Partial<CoreTradingConfig>): CoreTradingService {
  if (!globalCoreTrading) {
    globalCoreTrading = new CoreTradingService(config);
  }
  return globalCoreTrading;
}

/**
 * Reset the global Core Trading Service instance
 */
export function resetCoreTrading(): void {
  if (globalCoreTrading) {
    globalCoreTrading.shutdown();
  }
  globalCoreTrading = null;
}

/**
 * Create a new Core Trading Service instance (not singleton)
 */
export function createCoreTrading(config: Partial<CoreTradingConfig>): CoreTradingService {
  return new CoreTradingService(config);
}

// Default export
export default CoreTradingService;
/**
 * Auto-Sniping Execution Engine
 *
 * Core trading execution logic with pattern monitoring and opportunity processing.
 * Extracted from optimized-auto-sniping-core.ts for modularity.
 */

import { v4 as uuidv4 } from "uuid";
import type { PatternMatch } from "@/src/core/pattern-detection";
import { toSafeError } from "@/src/lib/error-type-utils";
import type { AutoSnipingConfigManager } from "./config-manager";
import {
  type AutoSnipingConfig,
  type ExecutionPosition,
  ExecutionPositionSchema,
  type ExecutionResult,
  type PatternType,
  type TradingOpportunity,
} from "./schemas";

export class AutoSnipingExecutionEngine {
  private static instance: AutoSnipingExecutionEngine | null = null;

  private configManager: AutoSnipingConfigManager;
  private activePositions = new Map<string, ExecutionPosition>();
  private isActive = false;
  private executionInterval: NodeJS.Timeout | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(configManager: AutoSnipingConfigManager) {
    this.configManager = configManager;
  }

  /**
   * Get singleton instance for backward compatibility
   */
  static getInstance(configManager?: AutoSnipingConfigManager): AutoSnipingExecutionEngine {
    if (!AutoSnipingExecutionEngine.instance) {
      if (!configManager) {
        // Create a default config manager if none provided
        try {
          const { AutoSnipingConfigManager } = require("./config-manager");
          configManager = new AutoSnipingConfigManager();
          console.info("[AutoSnipingExecutionEngine] Config manager loaded successfully");
        } catch (error) {
          console.warn(
            "[AutoSnipingExecutionEngine] Could not load config manager, using fallback:",
            error.message
          );
          // Create a minimal fallback config manager for testing/emergency scenarios
          configManager = {
            getConfig: () => ({
              enabled: true,
              maxPositions: 5,
              maxDailyTrades: 10,
              positionSizeUSDT: 100,
              minConfidence: 80,
              allowedPatternTypes: ["ready_state"],
              requireCalendarConfirmation: true,
              stopLossPercentage: 5,
              takeProfitPercentage: 10,
              maxDrawdownPercentage: 20,
              enableAdvanceDetection: true,
              advanceHoursThreshold: 3.5,
              enableMultiPhaseStrategy: false,
              slippageTolerancePercentage: 1,
              executionDelay: 1000,
              maxConcurrentTargets: 5,
              retryAttempts: 3,
            }),
            updateConfig: (config: any) => {
              console.log("[MockConfigManager] Config updated:", config);
              // Return the merged configuration
              const baseConfig = {
                enabled: true,
                maxPositions: 5,
                maxDailyTrades: 10,
                positionSizeUSDT: 100,
                minConfidence: 80,
                allowedPatternTypes: ["ready_state"],
                requireCalendarConfirmation: true,
                stopLossPercentage: 5,
                takeProfitPercentage: 10,
                maxDrawdownPercentage: 20,
                enableAdvanceDetection: true,
                advanceHoursThreshold: 3.5,
                enableMultiPhaseStrategy: false,
                slippageTolerancePercentage: 1,
                executionDelay: 1000,
                maxConcurrentTargets: 5,
                retryAttempts: 3,
                advanceNoticeHours: 24,
                enableRiskManagement: true,
                enablePerformanceTracking: true,
                enableTelemetry: false,
                throttleInterval: 1000,
                enableParallelExecution: false,
                maxConcurrentTrades: 3,
                enableSmartRouting: true,
                enableLivePatternFeed: true,
              };
              return { ...baseConfig, ...config };
            },
            validateConfig: (config: any) => {
              console.log("[MockConfigManager] Config validated:", config);
              return config;
            },
            reset: () => console.log("[MockConfigManager] Config reset"),
            export: () => ({
              enabled: true,
              maxPositions: 5,
              maxDailyTrades: 10,
              positionSizeUSDT: 100,
              minConfidence: 80,
            }),
            getStats: () => ({
              activePositions: 0,
              totalTrades: 0,
              isActive: false,
              uptime: 0,
            }),
            updateStats: (stats: any) => {
              console.log("[MockConfigManager] Stats updated:", stats);
            },
          } as any;
        }
      }
      AutoSnipingExecutionEngine.instance = new AutoSnipingExecutionEngine(configManager);
    }
    return AutoSnipingExecutionEngine.instance;
  }

  /**
   * Create instance asynchronously with proper config manager loading
   */
  static async createInstance(
    configManager?: AutoSnipingConfigManager
  ): Promise<AutoSnipingExecutionEngine> {
    if (!configManager) {
      try {
        const { AutoSnipingConfigManager } = await import("./config-manager");
        configManager = new AutoSnipingConfigManager();
        console.info("[AutoSnipingExecutionEngine] Config manager loaded asynchronously");
      } catch (error) {
        console.error("[AutoSnipingExecutionEngine] Failed to load config manager:", error);
        throw new Error(
          "Failed to initialize AutoSnipingExecutionEngine: config manager unavailable"
        );
      }
    }

    return new AutoSnipingExecutionEngine(configManager);
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    AutoSnipingExecutionEngine.instance = null;
  }

  /**
   * Start execution engine
   */
  async start(): Promise<void> {
    if (this.isActive) {
      throw new Error("Execution engine is already active");
    }

    const config = this.configManager.getConfig();

    console.info("Starting auto-sniping execution engine", {
      maxPositions: config.maxPositions,
      minConfidence: config.minConfidence,
      enableAdvanceDetection: config.enableAdvanceDetection,
    });

    // Validate configuration and health
    await this.configManager.validateConfiguration();
    await this.configManager.performHealthChecks();

    this.isActive = true;

    // Start execution interval
    this.executionInterval = setInterval(() => this.executionCycle(), config.throttleInterval);

    // Start monitoring interval
    this.monitoringInterval = setInterval(
      () => this.monitoringCycle(),
      config.throttleInterval * 2
    );

    console.info("Auto-sniping execution engine started successfully");
  }

  /**
   * Stop execution engine
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    console.info("Stopping auto-sniping execution engine");

    this.isActive = false;

    // Clear intervals
    if (this.executionInterval) {
      clearInterval(this.executionInterval);
      this.executionInterval = null;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.info("Auto-sniping execution engine stopped");
  }

  /**
   * Get execution status
   */
  isExecutionActive(): boolean {
    return this.isActive;
  }

  /**
   * Get active positions
   */
  getActivePositions(): ExecutionPosition[] {
    return Array.from(this.activePositions.values());
  }

  /**
   * Execute trading opportunity
   */
  async executeTradingOpportunity(opportunity: TradingOpportunity): Promise<boolean> {
    try {
      const config = this.configManager.getConfig();

      console.info("Executing trading opportunity", {
        symbol: opportunity.symbol,
        confidence: opportunity.confidence,
        patternType: opportunity.patternMatch.patternType,
      });

      // Pre-execution validations
      if (!this.isActive) {
        console.warn("Execution engine is not active");
        return false;
      }

      if (this.activePositions.size >= config.maxPositions) {
        console.warn("Maximum positions reached", {
          active: this.activePositions.size,
          max: config.maxPositions,
        });
        return false;
      }

      if (opportunity.confidence < config.minConfidence) {
        console.warn("Opportunity confidence below threshold", {
          confidence: opportunity.confidence,
          threshold: config.minConfidence,
        });
        return false;
      }

      // Execute the trade
      const result = await this.executeMarketOrder(opportunity);

      if (result.success && result.executedPrice && result.executedQuantity) {
        // Create position record
        const position: ExecutionPosition = {
          id: uuidv4(),
          symbol: opportunity.symbol,
          status: "ACTIVE",
          entryPrice: result.executedPrice,
          quantity: result.executedQuantity,
          timestamp: new Date().toISOString(),
          stopLossPrice: this.calculateStopLossPrice(
            result.executedPrice,
            opportunity.stopLossPercent ?? config.stopLossPercentage
          ),
          takeProfitPrice: this.calculateTakeProfitPrice(
            result.executedPrice,
            opportunity.takeProfitCustom ?? config.takeProfitPercentage
          ),
          patternData: {
            symbol: opportunity.symbol,
            patternType: opportunity.patternMatch.patternType,
            confidence: opportunity.patternMatch.confidence,
            timestamp: new Date().toISOString(),
            riskLevel: opportunity.patternMatch.riskLevel,
            advanceNoticeHours: opportunity.patternMatch.advanceNoticeHours,
          },
          executionMetadata: {
            confidence: opportunity.confidence,
            executionLatency: result.executionLatency || 0,
            slippage: result.slippage || 0,
            orderType: "MARKET",
          },
        };

        // Validate position before storing
        const validatedPosition = ExecutionPositionSchema.parse(position);
        this.activePositions.set(validatedPosition.id, validatedPosition);

        // Update statistics
        const stats = this.configManager.getStats();
        this.configManager.updateStats({
          activePositions: this.activePositions.size,
          totalTrades: stats.totalTrades + 1,
        });

        console.info("Position created successfully", {
          positionId: validatedPosition.id,
          symbol: opportunity.symbol,
          entryPrice: result.executedPrice,
          quantity: result.executedQuantity,
        });

        return true;
      } else {
        console.error("Trade execution failed", {
          symbol: opportunity.symbol,
          error: result.error,
        });
        return false;
      }
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("Failed to execute trading opportunity", {
        symbol: opportunity.symbol,
        error: safeError.message,
      });
      return false;
    }
  }

  /**
   * Main execution cycle
   */
  private async executionCycle(): Promise<void> {
    try {
      if (!this.isActive) return;

      // Fetch and process trading opportunities (pattern-based + database targets)
      const opportunities = await this.fetchAllTradingOpportunities();

      if (opportunities.length === 0) {
        return;
      }

      console.info(`Processing ${opportunities.length} trading opportunities`);

      // Process opportunities in parallel if enabled
      const config = this.configManager.getConfig();
      if (config.enableParallelExecution) {
        await this.processOpportunitiesParallel(opportunities);
      } else {
        await this.processOpportunitiesSequential(opportunities);
      }
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("Execution cycle error", {
        error: safeError.message,
      });
    }
  }

  /**
   * Position monitoring cycle
   */
  private async monitoringCycle(): Promise<void> {
    try {
      if (!this.isActive || this.activePositions.size === 0) return;

      console.info(`Monitoring ${this.activePositions.size} active positions`);

      // Monitor each active position
      for (const [positionId, position] of this.activePositions) {
        await this.monitorPosition(positionId, position);
      }
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("Monitoring cycle error", {
        error: safeError.message,
      });
    }
  }

  /**
   * Process opportunities sequentially
   */
  private async processOpportunitiesSequential(opportunities: TradingOpportunity[]): Promise<void> {
    for (const opportunity of opportunities) {
      try {
        await this.executeTradingOpportunity(opportunity);

        // Small delay between executions to prevent API rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        const safeError = toSafeError(error);
        console.error("Error processing opportunity", {
          symbol: opportunity.symbol,
          error: safeError.message,
        });
      }
    }
  }

  /**
   * Process opportunities in parallel
   */
  private async processOpportunitiesParallel(opportunities: TradingOpportunity[]): Promise<void> {
    const config = this.configManager.getConfig();
    const maxConcurrent = Math.min(config.maxConcurrentTrades, opportunities.length);

    // Process in batches
    for (let i = 0; i < opportunities.length; i += maxConcurrent) {
      const batch = opportunities.slice(i, i + maxConcurrent);

      await Promise.allSettled(
        batch.map((opportunity) => this.executeTradingOpportunity(opportunity))
      );

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  /**
   * Fetch trading opportunities from pattern detection
   */
  private async fetchTradingOpportunities(): Promise<TradingOpportunity[]> {
    try {
      // Import required services
      const { getMexcService } = await import("../../api/mexc-unified-exports");
      const { PatternDetectionCore } = await import("../../../core/pattern-detection");

      // Get MEXC service instance
      const mexcService = getMexcService();

      // Get calendar listings and symbols for pattern analysis
      const [calendarResponse, symbolsResponse] = await Promise.all([
        mexcService.getCalendarListings(),
        mexcService.getAllSymbols(),
      ]);

      if (!calendarResponse.success || !symbolsResponse.success) {
        console.warn("Failed to fetch market data for pattern detection", {
          calendarError: calendarResponse.error,
          symbolsError: symbolsResponse.error,
        });
        return [];
      }

      // Initialize pattern detection core
      const patternDetector = PatternDetectionCore.getInstance({
        minAdvanceHours: this.configManager.getConfig().advanceHoursThreshold,
        confidenceThreshold: this.configManager.getConfig().minConfidence,
        enableActivityEnhancement: true,
      });

      // Analyze patterns
      const analysisResult = await patternDetector.analyzePatterns({
        symbols: symbolsResponse.data || [],
        calendarEntries: calendarResponse.data || [],
        analysisType: "discovery",
        confidenceThreshold: this.configManager.getConfig().minConfidence,
      });

      // Convert pattern matches to trading opportunities
      const opportunities: TradingOpportunity[] = analysisResult.matches
        .filter(
          (match) =>
            this.configManager.getConfig().allowedPatternTypes.includes(match.patternType) &&
            match.confidence >= this.configManager.getConfig().minConfidence
        )
        .map((match) => {
          // Find corresponding calendar entry or use current time
          const calendarEntry = calendarResponse.data?.find(
            (entry) => entry.vcoinId === match.vcoinId || entry.cd === match.symbol
          );

          return {
            symbol: match.symbol,
            patternMatch: {
              patternType: match.patternType,
              confidence: match.confidence,
              riskLevel: match.riskLevel,
              advanceNoticeHours: match.advanceNoticeHours,
            },
            launchTime: calendarEntry?.et ? new Date(calendarEntry.et * 1000) : new Date(),
            confidence: match.confidence,
            vcoinId: match.vcoinId || "",
            projectName: calendarEntry?.fullName || match.symbol,
          };
        })
        .sort((a, b) => b.confidence - a.confidence); // Sort by confidence descending

      console.info(`Found ${opportunities.length} trading opportunities`, {
        totalMatches: analysisResult.matches.length,
        filteredOpportunities: opportunities.length,
        averageConfidence:
          opportunities.length > 0
            ? opportunities.reduce((sum, op) => sum + op.confidence, 0) / opportunities.length
            : 0,
        patternTypes: [...new Set(opportunities.map((op) => op.patternMatch.patternType))],
      });

      return opportunities;
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("Failed to fetch trading opportunities", {
        error: safeError.message,
      });
      return [];
    }
  }

  /**
   * Fetch database snipe targets and convert to trading opportunities
   */
  private async fetchDatabaseSnipeTargets(): Promise<TradingOpportunity[]> {
    try {
      const { db } = await import("@/src/db");
      const { snipeTargets } = await import("@/src/db/schema");
      const { inArray, and, gte } = await import("drizzle-orm");

      console.info("[ExecutionEngine] Fetching database snipe targets...");

      // Get active snipe targets that are ready for execution
      const activeTargets = await db
        .select()
        .from(snipeTargets)
        .where(
          and(
            inArray(snipeTargets.status, ["pending", "ready"]),
            // Only get targets that are scheduled for now or in the past
            snipeTargets.targetExecutionTime
              ? gte(new Date(), snipeTargets.targetExecutionTime)
              : undefined
          )
        )
        .limit(this.configManager.getConfig().maxConcurrentTargets);

      console.info(`[ExecutionEngine] Found ${activeTargets.length} database snipe targets`);

      // Convert database targets to trading opportunities
      const opportunities: TradingOpportunity[] = activeTargets
        .map((target) => {
          return {
            symbol: target.symbolName,
            patternMatch: {
              patternType: "database_target" as PatternType,
              confidence: target.confidenceScore / 100, // Convert percentage to decimal
              riskLevel: target.riskLevel as "low" | "medium" | "high",
              advanceNoticeHours: 0, // Database targets are immediate
            },
            launchTime: target.targetExecutionTime || new Date(),
            confidence: target.confidenceScore / 100,
            vcoinId: target.vcoinId,
            projectName: target.symbolName,
            // Add database-specific metadata
            databaseTargetId: target.id,
            entryStrategy: target.entryStrategy,
            entryPrice: target.entryPrice,
            positionSizeUSDT: target.positionSizeUsdt,
            stopLossPercent: target.stopLossPercent,
            takeProfitLevel: target.takeProfitLevel,
            takeProfitCustom: target.takeProfitCustom,
          };
        })
        .filter((opportunity) => {
          // Apply same filters as pattern opportunities
          const config = this.configManager.getConfig();
          return opportunity.confidence >= config.minConfidence;
        })
        .sort((a, b) => b.confidence - a.confidence);

      console.info(
        `[ExecutionEngine] Converted ${opportunities.length} database targets to trading opportunities`
      );

      return opportunities;
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("[ExecutionEngine] Failed to fetch database snipe targets:", safeError.message);
      return [];
    }
  }

  /**
   * Fetch all trading opportunities (pattern-based + database targets)
   */
  private async fetchAllTradingOpportunities(): Promise<TradingOpportunity[]> {
    try {
      const config = this.configManager.getConfig();

      console.info("[ExecutionEngine] Fetching all trading opportunities...");

      // Fetch both pattern-based and database opportunities in parallel
      const [patternOpportunities, databaseOpportunities] = await Promise.all([
        this.fetchTradingOpportunities(),
        this.fetchDatabaseSnipeTargets(),
      ]);

      // Combine and deduplicate opportunities
      const allOpportunities = [...patternOpportunities, ...databaseOpportunities];
      const uniqueOpportunities = new Map<string, TradingOpportunity>();

      // Deduplicate by symbol, keeping the highest confidence
      for (const opportunity of allOpportunities) {
        const existing = uniqueOpportunities.get(opportunity.symbol);
        if (!existing || opportunity.confidence > existing.confidence) {
          uniqueOpportunities.set(opportunity.symbol, opportunity);
        }
      }

      const finalOpportunities = Array.from(uniqueOpportunities.values())
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, config.maxConcurrentTargets);

      console.info(`[ExecutionEngine] Combined opportunities:`, {
        patternBased: patternOpportunities.length,
        databaseBased: databaseOpportunities.length,
        totalUnique: uniqueOpportunities.size,
        finalCount: finalOpportunities.length,
        maxConcurrent: config.maxConcurrentTargets,
      });

      return finalOpportunities;
    } catch (error) {
      const safeError = toSafeError(error);
      console.error(
        "[ExecutionEngine] Failed to fetch all trading opportunities:",
        safeError.message
      );
      return [];
    }
  }

  /**
   * Execute market order
   */
  private async executeMarketOrder(opportunity: TradingOpportunity): Promise<ExecutionResult> {
    try {
      const config = this.configManager.getConfig();
      const startTime = Date.now();

      // Import MEXC trading service
      const { getMexcService } = await import("../../api/mexc-unified-exports");
      const mexcService = getMexcService();

      // Prepare trading symbol (ensure it ends with USDT)
      const symbol = opportunity.symbol.endsWith("USDT")
        ? opportunity.symbol
        : `${opportunity.symbol}USDT`;

      // Get current market price for the symbol
      const tickerResponse = await mexcService.get24hrTicker(symbol);
      if (!tickerResponse.success || !tickerResponse.data || tickerResponse.data.length === 0) {
        throw new Error(`Failed to get market price for ${symbol}: ${tickerResponse.error}`);
      }

      const currentPrice = Number.parseFloat(
        tickerResponse.data[0].lastPrice || tickerResponse.data[0].price || "0"
      );
      if (currentPrice <= 0) {
        throw new Error(`Invalid market price for ${symbol}: ${currentPrice}`);
      }

      // Calculate quantity based on position size in USDT (use database-specific size if available)
      const positionSizeUSDT = opportunity.positionSizeUSDT ?? config.positionSizeUSDT;
      const quantity = (positionSizeUSDT / currentPrice).toFixed(6);

      // Check account balance before placing order
      const balanceResponse = await mexcService.getAccountBalances();
      if (!balanceResponse.success) {
        throw new Error(`Failed to check account balance: ${balanceResponse.error}`);
      }

      const usdtBalance = balanceResponse.data.balances.find((b) => b.asset === "USDT");
      const availableUSDT = Number.parseFloat(usdtBalance?.free || "0");

      if (availableUSDT < positionSizeUSDT) {
        throw new Error(`Insufficient USDT balance: ${availableUSDT} < ${positionSizeUSDT}`);
      }

      console.info(`Executing market BUY order for ${symbol}`, {
        symbol,
        quantity,
        currentPrice,
        positionSizeUSDT,
        availableUSDT,
        isDatabase: !!opportunity.databaseTargetId,
      });

      // Place market order
      const orderParams = {
        symbol,
        side: "BUY" as const,
        type: "MARKET" as const,
        quantity,
        quoteOrderQty: positionSizeUSDT.toString(), // Use database-specific position size for market orders
      };

      const orderResponse = await mexcService.placeOrder(orderParams);
      const executionLatency = Date.now() - startTime;

      if (!orderResponse.success || !orderResponse.data) {
        throw new Error(`Order execution failed: ${orderResponse.error}`);
      }

      const orderData = orderResponse.data;
      const executedPrice = Number.parseFloat(orderData.price || currentPrice.toString());
      const executedQuantity = Number.parseFloat(orderData.quantity || quantity);

      // Calculate slippage
      const slippage = Math.abs((executedPrice - currentPrice) / currentPrice) * 100;

      console.info(`Market order executed successfully`, {
        symbol,
        orderId: orderData.orderId,
        executedPrice,
        executedQuantity,
        executionLatency,
        slippage: slippage.toFixed(4) + "%",
        status: orderData.status,
      });

      return {
        success: true,
        executedPrice,
        executedQuantity,
        executionLatency,
        slippage,
      };
    } catch (error) {
      const safeError = toSafeError(error);
      const executionLatency = Date.now() - Date.now();

      console.error("Market order execution failed", {
        symbol: opportunity.symbol,
        error: safeError.message,
        executionLatency,
      });

      return {
        success: false,
        error: safeError.message,
        executionLatency,
      };
    }
  }

  /**
   * Monitor individual position
   */
  private async monitorPosition(positionId: string, position: ExecutionPosition): Promise<void> {
    try {
      const { getMexcService } = await import("../../api/mexc-unified-exports");
      const mexcService = getMexcService();

      // Prepare trading symbol (ensure it ends with USDT)
      const symbol = position.symbol.endsWith("USDT") ? position.symbol : `${position.symbol}USDT`;

      // Get current market price
      const tickerResponse = await mexcService.get24hrTicker(symbol);
      if (!tickerResponse.success || !tickerResponse.data || tickerResponse.data.length === 0) {
        console.warn(`Failed to get current price for position monitoring: ${symbol}`, {
          positionId,
          error: tickerResponse.error,
        });
        return;
      }

      const currentPrice = Number.parseFloat(
        tickerResponse.data[0].lastPrice || tickerResponse.data[0].price || "0"
      );
      if (currentPrice <= 0) {
        console.warn(`Invalid current price for position monitoring: ${symbol}`, {
          positionId,
          currentPrice,
        });
        return;
      }

      // Calculate current PnL
      const currentValue = position.quantity * currentPrice;
      const entryValue = position.quantity * position.entryPrice;
      const pnlUSDT = currentValue - entryValue;
      const pnlPercentage = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

      console.debug("Position monitoring update", {
        positionId,
        symbol: position.symbol,
        status: position.status,
        entryPrice: position.entryPrice,
        currentPrice,
        quantity: position.quantity,
        pnlUSDT: pnlUSDT.toFixed(4),
        pnlPercentage: pnlPercentage.toFixed(2) + "%",
        stopLossPrice: position.stopLossPrice,
        takeProfitPrice: position.takeProfitPrice,
      });

      // Check stop loss trigger
      if (position.stopLossPrice && currentPrice <= position.stopLossPrice) {
        console.warn(`Stop loss triggered for position ${positionId}`, {
          symbol,
          currentPrice,
          stopLossPrice: position.stopLossPrice,
          pnlPercentage: pnlPercentage.toFixed(2) + "%",
        });

        await this.executeExitOrder(positionId, position, currentPrice, "STOP_LOSS");
        return;
      }

      // Check take profit trigger
      if (position.takeProfitPrice && currentPrice >= position.takeProfitPrice) {
        console.info(`Take profit triggered for position ${positionId}`, {
          symbol,
          currentPrice,
          takeProfitPrice: position.takeProfitPrice,
          pnlPercentage: pnlPercentage.toFixed(2) + "%",
        });

        await this.executeExitOrder(positionId, position, currentPrice, "TAKE_PROFIT");
        return;
      }

      // Update position with current market data (in a real system, this would be stored in database)
      const updatedPosition = {
        ...position,
        lastMonitoredAt: new Date().toISOString(),
        currentPrice,
        unrealizedPnl: pnlUSDT,
        unrealizedPnlPercentage: pnlPercentage,
      };

      // In a real implementation, you would update the position in the database here
      console.debug(`Position ${positionId} monitoring completed`, {
        symbol,
        pnlPercentage: pnlPercentage.toFixed(2) + "%",
        needsAction: false,
      });
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("Position monitoring error", {
        positionId,
        symbol: position.symbol,
        error: safeError.message,
      });
    }
  }

  /**
   * Execute exit order for stop loss or take profit
   */
  private async executeExitOrder(
    positionId: string,
    position: ExecutionPosition,
    currentPrice: number,
    reason: "STOP_LOSS" | "TAKE_PROFIT" | "MANUAL"
  ): Promise<void> {
    try {
      const { getMexcService } = await import("../../api/mexc-unified-exports");
      const mexcService = getMexcService();

      const symbol = position.symbol.endsWith("USDT") ? position.symbol : `${position.symbol}USDT`;

      console.info(`Executing exit order for position ${positionId}`, {
        symbol,
        reason,
        quantity: position.quantity,
        currentPrice,
        entryPrice: position.entryPrice,
      });

      // Place market sell order to close position
      const orderParams = {
        symbol,
        side: "SELL" as const,
        type: "MARKET" as const,
        quantity: position.quantity.toString(),
      };

      const orderResponse = await mexcService.placeOrder(orderParams);

      if (!orderResponse.success || !orderResponse.data) {
        throw new Error(`Exit order failed: ${orderResponse.error}`);
      }

      const orderData = orderResponse.data;
      const exitPrice = Number.parseFloat(orderData.price || currentPrice.toString());
      const pnl = (exitPrice - position.entryPrice) * position.quantity;
      const pnlPercentage = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;

      console.info(`Exit order executed successfully`, {
        positionId,
        symbol,
        reason,
        orderId: orderData.orderId,
        exitPrice,
        entryPrice: position.entryPrice,
        quantity: position.quantity,
        pnl: pnl.toFixed(4),
        pnlPercentage: pnlPercentage.toFixed(2) + "%",
        status: orderData.status,
      });

      // Remove position from active positions
      this.activePositions.delete(positionId);

      // Update statistics
      const stats = this.configManager.getStats();
      this.configManager.updateStats({
        activePositions: this.activePositions.size,
        totalTrades: stats.totalTrades + 1,
        successfulTrades: pnl > 0 ? stats.successfulTrades + 1 : stats.successfulTrades,
        totalPnl: (stats.totalPnl || 0) + pnl,
      });
    } catch (error) {
      const safeError = toSafeError(error);
      console.error(`Failed to execute exit order for position ${positionId}`, {
        symbol: position.symbol,
        reason,
        error: safeError.message,
      });
    }
  }

  /**
   * Calculate stop loss price
   */
  private calculateStopLossPrice(entryPrice: number, stopLossPercentage: number): number {
    return entryPrice * (1 - stopLossPercentage / 100);
  }

  /**
   * Calculate take profit price
   */
  private calculateTakeProfitPrice(entryPrice: number, takeProfitPercentage: number): number {
    return entryPrice * (1 + takeProfitPercentage / 100);
  }

  /**
   * Get current configuration
   */
  getConfig(): AutoSnipingConfig {
    return this.configManager.getConfig();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AutoSnipingConfig>): AutoSnipingConfig {
    this.configManager.updateConfig(config);
    return this.configManager.getConfig();
  }

  /**
   * Close a specific position
   */
  async closePosition(positionId: string): Promise<boolean> {
    try {
      console.info(`[ExecutionEngine] Closing position ${positionId}`);

      // Check if position exists in active positions
      const position = this.activePositions.get(positionId);
      if (!position) {
        console.warn(`[ExecutionEngine] Position ${positionId} not found in active positions`);
        return false;
      }

      // Get current market price for proper exit calculation
      const { getMexcService } = await import("../../api/mexc-unified-exports");
      const mexcService = getMexcService();

      const symbol = position.symbol.endsWith("USDT") ? position.symbol : `${position.symbol}USDT`;

      const tickerResponse = await mexcService.get24hrTicker(symbol);
      let currentPrice = position.entryPrice; // Fallback to entry price

      if (tickerResponse.success && tickerResponse.data && tickerResponse.data.length > 0) {
        currentPrice = Number.parseFloat(
          tickerResponse.data[0].lastPrice ||
            tickerResponse.data[0].price ||
            position.entryPrice.toString()
        );
      }

      console.info(`[ExecutionEngine] Executing manual close order for position ${positionId}`, {
        symbol: position.symbol,
        quantity: position.quantity,
        entryPrice: position.entryPrice,
        currentPrice,
      });

      // Execute the exit order using the real trading system
      await this.executeExitOrder(positionId, position, currentPrice, "MANUAL");

      console.info(`[ExecutionEngine] Position ${positionId} closed successfully`);
      return true;
    } catch (error) {
      console.error(`[ExecutionEngine] Failed to close position ${positionId}:`, error);
      return false;
    }
  }

  /**
   * Check if the engine is ready for trading
   */
  isReadyForTrading(): boolean {
    try {
      const config = this.configManager.getConfig();
      return this.isActive && config.enabled && this.activePositions.size < config.maxPositions;
    } catch (error) {
      console.error("[AutoSnipingExecutionEngine] Error checking trading readiness:", error);
      return false;
    }
  }

  /**
   * Validate configuration
   */
  async validateConfiguration(): Promise<boolean> {
    try {
      if (typeof this.configManager.validateConfiguration === "function") {
        await this.configManager.validateConfiguration();
        return true;
      }
      // Fallback validation for mock config manager
      const config = this.configManager.getConfig();
      return config && typeof config === "object" && config.enabled !== undefined;
    } catch (error) {
      console.error("[AutoSnipingExecutionEngine] Configuration validation failed:", error);
      return false;
    }
  }

  /**
   * Perform health checks
   */
  async performHealthChecks(): Promise<boolean> {
    try {
      if (typeof this.configManager.performHealthChecks === "function") {
        await this.configManager.performHealthChecks();
        return true;
      }
      // Fallback health check for mock config manager
      return this.isActive && this.configManager !== null;
    } catch (error) {
      console.error("[AutoSnipingExecutionEngine] Health check failed:", error);
      return false;
    }
  }

  /**
   * Get execution statistics
   */
  getStats(): any {
    try {
      let stats;
      if (typeof this.configManager.getStats === "function") {
        stats = this.configManager.getStats();
      } else {
        // Fallback stats for mock config manager
        stats = {
          totalTrades: 0,
          successfulTrades: 0,
          totalPnl: 0,
          totalVolume: 0,
          winRate: 0,
          averageTradeReturn: 0,
          maxDrawdown: 0,
          currentDrawdown: 0,
          averageExecutionTime: 0,
          averageSlippage: 0,
          activePositions: this.activePositions.size,
          dailyTradeCount: 0,
          patternSuccessRates: {},
          averagePatternConfidence: 0,
          mostSuccessfulPattern: null,
          successRate: 0,
          errorCount: 0,
          totalExecutions: 0,
          successCount: 0,
        };
      }

      // Calculate dynamic fields
      const totalExecutions = stats.totalTrades || 0;
      const successCount = stats.successfulTrades || 0;
      const errorCount = totalExecutions - successCount;
      const successRate = totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0;

      // Add engine state information to stats
      return {
        ...stats,
        isActive: this.isActive,
        activePositions: this.activePositions.size, // Override with current value
        uptime: this.isActive ? Date.now() : 0,
        totalExecutions,
        successCount,
        errorCount,
        successRate,
      };
    } catch (error) {
      console.error("[AutoSnipingExecutionEngine] Error getting stats:", error);
      return {
        activePositions: 0,
        totalTrades: 0,
        isActive: false,
        uptime: 0,
        successfulTrades: 0,
        totalPnl: 0,
        totalVolume: 0,
        winRate: 0,
        averageTradeReturn: 0,
        maxDrawdown: 0,
        currentDrawdown: 0,
        averageExecutionTime: 0,
        averageSlippage: 0,
        dailyTradeCount: 0,
        patternSuccessRates: {},
        averagePatternConfidence: 0,
        mostSuccessfulPattern: null,
        successRate: 0,
        errorCount: 0,
        totalExecutions: 0,
        successCount: 0,
      };
    }
  }

  /**
   * Update execution statistics
   */
  updateStats(stats: any): void {
    try {
      if (typeof this.configManager.updateStats === "function") {
        this.configManager.updateStats(stats);
      }
      // For mock config manager, just log the update
      console.debug("[AutoSnipingExecutionEngine] Stats updated:", stats);
    } catch (error) {
      console.error("[AutoSnipingExecutionEngine] Error updating stats:", error);
    }
  }

  /**
   * Stop execution - alias for stop() method for backward compatibility
   */
  stopExecution(): Promise<void> {
    return this.stop();
  }

  /**
   * Get execution report for monitoring and debugging
   */
  async getExecutionReport(): Promise<{
    status: string;
    stats: any;
    activePositions: any[];
    config: any;
    health: any;
    systemHealth: any;
    totalProfit: number;
    successRate: number;
    successCount: number;
    errorCount: number;
    totalTrades: number;
    activeTargets: number;
    readyTargets: number;
    executedToday: number;
    lastExecution: string;
    safetyStatus: string;
    patternDetectionActive: boolean;
    executionCount: number;
    uptime: number;
  }> {
    try {
      const stats = this.getStats();
      const config = this.getConfig();
      const activePositions = this.getActivePositions();

      // Get health status
      let health = { overall: "unknown", apiConnection: false, patternEngine: false };
      try {
        if (typeof this.configManager.performHealthChecks === "function") {
          health = await this.configManager.performHealthChecks();
          health.overall = Object.values(health).every((v) => v) ? "healthy" : "degraded";
        }
      } catch (error) {
        console.warn("[AutoSnipingExecutionEngine] Health check failed in report:", error);
        health.overall = "error";
      }

      const status = this.isActive ? "active" : "idle";

      return {
        status,
        stats,
        activePositions,
        config,
        health,
        systemHealth: health, // Add alias for systemHealth for backward compatibility

        // Flatten commonly used fields for API compatibility
        totalProfit: stats.totalPnl || 0,
        successRate: stats.successRate || 0,
        successCount: stats.successCount || 0,
        errorCount: stats.errorCount || 0,
        totalTrades: stats.totalTrades || 0,
        activeTargets: this.activePositions.size,
        readyTargets: 0, // Would need to be calculated from pattern detection
        executedToday: stats.dailyTradeCount || 0,
        lastExecution: new Date().toISOString(),
        safetyStatus: health.overall === "healthy" ? "safe" : "warning",
        patternDetectionActive: true,
        executionCount: stats.totalExecutions || 0,
        uptime: this.isActive ? Date.now() : 0,
      };
    } catch (error) {
      console.error("[AutoSnipingExecutionEngine] Error generating execution report:", error);
      const errorHealth = { overall: "error" };
      const fallbackStats = this.getStats();
      return {
        status: "error",
        stats: fallbackStats,
        activePositions: [],
        config: {},
        health: errorHealth,
        systemHealth: errorHealth,

        // Flatten commonly used fields for API compatibility
        totalProfit: 0,
        successRate: 0,
        successCount: 0,
        errorCount: 0,
        totalTrades: 0,
        activeTargets: 0,
        readyTargets: 0,
        executedToday: 0,
        lastExecution: new Date().toISOString(),
        safetyStatus: "error",
        patternDetectionActive: false,
        executionCount: 0,
        uptime: 0,
      };
    }
  }

  /**
   * Start execution - alias for start() method for backward compatibility
   */
  startExecution(): Promise<void> {
    return this.start();
  }

  /**
   * Check if execution is currently active
   */
  getExecutionStatus(): { isActive: boolean; status: string } {
    return {
      isActive: this.isActive,
      status: this.isActive ? "active" : "idle",
    };
  }
}

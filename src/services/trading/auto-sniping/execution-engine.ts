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
  private configManager: AutoSnipingConfigManager;
  private activePositions = new Map<string, ExecutionPosition>();
  private isActive = false;
  private executionInterval: NodeJS.Timeout | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(configManager: AutoSnipingConfigManager) {
    this.configManager = configManager;
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
            config.stopLossPercentage
          ),
          takeProfitPrice: this.calculateTakeProfitPrice(
            result.executedPrice,
            config.takeProfitPercentage
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

      // Fetch and process trading opportunities
      const opportunities = await this.fetchTradingOpportunities();

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
      // Simulated pattern detection API call
      // In real implementation, this would call the pattern detection service
      return [];
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("Failed to fetch trading opportunities", {
        error: safeError.message,
      });
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

      // Simulated MEXC API call
      // In real implementation, this would call MEXC trading API
      const executionLatency = Date.now() - startTime;

      return {
        success: true,
        executedPrice: 1.0, // Simulated
        executedQuantity: config.positionSizeUSDT, // Simulated
        executionLatency,
        slippage: 0.1, // Simulated
      };
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        error: safeError.message,
      };
    }
  }

  /**
   * Monitor individual position
   */
  private async monitorPosition(positionId: string, position: ExecutionPosition): Promise<void> {
    try {
      // Simulated position monitoring
      // In real implementation, this would:
      // 1. Fetch current price
      // 2. Check stop loss/take profit triggers
      // 3. Update position status
      // 4. Execute exit orders if needed

      console.debug("Monitoring position", {
        positionId,
        symbol: position.symbol,
        status: position.status,
      });
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("Position monitoring error", {
        positionId,
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
}

/**
 * Snipe Execution Engine
 * Handles the core execution logic for auto-sniping operations
 */

import { BrowserCompatibleEventEmitter } from "@/src/lib/browser-compatible-events";
import { toSafeError } from "@/src/lib/error-type-utils";
import type { UnifiedMexcServiceV2 } from "@/src/services/api/unified-mexc-service-v2";
import type {
  ServiceResponse,
  TradeResult,
} from "../consolidated/core-trading/types";

export interface AutoSnipeTarget {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  targetPrice: number;
  quantity: number;
  orderType: "MARKET" | "LIMIT";
  stopLoss?: number;
  takeProfit?: number;
  strategy?: string;
  confidenceScore?: number;
  createdAt: Date;
  expiresAt?: Date;
  status: "pending" | "executed" | "failed" | "cancelled" | "expired";
}

export interface SnipeExecutionResult {
  success: boolean;
  snipeId: string;
  orderId?: string;
  executedPrice?: number;
  executedQuantity?: number;
  fees?: number;
  slippage?: number;
  executionTime: number;
  timestamp: string;
  error?: string;
}

export interface SnipeConfiguration {
  enabled: boolean;
  maxConcurrentSnipes: number;
  minConfidenceScore: number;
  defaultPositionSize: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  maxDailySnipes: number;
  riskManagementEnabled: boolean;
  paperTradingMode: boolean;
}

export class SnipeExecutionEngine extends BrowserCompatibleEventEmitter {
  private mexcService: UnifiedMexcServiceV2;
  private config: SnipeConfiguration;
  private executionQueue = new Map<string, AutoSnipeTarget>();
  private dailyExecutionCount = 0;
  private isExecuting = false;

  constructor(mexcService: UnifiedMexcServiceV2, config: SnipeConfiguration) {
    super();
    this.mexcService = mexcService;
    this.config = config;
  }

  async executeSnipe(target: AutoSnipeTarget): Promise<SnipeExecutionResult> {
    const startTime = Date.now();

    try {
      // Validate execution conditions
      await this.validateExecutionConditions(target);

      // Execute the snipe
      const result = this.config.paperTradingMode
        ? await this.executePaperSnipe(target)
        : await this.executeRealSnipe(target);

      const executionTime = Date.now() - startTime;

      // Update daily execution count
      if (result.success) {
        this.dailyExecutionCount++;
      }

      const executionResult: SnipeExecutionResult = {
        success: result.success,
        snipeId: target.id,
        orderId: result.data?.orderId,
        executedPrice: result.data?.price
          ? parseFloat(result.data.price)
          : undefined,
        executedQuantity: result.data?.quantity
          ? parseFloat(result.data.quantity)
          : undefined,
        fees: result.data?.fees,
        slippage: this.calculateSlippage(
          target.targetPrice,
          result.data?.price
        ),
        executionTime,
        timestamp: new Date().toISOString(),
        error: result.error,
      };

      // Emit execution event
      this.emit("snipeExecuted", {
        target,
        result: executionResult,
        timestamp: new Date().toISOString(),
      });

      return executionResult;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = toSafeError(error).message;

      const executionResult: SnipeExecutionResult = {
        success: false,
        snipeId: target.id,
        executionTime,
        timestamp: new Date().toISOString(),
        error: errorMessage,
      };

      this.emit("snipeExecutionFailed", {
        target,
        result: executionResult,
        timestamp: new Date().toISOString(),
      });

      return executionResult;
    }
  }

  async executePatternSnipe(
    symbol: string,
    pattern: string,
    confidence: number,
    price: number,
    quantity?: number
  ): Promise<SnipeExecutionResult> {
    try {
      // Validate pattern confidence
      if (confidence < this.config.minConfidenceScore) {
        throw new Error(
          `Pattern confidence ${confidence} below minimum ${this.config.minConfidenceScore}`
        );
      }

      // Create snipe target from pattern
      const target: AutoSnipeTarget = {
        id: `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        symbol,
        side: "BUY", // Default to BUY for patterns
        targetPrice: price,
        quantity: quantity || this.config.defaultPositionSize,
        orderType: "MARKET", // Use market orders for pattern-based snipes
        strategy: pattern,
        confidenceScore: confidence,
        createdAt: new Date(),
        status: "pending",
        stopLoss:
          this.config.stopLossPercent > 0
            ? price * (1 - this.config.stopLossPercent / 100)
            : undefined,
        takeProfit:
          this.config.takeProfitPercent > 0
            ? price * (1 + this.config.takeProfitPercent / 100)
            : undefined,
      };

      return await this.executeSnipe(target);
    } catch (error) {
      const errorMessage = toSafeError(error).message;
      return {
        success: false,
        snipeId: `pattern-error-${Date.now()}`,
        executionTime: 0,
        timestamp: new Date().toISOString(),
        error: errorMessage,
      };
    }
  }

  async executeManualSnipe(
    symbol: string,
    side: "BUY" | "SELL",
    quantity: number,
    targetPrice: number,
    orderType: "MARKET" | "LIMIT" = "LIMIT",
    options?: {
      stopLoss?: number;
      takeProfit?: number;
      strategy?: string;
    }
  ): Promise<SnipeExecutionResult> {
    try {
      const target: AutoSnipeTarget = {
        id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        symbol,
        side,
        targetPrice,
        quantity,
        orderType,
        stopLoss: options?.stopLoss,
        takeProfit: options?.takeProfit,
        strategy: options?.strategy || "manual",
        createdAt: new Date(),
        status: "pending",
      };

      return await this.executeSnipe(target);
    } catch (error) {
      const errorMessage = toSafeError(error).message;
      return {
        success: false,
        snipeId: `manual-error-${Date.now()}`,
        executionTime: 0,
        timestamp: new Date().toISOString(),
        error: errorMessage,
      };
    }
  }

  async batchExecute(
    targets: AutoSnipeTarget[]
  ): Promise<SnipeExecutionResult[]> {
    const results: SnipeExecutionResult[] = [];

    // Check concurrent execution limit
    const maxConcurrent = Math.min(
      targets.length,
      this.config.maxConcurrentSnipes
    );
    const batches = this.chunkArray(targets, maxConcurrent);

    for (const batch of batches) {
      const batchPromises = batch.map((target) => this.executeSnipe(target));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Brief pause between batches to avoid overwhelming the API
      if (batches.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  private async validateExecutionConditions(
    target: AutoSnipeTarget
  ): Promise<void> {
    // Check if sniping is enabled
    if (!this.config.enabled) {
      throw new Error("Auto-sniping is disabled");
    }

    // Check daily execution limit
    if (this.dailyExecutionCount >= this.config.maxDailySnipes) {
      throw new Error(
        `Daily snipe limit reached (${this.config.maxDailySnipes})`
      );
    }

    // Check concurrent execution limit
    if (this.executionQueue.size >= this.config.maxConcurrentSnipes) {
      throw new Error(
        `Maximum concurrent snipes reached (${this.config.maxConcurrentSnipes})`
      );
    }

    // Check target expiration
    if (target.expiresAt && new Date() > target.expiresAt) {
      throw new Error("Snipe target has expired");
    }

    // Check confidence score for pattern-based snipes
    if (
      target.confidenceScore &&
      target.confidenceScore < this.config.minConfidenceScore
    ) {
      throw new Error(
        `Confidence score ${target.confidenceScore} below minimum ${this.config.minConfidenceScore}`
      );
    }

    // Validate symbol format
    if (!target.symbol || target.symbol.length < 3) {
      throw new Error("Invalid symbol format");
    }

    // Validate quantity
    if (!target.quantity || target.quantity <= 0) {
      throw new Error("Quantity must be greater than 0");
    }

    // Add to execution queue
    this.executionQueue.set(target.id, target);
  }

  private async executePaperSnipe(
    target: AutoSnipeTarget
  ): Promise<TradeResult> {
    // Simulate paper trade execution
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 200 + 50)
    ); // Simulate API delay

    return {
      success: true,
      data: {
        orderId: `paper-${target.id}`,
        symbol: target.symbol,
        side: target.side,
        quantity: target.quantity.toString(),
        price: target.targetPrice.toString(),
        status: "FILLED",
        type: target.orderType,
        fees: target.quantity * target.targetPrice * 0.001, // 0.1% fee simulation
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async executeRealSnipe(
    target: AutoSnipeTarget
  ): Promise<TradeResult> {
    try {
      const tradeParams = {
        symbol: target.symbol,
        side: target.side,
        quantity: target.quantity,
        price: target.orderType === "LIMIT" ? target.targetPrice : undefined,
        type: target.orderType,
        strategy: target.strategy,
      };

      const result = await this.mexcService.executeTrade(tradeParams);

      // Remove from execution queue
      this.executionQueue.delete(target.id);

      return result;
    } catch (error) {
      // Remove from execution queue on error
      this.executionQueue.delete(target.id);
      throw error;
    }
  }

  private calculateSlippage(
    targetPrice: number,
    executedPrice?: string
  ): number | undefined {
    if (!executedPrice) return undefined;

    const executed = parseFloat(executedPrice);
    return Math.abs((executed - targetPrice) / targetPrice) * 100;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // Configuration management
  updateConfig(newConfig: Partial<SnipeConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit("configUpdated", this.config);
  }

  getConfig(): SnipeConfiguration {
    return { ...this.config };
  }

  // Status methods
  getExecutionStatus(): {
    enabled: boolean;
    isExecuting: boolean;
    queueSize: number;
    dailyExecutionCount: number;
    maxDailySnipes: number;
    maxConcurrentSnipes: number;
    paperTradingMode: boolean;
  } {
    return {
      enabled: this.config.enabled,
      isExecuting: this.isExecuting,
      queueSize: this.executionQueue.size,
      dailyExecutionCount: this.dailyExecutionCount,
      maxDailySnipes: this.config.maxDailySnipes,
      maxConcurrentSnipes: this.config.maxConcurrentSnipes,
      paperTradingMode: this.config.paperTradingMode,
    };
  }

  getActiveTargets(): AutoSnipeTarget[] {
    return Array.from(this.executionQueue.values());
  }

  cancelTarget(targetId: string): boolean {
    return this.executionQueue.delete(targetId);
  }

  clearQueue(): void {
    this.executionQueue.clear();
    this.emit("queueCleared");
  }

  resetDailyCount(): void {
    this.dailyExecutionCount = 0;
    this.emit("dailyCountReset");
  }
}

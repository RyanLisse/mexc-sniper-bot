import { db } from "@/src/db";
import { executionHistory, snipeTargets, userPreferences } from "@/src/db/schema";
import type { ExitLevel, ExitStrategy } from "@/src/types/exit-strategies";
import { EXIT_STRATEGIES } from "@/src/types/exit-strategies";
import { and, eq } from "drizzle-orm";
import { MexcTradingApi } from "./mexc-trading-api";

export interface ActivePosition {
  id: number;
  userId: string;
  symbol: string;
  entryPrice: number;
  quantity: number;
  positionSizeUsdt: number;
  exitStrategy: ExitStrategy;
  stopLossPercent: number;
  createdAt: Date;
  vcoinId: string;
}

export interface BatchPriceData {
  symbol: string;
  price: number;
  timestamp: Date;
}

export interface PositionUpdate {
  id: number;
  status: string;
  executedPrice?: number;
  actualPositionSize?: number;
  updatedAt: Date;
}

/**
 * Optimized Auto Exit Manager with batch operations and proper database patterns
 * Fixes N+1 queries, implements batching, and improves performance
 */
export class OptimizedAutoExitManager {
  private tradingApi: MexcTradingApi;
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private readonly MONITORING_INTERVAL_MS = 5000;
  private readonly BATCH_SIZE = 50; // Process positions in batches
  private readonly PRICE_CACHE_TTL = 10000; // 10 seconds cache
  private priceCache = new Map<string, { price: number; timestamp: number }>();

  constructor() {
    this.tradingApi = new MexcTradingApi("", "");
  }

  /**
   * Start monitoring with optimized batch processing
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log("🔄 OptimizedAutoExitManager already monitoring positions");
      return;
    }

    console.log("🚀 Starting OptimizedAutoExitManager with batch processing...");
    this.isMonitoring = true;

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.monitorAllPositionsBatch();
      } catch (error) {
        console.error("❌ Error in optimized position monitoring cycle:", error);
      }
    }, this.MONITORING_INTERVAL_MS);

    await this.monitorAllPositionsBatch();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
    this.priceCache.clear();
    console.log("⏹️ OptimizedAutoExitManager stopped monitoring");
  }

  /**
   * OPTIMIZED: Monitor all positions with batch processing and single JOIN query
   */
  private async monitorAllPositionsBatch(): Promise<void> {
    try {
      // Single optimized query with JOIN to get all data at once
      const activePositions = await this.getActivePositionsOptimized();

      if (activePositions.length === 0) {
        return;
      }

      console.log(`📊 Batch monitoring ${activePositions.length} active positions`);

      // Process in batches to avoid overwhelming the system
      const batches = this.chunkArray(activePositions, this.BATCH_SIZE);

      for (const batch of batches) {
        await this.processBatch(batch);
      }
    } catch (error) {
      console.error("❌ Error in batch monitoring:", error);
    }
  }

  /**
   * OPTIMIZED: Get active positions with single JOIN query instead of N+1 queries
   */
  private async getActivePositionsOptimized(): Promise<ActivePosition[]> {
    try {
      // Single JOIN query to get all required data
      const results = await db
        .select({
          // Target data
          targetId: snipeTargets.id,
          userId: snipeTargets.userId,
          vcoinId: snipeTargets.vcoinId,
          symbolName: snipeTargets.symbolName,
          positionSizeUsdt: snipeTargets.positionSizeUsdt,
          stopLossPercent: snipeTargets.stopLossPercent,
          targetCreatedAt: snipeTargets.createdAt,

          // Execution data
          executedPrice: executionHistory.executedPrice,
          executedQuantity: executionHistory.executedQuantity,

          // User preferences for exit strategy
          selectedExitStrategy: userPreferences.selectedExitStrategy,
          customExitStrategy: userPreferences.customExitStrategy,
        })
        .from(snipeTargets)
        .leftJoin(
          executionHistory,
          and(
            eq(executionHistory.snipeTargetId, snipeTargets.id),
            eq(executionHistory.action, "buy"),
            eq(executionHistory.status, "success")
          )
        )
        .leftJoin(userPreferences, eq(userPreferences.userId, snipeTargets.userId))
        .where(eq(snipeTargets.status, "ready"));

      const positions: ActivePosition[] = [];

      for (const result of results) {
        if (result.executedPrice && result.executedQuantity) {
          // Determine exit strategy
          let exitStrategy: ExitStrategy;
          if (result.selectedExitStrategy === "custom" && result.customExitStrategy) {
            try {
              exitStrategy = JSON.parse(result.customExitStrategy);
            } catch {
              exitStrategy = EXIT_STRATEGIES.find((s) => s.id === "balanced") || EXIT_STRATEGIES[1];
            }
          } else {
            exitStrategy =
              EXIT_STRATEGIES.find((s) => s.id === result.selectedExitStrategy) ||
              EXIT_STRATEGIES[1];
          }

          positions.push({
            id: result.targetId,
            userId: result.userId,
            symbol: result.symbolName,
            entryPrice: result.executedPrice,
            quantity: result.executedQuantity,
            positionSizeUsdt: result.positionSizeUsdt,
            exitStrategy,
            stopLossPercent: result.stopLossPercent,
            createdAt:
              result.targetCreatedAt instanceof Date
                ? result.targetCreatedAt
                : new Date(Number(result.targetCreatedAt) * 1000),
            vcoinId: result.vcoinId,
          });
        }
      }

      return positions;
    } catch (error) {
      console.error("❌ Error getting optimized active positions:", error);
      return [];
    }
  }

  /**
   * OPTIMIZED: Process positions in batches with batch price fetching
   */
  private async processBatch(positions: ActivePosition[]): Promise<void> {
    try {
      // Extract unique symbols for batch price fetching
      const symbols = [...new Set(positions.map((p) => p.symbol))];

      // Batch fetch prices instead of individual calls
      const priceData = await this.getBatchPrices(symbols);

      if (priceData.length === 0) {
        console.log("⚠️ No price data received for batch");
        return;
      }

      const updates: PositionUpdate[] = [];
      const executions: any[] = [];

      // Process each position with cached prices
      for (const position of positions) {
        const currentPrice = priceData.find((p) => p.symbol === position.symbol)?.price;

        if (!currentPrice) {
          console.log(`⚠️ No price data for ${position.symbol}`);
          continue;
        }

        const exitDecision = await this.evaluateExitCondition(position, currentPrice);

        if (exitDecision.shouldExit) {
          updates.push({
            id: position.id,
            status: "completed",
            executedPrice: currentPrice,
            actualPositionSize: exitDecision.quantityToSell || position.quantity,
            updatedAt: new Date(),
          });

          executions.push({
            userId: position.userId,
            snipeTargetId: position.id,
            vcoinId: position.vcoinId,
            symbolName: position.symbol,
            action: "sell",
            orderType: "MARKET",
            orderSide: "SELL",
            requestedQuantity: exitDecision.quantityToSell || position.quantity,
            requestedPrice: currentPrice,
            executedQuantity: exitDecision.quantityToSell || position.quantity,
            executedPrice: currentPrice,
            totalCost: (exitDecision.quantityToSell || position.quantity) * currentPrice,
            status: "success",
            requestedAt: new Date(),
            executedAt: new Date(),
          });
        }
      }

      // Batch database updates
      if (updates.length > 0) {
        await this.executeBatchUpdates(updates, executions);
      }
    } catch (error) {
      console.error("❌ Error processing batch:", error);
    }
  }

  /**
   * OPTIMIZED: Batch price fetching with caching
   */
  private async getBatchPrices(symbols: string[]): Promise<BatchPriceData[]> {
    const now = Date.now();
    const results: BatchPriceData[] = [];
    const symbolsToFetch: string[] = [];

    // Check cache first
    for (const symbol of symbols) {
      const cached = this.priceCache.get(symbol);
      if (cached && now - cached.timestamp < this.PRICE_CACHE_TTL) {
        results.push({
          symbol,
          price: cached.price,
          timestamp: new Date(cached.timestamp),
        });
      } else {
        symbolsToFetch.push(symbol);
      }
    }

    // Fetch missing prices in batch
    if (symbolsToFetch.length > 0) {
      try {
        // Use MEXC batch ticker endpoint for multiple symbols
        const symbolsParam = symbolsToFetch.join(",");
        const response = await fetch(
          `https://api.mexc.com/api/v3/ticker/price?symbols=[${symbolsToFetch.map((s) => `"${s}"`).join(",")}]`
        );

        if (response.ok) {
          const data = await response.json();
          const pricesArray = Array.isArray(data) ? data : [data];

          for (const priceInfo of pricesArray) {
            if (priceInfo.symbol && priceInfo.price) {
              const price = Number.parseFloat(priceInfo.price);

              // Cache the price
              this.priceCache.set(priceInfo.symbol, {
                price,
                timestamp: now,
              });

              results.push({
                symbol: priceInfo.symbol,
                price,
                timestamp: new Date(now),
              });
            }
          }
        }
      } catch (error) {
        console.error("❌ Error fetching batch prices:", error);
      }
    }

    return results;
  }

  /**
   * OPTIMIZED: Evaluate exit condition without external calls
   */
  private async evaluateExitCondition(
    position: ActivePosition,
    currentPrice: number
  ): Promise<{ shouldExit: boolean; reason?: string; quantityToSell?: number }> {
    const priceMultiplier = currentPrice / position.entryPrice;
    const profitPercent = (priceMultiplier - 1) * 100;

    console.log(
      `📈 ${position.symbol}: Entry: $${position.entryPrice.toFixed(6)}, Current: $${currentPrice.toFixed(6)}, P&L: ${profitPercent.toFixed(2)}%`
    );

    // Check stop-loss first
    const lossPercent = ((position.entryPrice - currentPrice) / position.entryPrice) * 100;
    if (lossPercent >= position.stopLossPercent) {
      return {
        shouldExit: true,
        reason: "stop_loss",
        quantityToSell: position.quantity,
      };
    }

    // Check take-profit levels
    const exitLevel = this.getTriggeredExitLevel(position.exitStrategy, priceMultiplier);
    if (exitLevel) {
      const quantityToSell = (position.quantity * exitLevel.percentage) / 100;
      return {
        shouldExit: true,
        reason: "take_profit",
        quantityToSell,
      };
    }

    return { shouldExit: false };
  }

  /**
   * OPTIMIZED: Batch database updates using transactions
   */
  private async executeBatchUpdates(updates: PositionUpdate[], executions: any[]): Promise<void> {
    try {
      // Use database transaction for atomic operations
      await db.transaction(async (tx) => {
        // Batch update snipe targets
        for (const update of updates) {
          await tx
            .update(snipeTargets)
            .set({
              status: update.status,
              executionPrice: update.executedPrice,
              actualPositionSize: update.actualPositionSize,
              updatedAt: update.updatedAt,
            })
            .where(eq(snipeTargets.id, update.id));
        }

        // Batch insert execution history
        if (executions.length > 0) {
          await tx.insert(executionHistory).values(executions);
        }
      });

      console.log(
        `✅ Batch updated ${updates.length} positions and recorded ${executions.length} executions`
      );
    } catch (error) {
      console.error("❌ Error in batch database updates:", error);
    }
  }

  /**
   * Get triggered exit level (unchanged)
   */
  private getTriggeredExitLevel(
    exitStrategy: ExitStrategy,
    priceMultiplier: number
  ): ExitLevel | null {
    let triggeredLevel: ExitLevel | null = null;

    for (const level of exitStrategy.levels) {
      if (priceMultiplier >= level.targetMultiplier) {
        if (!triggeredLevel || level.targetMultiplier > triggeredLevel.targetMultiplier) {
          triggeredLevel = level;
        }
      }
    }

    return triggeredLevel;
  }

  /**
   * Utility: Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Clean up price cache periodically
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [symbol, data] of this.priceCache.entries()) {
      if (now - data.timestamp > this.PRICE_CACHE_TTL * 2) {
        this.priceCache.delete(symbol);
      }
    }
  }

  /**
   * Get monitoring status with cache info
   */
  getStatus(): {
    isMonitoring: boolean;
    intervalMs: number;
    cacheSize: number;
    batchSize: number;
  } {
    return {
      isMonitoring: this.isMonitoring,
      intervalMs: this.MONITORING_INTERVAL_MS,
      cacheSize: this.priceCache.size,
      batchSize: this.BATCH_SIZE,
    };
  }
}

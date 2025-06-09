import { db } from "@/src/db";
import { executionHistory, snipeTargets } from "@/src/db/schema";
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

export interface PriceData {
  symbol: string;
  price: number;
  timestamp: Date;
}

export class AutoExitManager {
  private tradingApi: MexcTradingApi;
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private readonly MONITORING_INTERVAL_MS = 5000; // Check every 5 seconds

  constructor() {
    this.tradingApi = new MexcTradingApi("", ""); // Initialize with empty keys - will be set per user
  }

  /**
   * Start monitoring all active positions for exit conditions
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log("🔄 AutoExitManager already monitoring positions");
      return;
    }

    console.log("🚀 Starting AutoExitManager position monitoring...");
    this.isMonitoring = true;

    // Monitor positions every 5 seconds
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.monitorAllPositions();
      } catch (error) {
        console.error("❌ Error in position monitoring cycle:", error);
      }
    }, this.MONITORING_INTERVAL_MS);

    // Run initial check immediately
    await this.monitorAllPositions();
  }

  /**
   * Stop monitoring positions
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
    console.log("⏹️ AutoExitManager stopped monitoring");
  }

  /**
   * Monitor all active positions for exit conditions
   */
  private async monitorAllPositions(): Promise<void> {
    try {
      // Get all active positions (status = 'ready' or 'executing')
      const activePositions = await this.getActivePositions();

      if (activePositions.length === 0) {
        return;
      }

      console.log(`📊 Monitoring ${activePositions.length} active positions`);

      // Check each position for exit conditions
      for (const position of activePositions) {
        await this.checkExitConditions(position);
      }
    } catch (error) {
      console.error("❌ Error monitoring positions:", error);
    }
  }

  /**
   * Get all active positions from database
   */
  private async getActivePositions(): Promise<ActivePosition[]> {
    try {
      const targets = await db
        .select()
        .from(snipeTargets)
        .where(
          and(
            eq(snipeTargets.status, "ready")
            // Add condition for positions that have been executed
          )
        );

      const positions: ActivePosition[] = [];

      for (const target of targets) {
        // Get the execution history to find entry price
        const execution = await db
          .select()
          .from(executionHistory)
          .where(
            and(
              eq(executionHistory.snipeTargetId, target.id),
              eq(executionHistory.action, "buy"),
              eq(executionHistory.status, "success")
            )
          )
          .limit(1);

        if (execution.length > 0 && execution[0].executedPrice) {
          const exitStrategy = await this.getUserExitStrategy(target.userId);

          positions.push({
            id: target.id,
            userId: target.userId,
            symbol: target.symbolName,
            entryPrice: execution[0].executedPrice,
            quantity: execution[0].executedQuantity || 0,
            positionSizeUsdt: target.positionSizeUsdt,
            exitStrategy,
            stopLossPercent: target.stopLossPercent,
            createdAt:
              target.createdAt instanceof Date
                ? target.createdAt
                : new Date(Number(target.createdAt) * 1000),
            vcoinId: target.vcoinId,
          });
        }
      }

      return positions;
    } catch (error) {
      console.error("❌ Error getting active positions:", error);
      return [];
    }
  }

  /**
   * Check if a position meets exit conditions and execute if needed
   */
  private async checkExitConditions(position: ActivePosition): Promise<void> {
    try {
      // Get current price for the symbol
      const currentPrice = await this.getCurrentPrice(position.symbol);
      if (!currentPrice) {
        console.log(`⚠️ Could not get price for ${position.symbol}`);
        return;
      }

      const priceMultiplier = currentPrice / position.entryPrice;
      const profitPercent = (priceMultiplier - 1) * 100;

      console.log(
        `📈 ${position.symbol}: Entry: $${position.entryPrice.toFixed(6)}, Current: $${currentPrice.toFixed(6)}, P&L: ${profitPercent.toFixed(2)}%`
      );

      // Check stop-loss condition first (risk management)
      if (await this.shouldExecuteStopLoss(position, currentPrice)) {
        await this.executeStopLoss(position, currentPrice);
        return;
      }

      // Check take-profit conditions
      const exitLevel = this.getTriggeredExitLevel(position.exitStrategy, priceMultiplier);
      if (exitLevel) {
        await this.executeTakeProfit(position, currentPrice, exitLevel);
      }
    } catch (error) {
      console.error(`❌ Error checking exit conditions for ${position.symbol}:`, error);
    }
  }

  /**
   * Check if stop-loss should be triggered
   */
  private async shouldExecuteStopLoss(
    position: ActivePosition,
    currentPrice: number
  ): Promise<boolean> {
    if (!position.entryPrice || position.entryPrice <= 0) return false;
    const lossPercent = ((position.entryPrice - currentPrice) / position.entryPrice) * 100;
    return lossPercent >= position.stopLossPercent;
  }

  /**
   * Execute stop-loss order
   */
  private async executeStopLoss(position: ActivePosition, currentPrice: number): Promise<void> {
    console.log(`🔴 STOP-LOSS TRIGGERED for ${position.symbol} at $${currentPrice.toFixed(6)}`);

    try {
      // Execute market sell order for full position
      const result = await this.tradingApi.placeOrder({
        symbol: position.symbol,
        side: "SELL",
        type: "MARKET",
        quantity: position.quantity.toString(),
      });

      if (result.success) {
        // Update position status to completed
        await this.updatePositionStatus(position.id.toString(), "completed");

        // Record execution in history
        await this.recordExecution(position, "sell", "stop_loss", result, currentPrice);

        console.log(`✅ Stop-loss executed for ${position.symbol}: ${result.orderId}`);
      } else {
        console.error(`❌ Stop-loss execution failed for ${position.symbol}:`, result.error);
      }
    } catch (error) {
      console.error(`❌ Error executing stop-loss for ${position.symbol}:`, error);
    }
  }

  /**
   * Get the exit level that should be triggered at current price multiplier
   */
  private getTriggeredExitLevel(
    exitStrategy: ExitStrategy,
    priceMultiplier: number
  ): ExitLevel | null {
    // Find the highest exit level that has been reached
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
   * Execute take-profit order
   */
  private async executeTakeProfit(
    position: ActivePosition,
    currentPrice: number,
    exitLevel: ExitLevel
  ): Promise<void> {
    console.log(
      `🟢 TAKE-PROFIT TRIGGERED for ${position.symbol} at ${exitLevel.targetMultiplier}x (${exitLevel.profitPercent}% profit)`
    );

    try {
      // Calculate quantity to sell based on exit level percentage
      const quantityToSell = (position.quantity * exitLevel.percentage) / 100;

      const result = await this.tradingApi.placeOrder({
        symbol: position.symbol,
        side: "SELL",
        type: "MARKET",
        quantity: quantityToSell.toString(),
      });

      if (result.success) {
        // Update position - reduce quantity or mark complete if fully sold
        const remainingQuantity = position.quantity - quantityToSell;

        if (remainingQuantity <= 0.001) {
          // Consider position closed if very small remainder
          await this.updatePositionStatus(position.id.toString(), "completed");
        } else {
          // Update remaining quantity (this would need position tracking table)
          console.log(`📊 Remaining position: ${remainingQuantity} ${position.symbol}`);
        }

        // Record execution in history
        await this.recordExecution(position, "sell", "take_profit", result, currentPrice);

        console.log(
          `✅ Take-profit executed for ${position.symbol}: ${result.orderId} (${exitLevel.percentage}% of position)`
        );
      } else {
        console.error(`❌ Take-profit execution failed for ${position.symbol}:`, result.error);
      }
    } catch (error) {
      console.error(`❌ Error executing take-profit for ${position.symbol}:`, error);
    }
  }

  /**
   * Get current price for a symbol
   */
  private async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      // Use MEXC API to get current price
      const response = await fetch(`https://api.mexc.com/api/v3/ticker/price?symbol=${symbol}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return Number.parseFloat(data.price);
    } catch (error) {
      console.error(`❌ Error getting price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get user's exit strategy from preferences
   */
  private async getUserExitStrategy(userId: string): Promise<ExitStrategy> {
    try {
      // Get user preferences to determine exit strategy
      const response = await fetch(`/api/user-preferences?userId=${encodeURIComponent(userId)}`);
      if (!response.ok) {
        // Default to balanced strategy
        return EXIT_STRATEGIES.find((s) => s.id === "balanced") || EXIT_STRATEGIES[1];
      }

      const preferences = await response.json();

      if (preferences.selectedExitStrategy === "custom" && preferences.customExitStrategy) {
        return preferences.customExitStrategy;
      }

      return (
        EXIT_STRATEGIES.find((s) => s.id === preferences.selectedExitStrategy) || EXIT_STRATEGIES[1]
      );
    } catch (error) {
      console.error("❌ Error getting user exit strategy:", error);
      // Default to balanced strategy
      return EXIT_STRATEGIES.find((s) => s.id === "balanced") || EXIT_STRATEGIES[1];
    }
  }

  /**
   * Update position status in database
   */
  private async updatePositionStatus(targetId: string, status: string): Promise<void> {
    try {
      await db
        .update(snipeTargets)
        .set({
          status,
          updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
        })
        .where(eq(snipeTargets.id, Number.parseInt(targetId)));
    } catch (error) {
      console.error("❌ Error updating position status:", error);
    }
  }

  /**
   * Record execution in history
   */
  private async recordExecution(
    position: ActivePosition,
    action: string,
    reason: string,
    order: any,
    price: number
  ): Promise<void> {
    try {
      await db.insert(executionHistory).values({
        userId: position.userId,
        snipeTargetId: position.id,
        vcoinId: position.vcoinId,
        symbolName: position.symbol,
        action,
        orderType: "MARKET",
        orderSide: "SELL",
        requestedQuantity: Number.parseFloat(order.quantity) || 0,
        requestedPrice: price,
        executedQuantity: Number.parseFloat(order.executedQty || "0"),
        executedPrice: price,
        totalCost: Number.parseFloat(order.executedQty || "0") * price,
        exchangeOrderId: order.orderId || "",
        exchangeStatus: order.status || "",
        exchangeResponse: JSON.stringify(order),
        status: "success",
        requestedAt: new Date(),
        executedAt: new Date(),
      });

      console.log(`📝 Recorded execution: ${action} ${position.symbol} - ${reason}`);
    } catch (error) {
      console.error("❌ Error recording execution:", error);
    }
  }

  /**
   * Get monitoring status
   */
  getStatus(): { isMonitoring: boolean; intervalMs: number } {
    return {
      isMonitoring: this.isMonitoring,
      intervalMs: this.MONITORING_INTERVAL_MS,
    };
  }
}

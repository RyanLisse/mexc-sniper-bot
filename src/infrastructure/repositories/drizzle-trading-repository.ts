/**
 * Drizzle Trading Repository
 * Implements the TradingRepository interface using Drizzle ORM
 */

import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { TradingRepository } from "@/src/application/interfaces/trading-repository";
import { db } from "@/src/db";
import { snipeTargets, transactions } from "@/src/db/schemas/trading";
import { Trade, TradeStatus } from "@/src/domain/entities/trading/trade";
import { toSafeError } from "@/src/lib/error-type-utils";

export class DrizzleTradingRepository implements TradingRepository {
  constructor(
    private readonly logger: {
      info: (message: string, context?: any) => void;
      warn: (message: string, context?: any) => void;
      error: (message: string, context?: any) => void;
      debug: (message: string, context?: any) => void;
    } = console
  ) {}

  async saveTrade(trade: Trade): Promise<Trade> {
    try {
      this.logger.debug("Saving trade to database", {
        tradeId: trade.id,
        symbol: trade.symbol,
        status: trade.status,
      });

      // Convert trade to database format
      const tradeData = this.tradeToDbFormat(trade);

      // Insert into snipe targets table (adapting existing schema)
      const [insertedTrade] = await db.insert(snipeTargets).values(tradeData).returning();

      // Also insert into transactions table for tracking
      if (trade.hasOrders()) {
        await this.saveTradeOrders(trade);
      }

      this.logger.info("Trade saved successfully", {
        tradeId: trade.id,
        dbId: insertedTrade.id,
      });

      return trade;
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to save trade", {
        tradeId: trade.id,
        error: safeError,
      });
      throw safeError;
    }
  }

  async findTradeById(id: string): Promise<Trade | null> {
    try {
      // Query by either the domain ID or database ID
      const result = await db
        .select()
        .from(snipeTargets)
        .where(
          sql`${snipeTargets.errorMessage} LIKE ${`%tradeId:${id}%`} OR ${snipeTargets.id} = ${parseInt(id, 10) || -1}`
        )
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.dbToTradeFormat(result[0]);
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to find trade by ID", {
        id,
        error: safeError,
      });
      return null;
    }
  }

  async findTradesByUserId(userId: string, limit = 50): Promise<Trade[]> {
    try {
      const results = await db
        .select()
        .from(snipeTargets)
        .where(sql`${snipeTargets.errorMessage} LIKE ${`%userId:${userId}%`}`)
        .orderBy(desc(snipeTargets.createdAt))
        .limit(limit);

      return results.map((row: any) => this.dbToTradeFormat(row)).filter(Boolean) as Trade[];
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to find trades by user ID", {
        userId,
        error: safeError,
      });
      return [];
    }
  }

  async findTradesBySymbol(symbol: string, limit = 50): Promise<Trade[]> {
    try {
      const results = await db
        .select()
        .from(snipeTargets)
        .where(eq(snipeTargets.symbolName, symbol.toUpperCase()))
        .orderBy(desc(snipeTargets.createdAt))
        .limit(limit);

      return results.map((row: any) => this.dbToTradeFormat(row)).filter(Boolean) as Trade[];
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to find trades by symbol", {
        symbol,
        error: safeError,
      });
      return [];
    }
  }

  async findActiveTradesByUserId(userId: string): Promise<Trade[]> {
    try {
      const activeStatuses = ["ready", "executing", "pending"];

      const results = await db
        .select()
        .from(snipeTargets)
        .where(
          and(
            sql`${snipeTargets.errorMessage} LIKE ${`%userId:${userId}%`}`,
            sql`${snipeTargets.status} IN (${activeStatuses.map((s) => `'${s}'`).join(",")})`
          )
        )
        .orderBy(desc(snipeTargets.createdAt));

      return results.map((row: any) => this.dbToTradeFormat(row)).filter(Boolean) as Trade[];
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to find active trades by user ID", {
        userId,
        error: safeError,
      });
      return [];
    }
  }

  async updateTrade(trade: Trade): Promise<Trade> {
    try {
      this.logger.debug("Updating trade in database", {
        tradeId: trade.id,
        status: trade.status,
      });

      // Find existing record by trade ID
      const existing = await db
        .select()
        .from(snipeTargets)
        .where(sql`${snipeTargets.errorMessage} LIKE ${`%tradeId:${trade.id}%`}`)
        .limit(1);

      if (existing.length === 0) {
        throw new Error(`Trade not found for update: ${trade.id}`);
      }

      // Update with new trade data
      const updateData = this.tradeToDbUpdateFormat(trade);

      await db.update(snipeTargets).set(updateData).where(eq(snipeTargets.id, existing[0].id));

      // Update orders if any
      if (trade.hasOrders()) {
        await this.saveTradeOrders(trade);
      }

      this.logger.info("Trade updated successfully", {
        tradeId: trade.id,
        dbId: existing[0].id,
      });

      return trade;
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to update trade", {
        tradeId: trade.id,
        error: safeError,
      });
      throw safeError;
    }
  }

  async deleteTrade(id: string): Promise<void> {
    try {
      // Delete from snipe targets
      await db
        .delete(snipeTargets)
        .where(sql`${snipeTargets.errorMessage} LIKE ${`%tradeId:${id}%`}`);

      // Delete related transactions
      await db.delete(transactions).where(sql`${transactions.notes} LIKE ${`%tradeId:${id}%`}`);

      this.logger.info("Trade deleted successfully", { tradeId: id });
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to delete trade", {
        tradeId: id,
        error: safeError,
      });
      throw safeError;
    }
  }

  async getTradingMetrics(
    userId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<{
    totalTrades: number;
    successfulTrades: number;
    totalPnL: number;
    successRate: number;
    averageExecutionTime: number;
  }> {
    try {
      const whereConditions = [sql`${snipeTargets.errorMessage} LIKE ${`%userId:${userId}%`}`];

      if (fromDate) {
        whereConditions.push(gte(snipeTargets.createdAt, fromDate));
      }
      if (toDate) {
        whereConditions.push(lte(snipeTargets.createdAt, toDate));
      }

      // Get total trades count
      const [totalResult] = await db
        .select({ count: count() })
        .from(snipeTargets)
        .where(and(...whereConditions));

      // Get successful trades count
      const [successfulResult] = await db
        .select({ count: count() })
        .from(snipeTargets)
        .where(and(...whereConditions, eq(snipeTargets.status, "completed")));

      // Calculate basic metrics
      const totalTrades = totalResult.count;
      const successfulTrades = successfulResult.count;
      const successRate = totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0;

      // For now, return basic metrics
      // In a production system, you'd calculate actual PnL and execution times
      return {
        totalTrades,
        successfulTrades,
        totalPnL: 0, // Would be calculated from actual trade results
        successRate,
        averageExecutionTime: 0, // Would be calculated from execution timestamps
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to get trading metrics", {
        userId,
        error: safeError,
      });
      throw safeError;
    }
  }

  // Private helper methods

  private tradeToDbFormat(trade: Trade): any {
    const metadata = JSON.stringify({
      tradeId: trade.id,
      userId: trade.userId,
      strategy: trade.strategy,
      paperTrade: trade.paperTrade,
      notes: trade.notes,
      createdAt: trade.createdAt.toISOString(),
      updatedAt: trade.updatedAt.toISOString(),
    });

    return {
      userId: trade.userId,
      vcoinId: trade.symbol.replace("USDT", ""), // Extract vcoin from symbol
      symbolName: trade.symbol,
      positionSizeUsdt: 100, // Default position size, would be calculated from orders
      confidenceScore: trade.confidenceScore || 0,
      stopLossPercent: trade.stopLossPercent || 5,
      takeProfitCustom: trade.takeProfitPercent,
      status: this.mapTradeStatusToDb(trade.status),
      priority: trade.isAutoSnipe ? 1 : 0,
      targetExecutionTime: trade.executionStartedAt,
      actualExecutionTime: trade.executionCompletedAt,
      errorMessage: trade.errorMessage || metadata, // Store metadata in errorMessage field
      createdAt: trade.createdAt,
      updatedAt: trade.updatedAt,
    };
  }

  private tradeToDbUpdateFormat(trade: Trade): any {
    const metadata = JSON.stringify({
      tradeId: trade.id,
      userId: trade.userId,
      strategy: trade.strategy,
      paperTrade: trade.paperTrade,
      notes: trade.notes,
      createdAt: trade.createdAt.toISOString(),
      updatedAt: trade.updatedAt.toISOString(),
    });

    return {
      status: this.mapTradeStatusToDb(trade.status),
      actualExecutionTime: trade.executionCompletedAt,
      errorMessage: trade.errorMessage || metadata,
      updatedAt: trade.updatedAt,
    };
  }

  private dbToTradeFormat(row: any): Trade | null {
    try {
      let tradeMetadata: any = {};

      if (row.errorMessage) {
        try {
          tradeMetadata = JSON.parse(row.errorMessage);
        } catch {
          // If errorMessage is not JSON, treat as plain error message
          tradeMetadata = { errorMessage: row.errorMessage };
        }
      }

      // Extract trade ID from metadata or generate one
      const tradeId = tradeMetadata.tradeId || `trade-${row.id}-${Date.now()}`;

      return Trade.fromExisting({
        id: tradeId,
        userId: tradeMetadata.userId || "unknown",
        symbol: row.symbolName,
        status: this.mapDbStatusToTrade(row.status),
        strategy: tradeMetadata.strategy,
        isAutoSnipe: true,
        confidenceScore: row.confidenceScore,
        paperTrade: tradeMetadata.paperTrade || false,
        orders: [], // Orders would be loaded separately
        stopLossPercent: row.stopLossPercent,
        takeProfitPercent: row.takeProfitCustom,
        executionStartedAt: row.targetExecutionTime,
        executionCompletedAt: row.actualExecutionTime,
        errorMessage: tradeMetadata.errorMessage || row.errorMessage,
        notes: tradeMetadata.notes,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to convert DB row to Trade", {
        rowId: row.id,
        error: safeError,
      });
      return null;
    }
  }

  private mapTradeStatusToDb(status: TradeStatus): string {
    switch (status) {
      case TradeStatus.PENDING:
        return "ready";
      case TradeStatus.EXECUTING:
        return "executing";
      case TradeStatus.COMPLETED:
        return "completed";
      case TradeStatus.FAILED:
        return "failed";
      case TradeStatus.CANCELLED:
        return "cancelled";
      default:
        return "ready";
    }
  }

  private mapDbStatusToTrade(status: string): TradeStatus {
    switch (status) {
      case "ready":
        return TradeStatus.PENDING;
      case "executing":
        return TradeStatus.EXECUTING;
      case "completed":
        return TradeStatus.COMPLETED;
      case "failed":
        return TradeStatus.FAILED;
      case "cancelled":
        return TradeStatus.CANCELLED;
      default:
        return TradeStatus.PENDING;
    }
  }

  private async saveTradeOrders(trade: Trade): Promise<void> {
    try {
      for (const order of trade.orders) {
        const transactionData = {
          userId: trade.userId,
          transactionType: order.side === "BUY" ? "buy" : "sell",
          symbolName: order.symbol,
          vcoinId: trade.symbol.replace("USDT", ""), // Extract vcoin from symbol
          buyPrice: order.side === "BUY" ? order.price : null,
          buyQuantity: order.side === "BUY" ? order.quantity : null,
          buyTotalCost: order.side === "BUY" ? (order.quantity || 0) * (order.price || 0) : null,
          buyTimestamp: order.side === "BUY" ? order.createdAt : null,
          buyOrderId: order.side === "BUY" ? order.exchangeOrderId || order.id : null,
          sellPrice: order.side === "SELL" ? order.price : null,
          sellQuantity: order.side === "SELL" ? order.quantity : null,
          sellTotalRevenue:
            order.side === "SELL" ? (order.quantity || 0) * (order.price || 0) : null,
          sellTimestamp: order.side === "SELL" ? order.createdAt : null,
          sellOrderId: order.side === "SELL" ? order.exchangeOrderId || order.id : null,
          fees: order.fees || 0,
          status: order.status === "FILLED" ? "completed" : "pending",
          snipeTargetId: null, // Would need to map this properly
          notes: JSON.stringify({
            tradeId: trade.id,
            orderId: order.id,
            strategy: order.strategy,
            confidenceScore: order.confidenceScore,
          }),
          transactionTime: order.createdAt,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        };

        await db
          .insert(transactions)
          .values(transactionData)
          .onConflictDoUpdate({
            target: [transactions.buyOrderId],
            set: {
              status: transactionData.status,
              fees: transactionData.fees,
              updatedAt: transactionData.updatedAt,
            },
          });
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to save trade orders", {
        tradeId: trade.id,
        orderCount: trade.orders.length,
        error: safeError,
      });
      // Don't throw here as this is a secondary operation
    }
  }
}

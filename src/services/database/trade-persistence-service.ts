/**
 * Trade Persistence Service
 *
 * Provides database operations for persisting trade execution history,
 * transactions, and balance snapshots to the Supabase database.
 */

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import {
  balanceSnapshots,
  executionHistory,
  type NewBalanceSnapshot,
  type NewExecutionHistory,
  type NewTransaction,
  transactions,
} from "@/src/db/schemas/supabase-trading";

export interface TradeExecutionData {
  userId: string;
  snipeTargetId?: string;
  vcoinId: string;
  symbolName: string;
  action: "buy" | "sell" | "cancel";
  orderType: "market" | "limit";
  orderSide: "buy" | "sell";
  requestedQuantity: number;
  requestedPrice?: number;
  executedQuantity?: number;
  executedPrice?: number;
  totalCost?: number;
  fees?: number;
  exchangeOrderId?: string;
  exchangeStatus?: string;
  exchangeResponse?: string;
  executionLatencyMs?: number;
  slippagePercent?: number;
  status: "success" | "partial" | "failed" | "cancelled";
  errorCode?: string;
  errorMessage?: string;
  requestedAt: Date;
  executedAt?: Date;
}

export interface TransactionData {
  userId: string;
  transactionType: "buy" | "sell" | "complete_trade";
  symbolName: string;
  vcoinId?: string;
  buyPrice?: number;
  buyQuantity?: number;
  buyTotalCost?: number;
  buyTimestamp?: Date;
  buyOrderId?: string;
  sellPrice?: number;
  sellQuantity?: number;
  sellTotalRevenue?: number;
  sellTimestamp?: Date;
  sellOrderId?: string;
  profitLoss?: number;
  profitLossPercentage?: number;
  fees?: number;
  status?: "pending" | "completed" | "failed" | "cancelled";
  snipeTargetId?: string;
  notes?: string;
}

export interface BalanceSnapshotData {
  userId: string;
  asset: string;
  freeAmount: number;
  lockedAmount: number;
  totalAmount: number;
  usdValue: number;
  priceSource?: string;
  exchangeRate?: number;
  snapshotType?: "periodic" | "manual" | "triggered";
  dataSource?: "api" | "manual" | "calculated";
}

export class TradePersistenceService {
  private logger = {
    info: (message: string, context?: any) => {
      console.info("[trade-persistence-service]", message, context || "");
    },
    warn: (message: string, context?: any) => {
      console.warn("[trade-persistence-service]", message, context || "");
    },
    error: (message: string, context?: any) => {
      console.error("[trade-persistence-service]", message, context || "");
    },
    debug: (message: string, context?: any) => {
      console.debug("[trade-persistence-service]", message, context || "");
    },
  };

  /**
   * Save trade execution history to database
   */
  async saveExecutionHistory(
    data: TradeExecutionData
  ): Promise<{ id: string }> {
    try {
      this.logger.info("Saving execution history to database", {
        symbolName: data.symbolName,
        action: data.action,
        status: data.status,
      });

      const executionData: NewExecutionHistory = {
        userId: data.userId,
        snipeTargetId: data.snipeTargetId || null,
        vcoinId: data.vcoinId,
        symbolName: data.symbolName,
        action: data.action,
        orderType: data.orderType,
        orderSide: data.orderSide,
        requestedQuantity: data.requestedQuantity,
        requestedPrice: data.requestedPrice || null,
        executedQuantity: data.executedQuantity || null,
        executedPrice: data.executedPrice || null,
        totalCost: data.totalCost || null,
        fees: data.fees || null,
        exchangeOrderId: data.exchangeOrderId || null,
        exchangeStatus: data.exchangeStatus || null,
        exchangeResponse: data.exchangeResponse || null,
        executionLatencyMs: data.executionLatencyMs || null,
        slippagePercent: data.slippagePercent || null,
        status: data.status,
        errorCode: data.errorCode || null,
        errorMessage: data.errorMessage || null,
        requestedAt: data.requestedAt,
        executedAt: data.executedAt || null,
      };

      const result = await db
        .insert(executionHistory)
        .values(executionData)
        .returning({ id: executionHistory.id });

      const insertedId = result[0]?.id;
      if (!insertedId) {
        throw new Error("Failed to get inserted execution history ID");
      }

      this.logger.info("Successfully saved execution history", {
        id: insertedId,
        symbolName: data.symbolName,
      });

      return { id: insertedId };
    } catch (error) {
      this.logger.error("Failed to save execution history", {
        error: error instanceof Error ? error.message : "Unknown error",
        data,
      });
      throw error;
    }
  }

  /**
   * Save transaction data to database
   */
  async saveTransaction(data: TransactionData): Promise<{ id: string }> {
    try {
      this.logger.info("Saving transaction to database", {
        symbolName: data.symbolName,
        transactionType: data.transactionType,
        status: data.status,
      });

      const transactionData: NewTransaction = {
        userId: data.userId,
        transactionType: data.transactionType,
        symbolName: data.symbolName,
        vcoinId: data.vcoinId || null,
        buyPrice: data.buyPrice || null,
        buyQuantity: data.buyQuantity || null,
        buyTotalCost: data.buyTotalCost || null,
        buyTimestamp: data.buyTimestamp || null,
        buyOrderId: data.buyOrderId || null,
        sellPrice: data.sellPrice || null,
        sellQuantity: data.sellQuantity || null,
        sellTotalRevenue: data.sellTotalRevenue || null,
        sellTimestamp: data.sellTimestamp || null,
        sellOrderId: data.sellOrderId || null,
        profitLoss: data.profitLoss || null,
        profitLossPercentage: data.profitLossPercentage || null,
        fees: data.fees || null,
        status: data.status || "pending",
        snipeTargetId: data.snipeTargetId || null,
        notes: data.notes || null,
      };

      const result = await db
        .insert(transactions)
        .values(transactionData)
        .returning({ id: transactions.id });

      const insertedId = result[0]?.id;
      if (!insertedId) {
        throw new Error("Failed to get inserted transaction ID");
      }

      this.logger.info("Successfully saved transaction", {
        id: insertedId,
        symbolName: data.symbolName,
      });

      return { id: insertedId };
    } catch (error) {
      this.logger.error("Failed to save transaction", {
        error: error instanceof Error ? error.message : "Unknown error",
        data,
      });
      throw error;
    }
  }

  /**
   * Save balance snapshot to database
   */
  async saveBalanceSnapshot(
    data: BalanceSnapshotData
  ): Promise<{ id: string }> {
    try {
      this.logger.debug("Saving balance snapshot to database", {
        userId: data.userId,
        asset: data.asset,
        totalAmount: data.totalAmount,
      });

      const snapshotData: NewBalanceSnapshot = {
        userId: data.userId,
        asset: data.asset,
        freeAmount: data.freeAmount,
        lockedAmount: data.lockedAmount,
        totalAmount: data.totalAmount,
        usdValue: data.usdValue,
        priceSource: data.priceSource || "mexc",
        exchangeRate: data.exchangeRate || null,
        snapshotType: data.snapshotType || "triggered",
        dataSource: data.dataSource || "api",
      };

      const result = await db
        .insert(balanceSnapshots)
        .values(snapshotData)
        .returning({ id: balanceSnapshots.id });

      const insertedId = result[0]?.id;
      if (!insertedId) {
        throw new Error("Failed to get inserted balance snapshot ID");
      }

      this.logger.debug("Successfully saved balance snapshot", {
        id: insertedId,
        asset: data.asset,
      });

      return { id: insertedId };
    } catch (error) {
      this.logger.error("Failed to save balance snapshot", {
        error: error instanceof Error ? error.message : "Unknown error",
        data,
      });
      throw error;
    }
  }

  /**
   * Save multiple balance snapshots (e.g., before and after trade)
   */
  async saveBalanceSnapshots(
    snapshots: BalanceSnapshotData[]
  ): Promise<{ ids: string[] }> {
    try {
      this.logger.debug("Saving multiple balance snapshots", {
        count: snapshots.length,
        assets: snapshots.map((s) => s.asset),
      });

      const snapshotData: NewBalanceSnapshot[] = snapshots.map((data) => ({
        userId: data.userId,
        asset: data.asset,
        freeAmount: data.freeAmount,
        lockedAmount: data.lockedAmount,
        totalAmount: data.totalAmount,
        usdValue: data.usdValue,
        priceSource: data.priceSource || "mexc",
        exchangeRate: data.exchangeRate || null,
        snapshotType: data.snapshotType || "triggered",
        dataSource: data.dataSource || "api",
      }));

      const result = await db
        .insert(balanceSnapshots)
        .values(snapshotData)
        .returning({ id: balanceSnapshots.id });

      const insertedIds = result.map((r) => r.id);

      this.logger.debug("Successfully saved balance snapshots", {
        ids: insertedIds,
        count: insertedIds.length,
      });

      return { ids: insertedIds };
    } catch (error) {
      this.logger.error("Failed to save balance snapshots", {
        error: error instanceof Error ? error.message : "Unknown error",
        count: snapshots.length,
      });
      throw error;
    }
  }

  /**
   * Get execution history for a user
   */
  async getExecutionHistory(userId: string, limit = 50) {
    try {
      const result = await db
        .select()
        .from(executionHistory)
        .where(eq(executionHistory.userId, userId))
        .orderBy(desc(executionHistory.createdAt))
        .limit(limit);

      return result;
    } catch (error) {
      this.logger.error("Failed to get execution history", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
      });
      throw error;
    }
  }

  /**
   * Get transactions for a user
   */
  async getTransactions(userId: string, limit = 50) {
    try {
      const result = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, userId))
        .orderBy(desc(transactions.createdAt))
        .limit(limit);

      return result;
    } catch (error) {
      this.logger.error("Failed to get transactions", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
      });
      throw error;
    }
  }

  /**
   * Get balance snapshots for a user and asset
   */
  async getBalanceSnapshots(userId: string, asset?: string, limit = 50) {
    try {
      let query = db
        .select()
        .from(balanceSnapshots)
        .where(eq(balanceSnapshots.userId, userId));

      if (asset) {
        query = query.where(
          and(
            eq(balanceSnapshots.userId, userId),
            eq(balanceSnapshots.asset, asset)
          )
        );
      }

      const result = await query
        .orderBy(desc(balanceSnapshots.timestamp))
        .limit(limit);

      return result;
    } catch (error) {
      this.logger.error("Failed to get balance snapshots", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
        asset,
      });
      throw error;
    }
  }

  /**
   * Update transaction with completion data (for sell trades)
   */
  async updateTransactionCompletion(
    transactionId: string,
    completionData: {
      sellPrice?: number;
      sellQuantity?: number;
      sellTotalRevenue?: number;
      sellTimestamp?: Date;
      sellOrderId?: string;
      profitLoss?: number;
      profitLossPercentage?: number;
      status?: "completed" | "failed" | "cancelled";
    }
  ): Promise<void> {
    try {
      this.logger.info("Updating transaction completion", {
        transactionId,
        status: completionData.status,
      });

      await db
        .update(transactions)
        .set({
          sellPrice: completionData.sellPrice || null,
          sellQuantity: completionData.sellQuantity || null,
          sellTotalRevenue: completionData.sellTotalRevenue || null,
          sellTimestamp: completionData.sellTimestamp || null,
          sellOrderId: completionData.sellOrderId || null,
          profitLoss: completionData.profitLoss || null,
          profitLossPercentage: completionData.profitLossPercentage || null,
          status: completionData.status || "completed",
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, transactionId));

      this.logger.info("Successfully updated transaction completion", {
        transactionId,
      });
    } catch (error) {
      this.logger.error("Failed to update transaction completion", {
        error: error instanceof Error ? error.message : "Unknown error",
        transactionId,
      });
      throw error;
    }
  }
}

// Export singleton instance
export const tradePersistenceService = new TradePersistenceService();

/**
 * Transaction Service
 * Business logic extracted from oversized API route
 */

import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/src/db";
import { type NewTransaction, transactions } from "@/src/db/schemas/trading";
import type {
  CreateTransactionData,
  QueryTransactionData,
} from "./transaction-validation";

export interface TransactionSummary {
  totalTransactions: number;
  completedTrades: number;
  totalProfitLoss: number;
  profitableTrades: number;
  losingTrades: number;
  winRate: number;
  averageProfitLoss: number;
}

export interface TransactionResult {
  transactions: unknown[];
  summary: TransactionSummary;
}

export class TransactionService {
  private static readonly QUERY_TIMEOUT = 10000;

  static async getTransactions(
    queryData: QueryTransactionData
  ): Promise<TransactionResult> {
    const {
      userId,
      status,
      symbolName,
      transactionType,
      fromDate,
      toDate,
      limit,
      offset,
    } = queryData;

    // Build query conditions
    const conditions = [eq(transactions.userId, userId)];

    if (status) {
      conditions.push(eq(transactions.status, status));
    }

    if (symbolName) {
      conditions.push(eq(transactions.symbolName, symbolName));
    }

    if (transactionType) {
      conditions.push(eq(transactions.transactionType, transactionType));
    }

    if (fromDate) {
      const fromTimestamp = new Date(fromDate);
      if (Number.isNaN(fromTimestamp.getTime())) {
        throw new Error("Invalid fromDate format");
      }
      conditions.push(gte(transactions.transactionTime, fromTimestamp));
    }

    if (toDate) {
      const toTimestamp = new Date(toDate);
      if (Number.isNaN(toTimestamp.getTime())) {
        throw new Error("Invalid toDate format");
      }
      conditions.push(lte(transactions.transactionTime, toTimestamp));
    }

    // Execute query with timeout
    const userTransactions = await Promise.race([
      db
        .select()
        .from(transactions)
        .where(and(...conditions))
        .orderBy(desc(transactions.transactionTime))
        .limit(limit)
        .offset(offset),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Database query timeout")),
          TransactionService.QUERY_TIMEOUT
        )
      ),
    ]);

    const summary = TransactionService.calculateSummary(userTransactions);

    return {
      transactions: userTransactions,
      summary,
    };
  }

  static async createTransaction(
    transactionData: CreateTransactionData
  ): Promise<unknown> {
    // Auto-calculate profit/loss for complete trades
    if (
      transactionData.transactionType === "complete_trade" &&
      transactionData.buyTotalCost &&
      transactionData.sellTotalRevenue &&
      !transactionData.profitLoss
    ) {
      transactionData.profitLoss =
        transactionData.sellTotalRevenue - transactionData.buyTotalCost;
      transactionData.profitLossPercentage =
        (transactionData.profitLoss / transactionData.buyTotalCost) * 100;
    }

    const insertData: NewTransaction = {
      userId: transactionData.userId,
      transactionType: transactionData.transactionType,
      symbolName: transactionData.symbolName,
      vcoinId: transactionData.vcoinId,
      buyPrice: transactionData.buyPrice,
      buyQuantity: transactionData.buyQuantity,
      buyTotalCost: transactionData.buyTotalCost,
      buyTimestamp: transactionData.buyTimestamp
        ? TransactionService.parseTimestamp(transactionData.buyTimestamp)
        : undefined,
      buyOrderId: transactionData.buyOrderId,
      sellPrice: transactionData.sellPrice,
      sellQuantity: transactionData.sellQuantity,
      sellTotalRevenue: transactionData.sellTotalRevenue,
      sellTimestamp: transactionData.sellTimestamp
        ? TransactionService.parseTimestamp(transactionData.sellTimestamp)
        : undefined,
      sellOrderId: transactionData.sellOrderId,
      profitLoss: transactionData.profitLoss,
      profitLossPercentage: transactionData.profitLossPercentage,
      fees: transactionData.fees,
      status: transactionData.status,
      snipeTargetId: transactionData.snipeTargetId,
      notes: transactionData.notes,
      transactionTime: new Date(),
    };

    // Execute database insertion with timeout
    const [created] = await Promise.race([
      db.insert(transactions).values(insertData).returning(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Database insert timeout")),
          TransactionService.QUERY_TIMEOUT
        )
      ),
    ]);

    return created;
  }

  static async updateTransaction(
    id: number,
    updateData: Partial<CreateTransactionData>
  ): Promise<unknown> {
    // Add updated timestamp
    const dataWithTimestamp = {
      ...updateData,
      updatedAt: Math.floor(Date.now() / 1000),
    };

    // Execute database update with timeout
    const [updated] = await Promise.race([
      db
        .update(transactions)
        .set(dataWithTimestamp)
        .where(eq(transactions.id, id))
        .returning(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Database update timeout")),
          TransactionService.QUERY_TIMEOUT
        )
      ),
    ]);

    return updated;
  }

  private static parseTimestamp(timestamp: number): Date {
    try {
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid timestamp: ${timestamp}`);
      }
      return date;
    } catch (error) {
      console.error("Error converting timestamp:", { timestamp, error });
      return new Date(); // Fallback to current time
    }
  }

  private static calculateSummary(
    userTransactions: unknown[]
  ): TransactionSummary {
    const completedTrades = userTransactions.filter(
      (t: any) =>
        t.status === "completed" && t.transactionType === "complete_trade"
    );

    const totalProfitLoss = completedTrades.reduce(
      (sum: number, t: any) => sum + (t.profitLoss || 0),
      0
    );

    const profitableTrades = completedTrades.filter(
      (t: any) => (t.profitLoss || 0) > 0
    );

    const losingTrades = completedTrades.filter(
      (t: any) => (t.profitLoss || 0) < 0
    );

    const winRate =
      completedTrades.length > 0
        ? (profitableTrades.length / completedTrades.length) * 100
        : 0;

    return {
      totalTransactions: userTransactions.length,
      completedTrades: completedTrades.length,
      totalProfitLoss,
      profitableTrades: profitableTrades.length,
      losingTrades: losingTrades.length,
      winRate: Math.round(winRate * 100) / 100,
      averageProfitLoss:
        completedTrades.length > 0
          ? totalProfitLoss / completedTrades.length
          : 0,
    };
  }

  static createEmptyResult(): TransactionResult {
    return {
      transactions: [],
      summary: {
        totalTransactions: 0,
        completedTrades: 0,
        totalProfitLoss: 0,
        profitableTrades: 0,
        losingTrades: 0,
        winRate: 0,
        averageProfitLoss: 0,
      },
    };
  }

  static isDatabaseConnectivityError(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.message.includes("ECONNREFUSED") ||
        error.message.includes("timeout") ||
        error.message.includes("connection") ||
        error.message.includes("ENOTFOUND") ||
        error.message.includes("Database query timeout") ||
        error.message.includes("Database insert timeout") ||
        error.message.includes("Database update timeout"))
    );
  }
}

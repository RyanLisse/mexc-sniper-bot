/**
 * Trading Repository Interface
 * Defines the contract for trading data persistence operations
 */

import type { Trade } from "@/src/domain/entities/trading/trade";

export interface TradingRepository {
  /**
   * Save a trade to persistence
   */
  saveTrade(trade: Trade): Promise<Trade>;

  /**
   * Find a trade by ID
   */
  findTradeById(id: string): Promise<Trade | null>;

  /**
   * Find trades by user ID
   */
  findTradesByUserId(userId: string, limit?: number): Promise<Trade[]>;

  /**
   * Find trades by symbol
   */
  findTradesBySymbol(symbol: string, limit?: number): Promise<Trade[]>;

  /**
   * Find active trades for a user
   */
  findActiveTradesByUserId(userId: string): Promise<Trade[]>;

  /**
   * Update trade status
   */
  updateTrade(trade: Trade): Promise<Trade>;

  /**
   * Delete a trade
   */
  deleteTrade(id: string): Promise<void>;

  /**
   * Get trading performance metrics for a user
   */
  getTradingMetrics(
    userId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<{
    totalTrades: number;
    successfulTrades: number;
    totalPnL: number;
    successRate: number;
    averageExecutionTime: number;
  }>;
}

export interface TradingService {
  /**
   * Execute a trade through the trading service
   */
  executeTrade(params: {
    symbol: string;
    side: "BUY" | "SELL";
    type: "MARKET" | "LIMIT" | "STOP_LIMIT";
    quantity?: number;
    quoteOrderQty?: number;
    price?: number;
    stopPrice?: number;
    timeInForce?: "GTC" | "IOC" | "FOK";
    isAutoSnipe?: boolean;
    confidenceScore?: number;
    paperTrade?: boolean;
  }): Promise<{
    success: boolean;
    data?: {
      orderId: string;
      clientOrderId?: string;
      symbol: string;
      side: string;
      type: string;
      quantity: string;
      price: string;
      status: string;
      executedQty: string;
      timestamp: string;
    };
    error?: string;
    executionTime?: number;
  }>;

  /**
   * Get current market price for a symbol
   */
  getCurrentPrice(symbol: string): Promise<number>;

  /**
   * Check if trading is allowed for a symbol
   */
  canTrade(symbol: string): Promise<boolean>;
}

export interface NotificationService {
  /**
   * Send trade execution notification
   */
  notifyTradeExecution(trade: Trade): Promise<void>;

  /**
   * Send trade completion notification
   */
  notifyTradeCompletion(trade: Trade): Promise<void>;

  /**
   * Send trade failure notification
   */
  notifyTradeFailure(trade: Trade, error: string): Promise<void>;
}

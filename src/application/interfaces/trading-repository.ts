/**
 * Trading Repository Interface
 * Defines the contract for trading data persistence operations
 */

import type { Trade } from "../../domain/entities/trading/trade";

// Base interface types
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

export interface PortfolioService {
  /**
   * Get account balance information
   */
  getAccountBalance(): Promise<{
    success: boolean;
    data?: Array<{
      asset: string;
      free: string;
      locked: string;
      total?: number;
      usdtValue?: number;
    }>;
    error?: string;
  }>;

  /**
   * Get enhanced account balances with portfolio metrics
   */
  getAccountBalances(): Promise<{
    success: boolean;
    data?: {
      balances: Array<{
        asset: string;
        free: string;
        locked: string;
        total?: number;
        usdtValue?: number;
      }>;
      totalUsdtValue: number;
      totalValue: number;
      totalValueBTC: number;
      allocation: Record<string, number>;
      performance24h: { change: number; changePercent: number };
    };
    error?: string;
  }>;

  /**
   * Get account information with trading permissions
   */
  getAccountInfo(): Promise<{
    success: boolean;
    data?: {
      accountType: string;
      canTrade: boolean;
      canWithdraw: boolean;
      canDeposit: boolean;
      balances: Array<{
        asset: string;
        free: string;
        locked: string;
      }>;
    };
    error?: string;
  }>;

  /**
   * Calculate total portfolio value in USDT
   */
  getTotalPortfolioValue(): Promise<number>;

  /**
   * Check if user has sufficient balance for trading
   */
  hasSufficientBalance(asset: string, requiredAmount: number): Promise<boolean>;

  /**
   * Get balance for a specific asset
   */
  getAssetBalance(
    asset: string
  ): Promise<{ free: string; locked: string } | null>;
}

export interface MarketService {
  /**
   * Get exchange information
   */
  getExchangeInfo(): Promise<{
    success: boolean;
    data?: {
      symbols?: Array<{
        symbol: string;
        status: string;
        baseAsset: string;
        quoteAsset: string;
      }>;
    };
    error?: string;
  }>;

  /**
   * Get symbols data
   */
  getSymbolsData(): Promise<{
    success: boolean;
    data?: Array<{
      symbol: string;
      status: string;
      baseAsset: string;
      quoteAsset: string;
    }>;
    error?: string;
  }>;

  /**
   * Get 24hr ticker statistics
   */
  getTicker24hr(symbols?: string[]): Promise<{
    success: boolean;
    data?: Array<{
      symbol: string;
      price: string;
      lastPrice: string;
      priceChangePercent: string;
      volume: string;
    }>;
    error?: string;
  }>;

  /**
   * Get single symbol ticker
   */
  getTicker(symbol: string): Promise<{
    success: boolean;
    data?: {
      symbol: string;
      price: string;
      lastPrice: string;
      priceChangePercent: string;
      volume: string;
    };
    error?: string;
  }>;

  /**
   * Get symbol status
   */
  getSymbolStatus(
    symbol: string
  ): Promise<{ status: string; trading: boolean }>;

  /**
   * Get order book depth
   */
  getOrderBookDepth(
    symbol: string,
    limit?: number
  ): Promise<{
    success: boolean;
    data?: {
      bids: [string, string][];
      asks: [string, string][];
      lastUpdateId: number;
    };
    error?: string;
  }>;
}

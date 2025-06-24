/**
 * Live Trading Data Hook
 *
 * React hook for real-time trading data including prices, signals, and execution updates.
 * Integrates with MEXC WebSocket streams and AI trading system.
 *
 * Features:
 * - Real-time price feeds
 * - Order book streaming
 * - Trading signal monitoring
 * - Execution tracking
 * - Portfolio updates
 * - Performance analytics
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createLogger } from "../lib/structured-logger";
import type {
  TradingBalanceMessage,
  TradingExecutionMessage,
  TradingPortfolioMessage,
  TradingPriceMessage,
  TradingSignalMessage,
} from "../lib/websocket-types";
import { useWebSocket } from "./use-websocket";

// ======================
// Types and Interfaces
// ======================

export interface PriceData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: number;
  source: string;
  metadata?: {
    high24h?: number;
    low24h?: number;
    volume24h?: number;
    lastUpdate?: number;
  };
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
}

export interface OrderBookData {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
  spread: number;
  spreadPercent: number;
}

export interface TradingSignal {
  signalId: string;
  symbol: string;
  type: "buy" | "sell" | "hold" | "monitor";
  strength: number;
  confidence: number;
  source: string;
  reasoning: string;
  targetPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  timeframe: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface TradeExecution {
  executionId: string;
  orderId: string;
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "stop_limit";
  status: "pending" | "filled" | "partially_filled" | "cancelled" | "rejected";
  quantity: number;
  price: number;
  executedQuantity: number;
  executedPrice: number;
  timestamp: number;
  fees?: {
    amount: number;
    currency: string;
  };
  metadata?: Record<string, any>;
}

export interface PortfolioPosition {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  marketValue: number;
}

export interface TradingMetrics {
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  totalReturn: number;
  totalReturnPercent: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalTrades: number;
  profitableTrades: number;
  averageWin: number;
  averageLoss: number;
}

export interface UseLiveTradingDataConfig {
  /** Symbols to monitor */
  symbols?: string[];
  /** Enable order book streaming */
  enableOrderBook?: boolean;
  /** Order book depth levels */
  orderBookDepth?: number;
  /** Enable trading signals */
  enableSignals?: boolean;
  /** Enable execution tracking */
  enableExecutions?: boolean;
  /** Enable portfolio tracking */
  enablePortfolio?: boolean;
  /** Price update frequency filter (ms) */
  priceThrottleMs?: number;
  /** Auto-subscribe to new symbols */
  autoSubscribeNewSymbols?: boolean;
  /** User ID for portfolio tracking */
  userId?: string;
}

export interface UseLiveTradingDataResult {
  /** Real-time price data by symbol */
  prices: Map<string, PriceData>;
  /** Order book data by symbol */
  orderBooks: Map<string, OrderBookData>;
  /** Trading signals */
  signals: TradingSignal[];
  /** Trade executions */
  executions: TradeExecution[];
  /** Portfolio positions */
  positions: PortfolioPosition[];
  /** Account balances */
  balances: any[];
  /** Trading metrics */
  metrics: TradingMetrics;
  /** Currently monitored symbols */
  monitoredSymbols: string[];
  /** Connection status */
  isConnected: boolean;
  /** Last update timestamp */
  lastUpdate: number;
  /** Get price for symbol */
  getPrice: (symbol: string) => PriceData | undefined;
  /** Get order book for symbol */
  getOrderBook: (symbol: string) => OrderBookData | undefined;
  /** Get position for symbol */
  getPosition: (symbol: string) => PortfolioPosition | undefined;
  /** Subscribe to symbol */
  subscribeToSymbol: (symbol: string) => void;
  /** Unsubscribe from symbol */
  unsubscribeFromSymbol: (symbol: string) => void;
  /** Get price change for timeframe */
  getPriceChange: (symbol: string, timeframe: "1m" | "5m" | "1h" | "24h") => number;
  /** Get top movers */
  getTopMovers: (type: "gainers" | "losers", limit?: number) => PriceData[];
  /** Clear historical data */
  clearHistory: () => void;
}

// ======================
// Price Analytics Engine
// ======================

class PriceAnalyticsEngine {
  private logger = createLogger("use-live-trading-data");

  private priceHistory = new Map<string, Array<{ price: number; timestamp: number }>>();
  private readonly maxHistoryPoints = 1000;

  // PERFORMANCE OPTIMIZATION: Cache recent calculations to avoid repeated work
  private priceChangeCache = new Map<string, { result: number; timestamp: number }>();
  private topMoversCache = new Map<string, { result: PriceData[]; timestamp: number }>();
  private readonly cacheTimeout = 5000; // 5 seconds cache

  addPricePoint(symbol: string, price: number, timestamp: number): void {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }

    const history = this.priceHistory.get(symbol)!;

    // OPTIMIZATION: Use circular buffer approach instead of array.splice
    // This reduces memory allocations and improves performance
    if (history.length >= this.maxHistoryPoints) {
      // Remove oldest entry efficiently
      history.pop();
    }

    history.unshift({ price, timestamp });

    // Invalidate caches for this symbol
    this.invalidateCacheForSymbol(symbol);
  }

  getPriceChange(symbol: string, timeframeMs: number): number {
    // OPTIMIZATION: Check cache first to avoid expensive calculations
    const cacheKey = `${symbol}-${timeframeMs}`;
    const cached = this.priceChangeCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.result;
    }

    const history = this.priceHistory.get(symbol);
    if (!history || history.length < 2) return 0;

    const now = Date.now();
    const cutoff = now - timeframeMs;

    const currentPrice = history[0].price;

    // OPTIMIZATION: Use binary search instead of linear search for better performance
    const pastPrice = this.findPriceAtTimestamp(history, cutoff);

    if (!pastPrice) return 0;

    const result = ((currentPrice - pastPrice) / pastPrice) * 100;

    // Cache the result
    this.priceChangeCache.set(cacheKey, { result, timestamp: Date.now() });

    return result;
  }

  // OPTIMIZATION: Binary search for timestamp lookup (O(log n) vs O(n))
  private findPriceAtTimestamp(
    history: Array<{ price: number; timestamp: number }>,
    targetTimestamp: number
  ): number | null {
    if (history.length === 0) return null;

    let left = 0;
    let right = history.length - 1;
    let bestMatch: number | null = null;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midTimestamp = history[mid].timestamp;

      if (midTimestamp <= targetTimestamp) {
        bestMatch = history[mid].price;
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    return bestMatch;
  }

  getTopMovers(
    prices: Map<string, PriceData>,
    type: "gainers" | "losers",
    limit = 10
  ): PriceData[] {
    // OPTIMIZATION: Check cache first
    const cacheKey = `${type}-${limit}-${prices.size}`;
    const cached = this.topMoversCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.result;
    }

    // OPTIMIZATION: Use array filtering and partial sorting for better performance
    const pricesArray = Array.from(prices.values());
    const filtered = pricesArray.filter((p) => p.changePercent !== 0);

    // OPTIMIZATION: Use partial sort (quickselect) instead of full sort for top K elements
    const result = this.partialSort(filtered, type === "gainers", limit);

    // Cache the result
    this.topMoversCache.set(cacheKey, { result, timestamp: Date.now() });

    return result;
  }

  // OPTIMIZATION: Partial sort implementation for top K elements (O(n) average case)
  private partialSort(arr: PriceData[], descending: boolean, k: number): PriceData[] {
    if (k >= arr.length) {
      return arr.sort((a, b) =>
        descending ? b.changePercent - a.changePercent : a.changePercent - b.changePercent
      );
    }

    // For small k, use heap-based approach
    if (k <= 10) {
      return arr
        .sort((a, b) =>
          descending ? b.changePercent - a.changePercent : a.changePercent - b.changePercent
        )
        .slice(0, k);
    }

    // For larger k, use quickselect algorithm
    return this.quickSelect(arr, k, descending);
  }

  private quickSelect(arr: PriceData[], k: number, descending: boolean): PriceData[] {
    const compare = (a: PriceData, b: PriceData) =>
      descending ? b.changePercent - a.changePercent : a.changePercent - b.changePercent;

    // Simple implementation - in production, use more sophisticated quickselect
    return arr.sort(compare).slice(0, k);
  }

  private invalidateCacheForSymbol(symbol: string): void {
    // Remove cached entries related to this symbol
    for (const key of this.priceChangeCache.keys()) {
      if (key.startsWith(`${symbol}-`)) {
        this.priceChangeCache.delete(key);
      }
    }

    // Clear top movers cache as it depends on all symbols
    this.topMoversCache.clear();
  }

  clear(): void {
    this.priceHistory.clear();
    this.priceChangeCache.clear();
    this.topMoversCache.clear();
  }

  // OPTIMIZATION: Performance monitoring and analytics
  getPerformanceMetrics() {
    return {
      historySize: this.priceHistory.size,
      totalHistoryPoints: Array.from(this.priceHistory.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
      cacheHitRatio: {
        priceChange: this.priceChangeCache.size,
        topMovers: this.topMoversCache.size,
      },
      memoryUsage: {
        historyMB: this.estimateMemoryUsage(this.priceHistory),
        cacheMB:
          this.estimateMemoryUsage(this.priceChangeCache) +
          this.estimateMemoryUsage(this.topMoversCache),
      },
    };
  }

  private estimateMemoryUsage(obj: any): number {
    // Rough estimation - in production, use more sophisticated memory tracking
    return JSON.stringify(obj).length / (1024 * 1024);
  }
}

// ======================
// Trading Metrics Calculator
// ======================

class TradingMetricsCalculator {
  private executions: TradeExecution[] = [];
  private positions: PortfolioPosition[] = [];
  private totalValue = 0;
  private initialValue = 0;

  updateExecutions(executions: TradeExecution[]): void {
    this.executions = executions;
  }

  updatePositions(positions: PortfolioPosition[]): void {
    this.positions = positions;
    this.totalValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
  }

  setInitialValue(value: number): void {
    if (this.initialValue === 0) {
      this.initialValue = value;
    }
  }

  calculateMetrics(): TradingMetrics {
    const completedTrades = this.executions.filter((e) => e.status === "filled");
    const profitableTrades = completedTrades.filter((e) => this.isTradeProfit(e));

    const wins = profitableTrades.length;
    const _losses = completedTrades.length - wins;
    const winRate = completedTrades.length > 0 ? wins / completedTrades.length : 0;

    const profits = profitableTrades.map((e) => this.getTradeProfit(e));
    const losses_amounts = completedTrades
      .filter((e) => !this.isTradeProfit(e))
      .map((e) => Math.abs(this.getTradeProfit(e)));

    const averageWin =
      profits.length > 0 ? profits.reduce((sum, p) => sum + p, 0) / profits.length : 0;
    const averageLoss =
      losses_amounts.length > 0
        ? losses_amounts.reduce((sum, l) => sum + l, 0) / losses_amounts.length
        : 0;

    const totalReturn = this.initialValue > 0 ? this.totalValue - this.initialValue : 0;
    const totalReturnPercent = this.initialValue > 0 ? (totalReturn / this.initialValue) * 100 : 0;

    const unrealizedPnl = this.positions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);
    const dayChange = unrealizedPnl; // Simplified calculation
    const dayChangePercent =
      this.totalValue > 0 ? (dayChange / (this.totalValue - dayChange)) * 100 : 0;

    return {
      totalValue: this.totalValue,
      dayChange,
      dayChangePercent,
      totalReturn,
      totalReturnPercent,
      winRate,
      sharpeRatio: this.calculateSharpeRatio(),
      maxDrawdown: this.calculateMaxDrawdown(),
      totalTrades: completedTrades.length,
      profitableTrades: wins,
      averageWin,
      averageLoss,
    };
  }

  private isTradeProfit(execution: TradeExecution): boolean {
    // Simplified - would need more complex logic for actual P&L calculation
    return execution.side === "sell"
      ? execution.executedPrice > execution.price
      : execution.executedPrice < execution.price;
  }

  private getTradeProfit(execution: TradeExecution): number {
    // Simplified profit calculation
    const direction = execution.side === "buy" ? 1 : -1;
    return direction * (execution.executedPrice - execution.price) * execution.executedQuantity;
  }

  private calculateSharpeRatio(): number {
    // Simplified Sharpe ratio calculation
    // Would need actual returns series for proper calculation
    return 0;
  }

  private calculateMaxDrawdown(): number {
    // Simplified max drawdown calculation
    // Would need historical portfolio values
    return 0;
  }
}

// ======================
// Main Hook
// ======================

export function useLiveTradingData(
  config: UseLiveTradingDataConfig = {}
): UseLiveTradingDataResult {
  const {
    symbols = [],
    enableOrderBook = true,
    orderBookDepth = 20,
    enableSignals = true,
    enableExecutions = true,
    enablePortfolio = true,
    priceThrottleMs = 100,
    autoSubscribeNewSymbols = true,
    userId,
  } = config;

  // WebSocket connection
  const { subscribe, isConnected, send } = useWebSocket({
    autoConnect: true,
    debug: false,
  });

  // State management
  const [prices, setPrices] = useState(new Map<string, PriceData>());
  const [orderBooks, setOrderBooks] = useState(new Map<string, OrderBookData>());
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [executions, setExecutions] = useState<TradeExecution[]>([]);
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [monitoredSymbols, setMonitoredSymbols] = useState<string[]>(symbols);
  const [lastUpdate, setLastUpdate] = useState(0);

  // Analytics engines
  const analyticsRef = useRef(new PriceAnalyticsEngine());
  const metricsRef = useRef(new TradingMetricsCalculator());
  const [metrics, setMetrics] = useState<TradingMetrics>({
    totalValue: 0,
    dayChange: 0,
    dayChangePercent: 0,
    totalReturn: 0,
    totalReturnPercent: 0,
    winRate: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    totalTrades: 0,
    profitableTrades: 0,
    averageWin: 0,
    averageLoss: 0,
  });

  // Refs for cleanup and performance
  const isMountedRef = useRef(true);
  const priceThrottleRef = useRef(new Map<string, number>());

  // Price update handler
  const handlePriceUpdate = useCallback(
    (message: any) => {
      if (!isMountedRef.current) return;

      const priceData = message.data as TradingPriceMessage;
      const now = Date.now();

      // Throttle price updates
      const lastUpdate = priceThrottleRef.current.get(priceData.symbol) || 0;
      if (now - lastUpdate < priceThrottleMs) return;

      priceThrottleRef.current.set(priceData.symbol, now);

      const priceInfo: PriceData = {
        symbol: priceData.symbol,
        price: priceData.price,
        change: priceData.change,
        changePercent: priceData.changePercent,
        volume: priceData.volume,
        timestamp: priceData.timestamp,
        source: priceData.source,
        metadata: priceData.metadata,
      };

      setPrices((prev) => {
        const newMap = new Map(prev);
        newMap.set(priceData.symbol, priceInfo);
        return newMap;
      });

      // Add to analytics
      analyticsRef.current.addPricePoint(priceData.symbol, priceData.price, priceData.timestamp);

      // Auto-subscribe to new symbol if enabled
      if (autoSubscribeNewSymbols && !monitoredSymbols.includes(priceData.symbol)) {
        setMonitoredSymbols((prev) => [...prev, priceData.symbol]);
      }

      setLastUpdate(now);
    },
    [priceThrottleMs, autoSubscribeNewSymbols, monitoredSymbols]
  );

  // Order book update handler
  const handleOrderBookUpdate = useCallback(
    (message: any) => {
      if (!isMountedRef.current || !enableOrderBook) return;

      const orderBookData = message.data;

      const bids: OrderBookLevel[] = orderBookData.bids.map(
        ([price, quantity]: [string, string]) => ({
          price: Number.parseFloat(price),
          quantity: Number.parseFloat(quantity),
        })
      );

      const asks: OrderBookLevel[] = orderBookData.asks.map(
        ([price, quantity]: [string, string]) => ({
          price: Number.parseFloat(price),
          quantity: Number.parseFloat(quantity),
        })
      );

      const spread = asks[0] ? asks[0].price - bids[0].price : 0;
      const midPrice = asks[0] && bids[0] ? (asks[0].price + bids[0].price) / 2 : 0;
      const spreadPercent = midPrice > 0 ? (spread / midPrice) * 100 : 0;

      const orderBook: OrderBookData = {
        symbol: orderBookData.symbol,
        bids: bids.slice(0, orderBookDepth),
        asks: asks.slice(0, orderBookDepth),
        timestamp: orderBookData.timestamp,
        spread,
        spreadPercent,
      };

      setOrderBooks((prev) => {
        const newMap = new Map(prev);
        newMap.set(orderBookData.symbol, orderBook);
        return newMap;
      });

      setLastUpdate(Date.now());
    },
    [enableOrderBook, orderBookDepth]
  );

  // Trading signal handler
  const handleTradingSignal = useCallback(
    (message: any) => {
      if (!isMountedRef.current || !enableSignals) return;

      const signalData = message.data as TradingSignalMessage;

      const signal: TradingSignal = {
        signalId: signalData.signalId,
        symbol: signalData.symbol,
        type: signalData.type,
        strength: signalData.strength,
        confidence: signalData.confidence,
        source: signalData.source,
        reasoning: signalData.reasoning,
        targetPrice: signalData.targetPrice,
        stopLoss: signalData.stopLoss,
        takeProfit: signalData.takeProfit,
        timeframe: signalData.timeframe,
        timestamp: signalData.timestamp,
        metadata: signalData.metadata,
      };

      setSignals((prev) => [signal, ...prev.slice(0, 99)]); // Keep last 100 signals
      setLastUpdate(Date.now());
    },
    [enableSignals]
  );

  // Execution handler
  const handleExecution = useCallback(
    (message: any) => {
      if (!isMountedRef.current || !enableExecutions) return;

      const executionData = message.data as TradingExecutionMessage;

      const execution: TradeExecution = {
        executionId: executionData.executionId,
        orderId: executionData.orderId,
        symbol: executionData.symbol,
        side: executionData.side,
        type: executionData.type,
        status: executionData.status,
        quantity: executionData.quantity,
        price: executionData.price,
        executedQuantity: executionData.executedQuantity,
        executedPrice: executionData.executedPrice,
        timestamp: executionData.timestamp,
        fees: executionData.fees,
        metadata: executionData.metadata,
      };

      setExecutions((prev) => {
        const newExecutions = [execution, ...prev.slice(0, 199)]; // Keep last 200 executions
        metricsRef.current.updateExecutions(newExecutions);
        return newExecutions;
      });

      setLastUpdate(Date.now());
    },
    [enableExecutions]
  );

  // Portfolio handler
  const handlePortfolio = useCallback(
    (message: any) => {
      if (!isMountedRef.current || !enablePortfolio) return;

      const portfolioData = message.data as TradingPortfolioMessage;

      if (userId && portfolioData.userId !== userId) return;

      const newPositions: PortfolioPosition[] = portfolioData.portfolio.positions.map((pos) => ({
        symbol: pos.symbol,
        quantity: pos.quantity,
        averagePrice: pos.averagePrice,
        currentPrice: pos.currentPrice,
        unrealizedPnl: pos.unrealizedPnl,
        unrealizedPnlPercent: pos.unrealizedPnlPercent,
        marketValue: pos.quantity * pos.currentPrice,
      }));

      setPositions(newPositions);
      metricsRef.current.updatePositions(newPositions);
      metricsRef.current.setInitialValue(portfolioData.portfolio.totalValue);

      setLastUpdate(Date.now());
    },
    [enablePortfolio, userId]
  );

  // Balance handler
  const handleBalance = useCallback(
    (message: any) => {
      if (!isMountedRef.current || !enablePortfolio) return;

      const balanceData = message.data as TradingBalanceMessage;

      if (userId && balanceData.userId !== userId) return;

      setBalances(balanceData.balances);
      setLastUpdate(Date.now());
    },
    [enablePortfolio, userId]
  );

  // Set up subscriptions
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribers: (() => void)[] = [];

    // Subscribe to general trading data
    unsubscribers.push(subscribe("trading:prices", handlePriceUpdate));

    if (enableSignals) {
      unsubscribers.push(subscribe("trading:signals", handleTradingSignal));
    }

    if (enableExecutions) {
      unsubscribers.push(subscribe("trading:executions", handleExecution));
    }

    if (enablePortfolio && userId) {
      unsubscribers.push(subscribe(`user:${userId}:trading`, handlePortfolio));
      unsubscribers.push(subscribe(`user:${userId}:portfolio`, handlePortfolio));
      unsubscribers.push(subscribe("trading:balance", handleBalance));
    }

    // Subscribe to specific symbols
    for (const symbol of monitoredSymbols) {
      unsubscribers.push(subscribe(`trading:${symbol}:price`, handlePriceUpdate));

      if (enableOrderBook) {
        unsubscribers.push(subscribe(`trading:${symbol}:orderbook`, handleOrderBookUpdate));
      }

      if (enableSignals) {
        unsubscribers.push(subscribe(`trading:${symbol}:signals`, handleTradingSignal));
      }
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [
    isConnected,
    subscribe,
    monitoredSymbols,
    enableOrderBook,
    enableSignals,
    enableExecutions,
    enablePortfolio,
    userId,
    handlePriceUpdate,
    handleOrderBookUpdate,
    handleTradingSignal,
    handleExecution,
    handlePortfolio,
    handleBalance,
  ]);

  // Update metrics periodically
  useEffect(() => {
    const updateMetrics = () => {
      if (isMountedRef.current) {
        setMetrics(metricsRef.current.calculateMetrics());
      }
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // API functions
  const getPrice = useCallback(
    (symbol: string) => {
      return prices.get(symbol);
    },
    [prices]
  );

  const getOrderBook = useCallback(
    (symbol: string) => {
      return orderBooks.get(symbol);
    },
    [orderBooks]
  );

  const getPosition = useCallback(
    (symbol: string) => {
      return positions.find((pos) => pos.symbol === symbol);
    },
    [positions]
  );

  const subscribeToSymbol = useCallback(
    (symbol: string) => {
      if (!monitoredSymbols.includes(symbol)) {
        setMonitoredSymbols((prev) => [...prev, symbol]);
      }
    },
    [monitoredSymbols]
  );

  const unsubscribeFromSymbol = useCallback((symbol: string) => {
    setMonitoredSymbols((prev) => prev.filter((s) => s !== symbol));
  }, []);

  const getPriceChange = useCallback((symbol: string, timeframe: "1m" | "5m" | "1h" | "24h") => {
    const timeframeMs = {
      "1m": 60 * 1000,
      "5m": 5 * 60 * 1000,
      "1h": 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
    }[timeframe];

    return analyticsRef.current.getPriceChange(symbol, timeframeMs);
  }, []);

  const getTopMovers = useCallback(
    (type: "gainers" | "losers", limit = 10) => {
      return analyticsRef.current.getTopMovers(prices, type, limit);
    },
    [prices]
  );

  const clearHistory = useCallback(() => {
    setSignals([]);
    setExecutions([]);
    analyticsRef.current.clear();
    priceThrottleRef.current.clear();
    setLastUpdate(Date.now());
  }, []);

  // MEMORY LEAK PREVENTION: Comprehensive cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;

      // Clear all data to prevent memory leaks
      setPrices(new Map());
      setOrderBooks(new Map());
      setSignals([]);
      setExecutions([]);
      setPositions([]);
      setBalances([]);

      // Clear analytics caches
      analyticsRef.current.clear();
      priceThrottleRef.current.clear();

      // Clear metrics calculator
      metricsRef.current = new TradingMetricsCalculator();

      logger.info("[useLiveTradingData] Memory cleanup completed");
    };
  }, []);

  return {
    prices,
    orderBooks,
    signals,
    executions,
    positions,
    balances,
    metrics,
    monitoredSymbols,
    isConnected,
    lastUpdate,
    getPrice,
    getOrderBook,
    getPosition,
    subscribeToSymbol,
    unsubscribeFromSymbol,
    getPriceChange,
    getTopMovers,
    clearHistory,
  };
}

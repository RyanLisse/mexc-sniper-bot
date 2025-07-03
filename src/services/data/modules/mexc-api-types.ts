/**
 * MEXC API Types and Query Keys - Simplified Version
 *
 * Contains optimized query keys and simplified type definitions.
 */

// ============================================================================
// Simple Type Definitions
// ============================================================================

export interface SimpleRiskAssessment {
  level: string;
  score: number;
  factors: string[];
}

export interface SimpleBalanceEntry {
  asset: string;
  free: string;
  locked: string;
}

export interface SimpleCalendarEntry {
  vcoinId: string;
  projectName: string;
  launchTime: string;
  status: string;
}

export interface SimpleExchangeInfo {
  timezone: string;
  serverTime: number;
  symbols: SimpleSymbolEntry[];
}

export interface SimpleKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface SimpleMarketStats {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  volume: string;
}

export interface SimpleOrderBook {
  bids: [string, string][];
  asks: [string, string][];
}

export interface SimplePortfolio {
  totalValueUSDT: number;
  balances: SimpleBalanceEntry[];
}

export interface SimpleSymbolEntry {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
}

export interface SimpleTicker {
  symbol: string;
  price: string;
  time: number;
}

// ============================================================================
// Optimized Query Key Factory
// ============================================================================

/**
 * Type-safe query key factory for MEXC API endpoints
 * Optimized for React Query with proper cache invalidation
 */
export const mexcQueryKeys = {
  // Base keys
  all: () => ["mexc"] as const,

  // Calendar and listings
  calendar: () => [...mexcQueryKeys.all(), "calendar"] as const,

  // Symbols and market data
  symbols: () => [...mexcQueryKeys.all(), "symbols"] as const,
  symbol: (vcoinId: string) => [...mexcQueryKeys.symbols(), vcoinId] as const,

  // Account and portfolio
  account: () => [...mexcQueryKeys.all(), "account"] as const,
  balance: () => [...mexcQueryKeys.account(), "balance"] as const,
  portfolio: () => [...mexcQueryKeys.account(), "portfolio"] as const,

  // Market data
  ticker: (symbol?: string) =>
    symbol
      ? ([...mexcQueryKeys.all(), "ticker", symbol] as const)
      : ([...mexcQueryKeys.all(), "ticker"] as const),

  orderBook: (symbol: string) =>
    [...mexcQueryKeys.all(), "orderBook", symbol] as const,
  klines: (symbol: string, interval: string) =>
    [...mexcQueryKeys.all(), "klines", symbol, interval] as const,

  // System status
  serverTime: () => [...mexcQueryKeys.all(), "serverTime"] as const,
  exchangeInfo: () => [...mexcQueryKeys.all(), "exchangeInfo"] as const,

  // Trading
  trades: (symbol: string) =>
    [...mexcQueryKeys.all(), "trades", symbol] as const,
  orders: (symbol?: string) =>
    symbol
      ? ([...mexcQueryKeys.all(), "orders", symbol] as const)
      : ([...mexcQueryKeys.all(), "orders"] as const),
} as const;

// ============================================================================
// Response Type Definitions
// ============================================================================

export interface MexcApiResponse<T = any> {
  code: number;
  data: T;
  success: boolean;
  message?: string;
}

export interface MexcServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string | number;
  timestamp: string | number;
  source?: string;
  requestId?: string;
  cached?: boolean;
  executionTimeMs?: number;
  responseTime?: number;
  retryCount?: number;
  metadata?: {
    fromCache?: boolean;
    cacheKey?: string;
    [key: string]: any;
  };
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface MexcApiConfig {
  apiKey: string;
  secretKey: string;
  passphrase?: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  rateLimitDelay: number;
}

export interface MexcCacheConfig {
  enableCaching: boolean;
  cacheTTL: number;
  apiResponseTTL: number;
}

export interface MexcReliabilityConfig {
  enableCircuitBreaker: boolean;
  enableRateLimiter: boolean;
  maxFailures: number;
  resetTimeout: number;
}

// ============================================================================
// Exports (Using Simple Types)
// ============================================================================

export type {
  SimpleCalendarEntry as CalendarEntry,
  SimpleSymbolEntry as SymbolEntry,
  SimpleBalanceEntry as BalanceEntry,
  SimpleExchangeInfo as ExchangeInfo,
  SimpleTicker as Ticker,
  SimpleOrderBook as OrderBook,
  SimpleKline as Kline,
  SimpleMarketStats as MarketStats,
  SimplePortfolio as Portfolio,
  SimpleRiskAssessment as RiskAssessment,
  MexcApiResponse,
  MexcServiceResponse,
  MexcApiConfig,
  MexcCacheConfig,
  MexcReliabilityConfig,
};

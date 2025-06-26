/**
 * MEXC API Types and Query Keys
 *
 * Extracted from unified MEXC service for better modularity.
 * Contains optimized query keys and type definitions.
 */

import type {
  BalanceEntry,
  CalendarEntry,
  ExchangeInfo,
  Kline,
  MarketStats,
  OrderBook,
  Portfolio,
  RiskAssessment,
  SymbolEntry,
  Ticker,
} from "@/src/schemas/unified/mexc-api-schemas";

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

  orderBook: (symbol: string) => [...mexcQueryKeys.all(), "orderBook", symbol] as const,
  klines: (symbol: string, interval: string) =>
    [...mexcQueryKeys.all(), "klines", symbol, interval] as const,

  // System status
  serverTime: () => [...mexcQueryKeys.all(), "serverTime"] as const,
  exchangeInfo: () => [...mexcQueryKeys.all(), "exchangeInfo"] as const,

  // Trading
  trades: (symbol: string) => [...mexcQueryKeys.all(), "trades", symbol] as const,
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
// Exports
// ============================================================================

export type {
  CalendarEntry,
  SymbolEntry,
  BalanceEntry,
  ExchangeInfo,
  Ticker,
  OrderBook,
  Kline,
  MarketStats,
  Portfolio,
  RiskAssessment,
};

/**
 * MEXC Client Types and Configuration
 *
 * Core types, interfaces, and configuration for the MEXC API client.
 * Extracted from unified-mexc-client.ts for better modularity.
 */

export {
  type BalanceEntry,
  BalanceEntrySchema,
  type CalendarEntry,
  CalendarEntrySchema,
  type ExchangeSymbol,
  ExchangeSymbolSchema,
  type OrderResult,
  OrderResultSchema,
  type SymbolEntry,
  SymbolEntrySchema,
  type Ticker,
  TickerSchema,
} from "../../schemas/unified/mexc-api-schemas";

// ============================================================================
// Core Configuration
// ============================================================================

export interface UnifiedMexcConfig {
  apiKey?: string;
  secretKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  rateLimitDelay?: number;
  enableCaching?: boolean;
  cacheTTL?: number;
}

export interface UnifiedMexcResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  timestamp: string;
  cached?: boolean;
  requestId?: string;
}

// ============================================================================
// Trading Order Parameters
// ============================================================================

export interface OrderParameters {
  symbol: string;
  side: "BUY" | "SELL";
  type: "LIMIT" | "MARKET";
  quantity: string;
  price?: string;
  timeInForce?: "GTC" | "IOC" | "FOK";
  quoteOrderQty?: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface MexcApiHeaders {
  "X-MEXC-APIKEY"?: string;
  "Content-Type": string;
  "User-Agent": string;
}

export interface MexcApiRequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  params?: Record<string, unknown>;
  data?: Record<string, unknown>;
  headers?: MexcApiHeaders;
  timeout?: number;
}

export interface AccountInfo {
  accountType: string;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime?: number;
}

export interface PortfolioBalance {
  asset: string;
  free: string;
  locked: string;
  total: number;
  usdtValue?: number;
}

export interface PortfolioData {
  balances: PortfolioBalance[];
  totalUsdtValue: number;
  lastUpdated?: string;
}

// ============================================================================
// Error Types
// ============================================================================

export interface MexcApiError {
  code: number;
  msg: string;
  requestId?: string;
}

export class MexcClientError extends Error {
  public readonly code?: number;
  public readonly requestId?: string;

  constructor(message: string, code?: number, requestId?: string) {
    super(message);
    this.name = "MexcClientError";
    this.code = code;
    this.requestId = requestId;
  }
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hitRate?: number;
  missRate?: number;
}

// ============================================================================
// Market Data Types
// ============================================================================

export interface SymbolInfo {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  baseAssetPrecision: number;
  quotePrecision: number;
  orderTypes: string[];
  icebergAllowed: boolean;
  ocoAllowed: boolean;
  isSpotTradingAllowed: boolean;
  isMarginTradingAllowed: boolean;
  filters: SymbolFilter[];
}

export interface SymbolFilter {
  filterType: string;
  minPrice?: string;
  maxPrice?: string;
  tickSize?: string;
  minQty?: string;
  maxQty?: string;
  stepSize?: string;
  minNotional?: string;
  applyToMarket?: boolean;
  avgPriceMins?: number;
}

export interface TickerStats {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_CONFIG: Required<UnifiedMexcConfig> = {
  apiKey: "",
  secretKey: "",
  baseUrl: "https://api.mexc.com",
  timeout: 10000,
  maxRetries: 3,
  retryDelay: 1000,
  rateLimitDelay: 100,
  enableCaching: true,
  cacheTTL: 60000, // 1 minute default
};

export const API_ENDPOINTS = {
  // Public Market Data
  PING: "/api/v3/ping",
  SERVER_TIME: "/api/v3/time",
  EXCHANGE_INFO: "/api/v3/exchangeInfo",
  TICKER_24HR: "/api/v3/ticker/24hr",
  TICKER_PRICE: "/api/v3/ticker/price",
  DEPTH: "/api/v3/depth",
  KLINES: "/api/v3/klines",

  // Account Endpoints
  ACCOUNT: "/api/v3/account",
  BALANCE: "/api/v3/account",

  // Trading Endpoints
  ORDER: "/api/v3/order",
  ORDER_TEST: "/api/v3/order/test",
  OPEN_ORDERS: "/api/v3/openOrders",
  ALL_ORDERS: "/api/v3/allOrders",

  // Capital Endpoints
  CAPITAL_CONFIG: "/sapi/v1/capital/config/getall",
  DEPOSIT_HISTORY: "/sapi/v1/capital/deposit/hisrec",
  WITHDRAW_HISTORY: "/sapi/v1/capital/withdraw/history",
} as const;

export const HTTP_METHODS = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  DELETE: "DELETE",
} as const;

export const ORDER_SIDES = {
  BUY: "BUY",
  SELL: "SELL",
} as const;

export const ORDER_TYPES = {
  LIMIT: "LIMIT",
  MARKET: "MARKET",
  STOP: "STOP",
  STOP_LOSS: "STOP_LOSS",
  TAKE_PROFIT: "TAKE_PROFIT",
  LIMIT_MAKER: "LIMIT_MAKER",
} as const;

export const TIME_IN_FORCE = {
  GTC: "GTC", // Good Till Cancel
  IOC: "IOC", // Immediate or Cancel
  FOK: "FOK", // Fill or Kill
} as const;

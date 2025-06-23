/**
 * MEXC API Types and Schemas
 * 
 * Centralized type definitions and Zod validation schemas for MEXC API.
 * This module keeps all API-related types in one place under 500 lines.
 * 
 * Features:
 * - Comprehensive Zod validation
 * - TypeScript type inference
 * - Modular exports for tree-shaking
 * - Runtime type checking
 */

import { z } from 'zod';

// ============================================================================
// Base Configuration Schemas
// ============================================================================

export const UnifiedMexcConfigSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  secretKey: z.string().min(1, "Secret key is required"),
  passphrase: z.string().optional(),
  baseUrl: z.string().url("Valid base URL required").default("https://api.mexc.com"),
  timeout: z.number().positive("Timeout must be positive").default(10000),
  maxRetries: z.number().nonnegative("Max retries cannot be negative").default(3),
  retryDelay: z.number().positive("Retry delay must be positive").default(1000),
  rateLimitDelay: z.number().nonnegative("Rate limit delay cannot be negative").default(100),
  enableCaching: z.boolean().default(true),
  cacheTTL: z.number().positive("Cache TTL must be positive").default(30000),
  enableCircuitBreaker: z.boolean().default(true),
  enableMetrics: z.boolean().default(true),
  enableEnhancedCaching: z.boolean().default(true),
  enablePerformanceMonitoring: z.boolean().default(true),
  apiResponseTTL: z.number().positive("API response TTL must be positive").default(1500),
});

export type UnifiedMexcConfig = z.infer<typeof UnifiedMexcConfigSchema>;

// ============================================================================
// API Response Schemas
// ============================================================================

export const MexcServiceResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  timestamp: z.number().default(() => Date.now()),
  cached: z.boolean().default(false),
});

export type MexcServiceResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
  cached: boolean;
};

// ============================================================================
// Calendar Entry Schemas
// ============================================================================

export const CalendarEntrySchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  baseAsset: z.string().min(1, "Base asset is required"),
  quoteAsset: z.string().min(1, "Quote asset is required"),
  tradingStartTime: z.number().positive("Trading start time must be positive"),
  status: z.enum(['PENDING', 'TRADING', 'BREAK', 'CLOSE']).default('PENDING'),
  listingDate: z.string().optional(),
  description: z.string().optional(),
  website: z.string().url().optional(),
  explorer: z.string().url().optional(),
});

export type CalendarEntry = z.infer<typeof CalendarEntrySchema>;

// ============================================================================
// Exchange Symbol Schemas
// ============================================================================

export const ExchangeSymbolSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  status: z.enum(['PRE_TRADING', 'TRADING', 'POST_TRADING', 'END_OF_DAY', 'HALT', 'AUCTION_MATCH', 'BREAK']),
  baseAsset: z.string().min(1, "Base asset is required"),
  baseAssetPrecision: z.number().nonnegative().optional(),
  quoteAsset: z.string().min(1, "Quote asset is required"),
  quotePrecision: z.number().nonnegative().optional(),
  quoteAssetPrecision: z.number().nonnegative().optional(),
  baseCommissionPrecision: z.number().nonnegative().optional(),
  quoteCommissionPrecision: z.number().nonnegative().optional(),
  orderTypes: z.array(z.string()).optional(),
  icebergAllowed: z.boolean().optional(),
  ocoAllowed: z.boolean().optional(),
  quoteOrderQtyMarketAllowed: z.boolean().optional(),
  allowTrailingStop: z.boolean().optional(),
  cancelReplaceAllowed: z.boolean().optional(),
  isSpotTradingAllowed: z.boolean().optional(),
  isMarginTradingAllowed: z.boolean().optional(),
  filters: z.array(z.unknown()).optional(),
  permissions: z.array(z.string()).optional(),
  defaultSelfTradePreventionMode: z.string().optional(),
  allowedSelfTradePreventionModes: z.array(z.string()).optional(),
});

export type ExchangeSymbol = z.infer<typeof ExchangeSymbolSchema>;

// ============================================================================
// Trading Schemas
// ============================================================================

export const TradingFilterSchema = z.object({
  filterType: z.string(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  tickSize: z.string().optional(),
  minQty: z.string().optional(),
  maxQty: z.string().optional(),
  stepSize: z.string().optional(),
  limit: z.number().optional(),
  minNotional: z.string().optional(),
  applyToMarket: z.boolean().optional(),
  avgPriceMins: z.number().optional(),
});

export type TradingFilter = z.infer<typeof TradingFilterSchema>;

export const OrderParametersSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  side: z.enum(['BUY', 'SELL']),
  type: z.enum(['LIMIT', 'MARKET', 'STOP_LOSS', 'STOP_LOSS_LIMIT', 'TAKE_PROFIT', 'TAKE_PROFIT_LIMIT']),
  quantity: z.string().min(1, "Quantity is required"),
  price: z.string().optional(),
  timeInForce: z.enum(['GTC', 'IOC', 'FOK']).optional(),
  newClientOrderId: z.string().optional(),
  stopPrice: z.string().optional(),
  icebergQty: z.string().optional(),
  newOrderRespType: z.enum(['ACK', 'RESULT', 'FULL']).optional(),
});

export type OrderParameters = z.infer<typeof OrderParametersSchema>;

export const OrderResultSchema = z.object({
  symbol: z.string(),
  orderId: z.number(),
  orderListId: z.number().optional(),
  clientOrderId: z.string(),
  transactTime: z.number(),
  price: z.string(),
  origQty: z.string(),
  executedQty: z.string(),
  cummulativeQuoteQty: z.string(),
  status: z.string(),
  timeInForce: z.string(),
  type: z.string(),
  side: z.string(),
  workingTime: z.number().optional(),
  selfTradePreventionMode: z.string().optional(),
  fills: z.array(z.object({
    price: z.string(),
    qty: z.string(),
    commission: z.string(),
    commissionAsset: z.string(),
    tradeId: z.number(),
  })).optional(),
});

export type OrderResult = z.infer<typeof OrderResultSchema>;

// ============================================================================
// Market Data Schemas
// ============================================================================

export const TickerSchema = z.object({
  symbol: z.string(),
  priceChange: z.string(),
  priceChangePercent: z.string(),
  weightedAvgPrice: z.string(),
  prevClosePrice: z.string(),
  lastPrice: z.string(),
  lastQty: z.string(),
  bidPrice: z.string(),
  bidQty: z.string(),
  askPrice: z.string(),
  askQty: z.string(),
  openPrice: z.string(),
  highPrice: z.string(),
  lowPrice: z.string(),
  volume: z.string(),
  quoteVolume: z.string(),
  openTime: z.number(),
  closeTime: z.number(),
  firstId: z.number(),
  lastId: z.number(),
  count: z.number(),
});

export type Ticker = z.infer<typeof TickerSchema>;

export const KlineSchema = z.tuple([
  z.number(), // Open time
  z.string(), // Open price
  z.string(), // High price
  z.string(), // Low price
  z.string(), // Close price
  z.string(), // Volume
  z.number(), // Close time
  z.string(), // Quote asset volume
  z.number(), // Number of trades
  z.string(), // Taker buy base asset volume
  z.string(), // Taker buy quote asset volume
  z.string(), // Unused field, ignore
]);

export type Kline = z.infer<typeof KlineSchema>;

// ============================================================================
// Account Schemas
// ============================================================================

export const BalanceEntrySchema = z.object({
  asset: z.string().min(1, "Asset is required"),
  free: z.string(),
  locked: z.string(),
});

export type BalanceEntry = z.infer<typeof BalanceEntrySchema>;

export const PortfolioSchema = z.object({
  makerCommission: z.number(),
  takerCommission: z.number(),
  buyerCommission: z.number(),
  sellerCommission: z.number(),
  commissionRates: z.object({
    maker: z.string(),
    taker: z.string(),
    buyer: z.string(),
    seller: z.string(),
  }).optional(),
  canTrade: z.boolean(),
  canWithdraw: z.boolean(),
  canDeposit: z.boolean(),
  brokered: z.boolean().optional(),
  requireSelfTradePrevention: z.boolean().optional(),
  preventSor: z.boolean().optional(),
  updateTime: z.number(),
  accountType: z.string(),
  balances: z.array(BalanceEntrySchema),
  permissions: z.array(z.string()),
});

export type Portfolio = z.infer<typeof PortfolioSchema>;

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validates MEXC API data using appropriate schema
 */
export function validateMexcData<T>(data: unknown, schema: z.ZodSchema<T>): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`MEXC data validation failed: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

/**
 * Safe validation that returns result with success/error
 */
export function safeMexcValidation<T>(
  data: unknown, 
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: `Validation failed: ${error.errors.map(e => e.message).join(', ')}` 
      };
    }
    return { success: false, error: 'Unknown validation error' };
  }
}

// ============================================================================
// Query Key Factories for TanStack Query
// ============================================================================

export const mexcQueryKeys = {
  all: ['mexc'] as const,
  calendar: () => [...mexcQueryKeys.all, 'calendar'] as const,
  symbols: () => [...mexcQueryKeys.all, 'symbols'] as const,
  symbol: (symbol: string) => [...mexcQueryKeys.symbols(), symbol] as const,
  ticker: (symbol: string) => [...mexcQueryKeys.all, 'ticker', symbol] as const,
  portfolio: () => [...mexcQueryKeys.all, 'portfolio'] as const,
  serverTime: () => [...mexcQueryKeys.all, 'serverTime'] as const,
  exchangeInfo: () => [...mexcQueryKeys.all, 'exchangeInfo'] as const,
} as const;
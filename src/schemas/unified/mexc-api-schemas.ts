/**
 * Unified MEXC API Schemas
 *
 * Single source of truth for all MEXC API related types and schemas.
 * Consolidates types from:
 * - services/mexc-schemas.ts
 * - services/modules/mexc-api-types.ts
 * - services/api/mexc-api-types.ts
 * - schemas/mexc-schemas.ts
 * - lib/api-schemas.ts
 *
 * This eliminates duplication and provides consistent type definitions across the codebase.
 */

import { z } from "zod";

// ============================================================================
// Base API Configuration
// ============================================================================

export const MexcApiConfigSchema = z.object({
  apiKey: z.string(),
  secretKey: z.string(),
  passphrase: z.string().optional(),
  baseUrl: z.string().default("https://api.mexc.com"),
  timeout: z.number().default(10000),
  maxRetries: z.number().default(3),
  retryDelay: z.number().default(1000),
  rateLimitDelay: z.number().default(100),
});

export const MexcCacheConfigSchema = z.object({
  enableCaching: z.boolean().default(true),
  cacheTTL: z.number().default(30000),
  apiResponseTTL: z.number().default(1500),
});

export const MexcReliabilityConfigSchema = z.object({
  enableCircuitBreaker: z.boolean().default(true),
  enableRateLimiter: z.boolean().default(true),
  maxFailures: z.number().default(5),
  resetTimeout: z.number().default(60000),
});

export type MexcApiConfig = z.infer<typeof MexcApiConfigSchema>;
export type MexcCacheConfig = z.infer<typeof MexcCacheConfigSchema>;
export type MexcReliabilityConfig = z.infer<typeof MexcReliabilityConfigSchema>;

// ============================================================================
// Unified MEXC Configuration Schema
// ============================================================================

export const UnifiedMexcConfigSchema = z.object({
  // API Configuration
  apiKey: z.string(),
  secretKey: z.string(),
  passphrase: z.string().optional(),
  baseUrl: z.string().default("https://api.mexc.com"),
  timeout: z.number().default(10000),

  // Cache Configuration
  enableCaching: z.boolean().default(true),
  cacheTTL: z.number().default(30000),
  apiResponseTTL: z.number().default(1500),

  // Reliability Configuration
  enableCircuitBreaker: z.boolean().default(true),
  enableRateLimiter: z.boolean().default(true),
  maxFailures: z.number().default(5),
  resetTimeout: z.number().default(60000),

  // Advanced reliability settings
  circuitBreakerThreshold: z.number()
    .default(10),
  circuitBreakerResetTime: z.number()
    .default(60000),
});

export type UnifiedMexcConfig = z.infer<typeof UnifiedMexcConfigSchema>;

// ============================================================================
// Account Response Schemas
// ============================================================================

export const AccountInfoSchema = z.object({
  accountType: z.string(),
  canTrade: z.boolean(),
  canWithdraw: z.boolean(),
  canDeposit: z.boolean(),
  balances: z.array(z.object({
    asset: z.string(),
    free: z.string(),
    locked: z.string(),
  })),
});

export const AccountBalanceSchema = z.object({
  asset: z.string(),
  free: z.string().transform(val => parseFloat(val)),
  locked: z.string().transform(val => parseFloat(val)),
});

export type AccountInfo = z.infer<typeof AccountInfoSchema>;
export type AccountBalance = z.infer<typeof AccountBalanceSchema>;

// ============================================================================
// Core MEXC API Schemas - Consolidated from legacy mexc-schemas.ts
// ============================================================================

export const CalendarEntrySchema = z.object({
  vcoinId: z.string(),
  symbol: z.string(),
  projectName: z.string(),
  firstOpenTime: z.number(),
  // Additional fields from MEXC API
  vcoinName: z.string().optional(), // Short token name (e.g., "BRIC")
  vcoinNameFull: z.string().optional(), // Full project name (e.g., "REDBRICK")
  zone: z.string().optional(), // Trading zone (e.g., "NEW")
  introductionEn: z.string().optional(), // English description
  introductionCn: z.string().optional(), // Chinese description
});

// Unified Symbol Entry Schema (merged SymbolV2 and Symbol schemas)
export const SymbolEntrySchema = z.object({
  cd: z.string(), // vcoinId
  symbol: z.string().optional(), // symbol name for compatibility
  ca: z.string().optional(), // contract address
  ps: z.number().optional(), // price scale
  qs: z.number().optional(), // quantity scale
  sts: z.number(), // symbol trading status
  st: z.number(), // state
  tt: z.number(), // trading type
  ot: z.union([z.number(), z.record(z.unknown())]).optional(), // open time (flexible type)
});

// Balance Entry Schema for account balances
export const BalanceEntrySchema = z.object({
  asset: z.string(),
  free: z.string(),
  locked: z.string(),
  total: z.number(),
  usdtValue: z.number().optional(),
});

// Order Result Schema for order execution results
export const OrderResultSchema = z.object({
  success: z.boolean(),
  orderId: z.string().optional(),
  symbol: z.string(),
  side: z.string(),
  quantity: z.string(),
  price: z.string().optional(),
  status: z.string().optional(),
  error: z.string().optional(),
  timestamp: z.string(),
});

// MEXC Service Response Schema for standardized API responses
const FlexibleDataSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.unknown()),
  z.record(z.unknown()),
]);

export const MexcServiceResponseSchema = z.object({
  success: z.boolean(),
  data: FlexibleDataSchema.optional(),
  error: z.string().optional(),
  code: z.string().optional(),
  timestamp: z.string(),
  requestId: z.string().optional(),
  responseTime: z.number().optional(),
  cached: z.boolean().optional(),
  executionTimeMs: z.number().optional(),
  retryCount: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// Market Data Schemas
// ============================================================================

export const SymbolInfoSchema = z.object({
  symbol: z.string(),
  status: z.string(),
  baseAsset: z.string(),
  quoteAsset: z.string(),
  baseAssetPrecision: z.number(),
  quotePrecision: z.number(),
  quoteAssetPrecision: z.number(),
  filters: z.array(z.object({
    filterType: z.string(),
  })).optional(),
});

// Exchange Symbol Schema (from legacy mexc-schemas.ts)
export const ExchangeSymbolSchema = z.object({
  symbol: z.string(),
  status: z.string(),
  baseAsset: z.string(),
  quoteAsset: z.string(),
  baseAssetPrecision: z.number(),
  quotePrecision: z.number(),
  quoteAssetPrecision: z.number(),
});

export const TickerSchema = z.object({
  symbol: z.string(),
  lastPrice: z.string(),
  price: z.string(),
  priceChange: z.string(),
  priceChangePercent: z.string(),
  volume: z.string(),
  quoteVolume: z.string().optional(),
  openPrice: z.string().optional(),
  highPrice: z.string().optional(),
  lowPrice: z.string().optional(),
  count: z.string().optional(),
});

// Core API Types
export type CalendarEntry = z.infer<typeof CalendarEntrySchema>;
export type SymbolEntry = z.infer<typeof SymbolEntrySchema>;
export type BalanceEntry = z.infer<typeof BalanceEntrySchema>;
export type OrderResult = z.infer<typeof OrderResultSchema>;
export type MexcServiceResponse<T = unknown> = z.infer<typeof MexcServiceResponseSchema> & {
  data?: T;
};

// Market Data Types
export type SymbolInfo = z.infer<typeof SymbolInfoSchema>;
export type ExchangeSymbol = z.infer<typeof ExchangeSymbolSchema>;
export type Ticker = z.infer<typeof TickerSchema>;

// ============================================================================
// Trading Schemas
// ============================================================================

export const OrderSideSchema = z.enum(["BUY", "SELL"]);
export const OrderTypeSchema = z.enum(["LIMIT", "MARKET", "STOP_LOSS", "STOP_LOSS_LIMIT", "TAKE_PROFIT", "TAKE_PROFIT_LIMIT"]);
export const OrderStatusSchema = z.enum(["NEW", "PARTIALLY_FILLED", "FILLED", "CANCELED", "PENDING_CANCEL", "REJECTED", "EXPIRED"]);

export const OrderRequestSchema = z.object({
  symbol: z.string(),
  side: OrderSideSchema,
  type: OrderTypeSchema,
  quantity: z.string(),
  price: z.string().optional(),
  timeInForce: z.string().optional(),
  stopPrice: z.string().optional(),
  recvWindow: z.number().optional(),
});

export const OrderResponseSchema = z.object({
  symbol: z.string(),
  orderId: z.number(),
  orderListId: z.number().optional(),
  clientOrderId: z.string(),
  transactTime: z.number(),
  price: z.string(),
  origQty: z.string(),
  executedQty: z.string(),
  cummulativeQuoteQty: z.string(),
  status: OrderStatusSchema,
  timeInForce: z.string(),
  type: OrderTypeSchema,
  side: OrderSideSchema,
  fills: z.array(z.object({
    price: z.string(),
    qty: z.string(),
    commission: z.string(),
    commissionAsset: z.string(),
  })).optional(),
});

export type OrderSide = z.infer<typeof OrderSideSchema>;
export type OrderType = z.infer<typeof OrderTypeSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type OrderRequest = z.infer<typeof OrderRequestSchema>;
export type OrderResponse = z.infer<typeof OrderResponseSchema>;

// ============================================================================
// Error Response Schemas
// ============================================================================

export const ApiErrorSchema = z.object({
  code: z.number(),
  msg: z.string(),
});

export const RateLimitInfoSchema = z.object({
  rateLimitType: z.string(),
  interval: z.string(),
  intervalNum: z.number(),
  limit: z.number(),
  count: z.number(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
export type RateLimitInfo = z.infer<typeof RateLimitInfoSchema>;

// ============================================================================
// Activity API Schemas
// ============================================================================

export const ActivityTypeSchema = z.enum([
  "SUN_SHINE",
  "PROMOTION",
  "LAUNCH_EVENT",
  "TRADING_COMPETITION",
  "AIRDROP",
  "STAKING_EVENT",
  "LISTING_EVENT",
]);

export const ActivityDataSchema = z.object({
  activityId: z.string(),
  currency: z.string(),
  currencyId: z.string(),
  activityType: z.string(), // Using string instead of enum for flexibility
});

export const ActivityResponseSchema = z.object({
  data: z.array(ActivityDataSchema),
  code: z.number(),
  msg: z.string(),
  timestamp: z.number(),
});

export type ActivityType = z.infer<typeof ActivityTypeSchema>;
export type ActivityData = z.infer<typeof ActivityDataSchema>;
export type ActivityResponse = z.infer<typeof ActivityResponseSchema>;

// ============================================================================
// Activity Utility Functions
// ============================================================================

export const calculateActivityBoost = (activities: ActivityData[]): number => {
  if (activities.length === 0) return 0;

  const activityScores = {
    SUN_SHINE: 15,
    PROMOTION: 12,
    LAUNCH_EVENT: 18,
    TRADING_COMPETITION: 10,
    AIRDROP: 8,
    STAKING_EVENT: 10,
    LISTING_EVENT: 20,
  };

  const maxBoost = Math.max(
    ...activities.map(
      (activity) => activityScores[activity.activityType as keyof typeof activityScores] || 5
    )
  );

  const multipleActivitiesBonus = activities.length > 1 ? 5 : 0;

  return Math.min(maxBoost + multipleActivitiesBonus, 20);
};

export const hasHighPriorityActivity = (activities: ActivityData[]): boolean => {
  const highPriorityTypes = ["LAUNCH_EVENT", "LISTING_EVENT", "SUN_SHINE"];
  return activities.some((activity) => highPriorityTypes.includes(activity.activityType));
};

// ============================================================================
// Exports
// ============================================================================

export * from "./trading-schemas";
export * from "./pattern-detection-schemas";
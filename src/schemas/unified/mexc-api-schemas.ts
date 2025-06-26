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
  apiKey: z.string().min(1, "API key is required"),
  secretKey: z.string().min(1, "Secret key is required"),
  passphrase: z.string().optional(),
  baseUrl: z.string().url("Valid base URL required").default("https://api.mexc.com"),
  timeout: z.number().positive("Timeout must be positive").default(10000),
  maxRetries: z.number().nonnegative("Max retries cannot be negative").default(3),
  retryDelay: z.number().nonnegative("Retry delay cannot be negative").default(1000),
  rateLimitDelay: z.number().nonnegative("Rate limit delay cannot be negative").default(100),
});

export const MexcCacheConfigSchema = z.object({
  enableCaching: z.boolean().default(true),
  cacheTTL: z.number().positive("Cache TTL must be positive").default(30000),
  apiResponseTTL: z.number().positive("API response TTL must be positive").default(1500),
});

export const MexcReliabilityConfigSchema = z.object({
  enableCircuitBreaker: z.boolean().default(true),
  enableRateLimiter: z.boolean().default(true),
  maxFailures: z.number().positive("Max failures must be positive").default(5),
  resetTimeout: z.number().positive("Reset timeout must be positive").default(60000),
});

export type MexcApiConfig = z.infer<typeof MexcApiConfigSchema>;
export type MexcCacheConfig = z.infer<typeof MexcCacheConfigSchema>;
export type MexcReliabilityConfig = z.infer<typeof MexcReliabilityConfigSchema>;

// ============================================================================
// Response Wrapper
// ============================================================================

export const MexcServiceResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
  timestamp: z
    .union([z.string(), z.number()])
    .transform((val) => (typeof val === "string" ? val : new Date(val).toISOString())),
  source: z.string().optional(),
  requestId: z.string().optional(),
  responseTime: z.number().optional(),
  cached: z.boolean().optional(),
  executionTimeMs: z.number().optional(),
  retryCount: z.number().optional(),
  metadata: z.unknown().optional(),
});

export type MexcServiceResponse<T = any> = Omit<
  z.infer<typeof MexcServiceResponseSchema>,
  "data"
> & {
  data?: T;
};

// ============================================================================
// Core API Data Schemas
// ============================================================================

/**
 * Calendar Entry Schema - New listing announcements
 */
export const CalendarEntrySchema = z.object({
  vcoinId: z.string(),
  symbol: z.string(),
  projectName: z.string(),
  firstOpenTime: z.number(),
});

/**
 * Symbol Entry Schema - Trading pair information
 */
export const SymbolEntrySchema = z.object({
  cd: z.string(),
  symbol: z.string().optional(),
  sts: z.number(), // Symbol Trading Status
  st: z.number(), // Symbol State
  tt: z.number(), // Trading Time
  ca: z.number().optional(),
  ps: z.number().optional(),
  qs: z.number().optional(),
  ot: z.record(z.unknown()).optional(),
});

/**
 * Balance Entry Schema - Account balance information
 */
export const BalanceEntrySchema = z.object({
  asset: z.string(),
  free: z.string(),
  locked: z.string(),
  total: z.number(),
  usdtValue: z.number().optional(),
});

/**
 * Trading Filter Schema - Exchange trading rules
 */
export const TradingFilterSchema = z.object({
  filterType: z.string(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  tickSize: z.string().optional(),
  minQty: z.string().optional(),
  maxQty: z.string().optional(),
  stepSize: z.string().optional(),
  minNotional: z.string().optional(),
  maxNotional: z.string().optional(),
  multiplierUp: z.string().optional(),
  multiplierDown: z.string().optional(),
  avgPriceMins: z.number().optional(),
});

/**
 * Exchange Symbol Schema - Detailed symbol information
 */
export const ExchangeSymbolSchema = z.object({
  symbol: z.string(),
  status: z.string(),
  baseAsset: z.string(),
  quoteAsset: z.string(),
  baseAssetPrecision: z.number(),
  quotePrecision: z.number(),
  quoteAssetPrecision: z.number(),
  baseCommissionPrecision: z.number().optional(),
  quoteCommissionPrecision: z.number().optional(),
  orderTypes: z.array(z.string()).optional(),
  icebergAllowed: z.boolean().optional(),
  ocoAllowed: z.boolean().optional(),
  quoteOrderQtyMarketAllowed: z.boolean().optional(),
  allowTrailingStop: z.boolean().optional(),
  isSpotTradingAllowed: z.boolean().optional(),
  isMarginTradingAllowed: z.boolean().optional(),
  filters: z.array(TradingFilterSchema).optional(),
  permissions: z.array(z.string()).optional(),
});

/**
 * Ticker Schema - 24hr price statistics
 */
export const TickerSchema = z.object({
  symbol: z.string(),
  lastPrice: z.string().optional(),
  price: z.string(),
  c: z.string().optional(), // Alternate close price field
  priceChange: z.string(),
  p: z.string().optional(), // Alternate price change field
  priceChangePercent: z.string(),
  P: z.string().optional(), // Alternate price change percent field
  volume: z.string(),
  v: z.string().optional(), // Alternate volume field
  quoteVolume: z.string().optional(),
  q: z.string().optional(), // Alternate quote volume field
  openPrice: z.string().optional(),
  o: z.string().optional(), // Alternate open price field
  highPrice: z.string().optional(),
  h: z.string().optional(), // Alternate high price field
  lowPrice: z.string().optional(),
  l: z.string().optional(), // Alternate low price field
  count: z.union([z.string(), z.number()]).optional(),
  t: z.number().optional(), // Timestamp
});

/**
 * Order Parameters Schema - Order placement
 */
export const OrderParametersSchema = z.object({
  symbol: z.string(),
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["LIMIT", "MARKET", "STOP_LOSS", "STOP_LOSS_LIMIT"]),
  quantity: z.string(),
  price: z.string().optional(),
  stopPrice: z.string().optional(),
  timeInForce: z.enum(["GTC", "IOC", "FOK"]).optional(),
  icebergQty: z.string().optional(),
  newOrderRespType: z.enum(["ACK", "RESULT", "FULL"]).optional(),
  newClientOrderId: z.string().optional(),
});

/**
 * Order Result Schema - Order placement response
 */
export const OrderResultSchema = z.object({
  success: z.boolean(),
  orderId: z.string().optional(),
  clientOrderId: z.string().optional(),
  symbol: z.string(),
  side: z.string(),
  type: z.string().optional(),
  quantity: z.string(),
  price: z.string().optional(),
  status: z.string().optional(),
  executedQty: z.string().optional(),
  cummulativeQuoteQty: z.string().optional(),
  error: z.string().optional(),
  timestamp: z.string(),
  fills: z
    .array(
      z.object({
        price: z.string(),
        qty: z.string(),
        commission: z.string(),
        commissionAsset: z.string(),
      })
    )
    .optional(),
});

/**
 * Order Status Schema - Order status queries
 */
export const OrderStatusSchema = z.object({
  orderId: z.string(),
  symbol: z.string(),
  status: z.enum(["NEW", "PARTIALLY_FILLED", "FILLED", "CANCELED", "REJECTED", "EXPIRED"]),
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["LIMIT", "MARKET", "STOP_LOSS", "STOP_LOSS_LIMIT"]),
  quantity: z.string(),
  price: z.string().optional(),
  stopPrice: z.string().optional(),
  executedQty: z.string(),
  cummulativeQuoteQty: z.string(),
  time: z.number(),
  updateTime: z.number(),
});

/**
 * Order Book Schema - Market depth
 */
export const OrderBookSchema = z.object({
  symbol: z.string().optional(),
  bids: z.array(z.tuple([z.string(), z.string()])),
  asks: z.array(z.tuple([z.string(), z.string()])),
  lastUpdateId: z.number().optional(),
  timestamp: z.number().optional(),
});

/**
 * Account Info Schema - Account information
 */
export const AccountInfoSchema = z.object({
  accountType: z.string(),
  canTrade: z.boolean(),
  canWithdraw: z.boolean(),
  canDeposit: z.boolean(),
  balances: z.array(BalanceEntrySchema),
  updateTime: z.number().optional(),
  permissions: z.array(z.string()).optional(),
});

// ============================================================================
// Market Data Schemas
// ============================================================================

/**
 * Kline/Candlestick Schema
 */
export const KlineSchema = z.object({
  openTime: z.number(),
  open: z.string(),
  high: z.string(),
  low: z.string(),
  close: z.string(),
  volume: z.string(),
  closeTime: z.number(),
  quoteAssetVolume: z.string(),
  numberOfTrades: z.number(),
});

/**
 * Exchange Info Schema
 */
export const ExchangeInfoSchema = z.object({
  timezone: z.string(),
  serverTime: z.number(),
  rateLimits: z
    .array(
      z.object({
        rateLimitType: z.string(),
        interval: z.string(),
        intervalNum: z.number(),
        limit: z.number(),
      })
    )
    .optional(),
  exchangeFilters: z.array(TradingFilterSchema).optional(),
  symbols: z.array(ExchangeSymbolSchema),
});

// ============================================================================
// Activity Data Schema
// ============================================================================

export const ActivityDataSchema = z.object({
  symbol: z.string().optional(),
  activityType: z.string(),
  timestamp: z.number(),
  volume: z.number().optional(),
  price: z.number().optional(),
  significance: z.number().optional(),
  description: z.string().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CalendarEntry = z.infer<typeof CalendarEntrySchema>;
export type SymbolEntry = z.infer<typeof SymbolEntrySchema>;
export type BalanceEntry = z.infer<typeof BalanceEntrySchema>;
export type TradingFilter = z.infer<typeof TradingFilterSchema>;
export type ExchangeSymbol = z.infer<typeof ExchangeSymbolSchema>;
export type ExchangeInfo = z.infer<typeof ExchangeInfoSchema>;
export type Ticker = z.infer<typeof TickerSchema>;
export type OrderParameters = z.infer<typeof OrderParametersSchema>;
export type OrderResult = z.infer<typeof OrderResultSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type OrderBook = z.infer<typeof OrderBookSchema>;
export type AccountInfo = z.infer<typeof AccountInfoSchema>;
export type Kline = z.infer<typeof KlineSchema>;
export type ActivityData = z.infer<typeof ActivityDataSchema>;

export const ActivityResponseSchema = z.object({
  data: z.array(ActivityDataSchema),
  code: z.number(),
  msg: z.string(),
  timestamp: z.number(),
});

export type ActivityResponse = z.infer<typeof ActivityResponseSchema>;

// ============================================================================
// Activity Helper Functions
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

export const getUniqueActivityTypes = (activities: ActivityData[]): string[] => {
  return [...new Set(activities.map((activity) => activity.activityType))];
};

export const hasHighPriorityActivity = (activities: ActivityData[]): boolean => {
  const highPriorityTypes = ["LISTING_EVENT", "LAUNCH_EVENT", "SUN_SHINE", "PROMOTION"];
  return activities.some((activity) => highPriorityTypes.includes(activity.activityType));
};

export const isValidForSnipe = (entry: CalendarEntry): boolean => {
  // Check if the calendar entry is valid for sniping
  if (!entry.symbol || !entry.vcoinId || !entry.firstOpenTime) {
    return false;
  }

  // Check if the launch time is in the future (at least 5 minutes)
  const now = Date.now();
  const launchTime = entry.firstOpenTime;
  const fiveMinutes = 5 * 60 * 1000;

  return launchTime > now + fiveMinutes;
};

// ============================================================================
// Additional Legacy Schemas
// ============================================================================

export const SymbolV2EntrySchema = SymbolEntrySchema; // Legacy alias

export const SnipeTargetSchema = z.object({
  vcoinId: z.string(),
  symbol: z.string(),
  projectName: z.string(),
  priceDecimalPlaces: z.number(),
  quantityDecimalPlaces: z.number(),
  launchTime: z.date(),
  discoveredAt: z.date(),
  hoursAdvanceNotice: z.number(),
  orderParameters: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  confidence: z.number().optional(),
});

export const ActivityEnhancementSchema = z.object({
  baseConfidence: z.number(),
  enhancedConfidence: z.number(),
  activityBoost: z.number(),
  activities: z.number(),
  activityTypes: z.array(z.string()),
  multipleActivitiesBonus: z.number().optional(),
  recentActivityBonus: z.number().optional(),
});

export type SymbolV2Entry = z.infer<typeof SymbolV2EntrySchema>;
export type SnipeTarget = z.infer<typeof SnipeTargetSchema>;
export type ActivityEnhancement = z.infer<typeof ActivityEnhancementSchema>;

// ============================================================================
// Validation Helper Functions
// ============================================================================

export const validateCalendarEntry = (data: unknown): CalendarEntry => {
  return CalendarEntrySchema.parse(data);
};

export const validateSymbolEntry = (data: unknown): SymbolEntry => {
  return SymbolEntrySchema.parse(data);
};

export const validateSymbolV2Entry = (data: unknown): SymbolV2Entry => {
  return SymbolV2EntrySchema.parse(data);
};

export const validateSnipeTarget = (data: unknown): SnipeTarget => {
  return SnipeTargetSchema.parse(data);
};

export const validateActivityData = (data: unknown): ActivityData => {
  return ActivityDataSchema.parse(data);
};

export const validateActivityResponse = (data: unknown): ActivityResponse => {
  return ActivityResponseSchema.parse(data);
};

export const validateActivityEnhancement = (data: unknown): ActivityEnhancement => {
  return ActivityEnhancementSchema.parse(data);
};

export const validateTickerData = (data: unknown): Ticker => {
  return TickerSchema.parse(data);
};

export const validateMexcData = <T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: boolean; data?: T; error?: string } => {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Validation failed: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown validation error",
    };
  }
};

// ============================================================================
// Schema Collections
// ============================================================================

export const MEXC_API_SCHEMAS = {
  // Configuration
  MexcApiConfigSchema,
  MexcCacheConfigSchema,
  MexcReliabilityConfigSchema,

  // Response Wrapper
  MexcServiceResponseSchema,

  // Core Data
  CalendarEntrySchema,
  SymbolEntrySchema,
  BalanceEntrySchema,
  TradingFilterSchema,
  ExchangeSymbolSchema,
  TickerSchema,
  OrderParametersSchema,
  OrderResultSchema,
  OrderStatusSchema,
  OrderBookSchema,
  AccountInfoSchema,

  // Market Data
  KlineSchema,
  ExchangeInfoSchema,

  // Activity
  ActivityDataSchema,
} as const;

// ============================================================================
// Additional Validation Utilities
// ============================================================================

/**
 * Validate service response structure
 */
export function validateServiceResponse<T>(
  data: unknown,
  dataSchema?: z.ZodSchema<T>
): { success: boolean; data?: MexcServiceResponse<T>; error?: string } {
  const baseResponseSchema = z.object({
    success: z.boolean(),
    data: dataSchema ? dataSchema.optional() : z.unknown().optional(),
    error: z.string().optional(),
    code: z.string().optional(),
    timestamp: z.union([z.string(), z.number()]),
    source: z.string().optional(),
    requestId: z.string().optional(),
    responseTime: z.number().optional(),
    cached: z.boolean().optional(),
    executionTimeMs: z.number().optional(),
    retryCount: z.number().optional(),
    metadata: z.unknown().optional(),
  });

  return validateMexcData(baseResponseSchema, data);
}

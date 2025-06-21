import { z } from "zod";

// Core MEXC API Schemas
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

// Legacy alias for backward compatibility
export const SymbolV2EntrySchema = SymbolEntrySchema;

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

// API Response Schemas
export const CalendarResponseSchema = z.object({
  data: z.array(CalendarEntrySchema),
});

export const SymbolsV2ResponseSchema = z.object({
  data: z.object({
    symbols: z.array(SymbolEntrySchema),
  }),
});

// ============================================================================
// Additional MEXC Schemas (consolidated from extracted schemas)
// ============================================================================

/**
 * Balance Entry Schema for account balances
 */
export const BalanceEntrySchema = z.object({
  asset: z.string(),
  free: z.string(),
  locked: z.string(),
  total: z.number(),
  usdtValue: z.number().optional(),
});

/**
 * Exchange Symbol Schema for symbol information
 */
export const ExchangeSymbolSchema = z.object({
  symbol: z.string(),
  status: z.string(),
  baseAsset: z.string(),
  quoteAsset: z.string(),
  baseAssetPrecision: z.number(),
  quotePrecision: z.number(),
  quoteAssetPrecision: z.number(),
});

/**
 * Ticker Schema for price and volume data
 */
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

/**
 * Order Result Schema for order execution results
 */
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

/**
 * Order Status Schema for order status information
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
 * Order Book Schema for market depth data
 */
export const OrderBookSchema = z.object({
  symbol: z.string(),
  bids: z.array(z.tuple([z.string(), z.string()])),
  asks: z.array(z.tuple([z.string(), z.string()])),
  timestamp: z.number(),
});

/**
 * K-line Schema for candlestick data
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
 * MEXC Service Response Schema for standardized API responses
 */
export const MexcServiceResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
  timestamp: z.string(),
  requestId: z.string().optional(),
  responseTime: z.number().optional(),
  cached: z.boolean().optional(),
  executionTimeMs: z.number().optional(),
  retryCount: z.number().optional(),
  metadata: z.any().optional(),
});

// Trading Order Schema
export const OrderParametersSchema = z.object({
  symbol: z.string(),
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["MARKET", "LIMIT", "STOP_LOSS", "STOP_LOSS_LIMIT"]),
  quantity: z.number().optional(),
  quoteOrderQty: z.number().optional(),
  price: z.number().optional(),
  timeInForce: z.enum(["GTC", "IOC", "FOK"]).optional(),
});

// Pattern Matching Schema
export const ReadyStatePatternSchema = z.object({
  sts: z.number(),
  st: z.number(),
  tt: z.number(),
});

// Sniper State Schema
export const SniperStatsSchema = z.object({
  totalListings: z.number(),
  pendingDetection: z.number(),
  readyToSnipe: z.number(),
  executed: z.number(),
  uptime: z.number().optional(),
  successRate: z.number().optional(),
});

// Activity API Schemas
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

// Activity Enhancement Schemas
export const ActivityEnhancementSchema = z.object({
  baseConfidence: z.number(),
  enhancedConfidence: z.number(),
  activityBoost: z.number(),
  activities: z.number(),
  activityTypes: z.array(z.string()),
  multipleActivitiesBonus: z.number().optional(),
  recentActivityBonus: z.number().optional(),
});

export const ActivityQueryOptions = z.object({
  batchSize: z.number().optional().default(5),
  maxRetries: z.number().optional().default(3),
  rateLimitDelay: z.number().optional().default(200),
});

// Error Schema
export const MexcErrorSchema = z.object({
  code: z.number().optional(),
  message: z.string(),
  details: z.any().optional(),
});

// Type inference exports
export type CalendarEntry = z.infer<typeof CalendarEntrySchema>;
export type SymbolEntry = z.infer<typeof SymbolEntrySchema>;
export type SymbolV2Entry = z.infer<typeof SymbolV2EntrySchema>; // Legacy alias
export type SnipeTarget = z.infer<typeof SnipeTargetSchema>;
export type CalendarResponse = z.infer<typeof CalendarResponseSchema>;
export type SymbolsV2Response = z.infer<typeof SymbolsV2ResponseSchema>;
export type OrderParameters = z.infer<typeof OrderParametersSchema>;
export type ReadyStatePattern = z.infer<typeof ReadyStatePatternSchema>;
export type SniperStats = z.infer<typeof SniperStatsSchema>;
export type MexcError = z.infer<typeof MexcErrorSchema>;

// Additional consolidated types
export type BalanceEntry = z.infer<typeof BalanceEntrySchema>;
export type ExchangeSymbol = z.infer<typeof ExchangeSymbolSchema>;
export type Ticker = z.infer<typeof TickerSchema>;
export type OrderResult = z.infer<typeof OrderResultSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type OrderBook = z.infer<typeof OrderBookSchema>;
export type Kline = z.infer<typeof KlineSchema>;
export type MexcServiceResponse<T = any> = z.infer<typeof MexcServiceResponseSchema> & {
  data?: T;
};

// Activity API Types
export type ActivityType = z.infer<typeof ActivityTypeSchema>;
export type ActivityData = z.infer<typeof ActivityDataSchema>;
export type ActivityResponse = z.infer<typeof ActivityResponseSchema>;
export type ActivityEnhancement = z.infer<typeof ActivityEnhancementSchema>;
export type ActivityQueryOptions = z.infer<typeof ActivityQueryOptions>;

// Constants
export const READY_STATE_PATTERN: ReadyStatePattern = {
  sts: 2,
  st: 2,
  tt: 4,
} as const;

// Validation helpers
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

// Activity API validation helpers
export const validateActivityData = (data: unknown): ActivityData => {
  return ActivityDataSchema.parse(data);
};

export const validateActivityResponse = (data: unknown): ActivityResponse => {
  return ActivityResponseSchema.parse(data);
};

export const validateActivityEnhancement = (data: unknown): ActivityEnhancement => {
  return ActivityEnhancementSchema.parse(data);
};

// Pattern matching utilities
export const matchesReadyPattern = (symbol: SymbolV2Entry): boolean => {
  return (
    symbol.sts === READY_STATE_PATTERN.sts &&
    symbol.st === READY_STATE_PATTERN.st &&
    symbol.tt === READY_STATE_PATTERN.tt
  );
};

export const hasCompleteData = (symbol: SymbolV2Entry): boolean => {
  return !!(symbol.ca && symbol.ps && symbol.qs && symbol.ot);
};

export const isValidForSnipe = (symbol: SymbolV2Entry): boolean => {
  return matchesReadyPattern(symbol) && hasCompleteData(symbol);
};

// Activity API utility functions
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

export const getUniqueActivityTypes = (activities: ActivityData[]): string[] => {
  return [...new Set(activities.map((activity) => activity.activityType))];
};

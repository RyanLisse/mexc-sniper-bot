/**
 * MEXC API Schemas and Type Definitions
 *
 * Extracted from unified-mexc-service.ts for better modularity and tree-shaking.
 * Contains all Zod schemas and TypeScript type definitions for MEXC API responses.
 *
 * This module enables:
 * - Better code splitting and bundle size optimization
 * - Improved type safety across the application
 * - Easier schema maintenance and testing
 * - Better tree-shaking for unused types
 */

import { z } from "zod";

// ============================================================================
// Configuration Types
// ============================================================================

export interface UnifiedMexcConfig {
  apiKey?: string;
  secretKey?: string;
  passphrase?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  rateLimitDelay?: number;
  enableCaching?: boolean;
  cacheTTL?: number;
  enableCircuitBreaker?: boolean;
  enableMetrics?: boolean;
  enableEnhancedCaching?: boolean;
  enablePerformanceMonitoring?: boolean;
  apiResponseTTL?: number;
}

export interface MexcServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  timestamp: string;
  requestId?: string;
  responseTime?: number;
  cached?: boolean;
  executionTimeMs?: number;
  retryCount?: number;
  metadata?: any;
}

// ============================================================================
// Core API Schemas
// ============================================================================

/**
 * Calendar Entry Schema
 * Used for new listing announcements and trading calendar
 */
export const CalendarEntrySchema = z.object({
  vcoinId: z.string(),
  symbol: z.string(),
  projectName: z.string(),
  firstOpenTime: z.number(),
});

/**
 * Symbol Entry Schema
 * Used for symbol data and trading pairs information
 */
export const SymbolEntrySchema = z.object({
  cd: z.string(),
  symbol: z.string().optional(), // Add symbol property for compatibility
  sts: z.number(),
  st: z.number(),
  tt: z.number(),
  ca: z.number().optional(),
  ps: z.number().optional(),
  qs: z.number().optional(),
  ot: z.record(z.unknown()).optional(),
});

/**
 * Balance Entry Schema
 * Used for account balance information
 */
export const BalanceEntrySchema = z.object({
  asset: z.string(),
  free: z.string(),
  locked: z.string(),
  total: z.number(),
  usdtValue: z.number().optional(),
});

/**
 * Trading Filter Schema for MEXC exchange rules
 * Used for order validation and minimum requirements
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
 * Exchange Symbol Schema with enhanced trading rules
 * Used for detailed symbol information from exchange info
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
 * Exchange Info Schema
 * Complete exchange information with all symbols and rules
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

/**
 * Ticker Schema
 * Used for 24hr price change statistics
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
 * Order Parameters Schema
 * Used for placing orders
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
});

/**
 * Order Result Schema
 * Used for order placement responses
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
 * Order Status Schema
 * Used for order status queries
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
 * Order Book Schema
 * Used for order book depth data
 */
export const OrderBookSchema = z.object({
  symbol: z.string(),
  bids: z.array(z.tuple([z.string(), z.string()])),
  asks: z.array(z.tuple([z.string(), z.string()])),
  timestamp: z.number(),
});

/**
 * Kline Schema
 * Used for candlestick/kline data
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

// ============================================================================
// Advanced Analytics Schemas
// ============================================================================

/**
 * Market Stats Schema
 * Used for comprehensive market statistics
 */
export const MarketStatsSchema = z.object({
  totalMarketCap: z.number(),
  total24hVolume: z.number(),
  activePairs: z.number(),
  topGainers: z.array(
    z.object({
      symbol: z.string(),
      priceChangePercent: z.number(),
    })
  ),
  topLosers: z.array(
    z.object({
      symbol: z.string(),
      priceChangePercent: z.number(),
    })
  ),
  averageVolatility: z.number(),
});

/**
 * Pattern Analysis Schema
 * Used for pattern detection results
 */
export const PatternAnalysisSchema = z.object({
  symbol: z.string(),
  pattern: z.enum(["ready_state", "pre_launch", "volatility_spike", "volume_surge"]),
  confidence: z.number().min(0).max(100),
  strength: z.number().min(0).max(10),
  timeframe: z.string(),
  signals: z.array(
    z.object({
      type: z.string(),
      strength: z.number(),
      description: z.string(),
    })
  ),
  recommendations: z.array(z.string()),
  riskFactors: z.array(z.string()),
});

/**
 * Trading Opportunity Schema
 * Used for identified trading opportunities
 */
export const TradingOpportunitySchema = z.object({
  symbol: z.string(),
  type: z.enum(["buy", "sell", "hold"]),
  confidence: z.number().min(0).max(100),
  expectedReturn: z.number(),
  riskLevel: z.enum(["low", "medium", "high"]),
  timeHorizon: z.enum(["short", "medium", "long"]),
  entryPrice: z.number(),
  exitPrice: z.number(),
  stopLoss: z.number(),
  reasoning: z.string(),
  indicators: z.array(
    z.object({
      name: z.string(),
      value: z.number(),
      signal: z.enum(["bullish", "bearish", "neutral"]),
    })
  ),
});

/**
 * Portfolio Schema
 * Used for portfolio analysis
 */
export const PortfolioSchema = z.object({
  totalValue: z.number(),
  totalValueBTC: z.number(),
  totalUsdtValue: z.number(),
  balances: z.array(BalanceEntrySchema),
  allocation: z.record(z.string(), z.number()),
  performance24h: z.object({
    change: z.number(),
    changePercent: z.number(),
  }),
});

/**
 * Risk Assessment Schema
 * Used for risk analysis results
 */
export const RiskAssessmentSchema = z.object({
  overallRisk: z.enum(["low", "medium", "high", "extreme"]),
  factors: z.object({
    marketVolatility: z.number(),
    positionSize: z.number(),
    correlation: z.number(),
    liquidityRisk: z.number(),
  }),
  recommendations: z.array(z.string()),
  maxPositionSize: z.number(),
  suggestedStopLoss: z.number(),
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
export type Kline = z.infer<typeof KlineSchema>;
export type MarketStats = z.infer<typeof MarketStatsSchema>;
export type PatternAnalysis = z.infer<typeof PatternAnalysisSchema>;
export type TradingOpportunity = z.infer<typeof TradingOpportunitySchema>;
export type Portfolio = z.infer<typeof PortfolioSchema>;
export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;

// ============================================================================
// Schema Collections for Validation
// ============================================================================

/**
 * All schemas for batch validation or testing
 */
export const ALL_MEXC_SCHEMAS = {
  CalendarEntrySchema,
  SymbolEntrySchema,
  BalanceEntrySchema,
  TradingFilterSchema,
  ExchangeSymbolSchema,
  ExchangeInfoSchema,
  TickerSchema,
  OrderParametersSchema,
  OrderResultSchema,
  OrderStatusSchema,
  OrderBookSchema,
  KlineSchema,
  MarketStatsSchema,
  PatternAnalysisSchema,
  TradingOpportunitySchema,
  PortfolioSchema,
  RiskAssessmentSchema,
} as const;

/**
 * Schema names for reference and testing
 */
export const MEXC_SCHEMA_NAMES = Object.keys(ALL_MEXC_SCHEMAS) as Array<
  keyof typeof ALL_MEXC_SCHEMAS
>;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate data against a specific schema
 */
export function validateMexcData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: boolean; data?: T; error?: string } {
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
}

/**
 * Get schema by name for dynamic validation
 */
export function getMexcSchema(schemaName: keyof typeof ALL_MEXC_SCHEMAS): z.ZodSchema<any> {
  return ALL_MEXC_SCHEMAS[schemaName];
}

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
    timestamp: z.string(),
    requestId: z.string().optional(),
    responseTime: z.number().optional(),
    cached: z.boolean().optional(),
    executionTimeMs: z.number().optional(),
    retryCount: z.number().optional(),
    metadata: z.unknown().optional(),
  });

  return validateMexcData(baseResponseSchema, data);
}

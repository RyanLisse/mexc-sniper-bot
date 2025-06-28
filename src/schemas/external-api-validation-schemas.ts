/**
 * External API Validation Schemas
 * 
 * Comprehensive Zod schemas for validating external API responses,
 * particularly MEXC API responses and third-party integrations.
 */

import { z } from "zod";

// ============================================================================
// MEXC API Response Validation Schemas
// ============================================================================

/**
 * MEXC Base Response Schema - Common structure for all MEXC API responses
 */
export const MexcBaseResponseSchema = z.object({
  code: z.number(),
  msg: z.string().optional(),
  data: z.unknown().optional(),
});

/**
 * MEXC Server Time Response Schema
 */
export const MexcServerTimeResponseSchema = z.object({
  code: z.literal(200),
  data: z.object({
    serverTime: z.number(),
  }),
});

/**
 * MEXC Exchange Info Response Schema
 */
export const MexcExchangeInfoResponseSchema = z.object({
  code: z.literal(200),
  data: z.object({
    timezone: z.string(),
    serverTime: z.number(),
    rateLimits: z.array(z.object({
      rateLimitType: z.string(),
      interval: z.string(),
      intervalNum: z.number(),
      limit: z.number(),
    })).optional(),
    symbols: z.array(z.object({
      symbol: z.string(),
      status: z.string(),
      baseAsset: z.string(),
      quoteAsset: z.string(),
      baseAssetPrecision: z.number(),
      quotePrecision: z.number(),
      quoteAssetPrecision: z.number(),
      filters: z.array(z.object({
        filterType: z.string(),
        minPrice: z.string().optional(),
        maxPrice: z.string().optional(),
        tickSize: z.string().optional(),
        minQty: z.string().optional(),
        maxQty: z.string().optional(),
        stepSize: z.string().optional(),
        minNotional: z.string().optional(),
      })).optional(),
    })),
  }),
});

/**
 * MEXC Account Balance Response Schema
 */
export const MexcAccountBalanceResponseSchema = z.object({
  code: z.literal(200),
  data: z.object({
    accountType: z.string(),
    canTrade: z.boolean(),
    canWithdraw: z.boolean(),
    canDeposit: z.boolean(),
    updateTime: z.number(),
    balances: z.array(z.object({
      asset: z.string(),
      free: z.string(),
      locked: z.string(),
    })),
  }),
});

/**
 * MEXC Order Response Schema
 */
export const MexcOrderResponseSchema = z.object({
  code: z.literal(200),
  data: z.object({
    symbol: z.string(),
    orderId: z.string(),
    orderListId: z.number().optional(),
    clientOrderId: z.string(),
    transactTime: z.number(),
    price: z.string(),
    origQty: z.string(),
    executedQty: z.string(),
    cummulativeQuoteQty: z.string(),
    status: z.enum(["NEW", "PARTIALLY_FILLED", "FILLED", "CANCELED", "REJECTED", "EXPIRED"]),
    timeInForce: z.enum(["GTC", "IOC", "FOK"]),
    type: z.enum(["LIMIT", "MARKET", "STOP_LOSS", "STOP_LOSS_LIMIT", "TAKE_PROFIT", "TAKE_PROFIT_LIMIT"]),
    side: z.enum(["BUY", "SELL"]),
    fills: z.array(z.object({
      price: z.string(),
      qty: z.string(),
      commission: z.string(),
      commissionAsset: z.string(),
    })).optional(),
  }),
});

/**
 * MEXC Ticker Response Schema
 */
export const MexcTickerResponseSchema = z.object({
  code: z.literal(200),
  data: z.array(z.object({
    symbol: z.string(),
    lastPrice: z.string(),
    priceChange: z.string(),
    priceChangePercent: z.string(),
    volume: z.string(),
    quoteVolume: z.string(),
    openPrice: z.string(),
    highPrice: z.string(),
    lowPrice: z.string(),
    count: z.number(),
    openTime: z.number(),
    closeTime: z.number(),
    prevClosePrice: z.string().optional(),
    bidPrice: z.string().optional(),
    bidQty: z.string().optional(),
    askPrice: z.string().optional(),
    askQty: z.string().optional(),
  })),
});

/**
 * MEXC Order Book Response Schema
 */
export const MexcOrderBookResponseSchema = z.object({
  code: z.literal(200),
  data: z.object({
    lastUpdateId: z.number(),
    bids: z.array(z.tuple([z.string(), z.string()])),
    asks: z.array(z.tuple([z.string(), z.string()])),
  }),
});

/**
 * MEXC Calendar Listings Response Schema
 */
export const MexcCalendarResponseSchema = z.object({
  code: z.literal(200),
  data: z.array(z.object({
    vcoinId: z.string(),
    symbol: z.string(),
    projectName: z.string(),
    firstOpenTime: z.number(),
  })),
});

/**
 * MEXC Symbol Data Response Schema
 */
export const MexcSymbolDataResponseSchema = z.object({
  code: z.literal(200),
  data: z.array(z.object({
    cd: z.string(),
    symbol: z.string().optional(),
    sts: z.number(),
    st: z.number(), 
    tt: z.number(),
    ca: z.union([z.string(), z.number()]).optional(),
    ps: z.number().optional(),
    qs: z.number().optional(),
    ot: z.number().optional(),
  })),
});

/**
 * MEXC Activity Data Response Schema
 */
export const MexcActivityResponseSchema = z.object({
  code: z.literal(200),
  data: z.array(z.object({
    activityId: z.string(),
    currency: z.string(),
    currencyId: z.string(),
    activityType: z.string(),
  })),
  msg: z.string().optional(),
  timestamp: z.number().optional(),
});

// ============================================================================
// MEXC Error Response Schemas
// ============================================================================

export const MexcErrorResponseSchema = z.object({
  code: z.number().refine(code => code !== 200, "Error response should not have code 200"),
  msg: z.string(),
  data: z.null().optional(),
});

export const MexcAuthErrorSchema = z.object({
  code: z.union([z.literal(10072), z.literal(700002), z.literal(10073)]),
  msg: z.string(),
});

export const MexcRateLimitErrorSchema = z.object({
  code: z.literal(429),
  msg: z.string().includes("rate limit"),
});

// ============================================================================
// Third-Party API Validation Schemas
// ============================================================================

/**
 * CoinGecko Price Response Schema
 */
export const CoinGeckoPriceResponseSchema = z.record(
  z.string(),
  z.record(z.string(), z.number())
);

/**
 * Generic HTTP Response Schema
 */
export const HttpResponseSchema = z.object({
  status: z.number().min(100).max(599),
  statusText: z.string(),
  headers: z.record(z.string()).optional(),
  data: z.unknown().optional(),
});

// ============================================================================
// Critical Data Flow Schemas
// ============================================================================

/**
 * Trading Order Validation Schema - Critical for order execution
 */
export const TradingOrderSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["MARKET", "LIMIT", "STOP_LOSS", "STOP_LOSS_LIMIT"]),
  quantity: z.string().refine(
    (val) => parseFloat(val) > 0,
    "Quantity must be greater than 0"
  ),
  price: z.string().optional().refine(
    (val) => !val || parseFloat(val) > 0,
    "Price must be greater than 0 if provided"
  ),
  stopPrice: z.string().optional().refine(
    (val) => !val || parseFloat(val) > 0,
    "Stop price must be greater than 0 if provided"
  ),
  timeInForce: z.enum(["GTC", "IOC", "FOK"]).default("GTC"),
});

/**
 * Account Balance Schema - Critical for portfolio management
 */
export const AccountBalanceSchema = z.object({
  asset: z.string().min(1, "Asset is required"),
  free: z.string().refine(
    (val) => parseFloat(val) >= 0,
    "Free balance cannot be negative"
  ),
  locked: z.string().refine(
    (val) => parseFloat(val) >= 0,
    "Locked balance cannot be negative"
  ),
  total: z.number().nonnegative("Total balance cannot be negative"),
  usdtValue: z.number().nonnegative("USDT value cannot be negative").optional(),
});

/**
 * Portfolio Summary Schema - Critical for risk management
 */
export const PortfolioSummarySchema = z.object({
  totalValue: z.number().nonnegative("Total value cannot be negative"),
  totalValueUsdt: z.number().nonnegative("Total USDT value cannot be negative"),
  totalPnL: z.number().optional(),
  totalPnLPercent: z.number().optional(),
  lastUpdated: z.string().datetime("Invalid timestamp format"),
  balances: z.array(AccountBalanceSchema),
});

/**
 * Risk Parameters Schema - Critical for trading safety
 */
export const RiskParametersSchema = z.object({
  maxPositionSize: z.number().positive("Max position size must be positive"),
  stopLossPercentage: z.number().min(0.1).max(50, "Stop loss must be between 0.1% and 50%"),
  takeProfitPercentage: z.number().min(0.1).max(1000, "Take profit must be between 0.1% and 1000%"),
  maxDrawdown: z.number().min(0).max(100, "Max drawdown must be between 0% and 100%").optional(),
  riskLevel: z.enum(["low", "medium", "high"]).default("medium"),
});

/**
 * Market Data Schema - Critical for trading decisions
 */
export const MarketDataSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  price: z.number().positive("Price must be positive"),
  priceChange: z.number(),
  priceChangePercent: z.number(),
  volume: z.number().nonnegative("Volume cannot be negative"),
  timestamp: z.number().positive("Timestamp must be positive"),
  high24h: z.number().positive("24h high must be positive").optional(),
  low24h: z.number().positive("24h low must be positive").optional(),
});

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Validate MEXC API Response with specific schema
 */
export function validateMexcResponse<T extends z.ZodSchema>(
  schema: T,
  response: unknown,
  apiEndpoint: string = "unknown"
): { success: true; data: z.infer<T> } | { success: false; error: string; details?: z.ZodError } {
  try {
    // First check if it's a MEXC error response
    const errorCheck = MexcErrorResponseSchema.safeParse(response);
    if (errorCheck.success) {
      return {
        success: false,
        error: `MEXC API Error (${errorCheck.data.code}): ${errorCheck.data.msg}`,
      };
    }

    // Validate against the expected schema
    const result = schema.parse(response);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors
        .map((err) => `${(err.path as string[]).join(".")}: ${err.message}`)
        .join(", ");
      
      console.error(`[MEXC API Validation] ${apiEndpoint} validation failed:`, {
        errors: error.errors,
        receivedData: JSON.stringify(response, null, 2).substring(0, 500),
      });
      
      return {
        success: false,
        error: `MEXC API response validation failed for ${apiEndpoint}: ${errorMessage}`,
        details: error,
      };
    }
    
    return {
      success: false,
      error: `Unexpected validation error for ${apiEndpoint}: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Validate critical trading data with enhanced error handling
 */
export function validateCriticalTradingData<T extends z.ZodSchema>(
  schema: T,
  data: unknown,
  dataType: string
): z.infer<T> {
  try {
    const result = schema.parse(data);
    console.debug(`[CriticalValidation] ${dataType} validated successfully`);
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors
        .map((err) => `${(err.path as string[]).join(".")}: ${err.message}`)
        .join(", ");
      
      console.error(`[CriticalValidation] CRITICAL FAILURE - ${dataType} validation failed:`, {
        errors: error.errors,
        data: JSON.stringify(data, null, 2).substring(0, 300),
      });
      
      throw new Error(`Critical ${dataType} validation failed: ${errorMessage}`);
    }
    
    throw new Error(`Critical ${dataType} validation error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Safe validation that returns default on failure
 */
export function safeValidateWithDefault<T extends z.ZodSchema>(
  schema: T,
  data: unknown,
  defaultValue: z.infer<T>
): z.infer<T> {
  try {
    return schema.parse(data);
  } catch (error) {
    console.warn(`[SafeValidation] Validation failed, using default:`, {
      error: error instanceof z.ZodError ? error.errors : error,
      defaultValue,
    });
    return defaultValue;
  }
}

// ============================================================================
// Type Exports
// ============================================================================

export type MexcBaseResponse = z.infer<typeof MexcBaseResponseSchema>;
export type MexcServerTimeResponse = z.infer<typeof MexcServerTimeResponseSchema>;
export type MexcAccountBalanceResponse = z.infer<typeof MexcAccountBalanceResponseSchema>;
export type MexcOrderResponse = z.infer<typeof MexcOrderResponseSchema>;
export type MexcTickerResponse = z.infer<typeof MexcTickerResponseSchema>;
export type MexcCalendarResponse = z.infer<typeof MexcCalendarResponseSchema>;
export type MexcActivityResponse = z.infer<typeof MexcActivityResponseSchema>;
export type TradingOrder = z.infer<typeof TradingOrderSchema>;
export type AccountBalance = z.infer<typeof AccountBalanceSchema>;
export type PortfolioSummary = z.infer<typeof PortfolioSummarySchema>;
export type RiskParameters = z.infer<typeof RiskParametersSchema>;
export type MarketData = z.infer<typeof MarketDataSchema>;

// ============================================================================
// Schema Collections for Easy Reference
// ============================================================================

export const MEXC_API_SCHEMAS = {
  base: MexcBaseResponseSchema,
  serverTime: MexcServerTimeResponseSchema,
  exchangeInfo: MexcExchangeInfoResponseSchema,
  accountBalance: MexcAccountBalanceResponseSchema,
  order: MexcOrderResponseSchema,
  ticker: MexcTickerResponseSchema,
  orderBook: MexcOrderBookResponseSchema,
  calendar: MexcCalendarResponseSchema,
  symbolData: MexcSymbolDataResponseSchema,
  activity: MexcActivityResponseSchema,
  error: MexcErrorResponseSchema,
  authError: MexcAuthErrorSchema,
  rateLimitError: MexcRateLimitErrorSchema,
} as const;

export const CRITICAL_DATA_SCHEMAS = {
  tradingOrder: TradingOrderSchema,
  accountBalance: AccountBalanceSchema,
  portfolioSummary: PortfolioSummarySchema,
  riskParameters: RiskParametersSchema,
  marketData: MarketDataSchema,
} as const;
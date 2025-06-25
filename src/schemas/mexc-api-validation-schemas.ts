import { z } from "zod";

/**
 * MEXC API-specific validation schemas for endpoint requests/responses
 * Provides type-safe validation for all MEXC-related API operations
 */

// ============================================================================
// Account Balance API Schemas
// ============================================================================

export const AccountBalanceQuerySchema = z.object({
  userId: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .refine(
      (userId) => {
        if (!userId) return true; // Optional field
        // Allow UUID format or other valid user identifiers
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const userIdRegex = /^[a-zA-Z0-9_-]+([:.][a-zA-Z0-9_-]+)*$/; // Allow formats like "user:123" or "default-user"
        return uuidRegex.test(userId) || userIdRegex.test(userId);
      },
      {
        message:
          "userId must be a valid UUID or user identifier format (alphanumeric with optional separators)",
      }
    ),
});

export const BalanceItemSchema = z.object({
  asset: z.string().min(1).max(20),
  free: z.string().regex(/^\d+(\.\d+)?$/),
  locked: z.string().regex(/^\d+(\.\d+)?$/),
  total: z.number().min(0),
  usdtValue: z.number().min(0).optional(),
});

export const AccountBalanceResponseSchema = z.object({
  balances: z.array(BalanceItemSchema),
  totalUsdtValue: z.number().min(0),
  lastUpdated: z.string().datetime(),
  hasUserCredentials: z.boolean(),
  credentialsType: z.enum(["user-specific", "environment-fallback"]),
});

// ============================================================================
// API Credentials Test Schemas
// ============================================================================

export const ApiCredentialsTestRequestSchema = z.object({
  userId: z
    .string()
    .min(1)
    .max(100)
    .refine(
      (userId) => {
        // Allow UUID format or other valid user identifiers
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const userIdRegex = /^[a-zA-Z0-9_-]+([:.][a-zA-Z0-9_-]+)*$/; // Allow formats like "user:123" or "default-user"
        return uuidRegex.test(userId) || userIdRegex.test(userId);
      },
      {
        message:
          "userId must be a valid UUID or user identifier format (alphanumeric with optional separators)",
      }
    ),
  provider: z.enum(["mexc"]).default("mexc"),
});

export const ApiCredentialsTestResponseSchema = z.object({
  connectivity: z.boolean(),
  authentication: z.boolean(),
  accountType: z.enum(["spot", "margin", "futures"]),
  canTrade: z.boolean(),
  balanceCount: z.number().min(0),
  credentialSource: z.enum(["database", "environment"]),
  totalAssets: z.number().min(0),
  hasNonZeroBalances: z.boolean(),
  testTimestamp: z.number(),
  serverTime: z.string().datetime(),
  permissions: z.array(z.string()).optional(),
  lastUpdate: z.string().optional(),
  connectivityNote: z.string().optional(),
  statusSync: z.object({
    cacheInvalidated: z.boolean(),
    timestamp: z.string().datetime(),
    triggeredBy: z.string(),
    success: z.boolean().optional(),
    servicesNotified: z.array(z.string()).optional(),
    statusRefreshed: z.boolean().optional(),
  }),
});

// ============================================================================
// MEXC Connectivity Test Schemas
// ============================================================================

export const ConnectivityTestRequestSchema = z.object({
  userId: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .refine(
      (userId) => {
        if (!userId) return true; // Optional field
        // Allow UUID format or other valid user identifiers
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const userIdRegex = /^[a-zA-Z0-9_-]+([:.][a-zA-Z0-9_-]+)*$/; // Allow formats like "user:123" or "default-user"
        return uuidRegex.test(userId) || userIdRegex.test(userId);
      },
      {
        message:
          "userId must be a valid UUID or user identifier format (alphanumeric with optional separators)",
      }
    ),
  includeCredentialTest: z.boolean().default(true),
});

export const ConnectivityMetricsSchema = z.object({
  latency: z.number().min(0),
  retryCount: z.number().min(0),
  connectionHealth: z.enum(["excellent", "good", "poor", "failed"]),
  lastSuccessfulCheck: z.string().datetime().optional(),
});

export const ConnectivityTestResponseSchema = z.object({
  connected: z.boolean(),
  hasCredentials: z.boolean(),
  credentialsValid: z.boolean(),
  credentialSource: z.enum(["database", "environment", "none"]),
  hasUserCredentials: z.boolean(),
  hasEnvironmentCredentials: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
  timestamp: z.string().datetime(),
  status: z.string(),
  metrics: ConnectivityMetricsSchema.optional(),
});

// ============================================================================
// MEXC Trading Operation Schemas
// ============================================================================

export const TradingOrderRequestSchema = z
  .object({
    symbol: z.string().min(1),
    side: z.enum(["BUY", "SELL"]),
    type: z.enum(["MARKET", "LIMIT", "STOP_LOSS", "STOP_LOSS_LIMIT"]),
    quantity: z.union([z.string(), z.number()]).optional(),
    quoteOrderQty: z.union([z.string(), z.number()]).optional(),
    price: z.union([z.string(), z.number()]).optional(),
    timeInForce: z.enum(["GTC", "IOC", "FOK"]).optional(),
    userId: z.string().uuid(),
  })
  .refine((data) => data.quantity || data.quoteOrderQty, {
    message: "Either quantity or quoteOrderQty must be provided",
  });

export const TradingOrderResponseSchema = z.object({
  success: z.boolean(),
  orderId: z.string().optional(),
  symbol: z.string(),
  side: z.string(),
  quantity: z.string(),
  price: z.string().optional(),
  status: z.string().optional(),
  executedQty: z.string().optional(),
  error: z.string().optional(),
  timestamp: z.string().datetime(),
});

// ============================================================================
// Account Information Schemas
// ============================================================================

export const AccountInfoRequestSchema = z.object({
  userId: z.string().uuid().optional(),
});

export const AccountInfoResponseSchema = z.object({
  accountType: z.enum(["SPOT", "MARGIN", "FUTURES"]),
  canTrade: z.boolean(),
  canWithdraw: z.boolean(),
  canDeposit: z.boolean(),
  updateTime: z.number(),
  permissions: z.array(z.string()),
  balances: z.array(BalanceItemSchema),
});

// ============================================================================
// Symbol Information Schemas
// ============================================================================

export const SymbolInfoRequestSchema = z
  .object({
    symbol: z.string().optional(),
    symbols: z.array(z.string()).optional(),
  })
  .refine((data) => data.symbol || (data.symbols && data.symbols.length > 0), {
    message: "Either symbol or symbols array must be provided",
  });

export const SymbolInfoSchema = z.object({
  symbol: z.string(),
  status: z.string(),
  baseAsset: z.string(),
  quoteAsset: z.string(),
  baseAssetPrecision: z.number(),
  quotePrecision: z.number(),
  quoteAssetPrecision: z.number(),
  orderTypes: z.array(z.string()),
  filters: z.array(z.record(z.unknown())),
});

export const SymbolInfoResponseSchema = z.object({
  symbols: z.array(SymbolInfoSchema),
});

// ============================================================================
// Calendar Listings Schemas
// ============================================================================

export const CalendarListingsRequestSchema = z.object({
  limit: z.number().min(1).max(100).default(50).optional(),
  includeUpcoming: z.boolean().default(true).optional(),
});

export const CalendarListingSchema = z.object({
  vcoinId: z.string(),
  symbol: z.string(),
  projectName: z.string(),
  firstOpenTime: z.number(),
  vcoinName: z.string().optional(),
  vcoinNameFull: z.string().optional(),
  zone: z.string().optional(),
  introductionEn: z.string().optional(),
});

export const CalendarListingsResponseSchema = z.object({
  listings: z.array(CalendarListingSchema),
  total: z.number().min(0),
  upcoming: z.number().min(0),
  lastUpdated: z.string().datetime(),
});

// ============================================================================
// Server Time & Status Schemas
// ============================================================================

export const ServerTimeResponseSchema = z.object({
  serverTime: z.number(),
  serverTimeString: z.string().datetime(),
  timezone: z.string().optional(),
});

export const ServerStatusResponseSchema = z.object({
  status: z.enum(["normal", "maintenance", "limited"]),
  msg: z.string().optional(),
});

// ============================================================================
// Error Response Schemas
// ============================================================================

export const MexcErrorResponseSchema = z.object({
  code: z.number(),
  msg: z.string(),
  timestamp: z.number().optional(),
});

// ============================================================================
// Validation Helper Functions
// ============================================================================

export function validateMexcApiRequest<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string; details: string[] } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const details = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`);
      const errorMessage = `MEXC API validation failed: ${details.join(", ")}`;
      return { success: false, error: errorMessage, details };
    }
    return {
      success: false,
      error: "Unknown MEXC API validation error",
      details: [error instanceof Error ? error.message : String(error)],
    };
  }
}

export function validateMexcApiResponse<T extends z.ZodSchema>(
  schema: T,
  data: unknown,
  context?: string
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = context
        ? `MEXC API response validation failed for ${context}: ${error.errors.map((err) => err.message).join(", ")}`
        : `MEXC API response validation failed: ${error.errors.map((err) => err.message).join(", ")}`;
      return { success: false, error: errorMessage };
    }
    return {
      success: false,
      error: context
        ? `Unknown MEXC API response validation error for ${context}`
        : "Unknown MEXC API response validation error",
    };
  }
}

// ============================================================================
// Type Exports
// ============================================================================

export type AccountBalanceQuery = z.infer<typeof AccountBalanceQuerySchema>;
export type BalanceItem = z.infer<typeof BalanceItemSchema>;
export type AccountBalanceResponse = z.infer<typeof AccountBalanceResponseSchema>;
export type ApiCredentialsTestRequest = z.infer<typeof ApiCredentialsTestRequestSchema>;
export type ApiCredentialsTestResponse = z.infer<typeof ApiCredentialsTestResponseSchema>;
export type ConnectivityTestRequest = z.infer<typeof ConnectivityTestRequestSchema>;
export type ConnectivityMetrics = z.infer<typeof ConnectivityMetricsSchema>;
export type ConnectivityTestResponse = z.infer<typeof ConnectivityTestResponseSchema>;
export type TradingOrderRequest = z.infer<typeof TradingOrderRequestSchema>;
export type TradingOrderResponse = z.infer<typeof TradingOrderResponseSchema>;
export type AccountInfoRequest = z.infer<typeof AccountInfoRequestSchema>;
export type AccountInfoResponse = z.infer<typeof AccountInfoResponseSchema>;
export type SymbolInfoRequest = z.infer<typeof SymbolInfoRequestSchema>;
export type SymbolInfo = z.infer<typeof SymbolInfoSchema>;
export type SymbolInfoResponse = z.infer<typeof SymbolInfoResponseSchema>;
export type CalendarListingsRequest = z.infer<typeof CalendarListingsRequestSchema>;
export type CalendarListing = z.infer<typeof CalendarListingSchema>;
export type CalendarListingsResponse = z.infer<typeof CalendarListingsResponseSchema>;
export type ServerTimeResponse = z.infer<typeof ServerTimeResponseSchema>;
export type ServerStatusResponse = z.infer<typeof ServerStatusResponseSchema>;
export type MexcErrorResponse = z.infer<typeof MexcErrorResponseSchema>;

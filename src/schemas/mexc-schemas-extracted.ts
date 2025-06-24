/**
 * Extracted MEXC Schemas
 *
 * This file contains all Zod schemas extracted from the monolithic
 * unified-mexc-service.ts file as part of the TDD refactoring process.
 *
 * Extracted schemas provide type safety and validation for MEXC API
 * responses and trading operations.
 */

import { z } from "zod";

// ============================================================================
// Core Data Schemas
// ============================================================================

/**
 * Calendar Entry Schema for new coin listings
 */
export const CalendarEntrySchema = z.object({
  vcoinId: z.string(),
  symbol: z.string(),
  projectName: z.string(),
  firstOpenTime: z.number(),
});

/**
 * Symbol Entry Schema for trading symbols
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
  price: z.string().optional(), // MEXC API uses lastPrice, price is optional
  priceChange: z.string(),
  priceChangePercent: z.string(),
  volume: z.string(),
  quoteVolume: z.string().optional(),
  openPrice: z.string().optional(),
  highPrice: z.string().optional(),
  lowPrice: z.string().optional(),
  count: z.union([z.string(), z.null()]).optional(), // MEXC API returns null for count
});

/**
 * Order Parameters Schema for trading orders
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
  timestamp: z.number(),
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

// ============================================================================
// Type Exports
// ============================================================================

export type CalendarEntry = z.infer<typeof CalendarEntrySchema>;
export type SymbolEntry = z.infer<typeof SymbolEntrySchema>;
export type BalanceEntry = z.infer<typeof BalanceEntrySchema>;
export type ExchangeSymbol = z.infer<typeof ExchangeSymbolSchema>;
export type Ticker = z.infer<typeof TickerSchema>;
export type OrderParameters = z.infer<typeof OrderParametersSchema>;
export type OrderResult = z.infer<typeof OrderResultSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type OrderBook = z.infer<typeof OrderBookSchema>;
export type Kline = z.infer<typeof KlineSchema>;
export type MexcServiceResponse<T = any> = z.infer<typeof MexcServiceResponseSchema> & {
  data?: T;
};

// ============================================================================
// Schema Validation Utilities
// ============================================================================

/**
 * Validate calendar entry data
 */
export function validateCalendarEntry(data: unknown): CalendarEntry {
  return CalendarEntrySchema.parse(data);
}

/**
 * Validate symbol entry data
 */
export function validateSymbolEntry(data: unknown): SymbolEntry {
  return SymbolEntrySchema.parse(data);
}

/**
 * Validate balance entry data
 */
export function validateBalanceEntry(data: unknown): BalanceEntry {
  return BalanceEntrySchema.parse(data);
}

/**
 * Validate ticker data
 */
export function validateTicker(data: unknown): Ticker {
  return TickerSchema.parse(data);
}

/**
 * Validate order parameters
 */
export function validateOrderParameters(data: unknown): OrderParameters {
  return OrderParametersSchema.parse(data);
}

/**
 * Validate order book data
 */
export function validateOrderBook(data: unknown): OrderBook {
  return OrderBookSchema.parse(data);
}

/**
 * Validate MEXC service response
 */
export function validateMexcServiceResponse<T = any>(data: unknown): MexcServiceResponse<T> {
  return MexcServiceResponseSchema.parse(data) as MexcServiceResponse<T>;
}

// ============================================================================
// Schema Collections
// ============================================================================

/**
 * All available schemas for bulk operations
 */
export const ALL_SCHEMAS = {
  CalendarEntrySchema,
  SymbolEntrySchema,
  BalanceEntrySchema,
  ExchangeSymbolSchema,
  TickerSchema,
  OrderParametersSchema,
  OrderResultSchema,
  OrderStatusSchema,
  OrderBookSchema,
  KlineSchema,
  MexcServiceResponseSchema,
} as const;

/**
 * Core trading schemas
 */
export const TRADING_SCHEMAS = {
  OrderParametersSchema,
  OrderResultSchema,
  OrderStatusSchema,
  OrderBookSchema,
} as const;

/**
 * Market data schemas
 */
export const MARKET_DATA_SCHEMAS = {
  TickerSchema,
  KlineSchema,
  ExchangeSymbolSchema,
  CalendarEntrySchema,
} as const;

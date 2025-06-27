/**
 * Market Data Service - Type Definitions
 *
 * Consolidated type definitions for the market data service that merges
 * all market data, pattern detection, and real-time streaming functionality.
 */

import { z } from "zod";

// ============================================================================
// Configuration Types
// ============================================================================

export const MarketDataConfigSchema = z.object({
  // API Configuration
  apiKey: z.string().min(1, "API key is required"),
  secretKey: z.string().min(1, "Secret key is required"),
  baseUrl: z.string().url("Valid base URL required").default("https://api.mexc.com"),
  websocketUrl: z.string().url("Valid WebSocket URL required").default("wss://wbs.mexc.com"),

  // Connection Settings
  timeout: z.number().positive("Timeout must be positive").default(10000),
  maxRetries: z.number().nonnegative("Max retries cannot be negative").default(3),
  rateLimitDelay: z.number().nonnegative("Rate limit delay cannot be negative").default(100),

  // Caching Settings
  enableCaching: z.boolean().default(true),
  cacheTTL: z.number().positive("Cache TTL must be positive").default(300000), // 5 minutes
  maxCacheSize: z.number().positive("Max cache size must be positive").default(1000),

  // WebSocket Settings
  maxWebSocketConnections: z
    .number()
    .positive("Max WebSocket connections must be positive")
    .default(10),
  websocketReconnectDelay: z
    .number()
    .positive("WebSocket reconnect delay must be positive")
    .default(5000),
  websocketHeartbeatInterval: z
    .number()
    .positive("WebSocket heartbeat interval must be positive")
    .default(30000),

  // Pattern Detection Settings
  enablePatternDetection: z.boolean().default(true),
  patternDetectionInterval: z
    .number()
    .positive("Pattern detection interval must be positive")
    .default(30000),
  minPatternConfidence: z.number().min(0).max(100, "Pattern confidence must be 0-100").default(70),
  patternHistoryDays: z.number().positive("Pattern history days must be positive").default(7),

  // Price Alert Settings
  enablePriceAlerts: z.boolean().default(true),
  maxAlertsPerSymbol: z.number().positive("Max alerts per symbol must be positive").default(10),
  alertCheckInterval: z.number().positive("Alert check interval must be positive").default(5000),

  // Technical Analysis Settings
  defaultTechnicalPeriod: z
    .number()
    .positive("Default technical period must be positive")
    .default(20),
  maxTechnicalPeriod: z.number().positive("Max technical period must be positive").default(200),
});

export type MarketDataConfig = z.infer<typeof MarketDataConfigSchema>;

// ============================================================================
// Price Data Types
// ============================================================================

export const PriceDataSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  price: z.number().positive("Price must be positive"),
  volume: z.number().nonnegative("Volume cannot be negative"),
  change: z.number(),
  changePercent: z.number(),
  high24h: z.number().positive("24h high must be positive"),
  low24h: z.number().positive("24h low must be positive"),
  openPrice: z.number().positive("Open price must be positive").optional(),
  closePrice: z.number().positive("Close price must be positive").optional(),
  timestamp: z.number().positive("Timestamp must be positive"),
  source: z.enum(["api", "websocket", "cache"]).default("api"),
});

export type PriceData = z.infer<typeof PriceDataSchema>;

export const BatchPriceDataSchema = z.object({
  success: z.boolean(),
  data: z.array(PriceDataSchema),
  errors: z
    .array(
      z.object({
        symbol: z.string(),
        error: z.string(),
      })
    )
    .default([]),
  timestamp: z.string(),
  source: z.enum(["api", "websocket", "cache"]).default("api"),
});

export type BatchPriceData = z.infer<typeof BatchPriceDataSchema>;

// ============================================================================
// Kline/Candlestick Data Types
// ============================================================================

export const KlineIntervalSchema = z.enum([
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1M",
]);

export type KlineInterval = z.infer<typeof KlineIntervalSchema>;

export const KlineDataSchema = z.object({
  symbol: z.string(),
  interval: KlineIntervalSchema,
  openTime: z.number(),
  closeTime: z.number(),
  open: z.number().positive("Open price must be positive"),
  high: z.number().positive("High price must be positive"),
  low: z.number().positive("Low price must be positive"),
  close: z.number().positive("Close price must be positive"),
  volume: z.number().nonnegative("Volume cannot be negative"),
  quoteAssetVolume: z.number().nonnegative("Quote asset volume cannot be negative"),
  trades: z.number().nonnegative("Trades count cannot be negative"),
  takerBuyBaseAssetVolume: z.number().nonnegative("Taker buy base asset volume cannot be negative"),
  takerBuyQuoteAssetVolume: z
    .number()
    .nonnegative("Taker buy quote asset volume cannot be negative"),
});

export type KlineData = z.infer<typeof KlineDataSchema>;

// ============================================================================
// Pattern Detection Types
// ============================================================================

export const PatternTypeSchema = z.enum([
  "bullish_divergence",
  "bearish_divergence",
  "breakout",
  "breakdown",
  "support",
  "resistance",
  "volume_spike",
  "volume_drop",
  "price_consolidation",
  "trend_reversal",
  "momentum_shift",
  "volatility_spike",
  "ascending_triangle",
  "descending_triangle",
  "head_shoulders",
  "inverse_head_shoulders",
  "double_top",
  "double_bottom",
  "cup_handle",
  "flag",
  "pennant",
]);

export type PatternType = z.infer<typeof PatternTypeSchema>;

export const PatternSignificanceSchema = z.enum(["low", "medium", "high", "critical"]);

export type PatternSignificance = z.infer<typeof PatternSignificanceSchema>;

export const PatternDetectionResultSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  pattern: PatternTypeSchema,
  confidence: z.number().min(0).max(100),
  significance: PatternSignificanceSchema,
  timestamp: z.number(),

  // Pattern-specific data
  priceLevel: z.number().positive("Price level must be positive").optional(),
  supportLevel: z.number().positive("Support level must be positive").optional(),
  resistanceLevel: z.number().positive("Resistance level must be positive").optional(),
  volume: z.number().nonnegative("Volume cannot be negative").optional(),
  volumeChange: z.number().optional(),

  // Technical indicators that contributed to pattern
  indicators: z
    .object({
      rsi: z.number().min(0).max(100).optional(),
      macd: z.number().optional(),
      bollinger: z
        .object({
          upper: z.number(),
          middle: z.number(),
          lower: z.number(),
        })
        .optional(),
      sma: z.number().optional(),
      ema: z.number().optional(),
    })
    .optional(),

  // Pattern validity
  validFrom: z.number(),
  validUntil: z.number().optional(),
  isActive: z.boolean().default(true),

  // Metadata
  metadata: z.record(z.any()).default({}),
  notes: z.string().optional(),
});

export type PatternDetectionResult = z.infer<typeof PatternDetectionResultSchema>;

// ============================================================================
// Price Alert Types
// ============================================================================

export const AlertTypeSchema = z.enum([
  "price_above",
  "price_below",
  "price_change_percent",
  "volume_spike",
  "volume_drop",
  "technical_indicator",
  "pattern_detected",
  "support_break",
  "resistance_break",
]);

export type AlertType = z.infer<typeof AlertTypeSchema>;

export const AlertConditionSchema = z.enum([
  ">=",
  "<=",
  ">",
  "<",
  "==",
  "!=",
  "crosses_above",
  "crosses_below",
  "percentage_change",
  "absolute_change",
]);

export type AlertCondition = z.infer<typeof AlertConditionSchema>;

export const PriceAlertSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  type: AlertTypeSchema,
  condition: AlertConditionSchema,

  // Target values
  targetPrice: z.number().positive("Target price must be positive").optional(),
  targetPercent: z.number().optional(),
  targetVolume: z.number().nonnegative("Target volume cannot be negative").optional(),

  // Current values (for comparison)
  currentPrice: z.number().positive("Current price must be positive").optional(),
  currentPercent: z.number().optional(),
  currentVolume: z.number().nonnegative("Current volume cannot be negative").optional(),

  // Alert status
  enabled: z.boolean().default(true),
  triggered: z.boolean().default(false),
  triggerCount: z.number().nonnegative("Trigger count cannot be negative").default(0),
  maxTriggers: z.number().positive("Max triggers must be positive").default(1),

  // Timing
  createdAt: z.date(),
  triggeredAt: z.date().optional(),
  expiresAt: z.date().optional(),

  // Notification settings
  notificationChannels: z.array(z.enum(["email", "sms", "webhook", "push"])).default(["webhook"]),
  notificationMessage: z.string().optional(),

  // Metadata
  metadata: z.record(z.any()).default({}),
  notes: z.string().optional(),
});

export type PriceAlert = z.infer<typeof PriceAlertSchema>;

// ============================================================================
// Technical Analysis Types
// ============================================================================

export const TechnicalIndicatorSchema = z.object({
  symbol: z.string(),
  indicator: z.enum([
    "sma",
    "ema",
    "rsi",
    "macd",
    "bollinger",
    "stochastic",
    "adx",
    "cci",
    "williams_r",
    "momentum",
    "roc",
  ]),
  period: z.number().positive("Period must be positive"),
  value: z.number(),
  timestamp: z.number(),
  metadata: z.record(z.any()).default({}),
});

export type TechnicalIndicator = z.infer<typeof TechnicalIndicatorSchema>;

export const MovingAverageSchema = z.object({
  sma: z.number(),
  ema: z.number(),
  period: z.number().positive(),
  timestamp: z.number(),
});

export type MovingAverage = z.infer<typeof MovingAverageSchema>;

export const MACDSchema = z.object({
  macdLine: z.number(),
  signalLine: z.number(),
  histogram: z.number(),
  timestamp: z.number(),
});

export type MACD = z.infer<typeof MACDSchema>;

export const BollingerBandsSchema = z.object({
  upperBand: z.number(),
  middleBand: z.number(),
  lowerBand: z.number(),
  bandwidth: z.number(),
  percentB: z.number(),
  period: z.number().positive(),
  standardDeviations: z.number().positive(),
  timestamp: z.number(),
});

export type BollingerBands = z.infer<typeof BollingerBandsSchema>;

export const RSISchema = z.object({
  value: z.number().min(0).max(100),
  period: z.number().positive(),
  overbought: z.boolean(),
  oversold: z.boolean(),
  divergence: z.enum(["bullish", "bearish", "none"]),
  timestamp: z.number(),
});

export type RSI = z.infer<typeof RSISchema>;

// ============================================================================
// WebSocket Types
// ============================================================================

export const WebSocketConnectionSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  streams: z.array(
    z.enum([
      "trade",
      "kline_1m",
      "kline_5m",
      "kline_1h",
      "kline_1d",
      "ticker",
      "depth",
      "aggTrade",
      "miniTicker",
    ])
  ),
  status: z.enum(["connecting", "connected", "disconnected", "error"]),
  reconnectAttempts: z.number().nonnegative(),
  lastHeartbeat: z.date().optional(),
  createdAt: z.date(),
  lastDataReceived: z.date().optional(),
});

export type WebSocketConnection = z.infer<typeof WebSocketConnectionSchema>;

export const WebSocketMessageSchema = z.object({
  stream: z.string(),
  data: z.record(z.any()),
  timestamp: z.number(),
  symbol: z.string().optional(),
  type: z.enum(["trade", "kline", "ticker", "depth", "aggTrade"]).optional(),
});

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

// ============================================================================
// Market Analysis Types
// ============================================================================

export const MarketTrendSchema = z.enum(["bullish", "bearish", "sideways", "volatile", "unknown"]);

export type MarketTrend = z.infer<typeof MarketTrendSchema>;

export const MarketAnalysisSchema = z.object({
  symbol: z.string(),
  trend: MarketTrendSchema,
  strength: z.number().min(0).max(100),
  volatility: z.number().min(0),
  volume: z.object({
    current: z.number(),
    average: z.number(),
    ratio: z.number(),
  }),
  support: z.number().positive().optional(),
  resistance: z.number().positive().optional(),
  technicalIndicators: z.array(TechnicalIndicatorSchema),
  patterns: z.array(PatternDetectionResultSchema),
  sentiment: z.enum(["very_bearish", "bearish", "neutral", "bullish", "very_bullish"]),
  recommendation: z.enum(["strong_sell", "sell", "hold", "buy", "strong_buy"]),
  confidence: z.number().min(0).max(100),
  timestamp: z.number(),
});

export type MarketAnalysis = z.infer<typeof MarketAnalysisSchema>;

// ============================================================================
// Service Status Types
// ============================================================================

export const MarketDataServiceStatusSchema = z.object({
  // Service Health
  isHealthy: z.boolean(),
  isConnected: z.boolean(),
  lastApiCall: z.date().optional(),

  // WebSocket Status
  webSocketConnections: z.number().nonnegative(),
  maxWebSocketConnections: z.number().positive(),
  totalWebSocketReconnects: z.number().nonnegative(),

  // Pattern Detection Status
  patternDetectionEnabled: z.boolean(),
  patternsDetectedToday: z.number().nonnegative(),
  lastPatternDetection: z.date().optional(),

  // Price Alert Status
  priceAlertsEnabled: z.boolean(),
  activeAlerts: z.number().nonnegative(),
  alertsTriggeredToday: z.number().nonnegative(),

  // Performance Metrics
  cacheHitRate: z.number().min(0).max(100),
  averageResponseTime: z.number().nonnegative(),
  totalApiCalls: z.number().nonnegative(),
  totalErrors: z.number().nonnegative(),

  // Data Freshness
  oldestCachedData: z.date().optional(),
  newestCachedData: z.date().optional(),
  symbolsTracked: z.number().nonnegative(),

  // System Status
  uptime: z.number().nonnegative(),
  lastHealthCheck: z.date(),
  version: z.string(),

  // Resource Usage
  memoryUsage: z
    .object({
      used: z.number(),
      total: z.number(),
      percentage: z.number().min(0).max(100),
    })
    .optional(),
});

export type MarketDataServiceStatus = z.infer<typeof MarketDataServiceStatusSchema>;

// ============================================================================
// Event Types
// ============================================================================

export interface MarketDataEvents {
  price_update: PriceData;
  kline_update: KlineData;
  pattern_detected: PatternDetectionResult;
  alert_triggered: PriceAlert;
  websocket_connected: { symbol: string; streams: string[] };
  websocket_disconnected: { symbol: string; reason: string };
  websocket_error: { symbol: string; error: Error };
  market_analysis_update: MarketAnalysis;
  technical_indicator_update: TechnicalIndicator;
  error_occurred: { error: Error; context: string };
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  timestamp: string;
  requestId?: string;
  source?: "api" | "websocket" | "cache";
  fromCache?: boolean;
}

// ============================================================================
// Subscription Types
// ============================================================================

export const SubscriptionConfigSchema = z.object({
  symbol: z.string(),
  streams: z.array(
    z.enum([
      "trade",
      "kline_1m",
      "kline_5m",
      "kline_1h",
      "kline_1d",
      "ticker",
      "depth",
      "aggTrade",
      "miniTicker",
    ])
  ),
  enablePatternDetection: z.boolean().default(true),
  enablePriceAlerts: z.boolean().default(true),
  enableTechnicalAnalysis: z.boolean().default(true),
  callback: z.function().optional(),
});

export type SubscriptionConfig = z.infer<typeof SubscriptionConfigSchema>;

// ============================================================================
// Cache Types
// ============================================================================

export const CacheEntrySchema = z.object({
  key: z.string(),
  data: z.any(),
  timestamp: z.number(),
  ttl: z.number().positive(),
  hits: z.number().nonnegative().default(0),
  lastAccessed: z.number(),
});

export type CacheEntry = z.infer<typeof CacheEntrySchema>;

export const CacheStatisticsSchema = z.object({
  totalEntries: z.number().nonnegative(),
  totalHits: z.number().nonnegative(),
  totalMisses: z.number().nonnegative(),
  hitRate: z.number().min(0).max(100),
  missRate: z.number().min(0).max(100),
  totalRequests: z.number().nonnegative(),
  memoryUsage: z.number().nonnegative(),
  oldestEntry: z.date().optional(),
  newestEntry: z.date().optional(),
});

export type CacheStatistics = z.infer<typeof CacheStatisticsSchema>;

// ============================================================================
// Export All Types
// ============================================================================
// (Types already exported above via individual export statements)

// Schemas are already exported individually above

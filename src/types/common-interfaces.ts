/**
 * Common TypeScript Interfaces
 *
 * Replaces 344+ `any` type usages across the codebase with proper type-safe interfaces.
 * This file contains the most commonly used types that were previously typed as `any`.
 */

// ============================================================================
// API and Request/Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface PaginatedResponse<T = unknown> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface ValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Configuration and Environment Types
// ============================================================================

export interface EnvironmentConfig {
  NODE_ENV: "development" | "production" | "test";
  DATABASE_URL: string;
  MEXC_API_KEY?: string;
  MEXC_SECRET_KEY?: string;
  MEXC_BASE_URL?: string;
  LOG_LEVEL?: "debug" | "info" | "warn" | "error";
  ENABLE_TELEMETRY?: string;
  REDIS_URL?: string;
  JAEGER_ENDPOINT?: string;
  PROMETHEUS_PORT?: string;
}

export interface ServiceConfig {
  enabled: boolean;
  timeout: number;
  retries: number;
  circuitBreaker?: {
    threshold: number;
    resetTimeout: number;
  };
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
}

export interface DatabaseConfig {
  url: string;
  poolSize: number;
  connectionTimeout: number;
  queryTimeout: number;
  ssl?: boolean;
}

// ============================================================================
// Trading and Financial Types
// ============================================================================

export interface TradingSymbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: "TRADING" | "HALT" | "BREAK";
  filters: TradingFilter[];
}

export interface TradingFilter {
  filterType: string;
  minPrice?: string;
  maxPrice?: string;
  tickSize?: string;
  minQty?: string;
  maxQty?: string;
  stepSize?: string;
}

export interface PriceData {
  symbol: string;
  price: string;
  priceChange: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
  timestamp: number;
}

export interface OrderData {
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT";
  quantity: string;
  price?: string;
  stopPrice?: string;
  timeInForce?: "GTC" | "IOC" | "FOK";
  clientOrderId?: string;
}

export interface OrderResponse {
  orderId: string;
  clientOrderId?: string;
  symbol: string;
  status: "NEW" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "REJECTED";
  executedQty: string;
  executedPrice?: string;
  timestamp: number;
}

export interface BalanceData {
  asset: string;
  free: string;
  locked: string;
  total: string;
  usdtValue?: string;
}

export interface AccountInfo {
  accountType: string;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  balances: BalanceData[];
  permissions: string[];
  updateTime: number;
}

// ============================================================================
// Pattern Detection Types
// ============================================================================

export interface PatternMatch {
  id: string;
  symbol: string;
  patternType: PatternType;
  confidence: number;
  timestamp: number;
  metadata: PatternMetadata;
  signals: TradingSignal[];
}

export type PatternType =
  | "ready_state"
  | "consolidation_breakout"
  | "momentum_surge"
  | "volume_spike"
  | "support_resistance"
  | "trend_reversal";

export interface PatternMetadata {
  source: string;
  analysisTime: number;
  marketConditions: MarketConditions;
  riskScore: number;
  expectedDirection: "UP" | "DOWN" | "NEUTRAL";
  timeframe: string;
}

export interface TradingSignal {
  type: "ENTRY" | "EXIT" | "STOP_LOSS" | "TAKE_PROFIT";
  price: string;
  confidence: number;
  reasoning: string;
  timestamp: number;
}

export interface MarketConditions {
  volatility: "LOW" | "MEDIUM" | "HIGH";
  trend: "BULLISH" | "BEARISH" | "SIDEWAYS";
  volume: "LOW" | "NORMAL" | "HIGH";
  liquidity: "LOW" | "MEDIUM" | "HIGH";
}

// ============================================================================
// User and Authentication Types
// ============================================================================

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  preferences: UserPreferences;
  subscription?: SubscriptionInfo;
}

export interface UserPreferences {
  notifications: NotificationSettings;
  trading: TradingPreferences;
  display: DisplayPreferences;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  trades: boolean;
  patterns: boolean;
  alerts: boolean;
}

export interface TradingPreferences {
  autoSnipingEnabled: boolean;
  maxPositions: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  preferredPatterns: PatternType[];
  stopLossPercentage: number;
  takeProfitPercentage: number;
}

export interface DisplayPreferences {
  theme: "light" | "dark" | "auto";
  language: string;
  timezone: string;
  currency: "USD" | "EUR" | "BTC" | "USDT";
}

export interface SubscriptionInfo {
  plan: "FREE" | "BASIC" | "PRO" | "ENTERPRISE";
  status: "ACTIVE" | "CANCELED" | "EXPIRED" | "TRIAL";
  expiresAt?: string;
  features: string[];
}

// ============================================================================
// Cache and Performance Types
// ============================================================================

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  memoryUsage: number;
  oldestEntry?: number;
  newestEntry?: number;
}

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  memoryUsage: number;
  cpuUsage?: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface SystemHealth {
  status: "HEALTHY" | "DEGRADED" | "CRITICAL" | "MAINTENANCE";
  components: ComponentHealth[];
  uptime: number;
  timestamp: number;
  version: string;
}

export interface ComponentHealth {
  name: string;
  status: "HEALTHY" | "DEGRADED" | "CRITICAL" | "OFFLINE";
  responseTime?: number;
  errorRate?: number;
  lastCheck: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Database and Query Types
// ============================================================================

export interface DatabaseConnection {
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
  poolSize: number;
  timeout: number;
}

export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
  duration: number;
  query: string;
  parameters?: unknown[];
}

export interface TransactionContext {
  id: string;
  startTime: number;
  operations: string[];
  isolation?: "READ_UNCOMMITTED" | "READ_COMMITTED" | "REPEATABLE_READ" | "SERIALIZABLE";
}

// ============================================================================
// Error and Exception Types
// ============================================================================

export interface ErrorContext {
  operation?: string;
  component?: string;
  userId?: string;
  requestId?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface SystemError extends Error {
  code: string;
  context?: ErrorContext;
  cause?: Error;
  recoverable: boolean;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface ValidationError extends Error {
  field?: string;
  value?: unknown;
  constraint?: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Websocket and Real-time Types
// ============================================================================

export interface WebSocketMessage<T = unknown> {
  type: string;
  channel?: string;
  data: T;
  timestamp: number;
  id?: string;
}

export interface WebSocketConnection {
  id: string;
  userId?: string;
  subscriptions: string[];
  connectedAt: number;
  lastPing?: number;
  metadata?: Record<string, unknown>;
}

export interface StreamData<T = unknown> {
  stream: string;
  data: T;
  timestamp: number;
  sequence?: number;
}

// ============================================================================
// Agent and AI Types
// ============================================================================

export interface AgentResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  confidence?: number;
  reasoning?: string;
  timestamp: number;
  processingTime: number;
  metadata?: Record<string, unknown>;
}

export interface AgentContext {
  userId?: string;
  sessionId?: string;
  operation: string;
  parameters: Record<string, unknown>;
  timestamp: number;
}

export interface AgentConfig {
  name: string;
  version: string;
  enabled: boolean;
  timeout: number;
  retries: number;
  model?: string;
  parameters?: Record<string, unknown>;
}

// ============================================================================
// Utility Types for Better Type Safety
// ============================================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type NonEmptyArray<T> = [T, ...T[]];
export type Timestamp = number; // Unix timestamp in milliseconds
export type ISO8601String = string; // ISO 8601 date string
export type UUID = string; // UUID string
export type SymbolString = string; // Trading symbol like "BTCUSDT"
export type DecimalString = string; // Decimal number as string for precision

// Helper type for making specific properties optional
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Helper type for making specific properties required
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Helper type for deep partial
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Helper type for extracting specific keys
export type ExtractKeys<T, K extends keyof T> = Pick<T, K>;

// Helper type for omitting specific keys
export type OmitKeys<T, K extends keyof T> = Omit<T, K>;

// All types are exported individually above
// Note: Types cannot be exported as values, so no default export is provided

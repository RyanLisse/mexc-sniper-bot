/**
 * Application-wide constants and configuration values
 * Extracts magic numbers and hardcoded values for better maintainability
 */

// Time constants in milliseconds
export const TIME_CONSTANTS = {
  SECOND_MS: 1000,
  MINUTE_MS: 60 * 1000,
  HOUR_MS: 60 * 60 * 1000,
  DAY_MS: 24 * 60 * 60 * 1000,
  WEEK_MS: 7 * 24 * 60 * 60 * 1000,
} as const;

// Cache configuration
export const CACHE_CONSTANTS = {
  DEFAULT_TTL_MS: 5 * TIME_CONSTANTS.MINUTE_MS, // 5 minutes
  SHORT_TTL_MS: 1 * TIME_CONSTANTS.MINUTE_MS, // 1 minute
  LONG_TTL_MS: 1 * TIME_CONSTANTS.HOUR_MS, // 1 hour
  AGENT_CACHE_TTL_MS: 5 * TIME_CONSTANTS.MINUTE_MS, // Agent cache duration
} as const;

// Performance monitoring constants
export const PERFORMANCE_CONSTANTS = {
  COLLECTION_INTERVAL_MS: TIME_CONSTANTS.MINUTE_MS, // 1 minute
  MAX_HISTORY_SIZE: 10000,
  METRICS_RETENTION_MS: TIME_CONSTANTS.HOUR_MS, // 1 hour
  CLEANUP_INTERVAL_MS: 10 * TIME_CONSTANTS.MINUTE_MS, // 10 minutes
} as const;

// Trading and market constants
export const TRADING_CONSTANTS = {
  READY_STATE_PATTERN: {
    STS: 2, // Symbol Trading Status: Ready
    ST: 2, // Status: Active
    TT: 4, // Trading Time: Live
  },
  MIN_CONFIDENCE_THRESHOLD: 0.7,
  DEFAULT_RISK_LEVEL: "medium" as const,
  DEFAULT_CAPITAL: 1000,
  PATTERN_CONFIDENCE_THRESHOLD: 70,
} as const;

// API and request constants
export const API_CONSTANTS = {
  DEFAULT_TIMEOUT_MS: 30 * TIME_CONSTANTS.SECOND_MS, // 30 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2 * TIME_CONSTANTS.SECOND_MS, // 2 seconds
  CIRCUIT_BREAKER_THRESHOLD: 5,
  RATE_LIMIT_WINDOW_MS: TIME_CONSTANTS.MINUTE_MS, // 1 minute
} as const;

// Database and pagination constants
export const DATABASE_CONSTANTS = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  QUERY_TIMEOUT_MS: 30 * TIME_CONSTANTS.SECOND_MS, // 30 seconds
  CONNECTION_POOL_SIZE: 10,
} as const;

// WebSocket and real-time constants
export const WEBSOCKET_CONSTANTS = {
  HEARTBEAT_INTERVAL_MS: 30 * TIME_CONSTANTS.SECOND_MS, // 30 seconds
  RECONNECT_DELAY_MS: 5 * TIME_CONSTANTS.SECOND_MS, // 5 seconds
  MAX_RECONNECT_ATTEMPTS: 5,
  MESSAGE_QUEUE_SIZE: 1000,
} as const;

// Alert and notification constants
export const ALERT_CONSTANTS = {
  MAX_ALERTS_PER_HOUR: 100,
  ALERT_AGGREGATION_WINDOW_MS: 5 * TIME_CONSTANTS.MINUTE_MS, // 5 minutes
  NOTIFICATION_RETRY_ATTEMPTS: 3,
  ESCALATION_DELAY_MS: 15 * TIME_CONSTANTS.MINUTE_MS, // 15 minutes
} as const;

// File and data processing constants
export const DATA_CONSTANTS = {
  MAX_FILE_SIZE_MB: 10,
  MAX_ARRAY_LENGTH: 10000,
  DEFAULT_DECIMAL_PLACES: 6,
  PRICE_DECIMAL_PLACES: 4,
  PERCENTAGE_DECIMAL_PLACES: 2,
} as const;

// Security and auth constants
export const SECURITY_CONSTANTS = {
  JWT_EXPIRY_MS: 24 * TIME_CONSTANTS.HOUR_MS, // 24 hours
  REFRESH_TOKEN_EXPIRY_MS: 7 * TIME_CONSTANTS.DAY_MS, // 7 days
  SESSION_TIMEOUT_MS: 2 * TIME_CONSTANTS.HOUR_MS, // 2 hours
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 15 * TIME_CONSTANTS.MINUTE_MS, // 15 minutes
} as const;

// Environment-specific constants
export const ENV_CONSTANTS = {
  DEVELOPMENT: "development",
  PRODUCTION: "production",
  TEST: "test",
} as const;

// Export commonly used combinations
export const COMMON_TIMEOUTS = {
  QUICK: 5 * TIME_CONSTANTS.SECOND_MS, // 5 seconds
  STANDARD: 30 * TIME_CONSTANTS.SECOND_MS, // 30 seconds
  LONG: 2 * TIME_CONSTANTS.MINUTE_MS, // 2 minutes
  EXTENDED: 10 * TIME_CONSTANTS.MINUTE_MS, // 10 minutes
} as const;

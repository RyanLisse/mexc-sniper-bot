/**
 * Application-wide constants
 * Centralized configuration values to avoid magic numbers throughout the codebase
 */

// Time constants (in milliseconds)
export const TIME_CONSTANTS = {
  // Cache TTL values
  AGENT_CACHE_TTL_MS: 10 * 60 * 1000, // 10 minutes
  PATTERN_CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes
  API_RESPONSE_CACHE_TTL_MS: 2 * 60 * 1000, // 2 minutes
  USER_CREDENTIALS_CACHE_TTL_MS: 15 * 60 * 1000, // 15 minutes
  
  // Cleanup and maintenance intervals
  CACHE_CLEANUP_INTERVAL_MS: 10 * 60 * 1000, // 10 minutes
  HEALTH_CHECK_INTERVAL_MS: 30 * 1000, // 30 seconds
  PERFORMANCE_COLLECTION_INTERVAL_MS: 60 * 1000, // 1 minute
  
  // Timeouts
  DEFAULT_API_TIMEOUT_MS: 30 * 1000, // 30 seconds
  MEXC_API_TIMEOUT_MS: 15 * 1000, // 15 seconds
  DATABASE_TIMEOUT_MS: 10 * 1000, // 10 seconds
  
  // Retry delays
  DEFAULT_RETRY_DELAY_MS: 1000, // 1 second
  EXPONENTIAL_BACKOFF_BASE_MS: 1000, // 1 second
  MAX_RETRY_DELAY_MS: 30 * 1000, // 30 seconds
  
  // Circuit breaker
  CIRCUIT_BREAKER_RESET_TIMEOUT_MS: 60 * 1000, // 1 minute
  CIRCUIT_BREAKER_MONITORING_PERIOD_MS: 5 * 60 * 1000, // 5 minutes
} as const;

// Cache constants
export const CACHE_CONSTANTS = {
  // Cache sizes
  MAX_AGENT_CACHE_SIZE: 1000,
  MAX_PATTERN_CACHE_SIZE: 500,
  MAX_API_RESPONSE_CACHE_SIZE: 200,
  
  // Cache TTL values (from TIME_CONSTANTS for consistency)
  AGENT_CACHE_TTL_MS: TIME_CONSTANTS.AGENT_CACHE_TTL_MS,
  PATTERN_CACHE_TTL_MS: TIME_CONSTANTS.PATTERN_CACHE_TTL_MS,
  API_RESPONSE_CACHE_TTL_MS: TIME_CONSTANTS.API_RESPONSE_CACHE_TTL_MS,
} as const;

// Retry configuration constants
export const RETRY_CONSTANTS = {
  DEFAULT_MAX_RETRIES: 3,
  MAX_RETRIES_FOR_NETWORK_ERRORS: 5,
  MAX_RETRIES_FOR_RATE_LIMITS: 3,
  EXPONENTIAL_BACKOFF_MULTIPLIER: 2,
  JITTER_FACTOR: 0.1, // 10% jitter
} as const;

// Circuit breaker constants
export const CIRCUIT_BREAKER_CONSTANTS = {
  DEFAULT_FAILURE_THRESHOLD: 5,
  HIGH_PRIORITY_FAILURE_THRESHOLD: 10,
  RESET_TIMEOUT_MS: TIME_CONSTANTS.CIRCUIT_BREAKER_RESET_TIMEOUT_MS,
  MONITORING_PERIOD_MS: TIME_CONSTANTS.CIRCUIT_BREAKER_MONITORING_PERIOD_MS,
} as const;

// API constants
export const API_CONSTANTS = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MAX_QUERY_LENGTH: 1000,
  REQUEST_ID_LENGTH: 16,
} as const;

// Trading constants
export const TRADING_CONSTANTS = {
  // Risk management
  DEFAULT_MAX_POSITION_SIZE_PERCENT: 5, // 5% of portfolio
  DEFAULT_STOP_LOSS_PERCENT: 10, // 10% stop loss
  MIN_ORDER_AMOUNT: 0.01,
  
  // Multi-phase trading
  DEFAULT_PHASE_COUNT: 4,
  MIN_PROFIT_MULTIPLIER: 1.1, // 10% minimum profit
  MAX_PROFIT_MULTIPLIER: 10.0, // 1000% maximum profit
  
  // Pattern detection
  READY_STATE_SYMBOL_STS: 2,
  READY_STATE_SYMBOL_ST: 2,
  READY_STATE_SYMBOL_TT: 4,
  
  // Price thresholds
  MIN_PRICE_CHANGE_PERCENT_FOR_BREAKOUT: 10,
  MIN_PRICE_CHANGE_PERCENT_FOR_REVERSAL: -10,
  MIN_VOLUME_PERCENTILE_FOR_HIGH_VOLUME: 80,
} as const;

// Agent configuration constants
export const AGENT_CONSTANTS = {
  // OpenAI configuration
  DEFAULT_MODEL: "gpt-4o",
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_MAX_TOKENS: 2000,
  
  // Response sizes
  MAX_RESPONSE_LENGTH: 10000,
  MAX_CONTEXT_MESSAGES: 10,
  
  // Performance thresholds
  MAX_RESPONSE_TIME_MS: 30 * 1000, // 30 seconds
  MIN_CONFIDENCE_SCORE: 0.7, // 70%
  
  // Cache configuration
  ENABLE_CACHE_BY_DEFAULT: true,
  CACHE_HIT_RATE_THRESHOLD: 0.8, // 80%
} as const;

// Database constants
export const DATABASE_CONSTANTS = {
  // Connection pool
  MIN_POOL_SIZE: 2,
  MAX_POOL_SIZE: 20,
  CONNECTION_TIMEOUT_MS: TIME_CONSTANTS.DATABASE_TIMEOUT_MS,
  
  // Query limits
  DEFAULT_QUERY_LIMIT: 50,
  MAX_QUERY_LIMIT: 1000,
  
  // Batch sizes
  DEFAULT_BATCH_SIZE: 100,
  MAX_BATCH_SIZE: 1000,
  
  // Performance thresholds
  SLOW_QUERY_THRESHOLD_MS: 1000, // 1 second
  MAX_QUERY_EXECUTION_TIME_MS: 30 * 1000, // 30 seconds
} as const;

// Monitoring and alerting constants
export const MONITORING_CONSTANTS = {
  // Health check thresholds
  HEALTHY_RESPONSE_TIME_MS: 1000, // 1 second
  WARNING_RESPONSE_TIME_MS: 3000, // 3 seconds
  UNHEALTHY_RESPONSE_TIME_MS: 10000, // 10 seconds
  
  // Error rate thresholds
  HEALTHY_ERROR_RATE: 0.01, // 1%
  WARNING_ERROR_RATE: 0.05, // 5%
  CRITICAL_ERROR_RATE: 0.1, // 10%
  
  // Success rate thresholds
  HEALTHY_SUCCESS_RATE: 0.99, // 99%
  WARNING_SUCCESS_RATE: 0.95, // 95%
  CRITICAL_SUCCESS_RATE: 0.9, // 90%
  
  // Alert frequencies
  IMMEDIATE_ALERT_THRESHOLD: 0.1, // 10% error rate
  HOURLY_SUMMARY_THRESHOLD: 0.05, // 5% error rate
  DAILY_SUMMARY_THRESHOLD: 0.01, // 1% error rate
} as const;

// Security constants
export const SECURITY_CONSTANTS = {
  // Rate limiting
  DEFAULT_RATE_LIMIT_WINDOW_MS: 60 * 1000, // 1 minute
  DEFAULT_RATE_LIMIT_MAX_REQUESTS: 100,
  STRICT_RATE_LIMIT_MAX_REQUESTS: 10,
  
  // Authentication
  SESSION_TIMEOUT_MS: 24 * 60 * 60 * 1000, // 24 hours
  REFRESH_TOKEN_LIFETIME_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
  
  // API key security
  MIN_API_KEY_LENGTH: 16,
  MIN_SECRET_KEY_LENGTH: 32,
  
  // Encryption
  ENCRYPTION_ALGORITHM: "aes-256-gcm",
  SALT_LENGTH: 32,
  IV_LENGTH: 16,
} as const;

// Environment constants
export const ENVIRONMENT_CONSTANTS = {
  DEVELOPMENT: "development",
  STAGING: "staging",
  PRODUCTION: "production",
  TEST: "test",
} as const;

// HTTP status codes (for consistency)
export const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// Validation constants
export const VALIDATION_CONSTANTS = {
  // String lengths
  MIN_USERNAME_LENGTH: 3,
  MAX_USERNAME_LENGTH: 50,
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  
  // Numeric ranges
  MIN_PERCENTAGE: 0,
  MAX_PERCENTAGE: 100,
  MIN_MULTIPLIER: 0.1,
  MAX_MULTIPLIER: 100,
  
  // Patterns
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  SYMBOL_REGEX: /^[A-Z]{2,10}USDT?$/,
  VCOIN_ID_REGEX: /^[a-zA-Z0-9_-]+$/,
} as const;

// File and data size constants
export const SIZE_CONSTANTS = {
  // Memory limits
  MAX_CACHE_SIZE_MB: 100,
  MAX_LOG_FILE_SIZE_MB: 50,
  
  // Request/response limits
  MAX_REQUEST_BODY_SIZE_MB: 10,
  MAX_JSON_RESPONSE_SIZE_MB: 5,
  
  // Batch processing
  MAX_ITEMS_PER_BATCH: 1000,
  MAX_CONCURRENT_OPERATIONS: 10,
} as const;

// Export all constants as a single object for easy importing
export const CONSTANTS = {
  TIME: TIME_CONSTANTS,
  CACHE: CACHE_CONSTANTS,
  RETRY: RETRY_CONSTANTS,
  CIRCUIT_BREAKER: CIRCUIT_BREAKER_CONSTANTS,
  API: API_CONSTANTS,
  TRADING: TRADING_CONSTANTS,
  AGENT: AGENT_CONSTANTS,
  DATABASE: DATABASE_CONSTANTS,
  MONITORING: MONITORING_CONSTANTS,
  SECURITY: SECURITY_CONSTANTS,
  ENVIRONMENT: ENVIRONMENT_CONSTANTS,
  HTTP_STATUS: HTTP_STATUS_CODES,
  VALIDATION: VALIDATION_CONSTANTS,
  SIZE: SIZE_CONSTANTS,
} as const;
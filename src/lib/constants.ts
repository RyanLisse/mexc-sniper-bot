/**
 * Application Constants
 * 
 * Centralized constants file to eliminate magic numbers throughout the codebase.
 * Organized by category for easy maintenance and reference.
 */

// ============================================================================
// Time Constants (in milliseconds)
// ============================================================================

export const TIME_CONSTANTS = {
  /** Basic time units */
  SECOND_MS: 1000,
  MINUTE_MS: 60 * 1000,
  HOUR_MS: 60 * 60 * 1000,
  DAY_MS: 24 * 60 * 60 * 1000,
  WEEK_MS: 7 * 24 * 60 * 60 * 1000,

  /** Common intervals in milliseconds */
  INTERVALS: {
    /** 15 seconds */
    FIFTEEN_SECONDS: 15 * 1000,
    /** 30 seconds */
    THIRTY_SECONDS: 30 * 1000,
    /** 1 minute */
    ONE_MINUTE: 60 * 1000,
    /** 2 minutes */
    TWO_MINUTES: 2 * 60 * 1000,
    /** 5 minutes */
    FIVE_MINUTES: 5 * 60 * 1000,
    /** 10 minutes */
    TEN_MINUTES: 10 * 60 * 1000,
    /** 15 minutes */
    FIFTEEN_MINUTES: 15 * 60 * 1000,
    /** 30 minutes */
    THIRTY_MINUTES: 30 * 60 * 1000,
    /** 1 hour */
    ONE_HOUR: 60 * 60 * 1000,
  } as const,

  /** Timeout values in milliseconds */
  TIMEOUTS: {
    /** Default timeout for operations */
    DEFAULT: 30 * 1000,
    /** Short timeout for quick operations */
    SHORT: 8 * 1000,
    /** Medium timeout for normal operations */
    MEDIUM: 15 * 1000,
    /** Long timeout for heavy operations */
    LONG: 45 * 1000,
    /** Health check timeout */
    HEALTH_CHECK: 8 * 1000,
    /** Workflow timeout */
    WORKFLOW: 120 * 1000,
    /** Circuit breaker recovery timeout */
    CIRCUIT_BREAKER_RECOVERY: 30 * 1000,
  } as const,

  /** Cache TTL values in milliseconds */
  CACHE_TTL: {
    /** 15 seconds - health status */
    HEALTH_STATUS: 15 * 1000,
    /** 30 seconds - performance metrics */
    PERFORMANCE_METRICS: 30 * 1000,
    /** 1 minute - query results */
    QUERY_RESULT: 1 * 60 * 1000,
    /** 2 minutes - API responses */
    API_RESPONSE: 2 * 60 * 1000,
    /** 5 minutes - agent responses */
    AGENT_RESPONSE: 5 * 60 * 1000,
    /** 10 minutes - pattern detection */
    PATTERN_DETECTION: 10 * 60 * 1000,
    /** 15 minutes - workflow results */
    WORKFLOW_RESULT: 15 * 60 * 1000,
    /** 30 minutes - session data */
    SESSION_DATA: 30 * 60 * 1000,
    /** 1 hour - user preferences */
    USER_PREFERENCES: 60 * 60 * 1000,
  } as const,
} as const;

// ============================================================================
// System Configuration Constants
// ============================================================================

export const SYSTEM_CONFIG = {
  /** Agent configuration */
  AGENTS: {
    /** Maximum concurrent agents */
    MAX_CONCURRENT: 10 as number,
    /** Maximum health history size */
    MAX_HEALTH_HISTORY: 100 as number,
    /** Health check interval */
    HEALTH_CHECK_INTERVAL: TIME_CONSTANTS.INTERVALS.THIRTY_SECONDS,
    /** Default retry attempts */
    DEFAULT_RETRY_ATTEMPTS: 3 as number,
    /** Default agent priority */
    DEFAULT_PRIORITY: 1 as number,
    /** Default health score */
    DEFAULT_HEALTH_SCORE: 100 as number,
    /** Default uptime percentage */
    DEFAULT_UPTIME: 100 as number,
  },

  /** Cache configuration */
  CACHE: {
    /** Default cache size */
    DEFAULT_SIZE: 5000,
    /** Global cache size */
    GLOBAL_SIZE: 10000,
    /** L1 cache ratio (percentage of total) */
    L1_RATIO: 0.3,
    /** L2 cache ratio (percentage of total) */
    L2_RATIO: 0.5,
    /** L3 cache ratio (percentage of total) */
    L3_RATIO: 0.2,
    /** LRU cache default size */
    LRU_DEFAULT_SIZE: 1000,
    /** Default cleanup interval */
    CLEANUP_INTERVAL: TIME_CONSTANTS.INTERVALS.TEN_MINUTES,
    /** Global cleanup interval */
    GLOBAL_CLEANUP_INTERVAL: TIME_CONSTANTS.INTERVALS.FIVE_MINUTES,
    /** Maximum historical metrics */
    MAX_HISTORICAL_METRICS: 1000,
    /** Default memory estimate per entry (bytes) */
    DEFAULT_MEMORY_ESTIMATE: 1024,
    /** Maximum promotion candidates */
    MAX_PROMOTION_CANDIDATES: 50,
    /** Minimum access count for promotion */
    MIN_ACCESS_COUNT_FOR_PROMOTION: 5,
  } as const,

  /** Memory and size limits */
  MEMORY: {
    /** Memory warning threshold (100MB) */
    WARNING_THRESHOLD: 100 * 1024 * 1024,
    /** Average memory per cache entry (1KB) */
    AVERAGE_ENTRY_SIZE: 1024,
    /** SHA256 hash substring length */
    HASH_LENGTH: 32,
  } as const,
} as const;

// ============================================================================
// Risk Management Constants
// ============================================================================

export const RISK_CONSTANTS = {
  /** Risk score thresholds (0-100 scale) */
  THRESHOLDS: {
    /** Low risk threshold */
    LOW: 40,
    /** Medium risk threshold */
    MEDIUM: 60,
    /** High risk threshold */
    HIGH: 80,
    /** Critical risk threshold */
    CRITICAL: 90,
    /** Very high risk for trade rejection */
    REJECTION_THRESHOLD: 75,
  } as const,

  /** Position size risk thresholds */
  POSITION_SIZE: {
    /** Position size risk threshold */
    RISK_THRESHOLD: 50,
    /** Position size concentration threshold */
    CONCENTRATION_THRESHOLD: 60,
  } as const,

  /** Market risk thresholds */
  MARKET: {
    /** Market volatility risk threshold */
    VOLATILITY_THRESHOLD: 70,
    /** Emergency volatility threshold */
    EMERGENCY_VOLATILITY: 80,
    /** Emergency liquidity threshold */
    EMERGENCY_LIQUIDITY: 20,
    /** Emergency correlation threshold */
    EMERGENCY_CORRELATION: 0.9,
  } as const,

  /** Health thresholds for agents */
  HEALTH: {
    /** Response time warning threshold (ms) */
    RESPONSE_TIME_WARNING: 3000 as number,
    /** Response time critical threshold (ms) */
    RESPONSE_TIME_CRITICAL: 10000 as number,
    /** Error rate warning threshold (0-1) */
    ERROR_RATE_WARNING: 0.1 as number,
    /** Error rate critical threshold (0-1) */
    ERROR_RATE_CRITICAL: 0.3 as number,
    /** Consecutive errors warning threshold */
    CONSECUTIVE_ERRORS_WARNING: 3 as number,
    /** Consecutive errors critical threshold */
    CONSECUTIVE_ERRORS_CRITICAL: 5 as number,
    /** Uptime warning threshold (percentage) */
    UPTIME_WARNING: 95 as number,
    /** Uptime critical threshold (percentage) */
    UPTIME_CRITICAL: 90 as number,
    /** Memory usage warning threshold (MB) */
    MEMORY_WARNING: 100 as number,
    /** Memory usage critical threshold (MB) */
    MEMORY_CRITICAL: 250 as number,
    /** CPU usage warning threshold (percentage) */
    CPU_WARNING: 70 as number,
    /** CPU usage critical threshold (percentage) */
    CPU_CRITICAL: 90 as number,
  },

  /** System alert thresholds */
  ALERTS: {
    /** Maximum active alerts before warning */
    MAX_ACTIVE_ALERTS: 10 as number,
    /** Unhealthy agent percentage threshold */
    UNHEALTHY_AGENT_PERCENTAGE: 20 as number,
    /** Critical unhealthy percentage */
    CRITICAL_UNHEALTHY_PERCENTAGE: 40 as number,
    /** System response time threshold (ms) */
    SYSTEM_RESPONSE_TIME: 5000 as number,
    /** Critical system response time (ms) */
    CRITICAL_SYSTEM_RESPONSE_TIME: 10000 as number,
    /** System error rate threshold */
    SYSTEM_ERROR_RATE: 0.15 as number,
    /** Recovery attempts threshold */
    RECOVERY_ATTEMPTS_WARNING: 5 as number,
    /** Recovery attempts critical threshold */
    RECOVERY_ATTEMPTS_CRITICAL: 10 as number,
  },
} as const;

// ============================================================================
// Trading Configuration Constants
// ============================================================================

export const TRADING_CONFIG = {
  /** Portfolio limits */
  PORTFOLIO: {
    /** Default maximum portfolio value */
    MAX_VALUE: 100000,
    /** Maximum single position size */
    MAX_SINGLE_POSITION: 10000,
    /** Maximum concurrent positions */
    MAX_CONCURRENT_POSITIONS: 10,
    /** Maximum daily loss */
    MAX_DAILY_LOSS: 2000,
    /** Maximum drawdown percentage */
    MAX_DRAWDOWN: 10,
    /** Portfolio percentage limit (5%) */
    PERCENTAGE_LIMIT: 0.05,
    /** Minimum position size */
    MIN_POSITION_SIZE: 10,
  } as const,

  /** Risk parameters */
  RISK: {
    /** Confidence level for VaR calculations */
    CONFIDENCE_LEVEL: 0.95,
    /** VaR confidence multiplier for 95% */
    VAR_CONFIDENCE_95: 1.645,
    /** VaR confidence multiplier for 99% */
    VAR_CONFIDENCE_99: 1.96,
    /** Expected shortfall ratio */
    EXPECTED_SHORTFALL_RATIO: 1.3,
    /** Lookback period (days) */
    LOOKBACK_PERIOD: 30,
    /** Correlation threshold */
    CORRELATION_THRESHOLD: 0.7,
    /** Volatility multiplier */
    VOLATILITY_MULTIPLIER: 1.5,
    /** High correlation threshold */
    HIGH_CORRELATION: 0.7,
    /** Critical correlation threshold */
    CRITICAL_CORRELATION: 0.8,
  } as const,

  /** Stop loss and take profit settings */
  STOP_LOSS: {
    /** Base stop loss percentage */
    BASE_PERCENTAGE: 0.02,
    /** Minimum stop loss percentage */
    MIN_PERCENTAGE: 0.01,
    /** Maximum stop loss percentage */
    MAX_PERCENTAGE: 0.08,
    /** Volatility adjustment factor */
    VOLATILITY_ADJUSTMENT: 0.03,
    /** Liquidity adjustment factor */
    LIQUIDITY_ADJUSTMENT: 0.02,
    /** Position size adjustment factor */
    POSITION_SIZE_ADJUSTMENT: 0.01,
    /** Invalid threshold (above entry) */
    INVALID_THRESHOLD: 1.0,
    /** Too wide threshold (percentage) */
    TOO_WIDE_THRESHOLD: 50,
    /** Too tight threshold (percentage) */
    TOO_TIGHT_THRESHOLD: 2,
    /** Optimal range minimum (percentage) */
    OPTIMAL_MIN: 5,
    /** Optimal range maximum (percentage) */
    OPTIMAL_MAX: 15,
  } as const,

  /** Take profit settings */
  TAKE_PROFIT: {
    /** Base take profit percentage */
    BASE_PERCENTAGE: 0.05,
    /** Minimum take profit percentage */
    MIN_PERCENTAGE: 0.02,
    /** Maximum take profit percentage */
    MAX_PERCENTAGE: 0.12,
    /** Volatility adjustment factor */
    VOLATILITY_ADJUSTMENT: 0.04,
    /** Bullish market adjustment */
    BULLISH_ADJUSTMENT: 0.02,
    /** Bearish market adjustment */
    BEARISH_ADJUSTMENT: -0.01,
    /** Position size adjustment factor */
    POSITION_SIZE_ADJUSTMENT: 0.015,
  } as const,

  /** Trading state pattern constants */
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

// ============================================================================
// Market Data Constants
// ============================================================================

export const MARKET_DATA = {
  /** Default market conditions */
  DEFAULTS: {
    /** Default volatility index */
    VOLATILITY_INDEX: 50,
    /** Default liquidity index */
    LIQUIDITY_INDEX: 80,
    /** Default order book depth */
    ORDER_BOOK_DEPTH: 100000,
    /** Default bid-ask spread */
    BID_ASK_SPREAD: 0.1,
    /** Default trading volume (24h) */
    TRADING_VOLUME_24H: 1000000,
    /** Default price change (24h) */
    PRICE_CHANGE_24H: 0,
    /** Default correlation risk */
    CORRELATION_RISK: 0.3,
  } as const,

  /** Liquidity thresholds */
  LIQUIDITY: {
    /** Extreme spread threshold */
    EXTREME_SPREAD: 0.2,
    /** High spread threshold */
    HIGH_SPREAD: 0.1,
    /** Thin order book threshold */
    THIN_ORDER_BOOK: 500,
    /** Low volume threshold */
    LOW_VOLUME: 100000,
    /** Minimum market maker threshold */
    MIN_MARKET_MAKER: 100,
  } as const,

  /** Flash crash detection */
  FLASH_CRASH: {
    /** Minimum price drop percentage */
    MIN_PRICE_DROP: 10,
    /** Minimum volume spike multiplier */
    MIN_VOLUME_SPIKE: 3,
    /** Minimum data points for detection */
    MIN_DATA_POINTS: 3,
    /** Critical drop threshold */
    CRITICAL_DROP: 30,
    /** High drop threshold */
    HIGH_DROP: 20,
    /** Medium drop threshold */
    MEDIUM_DROP: 15,
  } as const,
} as const;

// ============================================================================
// Performance and API Constants
// ============================================================================

export const API_CONSTANTS = {
  DEFAULT_TIMEOUT_MS: 30 * TIME_CONSTANTS.SECOND_MS, // 30 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2 * TIME_CONSTANTS.SECOND_MS, // 2 seconds
  CIRCUIT_BREAKER_THRESHOLD: 5,
  RATE_LIMIT_WINDOW_MS: TIME_CONSTANTS.MINUTE_MS, // 1 minute
  /** Circuit breaker settings */
  CIRCUIT_BREAKER: {
    /** Default failure threshold */
    FAILURE_THRESHOLD: 3,
    /** Expected failure rate */
    EXPECTED_FAILURE_RATE: 0.1,
  } as const,
} as const;

export const PERFORMANCE_CONSTANTS = {
  COLLECTION_INTERVAL_MS: TIME_CONSTANTS.MINUTE_MS, // 1 minute
  MAX_HISTORY_SIZE: 10000,
  METRICS_RETENTION_MS: TIME_CONSTANTS.HOUR_MS, // 1 hour
  CLEANUP_INTERVAL_MS: 10 * TIME_CONSTANTS.MINUTE_MS, // 10 minutes
  /** Cache performance thresholds */
  CACHE: {
    /** Low hit rate threshold */
    LOW_HIT_RATE: 60,
    /** Excellent hit rate threshold */
    EXCELLENT_HIT_RATE: 90,
    /** Poor type hit rate threshold */
    POOR_TYPE_HIT_RATE: 50,
    /** High access time threshold (ms) */
    HIGH_ACCESS_TIME: 10,
    /** Near capacity threshold */
    NEAR_CAPACITY: 0.9,
  } as const,
} as const;

// ============================================================================
// Database and Data Processing Constants
// ============================================================================

export const DATABASE_CONSTANTS = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  QUERY_TIMEOUT_MS: 30 * TIME_CONSTANTS.SECOND_MS, // 30 seconds
  CONNECTION_POOL_SIZE: 10,
} as const;

export const DATA_CONSTANTS = {
  MAX_FILE_SIZE_MB: 10,
  MAX_ARRAY_LENGTH: 10000,
  DEFAULT_DECIMAL_PLACES: 6,
  PRICE_DECIMAL_PLACES: 4,
  PERCENTAGE_DECIMAL_PLACES: 2,
  /** History and sample sizes */
  HISTORY: {
    /** Recent checks for error rate calculation */
    RECENT_CHECKS: 20 as number,
    /** Top accessed keys limit */
    TOP_KEYS_LIMIT: 10 as number,
    /** Last N checks for trend analysis */
    LAST_N_CHECKS: 5 as number,
  },
} as const;

// ============================================================================
// WebSocket and Communication Constants
// ============================================================================

export const WEBSOCKET_CONSTANTS = {
  HEARTBEAT_INTERVAL_MS: 30 * TIME_CONSTANTS.SECOND_MS, // 30 seconds
  RECONNECT_DELAY_MS: 5 * TIME_CONSTANTS.SECOND_MS, // 5 seconds
  MAX_RECONNECT_ATTEMPTS: 5,
  MESSAGE_QUEUE_SIZE: 1000,
} as const;

export const ALERT_CONSTANTS = {
  MAX_ALERTS_PER_HOUR: 100,
  ALERT_AGGREGATION_WINDOW_MS: 5 * TIME_CONSTANTS.MINUTE_MS, // 5 minutes
  NOTIFICATION_RETRY_ATTEMPTS: 3,
  ESCALATION_DELAY_MS: 15 * TIME_CONSTANTS.MINUTE_MS, // 15 minutes
} as const;

// ============================================================================
// Security Constants
// ============================================================================

export const SECURITY_CONSTANTS = {
  JWT_EXPIRY_MS: 24 * TIME_CONSTANTS.HOUR_MS, // 24 hours
  REFRESH_TOKEN_EXPIRY_MS: 7 * TIME_CONSTANTS.DAY_MS, // 7 days
  SESSION_TIMEOUT_MS: 2 * TIME_CONSTANTS.HOUR_MS, // 2 hours
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 15 * TIME_CONSTANTS.MINUTE_MS, // 15 minutes
} as const;

// ============================================================================
// Environment and Legacy Constants
// ============================================================================

export const ENV_CONSTANTS = {
  DEVELOPMENT: "development",
  PRODUCTION: "production",
  TEST: "test",
} as const;

// Export commonly used combinations for backward compatibility
export const COMMON_TIMEOUTS = {
  QUICK: 5 * TIME_CONSTANTS.SECOND_MS, // 5 seconds
  STANDARD: 30 * TIME_CONSTANTS.SECOND_MS, // 30 seconds
  LONG: 2 * TIME_CONSTANTS.MINUTE_MS, // 2 minutes
  EXTENDED: 10 * TIME_CONSTANTS.MINUTE_MS, // 10 minutes
} as const;

// Backward compatibility aliases
export const CACHE_CONSTANTS = {
  DEFAULT_TTL_MS: TIME_CONSTANTS.CACHE_TTL.API_RESPONSE,
  SHORT_TTL_MS: TIME_CONSTANTS.CACHE_TTL.QUERY_RESULT,
  LONG_TTL_MS: TIME_CONSTANTS.CACHE_TTL.USER_PREFERENCES,
  AGENT_CACHE_TTL_MS: TIME_CONSTANTS.CACHE_TTL.AGENT_RESPONSE,
} as const;

export const TRADING_CONSTANTS = TRADING_CONFIG;

// ============================================================================
// Type-safe constant access helpers
// ============================================================================

/**
 * Get timeout value by name with fallback to default
 */
export function getTimeout(name: keyof typeof TIME_CONSTANTS.TIMEOUTS): number {
  return TIME_CONSTANTS.TIMEOUTS[name] || TIME_CONSTANTS.TIMEOUTS.DEFAULT;
}

/**
 * Get cache TTL by data type with fallback to default
 */
export function getCacheTTL(type: keyof typeof TIME_CONSTANTS.CACHE_TTL): number {
  return TIME_CONSTANTS.CACHE_TTL[type] || TIME_CONSTANTS.CACHE_TTL.API_RESPONSE;
}

/**
 * Get risk threshold by level
 */
export function getRiskThreshold(level: keyof typeof RISK_CONSTANTS.THRESHOLDS): number {
  return RISK_CONSTANTS.THRESHOLDS[level];
}

/**
 * Check if risk score exceeds threshold
 */
export function isRiskAboveThreshold(riskScore: number, threshold: keyof typeof RISK_CONSTANTS.THRESHOLDS): boolean {
  return riskScore > getRiskThreshold(threshold);
}

// ============================================================================
// Export all constants as a single object for easy access
// ============================================================================

export const CONSTANTS = {
  TIME: TIME_CONSTANTS,
  SYSTEM: SYSTEM_CONFIG,
  RISK: RISK_CONSTANTS,
  TRADING: TRADING_CONFIG,
  MARKET: MARKET_DATA,
  API: API_CONSTANTS,
  PERFORMANCE: PERFORMANCE_CONSTANTS,
  DATABASE: DATABASE_CONSTANTS,
  DATA: DATA_CONSTANTS,
  WEBSOCKET: WEBSOCKET_CONSTANTS,
  ALERT: ALERT_CONSTANTS,
  SECURITY: SECURITY_CONSTANTS,
  ENV: ENV_CONSTANTS,
} as const;

export default CONSTANTS;

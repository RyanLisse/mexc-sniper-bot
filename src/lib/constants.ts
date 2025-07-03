/**
 * Simple Constants
 */

export const TIME_CONSTANTS = {
  SECOND_MS: 1000,
  MINUTE_MS: 60 * 1000,
  HOUR_MS: 60 * 60 * 1000,
} as const;

export const CACHE_CONSTANTS = {
  DEFAULT_TTL: 5 * 60 * 1000, // 5 minutes
  MAX_SIZE: 1000,
  CLEANUP_INTERVAL: 10 * 60 * 1000, // 10 minutes
} as const;

export const PERFORMANCE_CONSTANTS = {
  MAX_RESPONSE_TIME: 5000,
  DEFAULT_TIMEOUT: 30000,
  MAX_RETRIES: 3,
  BATCH_SIZE: 100,
} as const;
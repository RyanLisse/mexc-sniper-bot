/**
 * Unified MEXC Service Configuration
 *
 * Configuration types, defaults, and interfaces for the MEXC service v2.
 * Extracted from unified-mexc-service-v2.ts for better modularity.
 */

import type {
  MexcApiConfig,
  MexcCacheConfig,
  MexcReliabilityConfig,
} from "../data/modules/mexc-api-types";

// ============================================================================
// Configuration Types
// ============================================================================

export interface UnifiedMexcConfigV2 extends MexcApiConfig, MexcCacheConfig, MexcReliabilityConfig {
  enableEnhancedFeatures?: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_CONFIG: Required<UnifiedMexcConfigV2> = {
  // API Configuration
  apiKey: process.env.MEXC_API_KEY || "",
  secretKey: process.env.MEXC_SECRET_KEY || "",
  passphrase: process.env.MEXC_PASSPHRASE || "",
  baseUrl: "https://api.mexc.com",
  timeout: 10000,
  maxRetries: 3,
  retryDelay: 1000,
  rateLimitDelay: 100,

  // Cache Configuration
  enableCaching: true,
  cacheTTL: 30000,
  apiResponseTTL: 1500,

  // Reliability Configuration
  enableCircuitBreaker: true,
  enableRateLimiter: true,
  maxFailures: 5,
  resetTimeout: 60000,

  // Feature Flags
  enableEnhancedFeatures: true,
};

// ============================================================================
// Configuration Utilities
// ============================================================================

/**
 * Merge user config with defaults
 */
export function mergeConfig(
  userConfig: Partial<UnifiedMexcConfigV2> = {}
): Required<UnifiedMexcConfigV2> {
  return { ...DEFAULT_CONFIG, ...userConfig };
}

/**
 * Validate configuration
 */
export function validateConfig(config: UnifiedMexcConfigV2): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.baseUrl || !config.baseUrl.startsWith("http")) {
    errors.push("Invalid baseUrl: must be a valid HTTP URL");
  }

  if (config.timeout <= 0) {
    errors.push("Invalid timeout: must be greater than 0");
  }

  if (config.maxRetries < 0) {
    errors.push("Invalid maxRetries: must be >= 0");
  }

  if (config.retryDelay < 0) {
    errors.push("Invalid retryDelay: must be >= 0");
  }

  if (config.cacheTTL < 0) {
    errors.push("Invalid cacheTTL: must be >= 0");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if API credentials are configured
 */
export function hasValidCredentials(config: UnifiedMexcConfigV2): boolean {
  return Boolean(
    config.apiKey && config.secretKey && config.apiKey.length > 0 && config.secretKey.length > 0
  );
}

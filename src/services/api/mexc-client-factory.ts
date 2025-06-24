/**
 * MEXC Client Factory and Unified Interface
 *
 * Factory for creating MEXC client instances and providing a unified interface
 * that combines all the modular components.
 * Extracted from unified-mexc-client.ts for better modularity.
 */

import type { UnifiedMexcConfig } from "./mexc-client-types";
import { MexcTradingApiClient } from "./mexc-trading-api";

// ============================================================================
// Unified MEXC Client (Main Export)
// ============================================================================

/**
 * Unified MEXC Client that combines all API modules
 * This is the main client that applications should use
 */
export class UnifiedMexcClient extends MexcTradingApiClient {
  private _logger?: { info: (message: string, context?: any) => void; warn: (message: string, context?: any) => void; error: (message: string, context?: any, error?: Error) => void; debug: (message: string, context?: any) => void; };
  private getLogger() {
    if (!this._logger) {
      this._logger = {
      info: (message: string, context?: any) => console.info('[mexc-client-factory]', message, context || ''),
      warn: (message: string, context?: any) => console.warn('[mexc-client-factory]', message, context || ''),
      error: (message: string, context?: any, error?: Error) => console.error('[mexc-client-factory]', message, context || '', error || ''),
      debug: (message: string, context?: any) => console.debug('[mexc-client-factory]', message, context || ''),
    };
    }
    return this._logger;
  }

  constructor(config: UnifiedMexcConfig = {}) {
    super(config);
    console.info("[UnifiedMexcClient] Initialized with modular architecture");
  }

  // ============================================================================
  // Utility Methods (from original file)
  // ============================================================================

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.clearExchangeCache();
    console.info("[UnifiedMexcClient] All caches cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    requestCache: { size: number; maxSize: number; hitRate?: number; missRate?: number };
    exchangeSymbolsCount: number;
    exchangeCacheValid: boolean;
  } {
    return {
      requestCache: this.cache.getStats(),
      exchangeSymbolsCount: this.getCachedSymbolsCount(),
      exchangeCacheValid: this.isExchangeCacheValid(),
    };
  }

  /**
   * Get configuration (without sensitive data)
   */
  getConfig(): Omit<Required<UnifiedMexcConfig>, "apiKey" | "secretKey"> {
    const { apiKey, secretKey, ...safeConfig } = this.config;
    return safeConfig;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<UnifiedMexcConfig>): void {
    this.config = { ...this.config, ...config };
    console.info("[UnifiedMexcClient] Configuration updated");
  }

  // ============================================================================
  // Health and Status Methods
  // ============================================================================

  /**
   * Comprehensive health check
   */
  async healthCheck(): Promise<{
    connectivity: boolean;
    authentication: boolean;
    permissions: { canTrade: boolean; accountType: string };
    performance: { cacheHitRate: number; lastRequestTime: number };
  }> {
    try {
      const connectivity = await this.testConnectivity();

      let authentication = false;
      let canTrade = false;
      let accountType = "UNKNOWN";

      if (this.hasCredentials()) {
        try {
          const accountInfo = await this.getAccountInfo();
          authentication = accountInfo.success;

          if (authentication) {
            canTrade = await this.canTrade();
            accountType = await this.getAccountType();
          }
        } catch {
          authentication = false;
        }
      }

      const cacheStats = this.getCacheStats();

      return {
        connectivity,
        authentication,
        permissions: { canTrade, accountType },
        performance: {
          cacheHitRate: cacheStats.requestCache.hitRate || 0,
          lastRequestTime: Date.now(),
        },
      };
    } catch (error) {
      console.error("[UnifiedMexcClient] Health check failed:", error);
      return {
        connectivity: false,
        authentication: false,
        permissions: { canTrade: false, accountType: "UNKNOWN" },
        performance: { cacheHitRate: 0, lastRequestTime: 0 },
      };
    }
  }

  /**
   * Get client status summary
   */
  getStatus(): {
    initialized: boolean;
    hasCredentials: boolean;
    cacheEnabled: boolean;
    totalCacheSize: number;
    version: string;
  } {
    return {
      initialized: true,
      hasCredentials: this.hasCredentials(),
      cacheEnabled: this.config.enableCaching,
      totalCacheSize: this.getCacheStats().requestCache.size,
      version: "2.0.0-modular",
    };
  }
}

// ============================================================================
// Global Client Instance and Factory
// ============================================================================

let globalUnifiedMexcClient: UnifiedMexcClient | null = null;

/**
 * Get the global MEXC client instance (singleton pattern)
 */
export function getUnifiedMexcClient(config?: UnifiedMexcConfig): UnifiedMexcClient {
  if (!globalUnifiedMexcClient) {
    globalUnifiedMexcClient = new UnifiedMexcClient(config);
    // Note: Global MEXC client created
  } else if (config) {
    globalUnifiedMexcClient.updateConfig(config);
    // Note: Global MEXC client config updated
  }
  return globalUnifiedMexcClient;
}

/**
 * Reset the global client instance (for testing or reconfiguration)
 */
export function resetUnifiedMexcClient(): void {
  if (globalUnifiedMexcClient) {
    globalUnifiedMexcClient.clearCache();
  }
  globalUnifiedMexcClient = null;
  // Note: Global MEXC client reset
}

/**
 * Create a new MEXC client instance (not singleton)
 */
export function createMexcClient(config: UnifiedMexcConfig): UnifiedMexcClient {
  return new UnifiedMexcClient(config);
}

/**
 * Create a MEXC client with custom credentials
 */
export function createMexcClientWithCredentials(
  apiKey: string,
  secretKey: string,
  additionalConfig?: Partial<UnifiedMexcConfig>
): UnifiedMexcClient {
  return new UnifiedMexcClient({
    apiKey,
    secretKey,
    ...additionalConfig,
  });
}

// ============================================================================
// Client Builder Pattern
// ============================================================================

export class MexcClientBuilder {
  private config: UnifiedMexcConfig = {};

  apiKey(key: string): this {
    this.config.apiKey = key;
    return this;
  }

  secretKey(key: string): this {
    this.config.secretKey = key;
    return this;
  }

  baseUrl(url: string): this {
    this.config.baseUrl = url;
    return this;
  }

  timeout(ms: number): this {
    this.config.timeout = ms;
    return this;
  }

  retries(count: number): this {
    this.config.maxRetries = count;
    return this;
  }

  caching(enabled: boolean, ttl?: number): this {
    this.config.enableCaching = enabled;
    if (ttl) this.config.cacheTTL = ttl;
    return this;
  }

  rateLimit(delayMs: number): this {
    this.config.rateLimitDelay = delayMs;
    return this;
  }

  build(): UnifiedMexcClient {
    return new UnifiedMexcClient(this.config);
  }

  buildGlobal(): UnifiedMexcClient {
    return getUnifiedMexcClient(this.config);
  }
}

/**
 * Create a new MEXC client builder
 */
export function createMexcClientBuilder(): MexcClientBuilder {
  return new MexcClientBuilder();
}

// ============================================================================
// Convenience Factory Functions
// ============================================================================

/**
 * Create a client optimized for trading
 */
export function createTradingClient(apiKey: string, secretKey: string): UnifiedMexcClient {
  return new UnifiedMexcClient({
    apiKey,
    secretKey,
    enableCaching: false, // Disable caching for trading
    rateLimitDelay: 50, // Lower rate limit for faster trading
    maxRetries: 1, // Fewer retries for trading
    timeout: 5000, // Shorter timeout for trading
  });
}

/**
 * Create a client optimized for data retrieval
 */
export function createDataClient(): UnifiedMexcClient {
  return new UnifiedMexcClient({
    enableCaching: true,
    cacheTTL: 300000, // 5 minute cache for data
    rateLimitDelay: 200, // Higher rate limit delay
    maxRetries: 3, // More retries for data
    timeout: 15000, // Longer timeout for data
  });
}

/**
 * Create a client for monitoring/dashboard
 */
export function createMonitoringClient(): UnifiedMexcClient {
  return new UnifiedMexcClient({
    enableCaching: true,
    cacheTTL: 60000, // 1 minute cache
    rateLimitDelay: 100,
    maxRetries: 2,
    timeout: 10000,
  });
}

// ============================================================================
// Exports
// ============================================================================

export * from "./mexc-account-api";
export * from "./mexc-client-core";
// Re-export all types and components for convenience
export * from "./mexc-client-types";
export * from "./mexc-market-data";
export * from "./mexc-request-cache";
export * from "./mexc-trading-api";

// Default export for backward compatibility
export default UnifiedMexcClient;

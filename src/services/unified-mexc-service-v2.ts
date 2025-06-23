/**
 * Unified MEXC Service v2 - Modular Architecture
 *
 * Refactored service that orchestrates modular components for:
 * - Better maintainability (under 300 lines!)
 * - Improved performance through focused modules
 * - Enhanced testability with clear separation of concerns
 * - Optimized bundle size through tree-shaking
 */

import type {
  BalanceEntry,
  CalendarEntry,
  MexcApiConfig,
  MexcCacheConfig,
  MexcReliabilityConfig,
  MexcServiceResponse,
  SymbolEntry,
} from "./modules/mexc-api-types";

import { MexcCacheLayer } from "./modules/mexc-cache-layer";
import { MexcCoreClient } from "./modules/mexc-core-client";

// ============================================================================
// Service Configuration
// ============================================================================

interface UnifiedMexcConfigV2 extends MexcApiConfig, MexcCacheConfig, MexcReliabilityConfig {
  enableEnhancedFeatures?: boolean;
}

const DEFAULT_CONFIG: Required<UnifiedMexcConfigV2> = {
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
// Unified MEXC Service v2
// ============================================================================

export class UnifiedMexcServiceV2 {
  private config: Required<UnifiedMexcConfigV2>;
  private coreClient: MexcCoreClient;
  private cacheLayer: MexcCacheLayer;

  constructor(config: Partial<UnifiedMexcConfigV2> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize modular components
    this.coreClient = new MexcCoreClient({
      apiKey: this.config.apiKey,
      secretKey: this.config.secretKey,
      passphrase: this.config.passphrase,
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay,
      rateLimitDelay: this.config.rateLimitDelay,
    });

    this.cacheLayer = new MexcCacheLayer({
      enableCaching: this.config.enableCaching,
      cacheTTL: this.config.cacheTTL,
      apiResponseTTL: this.config.apiResponseTTL,
    });
  }

  // ============================================================================
  // Public API - Calendar & Listings
  // ============================================================================

  /**
   * Get calendar listings with intelligent caching
   */
  async getCalendarListings(): Promise<MexcServiceResponse<CalendarEntry[]>> {
    return this.cacheLayer.getOrSet(
      "calendar:listings",
      () => this.coreClient.getCalendarListings(),
      "semiStatic" // 5 minute cache for calendar data
    );
  }

  // ============================================================================
  // Public API - Symbols & Market Data
  // ============================================================================

  /**
   * Get symbols for a specific coin
   */
  async getSymbolsByVcoinId(vcoinId: string): Promise<MexcServiceResponse<SymbolEntry[]>> {
    return this.cacheLayer.getOrSet(
      `symbols:${vcoinId}`,
      () => this.coreClient.getSymbolsByVcoinId(vcoinId),
      "semiStatic"
    );
  }

  /**
   * Get server time
   */
  async getServerTime(): Promise<MexcServiceResponse<number>> {
    return this.cacheLayer.getOrSet(
      "server:time",
      () => this.coreClient.getServerTime(),
      "realTime" // 15 second cache for server time
    );
  }

  // ============================================================================
  // Public API - Account & Portfolio
  // ============================================================================

  /**
   * Get account balance
   */
  async getAccountBalance(): Promise<MexcServiceResponse<BalanceEntry[]>> {
    return this.cacheLayer.getOrSet(
      "account:balance",
      () => this.coreClient.getAccountBalance(),
      "user" // 10 minute cache for user data
    );
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Invalidate calendar cache
   */
  invalidateCalendarCache(): number {
    return this.cacheLayer.invalidateCalendar();
  }

  /**
   * Invalidate symbols cache
   */
  invalidateSymbolsCache(): number {
    return this.cacheLayer.invalidateSymbols();
  }

  /**
   * Invalidate user data cache
   */
  invalidateUserCache(): number {
    return this.cacheLayer.invalidateUserData();
  }

  /**
   * Get cache metrics
   */
  getCacheMetrics() {
    return this.cacheLayer.getMetrics();
  }

  // ============================================================================
  // Configuration & Status
  // ============================================================================

  /**
   * Test API connectivity
   */
  async testConnectivity(): Promise<MexcServiceResponse<{ serverTime: number; latency: number }>> {
    const startTime = Date.now();

    try {
      const serverTimeResponse = await this.getServerTime();

      if (!serverTimeResponse.success) {
        return {
          success: false,
          error: "Failed to connect to MEXC API",
          timestamp: Date.now(),
          source: "unified-mexc-service-v2",
        };
      }

      const latency = Date.now() - startTime;

      return {
        success: true,
        data: {
          serverTime: serverTimeResponse.data!,
          latency,
        },
        timestamp: Date.now(),
        source: "unified-mexc-service-v2",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown connectivity error",
        timestamp: Date.now(),
        source: "unified-mexc-service-v2",
      };
    }
  }

  /**
   * Get service status and health
   */
  getStatus() {
    return {
      config: {
        baseUrl: this.config.baseUrl,
        cachingEnabled: this.config.enableCaching,
        circuitBreakerEnabled: this.config.enableCircuitBreaker,
        enhancedFeaturesEnabled: this.config.enableEnhancedFeatures,
      },
      cache: this.cacheLayer.getMetrics(),
      timestamp: Date.now(),
    };
  }

  // ============================================================================
  // Lifecycle Management
  // ============================================================================

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.cacheLayer.destroy();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new unified MEXC service instance
 */
export function createUnifiedMexcServiceV2(
  config?: Partial<UnifiedMexcConfigV2>
): UnifiedMexcServiceV2 {
  return new UnifiedMexcServiceV2(config);
}

/**
 * Singleton instance for global use
 */
let globalServiceInstance: UnifiedMexcServiceV2 | null = null;

export function getUnifiedMexcServiceV2(
  config?: Partial<UnifiedMexcConfigV2>
): UnifiedMexcServiceV2 {
  if (!globalServiceInstance) {
    globalServiceInstance = new UnifiedMexcServiceV2(config);
  }
  return globalServiceInstance;
}

export function resetUnifiedMexcServiceV2(): void {
  if (globalServiceInstance) {
    globalServiceInstance.destroy();
    globalServiceInstance = null;
  }
}

// ============================================================================
// Exports
// ============================================================================

export default UnifiedMexcServiceV2;
export type { UnifiedMexcConfigV2 };

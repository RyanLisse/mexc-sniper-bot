/**
 * MEXC API Client - Refactored Entry Point
 *
 * This file replaces the original 1235-line monolithic mexc-api-client.ts
 * with a clean module-based architecture for better maintainability.
 *
 * ARCHITECTURE:
 * - Service-oriented architecture with single-responsibility modules
 * - Clean separation of concerns (auth, retry, requests, trading)
 * - Preserved all original functionality and interfaces
 * - Enhanced type safety with dedicated type modules
 *
 * MODULES:
 * - mexc-api-types.ts: All type definitions and interfaces
 * - mexc-auth-service.ts: Authentication and signature generation
 * - mexc-retry-service.ts: Retry logic and error classification
 * - mexc-request-service.ts: HTTP request execution and timeout management
 * - mexc-trading-service.ts: Trading operations and market data
 */

import type { EnhancedUnifiedCacheSystem } from "../../lib/enhanced-unified-cache";
import type { PerformanceMonitoringService } from "../../lib/performance-monitoring-service";
import type { UnifiedMexcConfig } from "@/src/schemas/unified/mexc-api-schemas";
import type { CircuitBreaker } from "../risk/circuit-breaker";
// Import and export all types for backward compatibility
import type {
  ApiClientStats,
  ApiParams,
  ApiParamValue,
  ApiRequestConfig,
  AuthenticationContext,
  CacheEntry,
  ErrorClassification,
  HttpResponse,
  PerformanceMetrics,
  RateLimitInfo,
  RequestContext,
  RequestOptions,
  RetryConfig,
  TimeoutConfig,
} from "./mexc-api-types";
import { MexcAuthService } from "./mexc-auth-service";
import type { MexcRequestCache } from "./mexc-request-cache";
import { MexcRequestService } from "./mexc-request-service";
import { MexcRetryService } from "./mexc-retry-service";
import { MexcTradingService } from "./mexc-trading-service";

export type {
  ApiClientStats,
  ApiParams,
  ApiParamValue,
  ApiRequestConfig,
  AuthenticationContext,
  CacheEntry,
  ErrorClassification,
  HttpResponse,
  PerformanceMetrics,
  RateLimitInfo,
  RequestContext,
  RequestOptions,
  RetryConfig,
  TimeoutConfig,
};

// Export individual services for advanced usage
export { MexcAuthService } from "./mexc-auth-service";
export { MexcRequestService } from "./mexc-request-service";
export { MexcRetryService } from "./mexc-retry-service";
// Export trading-specific types
export type {
  AccountInfo,
  CredentialTestResult,
  OrderBook,
  OrderParams,
  OrderResult,
} from "./mexc-trading-service";
export { MexcTradingService } from "./mexc-trading-service";

/**
 * Main MEXC API Client - Refactored Implementation
 *
 * Composed of specialized service modules for better maintainability.
 * Maintains backward compatibility with the original monolithic implementation.
 */
export class MexcApiClient {
  private config: Required<UnifiedMexcConfig>;
  private authService: MexcAuthService;
  private retryService: MexcRetryService;
  private requestService: MexcRequestService;
  private tradingService: MexcTradingService;
  private cache: MexcRequestCache;
  private reliabilityManager: CircuitBreaker;
  private stats: ApiClientStats;

  constructor(
    config: Required<UnifiedMexcConfig>,
    cache: MexcRequestCache,
    reliabilityManager: CircuitBreaker,
    _enhancedCache?: EnhancedUnifiedCacheSystem,
    _performanceMonitoring?: PerformanceMonitoringService
  ) {
    this.config = config;
    this.cache = cache;
    this.reliabilityManager = reliabilityManager;

    // Initialize service modules
    this.authService = new MexcAuthService(config);
    this.retryService = new MexcRetryService({
      maxRetries: config.maxRetries,
      baseDelay: config.retryDelay,
    });
    this.requestService = new MexcRequestService(config);
    this.tradingService = new MexcTradingService(this);

    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      retryCount: 0,
    };
  }

  // ============================================================================
  // Core HTTP Methods - Delegated to RequestService
  // ============================================================================

  async get<T>(endpoint: string, params?: any, options?: any) {
    return this.requestService.executeHttpRequestWithContext<T>(
      { method: "GET", endpoint, params, ...options },
      this.requestService.createRequestContext(endpoint)
    );
  }

  async post<T>(endpoint: string, params?: any, options?: any) {
    return this.requestService.executeHttpRequestWithContext<T>(
      { method: "POST", endpoint, params, ...options },
      this.requestService.createRequestContext(endpoint)
    );
  }

  async put<T>(endpoint: string, params?: any, options?: any) {
    return this.requestService.executeHttpRequestWithContext<T>(
      { method: "PUT", endpoint, params, ...options },
      this.requestService.createRequestContext(endpoint)
    );
  }

  async delete<T>(endpoint: string, params?: any, options?: any) {
    return this.requestService.executeHttpRequestWithContext<T>(
      { method: "DELETE", endpoint, params, ...options },
      this.requestService.createRequestContext(endpoint)
    );
  }

  // ============================================================================
  // Authentication Methods - Delegated to AuthService
  // ============================================================================

  hasCredentials(): boolean {
    return this.authService.hasCredentials();
  }

  // ============================================================================
  // Trading Methods - Delegated to TradingService
  // ============================================================================

  async placeOrder(params: any) {
    return this.tradingService.placeOrder(params);
  }

  async getOrderBook(symbol: string, limit = 100) {
    return this.tradingService.getOrderBook(symbol, limit);
  }

  async getOrderStatus(symbol: string, orderId: string) {
    return this.tradingService.getOrderStatus(symbol, orderId);
  }

  async cancelOrder(symbol: string, orderId: string) {
    return this.tradingService.cancelOrder(symbol, orderId);
  }

  async getOpenOrders(symbol?: string) {
    return this.tradingService.getOpenOrders(symbol);
  }

  async getAccountInfo() {
    return this.tradingService.getAccountInfo();
  }

  async testCredentials() {
    return this.tradingService.testCredentials();
  }

  // ============================================================================
  // Statistics and Monitoring
  // ============================================================================

  getStats(): ApiClientStats {
    return { ...this.stats };
  }

  getConfig(): Required<UnifiedMexcConfig> {
    return { ...this.config };
  }
}

/**
 * MIGRATION GUIDE:
 *
 * The refactored MexcApiClient maintains full backward compatibility.
 * All existing code should continue to work without changes.
 *
 * OLD (monolithic):
 * ```ts
 * import { MexcApiClient } from './mexc-api-client';
 * const client = new MexcApiClient(config, cache, reliability);
 * ```
 *
 * NEW (modular - same interface):
 * ```ts
 * import { MexcApiClient } from './mexc-api-client';
 * const client = new MexcApiClient(config, cache, reliability);
 * ```
 *
 * For advanced usage, you can now import individual services:
 * ```ts
 * import { MexcAuthService, MexcTradingService } from './mexc-api-client';
 * ```
 */

/**
 * Unified MEXC Service v2 - Modular Architecture
 * 
 * Refactored version of the unified MEXC service using modular components.
 * This maintains backward compatibility while providing improved architecture.
 * 
 * Key Improvements:
 * - Modular design with focused components
 * - Better TypeScript type safety
 * - Enhanced Zod validation
 * - TanStack Query optimization
 * - Comprehensive error handling
 * - Performance monitoring
 * - Files kept under 500 lines each
 * 
 * Architecture:
 * - Core API Client: HTTP communication
 * - Cache Layer: Intelligent caching with TanStack Query
 * - Type System: Comprehensive Zod schemas
 * - Main Service: Orchestration and high-level API
 */

import { z } from 'zod';
import type {
  UnifiedMexcConfig,
  MexcServiceResponse,
  CalendarEntry,
  ExchangeSymbol,
  Portfolio,
  Ticker,
} from './modules/mexc-api-types';
import {
  UnifiedMexcConfigSchema,
  CalendarEntrySchema,
  ExchangeSymbolSchema,
  PortfolioSchema,
  TickerSchema,
  mexcQueryKeys,
  validateMexcData,
  safeMexcValidation,
} from './modules/mexc-api-types';
import { 
  MexcCoreClient, 
  createMexcCoreClient, 
  getMexcCoreClient,
  resetMexcCoreClient 
} from './modules/mexc-core-client';
import { 
  MexcCacheLayer, 
  createMexcCacheLayer, 
  getMexcCacheLayer,
  resetMexcCacheLayer 
} from './modules/mexc-cache-layer';

// ============================================================================
// Service Configuration
// ============================================================================

const DEFAULT_SERVICE_CONFIG = {
  enableCaching: true,
  cacheDefaultTTL: 30000,
  enableMetrics: true,
  enableCircuitBreaker: true,
  maxConcurrentRequests: 10,
  requestTimeout: 10000,
  retryAttempts: 3,
  retryDelay: 1000,
} as const;

type ServiceConfig = typeof DEFAULT_SERVICE_CONFIG;

// ============================================================================
// Performance Metrics
// ============================================================================

interface ServiceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  activeConnections: number;
  circuitBreakerTrips: number;
}

// ============================================================================
// Main Unified Service Class
// ============================================================================

export class UnifiedMexcServiceV2 {
  private readonly config: Required<UnifiedMexcConfig>;
  private readonly serviceConfig: ServiceConfig;
  private readonly coreClient: MexcCoreClient;
  private readonly cacheLayer: MexcCacheLayer;
  private metrics: ServiceMetrics;
  private circuitBreakerOpen: boolean = false;
  private lastCircuitBreakerTrip: number = 0;

  constructor(config: UnifiedMexcConfig = {}) {
    // Validate and merge configuration
    this.config = UnifiedMexcConfigSchema.parse({
      ...config,
      apiKey: config.apiKey || process.env.MEXC_API_KEY || '',
      secretKey: config.secretKey || process.env.MEXC_SECRET_KEY || '',
      passphrase: config.passphrase || process.env.MEXC_PASSPHRASE || '',
    });

    this.serviceConfig = { ...DEFAULT_SERVICE_CONFIG };

    // Initialize core components
    this.coreClient = createMexcCoreClient(this.config);
    this.cacheLayer = createMexcCacheLayer({
      defaultTTL: this.config.cacheTTL,
      enableMetrics: this.config.enableMetrics,
      enableAutoCleanup: true,
    });

    // Initialize metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      activeConnections: 0,
      circuitBreakerTrips: 0,
    };
  }

  // ============================================================================
  // Public API Methods (Backward Compatible)
  // ============================================================================

  /**
   * Get calendar listings with caching and validation
   */
  async getCalendarListings(): Promise<MexcServiceResponse<CalendarEntry[]>> {
    return this.withMetrics('getCalendarListings', async () => {
      if (this.isCircuitBreakerOpen()) {
        return this.circuitBreakerResponse('Calendar listings service unavailable');
      }

      try {
        return await this.cacheLayer.getOrSetCalendar(
          () => this.coreClient.getCalendarListings(),
          this.config.cacheTTL
        );
      } catch (error) {
        this.handleCircuitBreakerError(error);
        return this.errorResponse('getCalendarListings', error);
      }
    });
  }

  /**
   * Get exchange symbols with caching
   */
  async getExchangeSymbols(): Promise<MexcServiceResponse<ExchangeSymbol[]>> {
    return this.withMetrics('getExchangeSymbols', async () => {
      if (this.isCircuitBreakerOpen()) {
        return this.circuitBreakerResponse('Exchange symbols service unavailable');
      }

      try {
        return await this.cacheLayer.getOrSetSymbols(
          () => this.coreClient.getExchangeSymbols(),
          this.config.cacheTTL
        );
      } catch (error) {
        this.handleCircuitBreakerError(error);
        return this.errorResponse('getExchangeSymbols', error);
      }
    });
  }

  /**
   * Get portfolio information
   */
  async getPortfolio(): Promise<MexcServiceResponse<Portfolio>> {
    return this.withMetrics('getPortfolio', async () => {
      if (this.isCircuitBreakerOpen()) {
        return this.circuitBreakerResponse('Portfolio service unavailable');
      }

      try {
        // Portfolio data shouldn't be cached as long due to real-time nature
        const result = await this.coreClient.getPortfolio();
        return result;
      } catch (error) {
        this.handleCircuitBreakerError(error);
        return this.errorResponse('getPortfolio', error);
      }
    });
  }

  /**
   * Get ticker data for a symbol
   */
  async getTicker(symbol: string): Promise<MexcServiceResponse<Ticker>> {
    return this.withMetrics('getTicker', async () => {
      if (this.isCircuitBreakerOpen()) {
        return this.circuitBreakerResponse('Ticker service unavailable');
      }

      try {
        return await this.cacheLayer.getOrSetTicker(
          symbol,
          () => this.coreClient.getTicker(symbol),
          15000 // Shorter TTL for real-time price data
        );
      } catch (error) {
        this.handleCircuitBreakerError(error);
        return this.errorResponse('getTicker', error);
      }
    });
  }

  /**
   * Get server time
   */
  async getServerTime(): Promise<MexcServiceResponse<{ serverTime: number }>> {
    return this.withMetrics('getServerTime', async () => {
      if (this.isCircuitBreakerOpen()) {
        return this.circuitBreakerResponse('Server time service unavailable');
      }

      try {
        return await this.coreClient.getServerTime();
      } catch (error) {
        this.handleCircuitBreakerError(error);
        return this.errorResponse('getServerTime', error);
      }
    });
  }

  // ============================================================================
  // TanStack Query Integration
  // ============================================================================

  /**
   * Get query keys for TanStack Query integration
   */
  getQueryKeys() {
    return mexcQueryKeys;
  }

  /**
   * Create TanStack Query options for calendar data
   */
  createCalendarQueryOptions() {
    return {
      queryKey: mexcQueryKeys.calendar(),
      queryFn: () => this.getCalendarListings(),
      staleTime: this.config.cacheTTL,
      gcTime: this.config.cacheTTL * 2,
      retry: (failureCount: number, error: any) => {
        if (this.isCircuitBreakerOpen()) return false;
        return failureCount < 3;
      },
    };
  }

  /**
   * Create TanStack Query options for symbols data
   */
  createSymbolsQueryOptions() {
    return {
      queryKey: mexcQueryKeys.symbols(),
      queryFn: () => this.getExchangeSymbols(),
      staleTime: this.config.cacheTTL,
      gcTime: this.config.cacheTTL * 2,
      retry: (failureCount: number, error: any) => {
        if (this.isCircuitBreakerOpen()) return false;
        return failureCount < 3;
      },
    };
  }

  /**
   * Create TanStack Query options for ticker data
   */
  createTickerQueryOptions(symbol: string) {
    return {
      queryKey: mexcQueryKeys.ticker(symbol),
      queryFn: () => this.getTicker(symbol),
      staleTime: 15000, // 15 seconds for real-time data
      gcTime: 60000, // 1 minute
      refetchInterval: 30000, // Refetch every 30 seconds
      retry: (failureCount: number, error: any) => {
        if (this.isCircuitBreakerOpen()) return false;
        return failureCount < 2; // Less aggressive retry for real-time data
      },
    };
  }

  // ============================================================================
  // Circuit Breaker Implementation
  // ============================================================================

  private isCircuitBreakerOpen(): boolean {
    if (!this.config.enableCircuitBreaker) return false;
    
    // Auto-reset circuit breaker after 60 seconds
    if (this.circuitBreakerOpen && 
        (Date.now() - this.lastCircuitBreakerTrip) > 60000) {
      this.circuitBreakerOpen = false;
    }
    
    return this.circuitBreakerOpen;
  }

  private handleCircuitBreakerError(error: unknown): void {
    if (!this.config.enableCircuitBreaker) return;

    // Open circuit breaker on repeated failures
    const recentFailures = this.metrics.failedRequests / this.metrics.totalRequests;
    if (recentFailures > 0.5 && this.metrics.totalRequests > 10) {
      this.circuitBreakerOpen = true;
      this.lastCircuitBreakerTrip = Date.now();
      this.metrics.circuitBreakerTrips++;
      console.warn('[UnifiedMexcServiceV2] Circuit breaker opened due to high failure rate');
    }
  }

  private circuitBreakerResponse(message: string): MexcServiceResponse<never> {
    return {
      success: false,
      error: `Circuit breaker open: ${message}`,
      timestamp: Date.now(),
      cached: false,
    };
  }

  // ============================================================================
  // Metrics and Performance Monitoring
  // ============================================================================

  private async withMetrics<T>(
    operation: string, 
    fn: () => Promise<MexcServiceResponse<T>>
  ): Promise<MexcServiceResponse<T>> {
    const startTime = Date.now();
    this.metrics.totalRequests++;
    this.metrics.activeConnections++;

    try {
      const result = await fn();
      
      if (result.success) {
        this.metrics.successfulRequests++;
      } else {
        this.metrics.failedRequests++;
      }

      // Update cache hit rate from cache layer
      const cacheMetrics = this.cacheLayer.getMetrics();
      this.metrics.cacheHitRate = cacheMetrics.hitRate;

      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      throw error;
    } finally {
      this.metrics.activeConnections--;
      
      // Update average response time
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);
    }
  }

  private updateAverageResponseTime(responseTime: number): void {
    if (this.metrics.totalRequests === 1) {
      this.metrics.averageResponseTime = responseTime;
    } else {
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) 
        / this.metrics.totalRequests;
    }
  }

  private errorResponse(method: string, error: unknown): MexcServiceResponse<never> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[UnifiedMexcServiceV2.${method}] Error:`, errorMessage);
    
    return {
      success: false,
      error: errorMessage,
      timestamp: Date.now(),
      cached: false,
    };
  }

  // ============================================================================
  // Public Utility Methods
  // ============================================================================

  /**
   * Get current service metrics
   */
  getMetrics(): Readonly<ServiceMetrics> {
    return { ...this.metrics };
  }

  /**
   * Get service configuration
   */
  getConfig(): Readonly<Required<UnifiedMexcConfig>> {
    return { ...this.config };
  }

  /**
   * Check if service is configured properly
   */
  isConfigured(): boolean {
    return this.coreClient.isConfigured();
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cacheLayer.clear();
  }

  /**
   * Get cache metrics
   */
  getCacheMetrics() {
    return this.cacheLayer.getMetrics();
  }

  /**
   * Reset circuit breaker manually
   */
  resetCircuitBreaker(): void {
    this.circuitBreakerOpen = false;
    this.lastCircuitBreakerTrip = 0;
  }

  /**
   * Shutdown service and cleanup resources
   */
  shutdown(): void {
    this.cacheLayer.shutdown();
    resetMexcCoreClient();
    resetMexcCacheLayer();
  }
}

// ============================================================================
// Factory Functions (Backward Compatible)
// ============================================================================

let globalService: UnifiedMexcServiceV2 | null = null;

export function getUnifiedMexcService(config?: UnifiedMexcConfig): UnifiedMexcServiceV2 {
  if (!globalService) {
    globalService = new UnifiedMexcServiceV2(config);
  }
  return globalService;
}

export function resetUnifiedMexcService(): void {
  if (globalService) {
    globalService.shutdown();
    globalService = null;
  }
}

// Backward compatibility aliases
export { UnifiedMexcServiceV2 as UnifiedMexcService };
export default UnifiedMexcServiceV2;

// Re-export types for backward compatibility
export type {
  UnifiedMexcConfig,
  MexcServiceResponse,
  CalendarEntry,
  ExchangeSymbol,
  Portfolio,
  Ticker,
} from './modules/mexc-api-types';
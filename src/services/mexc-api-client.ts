/**
 * MEXC API Client
 * 
 * Extracted from unified-mexc-service.ts for better modularity.
 * Handles core HTTP communication with MEXC API endpoints.
 * 
 * Features:
 * - HTTP request/response handling
 * - Authentication and signature generation
 * - Request retry logic with exponential backoff
 * - Response validation and error handling
 * - Performance monitoring and metrics
 */

import * as crypto from "node:crypto";
import { 
  type UnifiedMexcConfig, 
  type MexcServiceResponse,
  validateServiceResponse 
} from "./mexc-schemas";
import { type MexcResponseCache } from "./mexc-cache-manager";
import { type MexcReliabilityManager } from "./mexc-circuit-breaker";
import {
  type EnhancedUnifiedCacheSystem,
} from "../lib/enhanced-unified-cache";
import {
  type PerformanceMonitoringService,
} from "../lib/performance-monitoring-service";

// ============================================================================
// API Client Types and Interfaces
// ============================================================================

export interface ApiRequestConfig {
  method: "GET" | "POST" | "PUT" | "DELETE";
  endpoint: string;
  params?: Record<string, any>;
  requiresAuth?: boolean;
  timeout?: number;
  retries?: number;
  cacheTTL?: number;
}

export interface ApiClientStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  retryCount: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
}

// ============================================================================
// MEXC API Client Implementation
// ============================================================================

/**
 * Core API client for MEXC communication
 * Handles all HTTP requests with proper authentication and error handling
 */
export class MexcApiClient {
  private config: Required<UnifiedMexcConfig>;
  private cache: MexcResponseCache;
  private reliabilityManager: MexcReliabilityManager;
  private enhancedCache?: EnhancedUnifiedCacheSystem;
  private performanceMonitoring?: PerformanceMonitoringService;
  private stats: ApiClientStats;
  private retryConfig: RetryConfig;

  constructor(
    config: Required<UnifiedMexcConfig>,
    cache: MexcResponseCache,
    reliabilityManager: MexcReliabilityManager,
    enhancedCache?: EnhancedUnifiedCacheSystem,
    performanceMonitoring?: PerformanceMonitoringService
  ) {
    this.config = config;
    this.cache = cache;
    this.reliabilityManager = reliabilityManager;
    this.enhancedCache = enhancedCache;
    this.performanceMonitoring = performanceMonitoring;
    
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      retryCount: 0,
    };

    this.retryConfig = {
      maxRetries: config.maxRetries,
      baseDelay: config.retryDelay,
      maxDelay: 30000, // 30 seconds max delay
      backoffMultiplier: 2,
      retryableStatusCodes: [429, 500, 502, 503, 504],
    };
  }

  // ============================================================================
  // Core Request Methods
  // ============================================================================

  /**
   * Make HTTP request to MEXC API
   */
  async request<T>(requestConfig: ApiRequestConfig): Promise<MexcServiceResponse<T>> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      this.stats.totalRequests++;

      // Check cache first for GET requests
      if (requestConfig.method === "GET") {
        const cachedResult = await this.getCachedResponse<T>(requestConfig);
        if (cachedResult) {
          this.updateCacheStats(true);
          return {
            ...cachedResult,
            requestId,
            responseTime: Date.now() - startTime,
            cached: true,
          };
        }
        this.updateCacheStats(false);
      }

      // Execute request with reliability protection
      const response = await this.reliabilityManager.execute(async () => {
        return this.executeHttpRequest<T>(requestConfig);
      });

      // Cache successful GET responses
      if (requestConfig.method === "GET" && response.success && response.data) {
        await this.cacheResponse(requestConfig, response.data, requestConfig.cacheTTL);
      }

      this.stats.successfulRequests++;
      this.updateResponseTimeStats(Date.now() - startTime);

      return {
        ...response,
        requestId,
        responseTime: Date.now() - startTime,
      };

    } catch (error) {
      this.stats.failedRequests++;
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[MexcApiClient] Request failed:`, {
        endpoint: requestConfig.endpoint,
        error: errorMessage,
        requestId,
      });

      return {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        requestId,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * GET request convenience method
   */
  async get<T>(endpoint: string, params?: Record<string, any>, options?: Partial<ApiRequestConfig>): Promise<MexcServiceResponse<T>> {
    return this.request<T>({
      method: "GET",
      endpoint,
      params,
      ...options,
    });
  }

  /**
   * POST request convenience method
   */
  async post<T>(endpoint: string, params?: Record<string, any>, options?: Partial<ApiRequestConfig>): Promise<MexcServiceResponse<T>> {
    return this.request<T>({
      method: "POST",
      endpoint,
      params,
      requiresAuth: true,
      ...options,
    });
  }

  /**
   * PUT request convenience method
   */
  async put<T>(endpoint: string, params?: Record<string, any>, options?: Partial<ApiRequestConfig>): Promise<MexcServiceResponse<T>> {
    return this.request<T>({
      method: "PUT",
      endpoint,
      params,
      requiresAuth: true,
      ...options,
    });
  }

  /**
   * DELETE request convenience method
   */
  async delete<T>(endpoint: string, params?: Record<string, any>, options?: Partial<ApiRequestConfig>): Promise<MexcServiceResponse<T>> {
    return this.request<T>({
      method: "DELETE",
      endpoint,
      params,
      requiresAuth: true,
      ...options,
    });
  }

  // ============================================================================
  // HTTP Implementation
  // ============================================================================

  /**
   * Execute actual HTTP request with retry logic
   */
  private async executeHttpRequest<T>(requestConfig: ApiRequestConfig): Promise<MexcServiceResponse<T>> {
    let lastError: Error | null = null;
    const maxRetries = requestConfig.retries ?? this.retryConfig.maxRetries;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.calculateRetryDelay(attempt);
          await this.sleep(delay);
          this.stats.retryCount++;
        }

        const response = await this.makeHttpRequest<T>(requestConfig);
        return response;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");
        
        // Don't retry on certain errors
        if (!this.shouldRetry(lastError, attempt, maxRetries)) {
          break;
        }
      }
    }

    throw lastError || new Error("Request failed after all retries");
  }

  /**
   * Make actual HTTP request
   */
  private async makeHttpRequest<T>(requestConfig: ApiRequestConfig): Promise<MexcServiceResponse<T>> {
    const { method, endpoint, params = {}, requiresAuth = false } = requestConfig;
    
    let url = `${this.config.baseUrl}${endpoint}`;
    let body: string | undefined;

    // Handle authentication
    if (requiresAuth) {
      if (!this.hasCredentials()) {
        throw new Error("API credentials are required for this operation");
      }

      const timestamp = Date.now();
      params.timestamp = timestamp;

      if (method === "POST" || method === "PUT") {
        body = JSON.stringify(params);
        const signature = this.createSignature(body);
        params.signature = signature;
      } else {
        const queryString = new URLSearchParams(params).toString();
        const signature = this.createSignature(queryString);
        url += `?${queryString}&signature=${signature}`;
      }
    } else if (method === "GET" && Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(params).toString();
      url += `?${queryString}`;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "MEXC-Sniper-Bot/1.0",
    };

    if (requiresAuth && this.config.apiKey) {
      headers["X-MEXC-APIKEY"] = this.config.apiKey;
    }

    const timeout = requestConfig.timeout ?? this.config.timeout;
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.msg || errorJson.message || errorMessage;
      } catch {
        // Use the raw error text if JSON parsing fails
        if (errorText) {
          errorMessage = errorText;
        }
      }

      throw new Error(errorMessage);
    }

    const responseText = await response.text();
    let data: T;

    try {
      data = JSON.parse(responseText);
    } catch (error) {
      throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`);
    }

    // Track performance
    if (this.performanceMonitoring) {
      this.performanceMonitoring.trackApiRequest(Date.now() - Date.now(), false);
    }

    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Authentication and Security
  // ============================================================================

  /**
   * Create HMAC SHA256 signature for authenticated requests
   */
  private createSignature(queryString: string): string {
    return crypto
      .createHmac("sha256", this.config.secretKey)
      .update(queryString)
      .digest("hex");
  }

  /**
   * Check if API credentials are available
   */
  private hasCredentials(): boolean {
    return !!(this.config.apiKey && this.config.secretKey);
  }

  // ============================================================================
  // Caching
  // ============================================================================

  /**
   * Get cached response if available
   */
  private async getCachedResponse<T>(requestConfig: ApiRequestConfig): Promise<MexcServiceResponse<T> | null> {
    const cacheKey = this.cache.generateKey(requestConfig.endpoint, requestConfig.params);

    // Try enhanced cache first
    if (this.config.enableEnhancedCaching && this.enhancedCache) {
      const cached = await this.enhancedCache.get<T>(cacheKey, "api_response");
      if (cached) {
        return {
          success: true,
          data: cached,
          timestamp: new Date().toISOString(),
          cached: true,
        };
      }
    }

    // Fallback to legacy cache
    if (this.config.enableCaching) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          timestamp: new Date().toISOString(),
          cached: true,
        };
      }
    }

    return null;
  }

  /**
   * Cache successful response
   */
  private async cacheResponse(requestConfig: ApiRequestConfig, data: any, ttl?: number): Promise<void> {
    const cacheKey = this.cache.generateKey(requestConfig.endpoint, requestConfig.params);
    const cacheTTL = ttl ?? this.config.cacheTTL;

    // Cache in enhanced cache if available
    if (this.config.enableEnhancedCaching && this.enhancedCache) {
      await this.enhancedCache.set(cacheKey, data, "api_response", this.config.apiResponseTTL);
    }

    // Also cache in legacy cache
    if (this.config.enableCaching) {
      this.cache.set(cacheKey, data, cacheTTL);
    }
  }

  // ============================================================================
  // Retry Logic
  // ============================================================================

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const delay = this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.retryConfig.maxDelay);
  }

  /**
   * Determine if request should be retried
   */
  private shouldRetry(error: Error, attempt: number, maxRetries: number): boolean {
    if (attempt >= maxRetries) {
      return false;
    }

    // Don't retry authentication errors
    if (error.message.includes("401") || error.message.includes("403")) {
      return false;
    }

    // Don't retry client errors (4xx) except rate limiting
    if (error.message.includes("4") && !error.message.includes("429")) {
      return false;
    }

    // Retry on network errors, timeouts, and server errors
    return true;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Statistics and Monitoring
  // ============================================================================

  /**
   * Update cache statistics
   */
  private updateCacheStats(hit: boolean): void {
    const totalCacheRequests = this.stats.totalRequests;
    if (totalCacheRequests > 0) {
      const currentHits = this.stats.cacheHitRate * (totalCacheRequests - 1);
      const newHits = hit ? currentHits + 1 : currentHits;
      this.stats.cacheHitRate = newHits / totalCacheRequests;
    }
  }

  /**
   * Update response time statistics
   */
  private updateResponseTimeStats(responseTime: number): void {
    const totalRequests = this.stats.successfulRequests;
    if (totalRequests === 1) {
      this.stats.averageResponseTime = responseTime;
    } else {
      const currentTotal = this.stats.averageResponseTime * (totalRequests - 1);
      this.stats.averageResponseTime = (currentTotal + responseTime) / totalRequests;
    }
  }

  /**
   * Get API client statistics
   */
  getStats(): ApiClientStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      retryCount: 0,
    };
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    successRate: number;
    averageResponseTime: number;
    cacheHitRate: number;
    isBlocked: boolean;
    blockingReason?: string;
  } {
    const successRate = this.stats.totalRequests > 0 
      ? this.stats.successfulRequests / this.stats.totalRequests 
      : 1;

    const isBlocked = this.reliabilityManager.isBlocked();
    const blockingReason = this.reliabilityManager.getBlockingReason();

    return {
      healthy: successRate > 0.8 && !isBlocked,
      successRate,
      averageResponseTime: this.stats.averageResponseTime,
      cacheHitRate: this.stats.cacheHitRate,
      isBlocked,
      blockingReason: blockingReason || undefined,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<UnifiedMexcConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): UnifiedMexcConfig {
    return { ...this.config };
  }
}
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
import type { EnhancedUnifiedCacheSystem } from "../lib/enhanced-unified-cache";
import { toSafeError } from "../lib/error-type-utils";
import type { PerformanceMonitoringService } from "../lib/performance-monitoring-service";
import type { MexcResponseCache } from "./mexc-cache-manager";
import type { MexcReliabilityManager } from "./mexc-circuit-breaker";
import type { MexcServiceResponse, UnifiedMexcConfig } from "./mexc-schemas";

// ============================================================================
// API Client Types and Interfaces
// ============================================================================

// Define possible parameter value types for API requests
export type ApiParamValue = string | number | boolean | null | undefined;
export type ApiParams = Record<string, ApiParamValue | ApiParamValue[]>;

export interface ApiRequestConfig {
  method: "GET" | "POST" | "PUT" | "DELETE";
  endpoint: string;
  params?: ApiParams;
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
  jitterFactor: number; // Add jitter to prevent thundering herd
  adaptiveRetry: boolean; // Enable adaptive retry based on success rate
}

export interface TimeoutConfig {
  defaultTimeout: number;
  connectTimeout: number;
  readTimeout: number;
  adaptiveTimeout: boolean;
  endpointTimeouts: Record<string, number>; // Per-endpoint timeouts
}

export interface RequestContext {
  requestId: string;
  correlationId?: string;
  priority: "low" | "medium" | "high" | "critical";
  endpoint: string;
  attempt: number;
  startTime: number;
  metadata?: Record<string, any>;
}

export interface ErrorClassification {
  isRetryable: boolean;
  category: "network" | "authentication" | "rate_limit" | "server" | "client" | "timeout";
  severity: "low" | "medium" | "high" | "critical";
  suggestedDelay?: number;
  suggestedBackoff?: number;
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
  private timeoutConfig: TimeoutConfig;

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
      jitterFactor: 0.1, // 10% jitter to prevent thundering herd
      adaptiveRetry: true, // Enable adaptive retry based on success rate
    };

    this.timeoutConfig = {
      defaultTimeout: config.timeout,
      connectTimeout: 10000, // 10 seconds for connection
      readTimeout: 20000, // 20 seconds for reading response
      adaptiveTimeout: true,
      endpointTimeouts: {
        "/api/v3/ping": 5000, // Fast ping timeout
        "/api/v3/time": 5000, // Server time should be fast
        "/api/v3/depth": 15000, // Order book can take longer
        "/api/v3/account": 30000, // Account info may take longer
        "/api/v3/order": 45000, // Order operations need more time
        "/api/v3/openOrders": 30000, // Open orders query
      },
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
    
    // Create request context for tracking
    const context: RequestContext = {
      requestId,
      priority: this.determinePriority(requestConfig.endpoint),
      endpoint: requestConfig.endpoint,
      attempt: 1,
      startTime,
      metadata: {
        method: requestConfig.method,
        requiresAuth: requestConfig.requiresAuth || false,
        timeout: this.calculateTimeout(requestConfig),
      },
    };

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
        return this.executeHttpRequestWithContext<T>(requestConfig, context);
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

      const safeError = toSafeError(error);
      const classification = this.classifyError(safeError);
      
      console.error(`[MexcApiClient] Request failed:`, {
        endpoint: requestConfig.endpoint,
        error: safeError.message,
        requestId,
        classification,
        context,
      });

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
        requestId,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * GET request convenience method
   */
  async get<T>(
    endpoint: string,
    params?: ApiParams,
    options?: Partial<ApiRequestConfig>
  ): Promise<MexcServiceResponse<T>> {
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
  async post<T>(
    endpoint: string,
    params?: ApiParams,
    options?: Partial<ApiRequestConfig>
  ): Promise<MexcServiceResponse<T>> {
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
  async put<T>(
    endpoint: string,
    params?: Record<string, any>,
    options?: Partial<ApiRequestConfig>
  ): Promise<MexcServiceResponse<T>> {
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
  async delete<T>(
    endpoint: string,
    params?: Record<string, any>,
    options?: Partial<ApiRequestConfig>
  ): Promise<MexcServiceResponse<T>> {
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
   * Execute actual HTTP request with retry logic and context tracking
   */
  private async executeHttpRequestWithContext<T>(
    requestConfig: ApiRequestConfig,
    context: RequestContext
  ): Promise<MexcServiceResponse<T>> {
    let lastError: Error | null = null;
    const maxRetries = requestConfig.retries ?? this.retryConfig.maxRetries;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.calculateRetryDelayWithClassification(attempt, lastError);
          await this.sleep(delay);
          this.stats.retryCount++;
        }

        // Update context with current attempt
        context.attempt = attempt + 1;
        context.startTime = Date.now();

        const response = await this.makeHttpRequest<T>(requestConfig);
        return response;
      } catch (error) {
        lastError = toSafeError(error) as Error & { statusCode?: number; headers?: Record<string, string> };

        // FIXED: Handle rate limiting errors for adaptive rate limiter
        if (lastError.statusCode === 429) {
          await this.handleRateLimitError(lastError, requestConfig.endpoint, Date.now() - context.startTime);
        }

        // Don't retry on certain errors
        if (!this.shouldRetry(lastError, attempt, maxRetries)) {
          break;
        }
      }
    }

    throw lastError || new Error("Request failed after all retries");
  }

  /**
   * Execute actual HTTP request with retry logic (legacy method for compatibility)
   */
  private async executeHttpRequest<T>(
    requestConfig: ApiRequestConfig
  ): Promise<MexcServiceResponse<T>> {
    const context: RequestContext = {
      requestId: crypto.randomUUID(),
      priority: this.determinePriority(requestConfig.endpoint),
      endpoint: requestConfig.endpoint,
      attempt: 1,
      startTime: Date.now(),
    };
    
    return this.executeHttpRequestWithContext(requestConfig, context);
  }

  /**
   * Determine request priority based on endpoint
   */
  private determinePriority(endpoint: string): "low" | "medium" | "high" | "critical" {
    // Trading operations are critical
    if (endpoint.includes("/order") || endpoint.includes("/trade")) {
      return "critical";
    }
    
    // Account and balance info is high priority
    if (endpoint.includes("/account") || endpoint.includes("/balance")) {
      return "high";
    }
    
    // Market data is medium priority
    if (endpoint.includes("/ticker") || endpoint.includes("/depth") || endpoint.includes("/klines")) {
      return "medium";
    }
    
    // Everything else is low priority (ping, time, etc.)
    return "low";
  }

  /**
   * Make actual HTTP request
   */
  private async makeHttpRequest<T>(
    requestConfig: ApiRequestConfig
  ): Promise<MexcServiceResponse<T>> {
    const startTime = Date.now();
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

    const timeout = this.calculateTimeout(requestConfig);
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(timeout),
    });

    // FIXED: Extract response headers for rate limiting analysis
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
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

      // FIXED: Pass response headers and status code for rate limiting
      const errorWithHeaders = new Error(errorMessage) as Error & { 
        statusCode?: number; 
        headers?: Record<string, string>; 
      };
      errorWithHeaders.statusCode = response.status;
      errorWithHeaders.headers = responseHeaders;

      throw errorWithHeaders;
    }

    const responseText = await response.text();
    let data: T;

    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      const safeParseError = toSafeError(parseError);
      throw new Error(
        `Invalid JSON response: ${responseText.substring(0, 200)} - Parse error: ${safeParseError.message}`
      );
    }

    // FIXED: Track performance and rate limiting headers
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    if (this.performanceMonitoring) {
      this.performanceMonitoring.trackApiRequest(responseTime, false);
    }

    // FIXED: Record response headers for adaptive rate limiting
    await this.recordRateLimitingResponse(endpoint, responseTime, true, response.status, responseHeaders);

    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      headers: responseHeaders, // Include headers in response
    };
  }

  // ============================================================================
  // Authentication and Security
  // ============================================================================

  /**
   * Create HMAC SHA256 signature for authenticated requests
   */
  private createSignature(queryString: string): string {
    return crypto.createHmac("sha256", this.config.secretKey).update(queryString).digest("hex");
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
  private async getCachedResponse<T>(
    requestConfig: ApiRequestConfig
  ): Promise<MexcServiceResponse<T> | null> {
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
  private async cacheResponse(
    requestConfig: ApiRequestConfig,
    data: any,
    ttl?: number
  ): Promise<void> {
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
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.retryConfig.baseDelay * this.retryConfig.backoffMultiplier ** (attempt - 1);
    const cappedDelay = Math.min(baseDelay, this.retryConfig.maxDelay);
    
    // Add jitter to prevent thundering herd problem
    const jitter = cappedDelay * this.retryConfig.jitterFactor * (Math.random() - 0.5);
    const delayWithJitter = Math.max(0, cappedDelay + jitter);
    
    // Apply adaptive retry - increase delay if success rate is low
    if (this.retryConfig.adaptiveRetry) {
      const successRate = this.stats.totalRequests > 0 
        ? this.stats.successfulRequests / this.stats.totalRequests 
        : 1;
      
      if (successRate < 0.5) {
        // Low success rate - increase delay by 50%
        return delayWithJitter * 1.5;
      } else if (successRate < 0.8) {
        // Medium success rate - increase delay by 25%
        return delayWithJitter * 1.25;
      }
    }
    
    return delayWithJitter;
  }

  /**
   * Calculate retry delay incorporating error classification
   */
  private calculateRetryDelayWithClassification(attempt: number, lastError: Error | null): number {
    if (!lastError) {
      return this.calculateRetryDelay(attempt);
    }
    
    const classification = this.classifyError(lastError);
    
    // Use suggested delay from error classification if available
    if (classification.suggestedDelay) {
      const baseDelay = classification.suggestedDelay;
      const backoffMultiplier = classification.suggestedBackoff || this.retryConfig.backoffMultiplier;
      const delay = baseDelay * backoffMultiplier ** (attempt - 1);
      const cappedDelay = Math.min(delay, this.retryConfig.maxDelay);
      
      // Add jitter
      const jitter = cappedDelay * this.retryConfig.jitterFactor * (Math.random() - 0.5);
      return Math.max(0, cappedDelay + jitter);
    }
    
    // Fallback to standard retry delay calculation
    return this.calculateRetryDelay(attempt);
  }

  /**
   * Determine if request should be retried
   */
  private shouldRetry(error: Error, attempt: number, maxRetries: number): boolean {
    if (attempt >= maxRetries) {
      return false;
    }

    const classification = this.classifyError(error);
    return classification.isRetryable;
  }

  /**
   * Classify error for intelligent retry decisions
   */
  private classifyError(error: Error): ErrorClassification {
    const message = error.message.toLowerCase();
    
    // Authentication errors - not retryable
    if (message.includes("401") || message.includes("403") || message.includes("unauthorized") || message.includes("forbidden")) {
      return {
        isRetryable: false,
        category: "authentication",
        severity: "high",
      };
    }
    
    // Rate limiting - retryable with longer delay
    if (message.includes("429") || message.includes("rate limit") || message.includes("too many requests")) {
      return {
        isRetryable: true,
        category: "rate_limit",
        severity: "medium",
        suggestedDelay: 5000, // 5 seconds
        suggestedBackoff: 2.5,
      };
    }
    
    // Client errors (4xx except 429) - usually not retryable
    if (message.includes("400") || message.includes("404") || message.includes("422")) {
      return {
        isRetryable: false,
        category: "client",
        severity: "medium",
      };
    }
    
    // Server errors (5xx) - retryable
    if (message.includes("500") || message.includes("502") || message.includes("503") || message.includes("504")) {
      return {
        isRetryable: true,
        category: "server",
        severity: "high",
        suggestedDelay: 2000, // 2 seconds
        suggestedBackoff: 2,
      };
    }
    
    // Network errors - retryable
    if (message.includes("network") || message.includes("connection") || message.includes("timeout") || 
        message.includes("fetch") || message.includes("abort")) {
      return {
        isRetryable: true,
        category: "network",
        severity: "high",
        suggestedDelay: 1000, // 1 second
        suggestedBackoff: 1.5,
      };
    }
    
    // Timeout errors - retryable
    if (message.includes("timeout") || error.name === "AbortError") {
      return {
        isRetryable: true,
        category: "timeout",
        severity: "medium",
        suggestedDelay: 3000, // 3 seconds
        suggestedBackoff: 2,
      };
    }
    
    // Unknown errors - cautiously retryable
    return {
      isRetryable: true,
      category: "server",
      severity: "medium",
      suggestedDelay: 2000,
      suggestedBackoff: 2,
    };
  }

  /**
   * Calculate timeout for a request based on endpoint and adaptive settings
   */
  private calculateTimeout(requestConfig: ApiRequestConfig): number {
    // Use explicit timeout if provided
    if (requestConfig.timeout) {
      return requestConfig.timeout;
    }
    
    // Check for endpoint-specific timeout
    const endpointTimeout = this.timeoutConfig.endpointTimeouts[requestConfig.endpoint];
    if (endpointTimeout) {
      return endpointTimeout;
    }
    
    // Apply adaptive timeout based on recent performance
    if (this.timeoutConfig.adaptiveTimeout && this.stats.averageResponseTime > 0) {
      const adaptiveTimeout = Math.min(
        this.stats.averageResponseTime * 3, // 3x average response time
        this.timeoutConfig.defaultTimeout * 2 // But not more than 2x default
      );
      
      // Ensure minimum timeout
      return Math.max(adaptiveTimeout, 5000);
    }
    
    return this.timeoutConfig.defaultTimeout;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
    const successRate =
      this.stats.totalRequests > 0 ? this.stats.successfulRequests / this.stats.totalRequests : 1;

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

  /**
   * Get retry configuration
   */
  getRetryConfig(): RetryConfig {
    return { ...this.retryConfig };
  }

  /**
   * Get timeout configuration
   */
  getTimeoutConfig(): TimeoutConfig {
    return { ...this.timeoutConfig };
  }

  /**
   * Update retry configuration
   */
  updateRetryConfig(newRetryConfig: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...newRetryConfig };
  }

  /**
   * Update timeout configuration
   */
  updateTimeoutConfig(newTimeoutConfig: Partial<TimeoutConfig>): void {
    this.timeoutConfig = { ...this.timeoutConfig, ...newTimeoutConfig };
  }

  /**
   * Record rate limiting response data for adaptive rate limiter
   */
  private async recordRateLimitingResponse(
    endpoint: string,
    responseTime: number,
    success: boolean,
    statusCode: number,
    headers: Record<string, string>
  ): Promise<void> {
    try {
      // Import adaptive rate limiter dynamically to avoid circular dependencies
      const { adaptiveRateLimiter } = await import('./adaptive-rate-limiter');
      
      // Record the response with headers for rate limiting analysis
      await adaptiveRateLimiter.recordResponse(
        endpoint,
        undefined, // userId not available in API client context
        responseTime,
        success,
        statusCode,
        headers
      );
    } catch (error) {
      console.error('[MexcApiClient] Failed to record rate limiting response:', error);
      // Don't throw - this is non-critical for the main request flow
    }
  }

  /**
   * Handle rate limiting errors
   */
  private async handleRateLimitError(
    error: Error & { statusCode?: number; headers?: Record<string, string> },
    endpoint: string,
    responseTime: number
  ): Promise<void> {
    if (error.statusCode === 429 && error.headers) {
      // Record the rate limit response
      await this.recordRateLimitingResponse(
        endpoint,
        responseTime,
        false,
        error.statusCode,
        error.headers
      );
    }
  }

  /**
   * Get performance insights
   */
  getPerformanceInsights(): {
    stats: ApiClientStats;
    health: ReturnType<MexcApiClient["getHealthStatus"]>;
    retryConfig: RetryConfig;
    timeoutConfig: TimeoutConfig;
    recommendations: string[];
  } {
    const health = this.getHealthStatus();
    const recommendations: string[] = [];
    
    // Generate recommendations based on performance
    if (health.successRate < 0.8) {
      recommendations.push("Consider increasing retry delays or checking API credentials");
    }
    
    if (health.averageResponseTime > 10000) {
      recommendations.push("Consider increasing timeout values for better reliability");
    }
    
    if (this.stats.retryCount > this.stats.totalRequests * 0.3) {
      recommendations.push("High retry rate detected - check network connectivity");
    }
    
    if (health.cacheHitRate < 0.2 && this.config.enableCaching) {
      recommendations.push("Low cache hit rate - consider optimizing cache TTL settings");
    }
    
    return {
      stats: this.getStats(),
      health,
      retryConfig: this.getRetryConfig(),
      timeoutConfig: this.getTimeoutConfig(),
      recommendations,
    };
  }

  // ============================================================================
  // Trading Operations
  // ============================================================================

  /**
   * Place order on MEXC exchange
   */
  async placeOrder(params: any): Promise<MexcServiceResponse<any>> {
    if (!this.hasCredentials()) {
      return {
        success: false,
        error: "API credentials are required for placing orders",
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const orderParams = {
        symbol: params.symbol,
        side: params.side,
        type: params.type || "LIMIT",
        quantity: params.quantity,
        price: params.price,
        timeInForce: params.timeInForce || "GTC",
        newOrderRespType: params.newOrderRespType || "RESULT",
      };

      const response = await this.post<any>("/api/v3/order", orderParams);

      // Transform response to match OrderResult format
      if (response.success && response.data) {
        const orderResult = {
          success: true,
          orderId: response.data.orderId?.toString() || response.data.id?.toString(),
          symbol: response.data.symbol || params.symbol,
          side: response.data.side || params.side,
          quantity: response.data.origQty || params.quantity,
          price: response.data.price || params.price,
          status: response.data.status,
          timestamp: new Date().toISOString(),
        };

        return {
          success: true,
          data: orderResult,
          timestamp: new Date().toISOString(),
          requestId: response.requestId,
          responseTime: response.responseTime,
        };
      }

      return response;
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        error: `Failed to place order: ${safeError.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get order book depth for a symbol
   */
  async getOrderBook(symbol: string, limit = 100): Promise<any> {
    try {
      const response = await this.get<any>("/api/v3/depth", { symbol, limit });

      if (response.success && response.data) {
        // Transform MEXC order book format to our standard format
        const orderBook = {
          symbol,
          bids: (response.data.bids || []).map((bid: any) => ({
            price: Array.isArray(bid) ? bid[0] : bid.price,
            quantity: Array.isArray(bid) ? bid[1] : bid.quantity,
          })),
          asks: (response.data.asks || []).map((ask: any) => ({
            price: Array.isArray(ask) ? ask[0] : ask.price,
            quantity: Array.isArray(ask) ? ask[1] : ask.quantity,
          })),
          timestamp: Date.now(),
        };

        return orderBook;
      }

      throw new Error(response.error || "Failed to get order book");
    } catch (error) {
      const safeError = toSafeError(error);
      console.error(`[MexcApiClient] Failed to get order book for ${symbol}:`, safeError.message);
      return {
        symbol,
        bids: [],
        asks: [],
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(symbol: string, orderId: string): Promise<MexcServiceResponse<any>> {
    if (!this.hasCredentials()) {
      return {
        success: false,
        error: "API credentials are required for order status",
        timestamp: new Date().toISOString(),
      };
    }

    return this.get<any>("/api/v3/order", { symbol, orderId });
  }

  /**
   * Cancel order
   */
  async cancelOrder(symbol: string, orderId: string): Promise<MexcServiceResponse<any>> {
    if (!this.hasCredentials()) {
      return {
        success: false,
        error: "API credentials are required for canceling orders",
        timestamp: new Date().toISOString(),
      };
    }

    return this.delete<any>("/api/v3/order", { symbol, orderId });
  }

  /**
   * Get open orders
   */
  async getOpenOrders(symbol?: string): Promise<MexcServiceResponse<any[]>> {
    if (!this.hasCredentials()) {
      return {
        success: false,
        error: "API credentials are required for getting open orders",
        timestamp: new Date().toISOString(),
      };
    }

    const params = symbol ? { symbol } : {};
    return this.get<any[]>("/api/v3/openOrders", params);
  }

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<MexcServiceResponse<any>> {
    if (!this.hasCredentials()) {
      return {
        success: false,
        error: "API credentials are required for account information",
        timestamp: new Date().toISOString(),
      };
    }

    return this.get<any>("/api/v3/account");
  }

  // ============================================================================
  // Enhanced Credential Validation
  // ============================================================================

  /**
   * Test API credentials with a simple authenticated request
   */
  async testCredentials(): Promise<{
    isValid: boolean;
    hasConnection: boolean;
    error?: string;
    responseTime?: number;
  }> {
    const startTime = Date.now();

    // Check if credentials exist
    if (!this.hasCredentials()) {
      return {
        isValid: false,
        hasConnection: false,
        error: "No API credentials configured",
        responseTime: Date.now() - startTime,
      };
    }

    try {
      // Test connection with a simple unauthenticated request first
      const pingResponse = await this.get<any>("/api/v3/ping");
      const hasConnection = pingResponse.success;

      if (!hasConnection) {
        return {
          isValid: false,
          hasConnection: false,
          error: "Cannot connect to MEXC API",
          responseTime: Date.now() - startTime,
        };
      }

      // Test credentials with authenticated request
      const accountResponse = await this.getAccountInfo();
      const isValid = accountResponse.success;

      return {
        isValid,
        hasConnection,
        error: isValid ? undefined : accountResponse.error || "Invalid credentials",
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        isValid: false,
        hasConnection: false,
        error: `Credential test failed: ${safeError.message}`,
        responseTime: Date.now() - startTime,
      };
    }
  }
}

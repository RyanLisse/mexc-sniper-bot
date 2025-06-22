/**
 * Adaptive Rate Limiter Service
 *
 * Provides intelligent rate limiting with:
 * - Adaptive algorithms based on API response times
 * - Circuit breaker integration
 * - User-specific and endpoint-specific limits
 * - Burst allowances and token bucket algorithms
 * - Real-time performance monitoring
 */

import { circuitBreakerRegistry } from "./circuit-breaker";
import { ErrorLoggingService } from "./error-logging-service";

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  burstAllowance: number; // Additional requests allowed in burst
  adaptiveEnabled: boolean; // Enable adaptive rate limiting
  circuitBreakerEnabled: boolean; // Enable circuit breaker integration
  userSpecific: boolean; // Different limits per user
  endpointSpecific: boolean; // Different limits per endpoint
  tokenBucketEnabled: boolean; // Use token bucket algorithm
}

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
  retryAfter?: number; // Seconds to wait before retry
  adaptiveDelay?: number; // Suggested delay based on performance
  circuitBreakerStatus?: string;
  metadata: {
    algorithm: string;
    currentWindowRequests: number;
    averageResponseTime: number;
    successRate: number;
    adaptationFactor: number;
    burstTokens: number;
  };
}

export interface EndpointMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastResponseTime: number;
  successRate: number;
  adaptationFactor: number; // Current adaptation factor (0.1 - 2.0)
  lastAdaptation: number;
  circuitBreakerState: string;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number; // Tokens per second
}

interface SlidingWindow {
  requests: number[];
  windowStart: number;
  windowSize: number;
}

interface UserLimits {
  userId: string;
  customLimits: Record<string, RateLimitConfig>;
  priorityLevel: "low" | "medium" | "high" | "premium";
  adaptationHistory: Array<{
    timestamp: number;
    factor: number;
    reason: string;
  }>;
}

export class AdaptiveRateLimiterService {
  private static instance: AdaptiveRateLimiterService;
  private errorLogger = ErrorLoggingService.getInstance();

  // Core data structures
  private endpointMetrics = new Map<string, EndpointMetrics>();
  private tokenBuckets = new Map<string, TokenBucket>();
  private slidingWindows = new Map<string, SlidingWindow>();
  private userLimits = new Map<string, UserLimits>();

  // Default configurations
  private readonly defaultConfig: RateLimitConfig = {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    burstAllowance: 20,
    adaptiveEnabled: true,
    circuitBreakerEnabled: true,
    userSpecific: true,
    endpointSpecific: true,
    tokenBucketEnabled: true,
  };

  private readonly endpointConfigs: Record<string, Partial<RateLimitConfig>> = {
    "/api/mexc/trade": {
      maxRequests: 10, // Very conservative for trading
      burstAllowance: 2,
      windowMs: 60000,
    },
    "/api/mexc/test-credentials": {
      maxRequests: 5, // Conservative for credential testing
      burstAllowance: 1,
      windowMs: 300000, // 5 minutes
    },
    "/api/mexc/account": {
      maxRequests: 30,
      burstAllowance: 5,
      windowMs: 60000,
    },
    "/api/mexc/connectivity": {
      maxRequests: 60,
      burstAllowance: 10,
      windowMs: 60000,
    },
    // Public endpoints can have higher limits
    "/api/mexc/calendar": {
      maxRequests: 120,
      burstAllowance: 20,
      windowMs: 60000,
    },
    "/api/mexc/symbols": {
      maxRequests: 100,
      burstAllowance: 15,
      windowMs: 60000,
    },
  };

  private readonly priorityMultipliers = {
    low: 0.5,
    medium: 1.0,
    high: 1.5,
    premium: 2.0,
  };

  // Performance tracking
  private readonly adaptationThresholds = {
    slowResponseTime: 2000, // 2 seconds
    verySlowResponseTime: 5000, // 5 seconds
    lowSuccessRate: 0.8, // 80%
    veryLowSuccessRate: 0.6, // 60%
  };

  private cleanupInterval?: NodeJS.Timeout;

  private constructor() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 300000); // Clean up every 5 minutes
  }

  public static getInstance(): AdaptiveRateLimiterService {
    if (!AdaptiveRateLimiterService.instance) {
      AdaptiveRateLimiterService.instance = new AdaptiveRateLimiterService();
    }
    return AdaptiveRateLimiterService.instance;
  }

  /**
   * Check if request is allowed with adaptive rate limiting
   */
  async checkRateLimit(
    endpoint: string,
    userId?: string,
    userAgent?: string,
    _metadata?: Record<string, any>
  ): Promise<RateLimitResult> {
    const _startTime = Date.now();

    try {
      // Get configuration for this endpoint/user
      const config = this.getConfiguration(endpoint, userId);
      const key = this.generateKey(endpoint, userId);

      // Get current metrics
      const metrics = this.getOrCreateMetrics(key);

      // Check circuit breaker first
      if (config.circuitBreakerEnabled) {
        const circuitBreaker = circuitBreakerRegistry.getBreaker(`rate-limit-${endpoint}`);
        const cbStats = circuitBreaker.getStats();

        if (cbStats.state === "OPEN") {
          return {
            allowed: false,
            remainingRequests: 0,
            resetTime: Date.now() + 30000, // 30 seconds
            retryAfter: 30,
            circuitBreakerStatus: "OPEN",
            metadata: {
              algorithm: "circuit-breaker",
              currentWindowRequests: 0,
              averageResponseTime: metrics.averageResponseTime,
              successRate: metrics.successRate,
              adaptationFactor: metrics.adaptationFactor,
              burstTokens: 0,
            },
          };
        }
      }

      // Apply adaptive algorithm
      let result: RateLimitResult;

      if (config.tokenBucketEnabled) {
        result = await this.checkTokenBucket(key, config, metrics);
      } else {
        result = await this.checkSlidingWindow(key, config, metrics);
      }

      // Add adaptive delay suggestion
      if (result.allowed) {
        result.adaptiveDelay = this.calculateAdaptiveDelay(metrics);
      }

      // Update metrics
      this.updateRequestMetrics(key, result.allowed);

      return result;
    } catch (error) {
      console.error("[Adaptive Rate Limiter] Check failed:", error);

      await this.errorLogger.logError(error as Error, {
        context: "rate_limit_check",
        endpoint,
        userId,
        userAgent,
      });

      // Return conservative result on error
      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: Date.now() + 60000,
        retryAfter: 60,
        metadata: {
          algorithm: "error-fallback",
          currentWindowRequests: 0,
          averageResponseTime: 0,
          successRate: 0,
          adaptationFactor: 1.0,
          burstTokens: 0,
        },
      };
    }
  }

  /**
   * Record API response for adaptive learning with MEXC rate limit headers
   */
  async recordResponse(
    endpoint: string,
    userId: string | undefined,
    responseTime: number,
    success: boolean,
    statusCode?: number,
    headers?: Record<string, string>
  ): Promise<void> {
    const key = this.generateKey(endpoint, userId);
    const metrics = this.getOrCreateMetrics(key);

    // Update response time
    metrics.totalRequests++;
    metrics.lastResponseTime = responseTime;

    // Calculate moving average
    const alpha = 0.1; // Smoothing factor
    metrics.averageResponseTime = (1 - alpha) * metrics.averageResponseTime + alpha * responseTime;

    // Update success metrics
    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }

    metrics.successRate = metrics.successfulRequests / metrics.totalRequests;

    // FIXED: Process MEXC rate limiting headers to respect actual API limits
    if (headers && success) {
      this.processMexcRateLimitHeaders(endpoint, headers, metrics);
    }

    // Handle 429 rate limit responses
    if (statusCode === 429) {
      this.handleRateLimitResponse(endpoint, headers, metrics);
    }

    // Adaptive adjustment
    if (Date.now() - metrics.lastAdaptation > 30000) {
      // Adapt every 30 seconds
      const newFactor = this.calculateAdaptationFactor(metrics, responseTime, success);

      if (Math.abs(newFactor - metrics.adaptationFactor) > 0.1) {
        console.log(
          `[Adaptive Rate Limiter] Adapting ${key}: ${metrics.adaptationFactor.toFixed(2)} -> ${newFactor.toFixed(2)}`
        );

        metrics.adaptationFactor = newFactor;
        metrics.lastAdaptation = Date.now();

        // Update user adaptation history
        if (userId) {
          this.updateUserAdaptationHistory(userId, newFactor, success ? "performance" : "failure");
        }

        // Update circuit breaker if needed
        this.updateCircuitBreakerThresholds(endpoint, metrics);
      }
    }

    // Update circuit breaker status
    const circuitBreaker = circuitBreakerRegistry.getBreaker(`rate-limit-${endpoint}`);
    metrics.circuitBreakerState = circuitBreaker.getState();
  }

  /**
   * Token bucket rate limiting
   */
  private async checkTokenBucket(
    key: string,
    config: RateLimitConfig,
    metrics: EndpointMetrics
  ): Promise<RateLimitResult> {
    let bucket = this.tokenBuckets.get(key);
    const now = Date.now();

    if (!bucket) {
      bucket = {
        tokens: config.maxRequests,
        lastRefill: now,
        capacity: config.maxRequests + config.burstAllowance,
        refillRate: config.maxRequests / (config.windowMs / 1000), // tokens per second
      };
      this.tokenBuckets.set(key, bucket);
    }

    // Refill tokens
    const timePassed = (now - bucket.lastRefill) / 1000; // seconds
    const tokensToAdd = timePassed * bucket.refillRate * metrics.adaptationFactor;
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Check if token available
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;

      return {
        allowed: true,
        remainingRequests: Math.floor(bucket.tokens),
        resetTime: now + ((bucket.capacity - bucket.tokens) / bucket.refillRate) * 1000,
        metadata: {
          algorithm: "token-bucket",
          currentWindowRequests: config.maxRequests - Math.floor(bucket.tokens),
          averageResponseTime: metrics.averageResponseTime,
          successRate: metrics.successRate,
          adaptationFactor: metrics.adaptationFactor,
          burstTokens: Math.max(0, bucket.tokens - config.maxRequests),
        },
      };
    }
    // Calculate retry after
    const retryAfterSeconds = Math.ceil((1 - bucket.tokens) / bucket.refillRate);

    return {
      allowed: false,
      remainingRequests: 0,
      resetTime: now + retryAfterSeconds * 1000,
      retryAfter: retryAfterSeconds,
      metadata: {
        algorithm: "token-bucket",
        currentWindowRequests: config.maxRequests,
        averageResponseTime: metrics.averageResponseTime,
        successRate: metrics.successRate,
        adaptationFactor: metrics.adaptationFactor,
        burstTokens: 0,
      },
    };
  }

  /**
   * Sliding window rate limiting
   */
  private async checkSlidingWindow(
    key: string,
    config: RateLimitConfig,
    metrics: EndpointMetrics
  ): Promise<RateLimitResult> {
    let window = this.slidingWindows.get(key);
    const now = Date.now();
    const windowStart = now - config.windowMs;

    if (!window) {
      window = {
        requests: [],
        windowStart: now,
        windowSize: config.windowMs,
      };
      this.slidingWindows.set(key, window);
    }

    // Remove old requests
    window.requests = window.requests.filter((timestamp) => timestamp > windowStart);

    // Apply adaptation factor to max requests
    const adaptedMaxRequests = Math.floor(config.maxRequests * metrics.adaptationFactor);
    const maxWithBurst = adaptedMaxRequests + config.burstAllowance;

    if (window.requests.length < maxWithBurst) {
      window.requests.push(now);

      return {
        allowed: true,
        remainingRequests: maxWithBurst - window.requests.length,
        resetTime: Math.min(...window.requests) + config.windowMs,
        metadata: {
          algorithm: "sliding-window",
          currentWindowRequests: window.requests.length,
          averageResponseTime: metrics.averageResponseTime,
          successRate: metrics.successRate,
          adaptationFactor: metrics.adaptationFactor,
          burstTokens: Math.max(0, window.requests.length - adaptedMaxRequests),
        },
      };
    }
    // Calculate retry after
    const oldestRequest = Math.min(...window.requests);
    const retryAfterMs = oldestRequest + config.windowMs - now;

    return {
      allowed: false,
      remainingRequests: 0,
      resetTime: oldestRequest + config.windowMs,
      retryAfter: Math.ceil(retryAfterMs / 1000),
      metadata: {
        algorithm: "sliding-window",
        currentWindowRequests: window.requests.length,
        averageResponseTime: metrics.averageResponseTime,
        successRate: metrics.successRate,
        adaptationFactor: metrics.adaptationFactor,
        burstTokens: Math.max(0, window.requests.length - adaptedMaxRequests),
      },
    };
  }

  /**
   * Calculate adaptive delay suggestion
   */
  private calculateAdaptiveDelay(metrics: EndpointMetrics): number {
    let delay = 0;

    // Base delay on response time
    if (metrics.averageResponseTime > this.adaptationThresholds.verySlowResponseTime) {
      delay = 5000; // 5 seconds
    } else if (metrics.averageResponseTime > this.adaptationThresholds.slowResponseTime) {
      delay = 2000; // 2 seconds
    }

    // Increase delay for low success rates
    if (metrics.successRate < this.adaptationThresholds.veryLowSuccessRate) {
      delay = Math.max(delay, 3000);
    } else if (metrics.successRate < this.adaptationThresholds.lowSuccessRate) {
      delay = Math.max(delay, 1000);
    }

    // Apply adaptation factor
    delay = delay / metrics.adaptationFactor;

    return Math.max(100, delay); // Minimum 100ms delay
  }

  /**
   * Calculate adaptation factor based on performance
   */
  private calculateAdaptationFactor(
    metrics: EndpointMetrics,
    responseTime: number,
    success: boolean
  ): number {
    let factor = metrics.adaptationFactor;

    // Adjust based on response time
    if (responseTime > this.adaptationThresholds.verySlowResponseTime) {
      factor *= 0.7; // Reduce rate by 30%
    } else if (responseTime > this.adaptationThresholds.slowResponseTime) {
      factor *= 0.85; // Reduce rate by 15%
    } else if (responseTime < 500) {
      // Fast response
      factor *= 1.05; // Increase rate by 5%
    }

    // Adjust based on success rate
    if (metrics.successRate < this.adaptationThresholds.veryLowSuccessRate) {
      factor *= 0.5; // Reduce rate by 50%
    } else if (metrics.successRate < this.adaptationThresholds.lowSuccessRate) {
      factor *= 0.8; // Reduce rate by 20%
    } else if (metrics.successRate > 0.95) {
      // Very high success rate
      factor *= 1.1; // Increase rate by 10%
    }

    // Individual request impact
    if (!success) {
      factor *= 0.9; // Reduce slightly on failure
    }

    // Keep factor within reasonable bounds
    return Math.max(0.1, Math.min(2.0, factor));
  }

  /**
   * Update circuit breaker thresholds based on adaptation
   */
  private updateCircuitBreakerThresholds(endpoint: string, metrics: EndpointMetrics): void {
    const circuitBreaker = circuitBreakerRegistry.getBreaker(`rate-limit-${endpoint}`);

    // Adjust failure threshold based on adaptation factor
    // If we're being adaptive due to poor performance, make circuit breaker more sensitive
    if (metrics.adaptationFactor < 0.8) {
      // More sensitive to failures
      circuitBreaker.getStats().state; // This would need circuit breaker API enhancement
    }
  }

  /**
   * Get configuration for endpoint/user combination
   */
  private getConfiguration(endpoint: string, userId?: string): RateLimitConfig {
    let config = { ...this.defaultConfig };

    // Apply endpoint-specific config
    const endpointConfig = this.endpointConfigs[endpoint];
    if (endpointConfig) {
      config = { ...config, ...endpointConfig };
    }

    // Apply user-specific config
    if (userId) {
      const userLimits = this.userLimits.get(userId);
      if (userLimits?.customLimits[endpoint]) {
        config = { ...config, ...userLimits.customLimits[endpoint] };
      }

      // Apply priority multiplier
      if (userLimits?.priorityLevel) {
        const multiplier = this.priorityMultipliers[userLimits.priorityLevel];
        config.maxRequests = Math.floor(config.maxRequests * multiplier);
        config.burstAllowance = Math.floor(config.burstAllowance * multiplier);
      }
    }

    return config;
  }

  /**
   * Helper methods
   */
  private generateKey(endpoint: string, userId?: string): string {
    return userId ? `${endpoint}:${userId}` : endpoint;
  }

  private getOrCreateMetrics(key: string): EndpointMetrics {
    let metrics = this.endpointMetrics.get(key);

    if (!metrics) {
      metrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 1000, // Start with 1 second baseline
        lastResponseTime: 0,
        successRate: 1.0,
        adaptationFactor: 1.0,
        lastAdaptation: Date.now(),
        circuitBreakerState: "CLOSED",
      };
      this.endpointMetrics.set(key, metrics);
    }

    return metrics;
  }

  private updateRequestMetrics(key: string, allowed: boolean): void {
    const metrics = this.getOrCreateMetrics(key);

    if (!allowed) {
      // Track rate limit hits as failures for adaptation
      metrics.failedRequests++;
      metrics.totalRequests++;
      metrics.successRate = metrics.successfulRequests / metrics.totalRequests;
    }
  }

  private updateUserAdaptationHistory(userId: string, factor: number, reason: string): void {
    let userLimits = this.userLimits.get(userId);

    if (!userLimits) {
      userLimits = {
        userId,
        customLimits: {},
        priorityLevel: "medium",
        adaptationHistory: [],
      };
      this.userLimits.set(userId, userLimits);
    }

    userLimits.adaptationHistory.push({
      timestamp: Date.now(),
      factor,
      reason,
    });

    // Keep only last 50 adaptations
    if (userLimits.adaptationHistory.length > 50) {
      userLimits.adaptationHistory = userLimits.adaptationHistory.slice(-50);
    }
  }

  /**
   * Cleanup expired data
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    // Clean sliding windows
    for (const [key, window] of this.slidingWindows.entries()) {
      if (now - window.windowStart > maxAge) {
        this.slidingWindows.delete(key);
      }
    }

    // Clean old metrics
    for (const [key, metrics] of this.endpointMetrics.entries()) {
      if (now - metrics.lastAdaptation > maxAge && metrics.totalRequests === 0) {
        this.endpointMetrics.delete(key);
      }
    }

    console.log(
      `[Adaptive Rate Limiter] Cleanup completed - ${this.slidingWindows.size} windows, ${this.endpointMetrics.size} metrics`
    );
  }

  // ============================================================================
  // MEXC Rate Limiting Header Processing
  // ============================================================================

  /**
   * Process MEXC rate limiting headers to dynamically adjust limits
   * MEXC returns headers like X-MBX-USED-WEIGHT-1M, X-MBX-ORDER-COUNT-1S, etc.
   */
  private processMexcRateLimitHeaders(
    endpoint: string,
    headers: Record<string, string>,
    metrics: EndpointMetrics
  ): void {
    try {
      // Extract weight and order count headers (case-insensitive)
      const originalHeaderKeys = Object.keys(headers);

      // Check weight-based limits (1-minute window)
      const weightUsedHeaderKey = originalHeaderKeys.find(
        (key) =>
          key.toLowerCase().includes("x-mbx-used-weight") ||
          key.toLowerCase().includes("x-mexc-used-weight")
      );

      if (weightUsedHeaderKey) {
        const weightUsed = Number.parseInt(headers[weightUsedHeaderKey] || "0", 10);
        const weightLimit = this.extractWeightLimit(headers, weightUsedHeaderKey);

        if (weightUsed > 0 && weightLimit > 0) {
          const utilizationRate = weightUsed / weightLimit;
          this.adjustRateLimitBasedOnUtilization(endpoint, utilizationRate, "weight", metrics);
        }
      }

      // Check order count limits (1-second and 1-minute windows)
      const orderCount1sHeaderKey = originalHeaderKeys.find(
        (key) =>
          key.toLowerCase().includes("x-mbx-order-count-1s") ||
          key.toLowerCase().includes("x-mexc-order-count-1s")
      );

      if (orderCount1sHeaderKey) {
        const orderCount = Number.parseInt(headers[orderCount1sHeaderKey] || "0", 10);
        const orderLimit = this.extractOrderLimit(headers, orderCount1sHeaderKey);

        if (orderCount > 0 && orderLimit > 0) {
          const utilizationRate = orderCount / orderLimit;
          this.adjustRateLimitBasedOnUtilization(endpoint, utilizationRate, "order_1s", metrics);
        }
      }

      const orderCount1mHeaderKey = originalHeaderKeys.find(
        (key) =>
          key.toLowerCase().includes("x-mbx-order-count-1m") ||
          key.toLowerCase().includes("x-mexc-order-count-1m")
      );

      if (orderCount1mHeaderKey) {
        const orderCount = Number.parseInt(headers[orderCount1mHeaderKey] || "0", 10);
        const orderLimit = this.extractOrderLimit(headers, orderCount1mHeaderKey);

        if (orderCount > 0 && orderLimit > 0) {
          const utilizationRate = orderCount / orderLimit;
          this.adjustRateLimitBasedOnUtilization(endpoint, utilizationRate, "order_1m", metrics);
        }
      }

      console.log(`[Adaptive Rate Limiter] Processed MEXC headers for ${endpoint}`, {
        weightUsed: weightUsedHeaderKey ? headers[weightUsedHeaderKey] : "none",
        orderCount1s: orderCount1sHeaderKey ? headers[orderCount1sHeaderKey] : "none",
        orderCount1m: orderCount1mHeaderKey ? headers[orderCount1mHeaderKey] : "none",
      });
    } catch (error) {
      console.error(
        `[Adaptive Rate Limiter] Error processing MEXC headers for ${endpoint}:`,
        error
      );
    }
  }

  /**
   * Handle 429 rate limit responses with Retry-After header
   */
  private handleRateLimitResponse(
    endpoint: string,
    headers?: Record<string, string>,
    metrics?: EndpointMetrics
  ): void {
    try {
      // Look for Retry-After header
      const retryAfterHeader = headers
        ? Object.keys(headers).find((key) => key.toLowerCase() === "retry-after")
        : undefined;

      const retryAfterSeconds = retryAfterHeader
        ? Number.parseInt(headers![retryAfterHeader], 10)
        : 60;

      // Significantly reduce rate limit temporarily
      if (metrics) {
        metrics.adaptationFactor = Math.min(metrics.adaptationFactor * 0.1, 0.1); // Reduce to 10%
        metrics.lastAdaptation = Date.now();

        console.warn(`[Adaptive Rate Limiter] Rate limited on ${endpoint}`, {
          retryAfterSeconds,
          newAdaptationFactor: metrics.adaptationFactor,
          recommendation: `Wait ${retryAfterSeconds} seconds before retrying`,
        });
      }

      // Update endpoint-specific rate limits for this endpoint
      this.temporarilyReduceEndpointLimits(endpoint, retryAfterSeconds);
    } catch (error) {
      console.error(
        `[Adaptive Rate Limiter] Error handling rate limit response for ${endpoint}:`,
        error
      );
    }
  }

  /**
   * Extract weight limit from headers or use defaults
   */
  private extractWeightLimit(headers: Record<string, string>, weightHeader: string): number {
    // Look for weight limit header
    const limitHeader = Object.keys(headers).find(
      (key) =>
        key.toLowerCase().includes("x-mbx-weight-limit") ||
        key.toLowerCase().includes("x-mexc-weight-limit")
    );

    if (limitHeader) {
      return Number.parseInt(headers[limitHeader], 10);
    }

    // Default MEXC weight limits based on endpoint type
    if (weightHeader.includes("1m")) {
      return 6000; // Default 1-minute weight limit
    }

    return 1200; // Default weight limit
  }

  /**
   * Extract order limit from headers or use defaults
   */
  private extractOrderLimit(headers: Record<string, string>, orderHeader: string): number {
    // Look for order limit header
    const limitHeader = Object.keys(headers).find(
      (key) =>
        key.toLowerCase().includes("x-mbx-order-limit") ||
        key.toLowerCase().includes("x-mexc-order-limit")
    );

    if (limitHeader) {
      return Number.parseInt(headers[limitHeader], 10);
    }

    // Default MEXC order limits
    if (orderHeader.includes("1s")) {
      return 10; // Default 1-second order limit
    } else if (orderHeader.includes("1m")) {
      return 100; // Default 1-minute order limit
    }

    return 50; // Default order limit
  }

  /**
   * Adjust rate limits based on API utilization
   */
  private adjustRateLimitBasedOnUtilization(
    endpoint: string,
    utilizationRate: number,
    limitType: string,
    metrics: EndpointMetrics
  ): void {
    let newAdaptationFactor = metrics.adaptationFactor;

    // Adjust based on utilization rate
    if (utilizationRate > 0.9) {
      // Very high utilization - reduce rate significantly
      newAdaptationFactor = Math.max(newAdaptationFactor * 0.5, 0.1);
    } else if (utilizationRate > 0.7) {
      // High utilization - reduce rate moderately
      newAdaptationFactor = Math.max(newAdaptationFactor * 0.8, 0.3);
    } else if (utilizationRate > 0.5) {
      // Medium utilization - reduce rate slightly
      newAdaptationFactor = Math.max(newAdaptationFactor * 0.9, 0.5);
    } else if (utilizationRate < 0.2) {
      // Low utilization - can increase rate slightly
      newAdaptationFactor = Math.min(newAdaptationFactor * 1.1, 2.0);
    }

    // Only update if significant change
    if (Math.abs(newAdaptationFactor - metrics.adaptationFactor) > 0.05) {
      console.log(
        `[Adaptive Rate Limiter] Adjusting ${endpoint} based on ${limitType} utilization`,
        {
          utilizationRate: `${(utilizationRate * 100).toFixed(1)}%`,
          oldFactor: metrics.adaptationFactor.toFixed(2),
          newFactor: newAdaptationFactor.toFixed(2),
          limitType,
        }
      );

      metrics.adaptationFactor = newAdaptationFactor;
      metrics.lastAdaptation = Date.now();
    }
  }

  /**
   * Temporarily reduce endpoint limits after rate limiting
   */
  private temporarilyReduceEndpointLimits(endpoint: string, retryAfterSeconds: number): void {
    const currentConfig = this.endpointConfigs[endpoint];
    if (currentConfig) {
      // Temporarily reduce limits
      const reducedConfig = {
        ...currentConfig,
        maxRequests: Math.max(Math.floor((currentConfig.maxRequests || 100) * 0.5), 1),
        burstAllowance: Math.max(Math.floor((currentConfig.burstAllowance || 10) * 0.3), 1),
        windowMs: Math.max((currentConfig.windowMs || 60000) * 2, retryAfterSeconds * 1000),
      };

      this.endpointConfigs[endpoint] = reducedConfig;

      // Reset limits after some time (double the retry-after period)
      setTimeout(() => {
        this.endpointConfigs[endpoint] = currentConfig;
        console.log(`[Adaptive Rate Limiter] Reset limits for ${endpoint} after rate limit period`);
      }, retryAfterSeconds * 2000);

      console.log(`[Adaptive Rate Limiter] Temporarily reduced limits for ${endpoint}`, {
        retryAfterSeconds,
        newMaxRequests: reducedConfig.maxRequests,
        newBurstAllowance: reducedConfig.burstAllowance,
        newWindowMs: reducedConfig.windowMs,
      });
    }
  }

  /**
   * Public API methods
   */
  public setUserPriority(userId: string, priority: "low" | "medium" | "high" | "premium"): void {
    let userLimits = this.userLimits.get(userId);

    if (!userLimits) {
      userLimits = {
        userId,
        customLimits: {},
        priorityLevel: priority,
        adaptationHistory: [],
      };
    } else {
      userLimits.priorityLevel = priority;
    }

    this.userLimits.set(userId, userLimits);
    console.log(`[Adaptive Rate Limiter] Set user ${userId} priority to ${priority}`);
  }

  public setCustomLimits(userId: string, endpoint: string, config: Partial<RateLimitConfig>): void {
    let userLimits = this.userLimits.get(userId);

    if (!userLimits) {
      userLimits = {
        userId,
        customLimits: {},
        priorityLevel: "medium",
        adaptationHistory: [],
      };
    }

    userLimits.customLimits[endpoint] = { ...this.defaultConfig, ...config };
    this.userLimits.set(userId, userLimits);

    console.log(
      `[Adaptive Rate Limiter] Set custom limits for user ${userId} endpoint ${endpoint}`
    );
  }

  public getMetrics(key?: string): EndpointMetrics | Map<string, EndpointMetrics> {
    if (key) {
      return this.endpointMetrics.get(key) || this.getOrCreateMetrics(key);
    }
    return this.endpointMetrics;
  }

  public getStats(): {
    totalEndpoints: number;
    totalTokenBuckets: number;
    totalSlidingWindows: number;
    totalUsers: number;
    adaptationStats: {
      avgAdaptationFactor: number;
      adaptedEndpoints: number;
      recentAdaptations: number;
    };
  } {
    const metrics = Array.from(this.endpointMetrics.values());
    const avgAdaptationFactor =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.adaptationFactor, 0) / metrics.length
        : 1.0;

    const adaptedEndpoints = metrics.filter((m) => Math.abs(m.adaptationFactor - 1.0) > 0.1).length;

    const recentAdaptations = metrics.filter(
      (m) => Date.now() - m.lastAdaptation < 300000 // Last 5 minutes
    ).length;

    return {
      totalEndpoints: this.endpointMetrics.size,
      totalTokenBuckets: this.tokenBuckets.size,
      totalSlidingWindows: this.slidingWindows.size,
      totalUsers: this.userLimits.size,
      adaptationStats: {
        avgAdaptationFactor,
        adaptedEndpoints,
        recentAdaptations,
      },
    };
  }

  public clearCache(): void {
    this.endpointMetrics.clear();
    this.tokenBuckets.clear();
    this.slidingWindows.clear();
    console.log("[Adaptive Rate Limiter] Cache cleared");
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.clearCache();
  }
}

// Export singleton instance
export const adaptiveRateLimiter = AdaptiveRateLimiterService.getInstance();

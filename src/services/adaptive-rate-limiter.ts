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
    metadata?: Record<string, any>
  ): Promise<RateLimitResult> {
    const startTime = Date.now();

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
   * Record API response for adaptive learning
   */
  async recordResponse(
    endpoint: string,
    userId: string | undefined,
    responseTime: number,
    success: boolean,
    statusCode?: number
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
    } else {
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
    } else {
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

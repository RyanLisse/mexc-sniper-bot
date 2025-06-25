/**
 * Adaptive Rate Limiter Service
 *
 * Main service class that orchestrates all rate limiting functionality
 */

import { createLogger } from "../../lib/unified-logger";
import { circuitBreakerRegistry } from "../circuit-breaker";
import { ErrorLoggingService } from "../error-logging-service";
import { MexcRateLimiter } from "./mexc-rate-limiter";
import { SlidingWindowManager } from "./sliding-window";
import { TokenBucketManager } from "./token-bucket";
import type { EndpointMetrics, RateLimitConfig, RateLimitResult, UserLimits } from "./types";

const logger = createLogger("adaptive-rate-limiter", {
  enableStructuredLogging: process.env.NODE_ENV === "production",
  enablePerformanceLogging: true,
});

export class AdaptiveRateLimiterService {
  private static instance: AdaptiveRateLimiterService;
  private errorLogger = ErrorLoggingService.getInstance();

  // Component managers
  private tokenBucketManager = new TokenBucketManager();
  private slidingWindowManager = new SlidingWindowManager();
  private mexcRateLimiter = new MexcRateLimiter();

  // Core data structures
  private endpointMetrics = new Map<string, EndpointMetrics>();
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
        result = await this.tokenBucketManager.checkTokenBucket(key, config, metrics);
      } else {
        result = await this.slidingWindowManager.checkSlidingWindow(key, config, metrics);
      }

      // Add adaptive delay suggestion
      if (result.allowed) {
        result.adaptiveDelay = this.calculateAdaptiveDelay(metrics);
      }

      // Update metrics
      this.updateRequestMetrics(key, result.allowed);

      return result;
    } catch (error) {
      logger.error(
        "Check failed:",
        { endpoint, userId, userAgent },
        error instanceof Error ? error : new Error(String(error))
      );

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

    // Process MEXC rate limiting headers to respect actual API limits
    if (headers && success) {
      this.mexcRateLimiter.processMexcRateLimitHeaders(endpoint, headers, metrics);
    }

    // Handle 429 rate limit responses
    if (statusCode === 429) {
      this.mexcRateLimiter.handleRateLimitResponse(endpoint, headers, metrics);
    }

    // Adaptive adjustment
    if (Date.now() - metrics.lastAdaptation > 30000) {
      // Adapt every 30 seconds
      const newFactor = this.calculateAdaptationFactor(metrics, responseTime, success);

      if (Math.abs(newFactor - metrics.adaptationFactor) > 0.1) {
        logger.info(
          `Adapting ${key}: ${metrics.adaptationFactor.toFixed(2)} -> ${newFactor.toFixed(2)}`,
          { key, oldFactor: metrics.adaptationFactor, newFactor }
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
   * Get configuration for endpoint/user combination
   */
  private getConfiguration(endpoint: string, userId?: string): RateLimitConfig {
    let config = { ...this.defaultConfig };

    // Apply endpoint-specific config
    const endpointConfig = this.mexcRateLimiter.getEndpointConfig(endpoint);
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
   * Cleanup expired data
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    // Clean sliding windows
    this.slidingWindowManager.cleanup(maxAge);

    // Clean old metrics
    for (const [key, metrics] of this.endpointMetrics.entries()) {
      if (now - metrics.lastAdaptation > maxAge && metrics.totalRequests === 0) {
        this.endpointMetrics.delete(key);
      }
    }

    logger.info(`Cleanup completed - ${this.endpointMetrics.size} metrics`, {
      metricsCount: this.endpointMetrics.size,
    });
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
    logger.info(`Set user ${userId} priority to ${priority}`, { userId, priority });
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

    logger.info(`Set custom limits for user ${userId} endpoint ${endpoint}`, {
      userId,
      endpoint,
      config,
    });
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

    const tokenBucketStats = this.tokenBucketManager.getStats();
    const slidingWindowStats = this.slidingWindowManager.getStats();

    return {
      totalEndpoints: this.endpointMetrics.size,
      totalTokenBuckets: tokenBucketStats.totalBuckets,
      totalSlidingWindows: slidingWindowStats.totalWindows,
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
    this.tokenBucketManager.clearBuckets();
    this.slidingWindowManager.clearWindows();
    logger.info("Cache cleared");
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.clearCache();
  }
}

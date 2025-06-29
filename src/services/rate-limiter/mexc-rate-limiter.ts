/**
 * MEXC-Specific Rate Limiting Logic
 *
 * Handles MEXC API rate limiting headers and adaptive adjustments
 */

import { createLogger } from "../../lib/unified-logger";
import type { EndpointMetrics, RateLimitConfig } from "./types";

const logger = createLogger("mexc-rate-limiter", {
  enableStructuredLogging: process.env.NODE_ENV === "production",
  enablePerformanceLogging: true,
});

export class MexcRateLimiter {
  private endpointConfigs: Record<string, Partial<RateLimitConfig>>;

  constructor() {
    this.endpointConfigs = {
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
  }

  /**
   * Process MEXC rate limiting headers to dynamically adjust limits
   */
  processMexcRateLimitHeaders(
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

      // Check order count limits
      this.processOrderCountLimits(headers, originalHeaderKeys, endpoint, metrics);

      logger.info(`Processed MEXC headers for ${endpoint}`, {
        weightUsed: weightUsedHeaderKey ? headers[weightUsedHeaderKey] : "none",
      });
    } catch (error) {
      logger.error(
        `Error processing MEXC headers for ${endpoint}:`,
        { endpoint },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  } /**
   * Process order count limits for 1s and 1m windows
   */
  private processOrderCountLimits(
    headers: Record<string, string>,
    originalHeaderKeys: string[],
    endpoint: string,
    metrics: EndpointMetrics
  ): void {
    // Check order count limits (1-second window)
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

    // Check order count limits (1-minute window)
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
  }

  /**
   * Handle 429 rate limit responses with Retry-After header
   */
  handleRateLimitResponse(
    endpoint: string,
    headers?: Record<string, string>,
    metrics?: EndpointMetrics
  ): void {
    try {
      // Look for Retry-After header
      const retryAfterHeader = headers
        ? Object.keys(headers).find((key) => key.toLowerCase() === "retry-after")
        : undefined;

      const retryAfterSeconds = retryAfterHeader && headers?.[retryAfterHeader]
        ? Number.parseInt(headers[retryAfterHeader], 10)
        : 60;

      // Significantly reduce rate limit temporarily
      if (metrics) {
        metrics.adaptationFactor = Math.min(metrics.adaptationFactor * 0.1, 0.1); // Reduce to 10%
        metrics.lastAdaptation = Date.now();

        logger.warn(`Rate limited on ${endpoint}`, {
          endpoint,
          retryAfterSeconds,
          newAdaptationFactor: metrics.adaptationFactor,
          recommendation: `Wait ${retryAfterSeconds} seconds before retrying`,
        });
      }

      // Update endpoint-specific rate limits
      this.temporarilyReduceEndpointLimits(endpoint, retryAfterSeconds);
    } catch (error) {
      logger.error(
        `Error handling rate limit response for ${endpoint}:`,
        { endpoint },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  } /**
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
      logger.info(`Adjusting ${endpoint} based on ${limitType} utilization`, {
        endpoint,
        utilizationRate: `${(utilizationRate * 100).toFixed(1)}%`,
        oldFactor: metrics.adaptationFactor.toFixed(2),
        newFactor: newAdaptationFactor.toFixed(2),
        limitType,
      });

      metrics.adaptationFactor = newAdaptationFactor;
      metrics.lastAdaptation = Date.now();
    }
  } /**
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
        logger.info(`Reset limits for ${endpoint} after rate limit period`, { endpoint });
      }, retryAfterSeconds * 2000);

      logger.info(`Temporarily reduced limits for ${endpoint}`, {
        endpoint,
        retryAfterSeconds,
        newMaxRequests: reducedConfig.maxRequests,
        newBurstAllowance: reducedConfig.burstAllowance,
        newWindowMs: reducedConfig.windowMs,
      });
    }
  }

  /**
   * Get endpoint configuration
   */
  getEndpointConfig(endpoint: string): Partial<RateLimitConfig> | undefined {
    return this.endpointConfigs[endpoint];
  }

  /**
   * Update endpoint configuration
   */
  updateEndpointConfig(endpoint: string, config: Partial<RateLimitConfig>): void {
    this.endpointConfigs[endpoint] = { ...this.endpointConfigs[endpoint], ...config };
    logger.info(`Updated endpoint config for ${endpoint}`, { endpoint, config });
  }

  /**
   * Get all endpoint configurations
   */
  getAllConfigs(): Record<string, Partial<RateLimitConfig>> {
    return { ...this.endpointConfigs };
  }
}

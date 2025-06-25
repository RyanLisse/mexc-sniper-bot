/**
 * Token Bucket Rate Limiting Algorithm
 */

import { createLogger } from "../../lib/unified-logger";
import type { TokenBucket, RateLimitConfig, RateLimitResult, EndpointMetrics } from "./types";

const logger = createLogger("token-bucket", {
  enableStructuredLogging: process.env.NODE_ENV === 'production',
  enablePerformanceLogging: true,
});

export class TokenBucketManager {
  private tokenBuckets = new Map<string, TokenBucket>();

  /**
   * Check token bucket rate limiting
   */
  async checkTokenBucket(
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
   * Get bucket information for debugging
   */
  getBucket(key: string): TokenBucket | undefined {
    return this.tokenBuckets.get(key);
  }

  /**
   * Clear all buckets
   */
  clearBuckets(): void {
    this.tokenBuckets.clear();
    logger.info("Token buckets cleared");
  }

  /**
   * Get statistics
   */
  getStats(): { totalBuckets: number; keys: string[] } {
    return {
      totalBuckets: this.tokenBuckets.size,
      keys: Array.from(this.tokenBuckets.keys()),
    };
  }
}
/**
 * Sliding Window Rate Limiting Algorithm
 */

import { createLogger } from "../../lib/unified-logger";
import type { EndpointMetrics, RateLimitConfig, RateLimitResult, SlidingWindow } from "./types";

const logger = createLogger("sliding-window", {
  enableStructuredLogging: process.env.NODE_ENV === "production",
  enablePerformanceLogging: true,
});

export class SlidingWindowManager {
  private slidingWindows = new Map<string, SlidingWindow>();

  /**
   * Check sliding window rate limiting
   */
  async checkSlidingWindow(
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
   * Get window information for debugging
   */
  getWindow(key: string): SlidingWindow | undefined {
    return this.slidingWindows.get(key);
  }

  /**
   * Cleanup old windows
   */
  cleanup(maxAge: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, window] of this.slidingWindows.entries()) {
      if (now - window.windowStart > maxAge) {
        this.slidingWindows.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old sliding windows`);
    }

    return cleaned;
  }

  /**
   * Clear all windows
   */
  clearWindows(): void {
    this.slidingWindows.clear();
    logger.info("Sliding windows cleared");
  }

  /**
   * Get statistics
   */
  getStats(): { totalWindows: number; keys: string[] } {
    return {
      totalWindows: this.slidingWindows.size,
      keys: Array.from(this.slidingWindows.keys()),
    };
  }
}

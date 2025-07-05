/**
 * MEXC Retry Service
 *
 * Handles retry logic, error classification, and backoff strategies for MEXC API requests.
 * Extracted from mexc-api-client.ts for better modularity.
 */

import type {
  ErrorClassification,
  RateLimitInfo,
  RequestContext,
  RetryConfig,
} from "./mexc-api-types";

export class MexcRetryService {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[mexc-retry-service]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[mexc-retry-service]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error(
        "[mexc-retry-service]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: any) =>
      console.debug("[mexc-retry-service]", message, context || ""),
  };

  private retryConfig: RetryConfig;
  private recentErrors: Error[] = [];
  private successRate = 1.0;
  private lastRateLimitReset = 0;

  constructor(retryConfig: Partial<RetryConfig> = {}) {
    this.retryConfig = {
      maxRetries: retryConfig.maxRetries || 3,
      baseDelay: retryConfig.baseDelay || 1000,
      maxDelay: retryConfig.maxDelay || 30000,
      backoffMultiplier: retryConfig.backoffMultiplier || 2,
      retryableStatusCodes: retryConfig.retryableStatusCodes || [
        429, 500, 502, 503, 504,
      ],
      jitterFactor: retryConfig.jitterFactor || 0.1,
      adaptiveRetry: retryConfig.adaptiveRetry ?? true,
    };
  }

  /**
   * Determine if an error should trigger a retry
   */
  shouldRetry(error: Error, attempt: number, maxRetries: number): boolean {
    if (attempt >= maxRetries) {
      return false;
    }

    const classification = this.classifyError(error);
    return classification.isRetryable;
  }

  /**
   * Classify error for retry decision making
   */
  classifyError(error: Error): ErrorClassification {
    const message = error.message.toLowerCase();

    // Rate limiting - retryable with longer delay (check first for priority)
    if (message.includes("rate limit") || message.includes("429")) {
      return {
        isRetryable: true,
        category: "rate_limit",
        severity: "low",
        suggestedDelay: this.retryConfig.baseDelay * 4,
        suggestedBackoff: 2.5,
      };
    }

    // Server errors - retryable (check before timeout to catch gateway timeout)
    if (
      message.includes("http 500") ||
      message.includes("http 502") ||
      message.includes("http 503") ||
      message.includes("http 504") ||
      message.includes("internal server error") ||
      message.includes("bad gateway") ||
      message.includes("service unavailable") ||
      message.includes("gateway timeout")
    ) {
      return {
        isRetryable: true,
        category: "server",
        severity: "high",
        suggestedDelay: this.retryConfig.baseDelay * 2,
      };
    }

    // Timeout errors - retryable (exclude connection timeout which is network error, exclude gateway timeout which is server error)
    if (
      message.includes("timeout") &&
      !message.includes("connection timeout") &&
      !message.includes("gateway timeout")
    ) {
      return {
        isRetryable: true,
        category: "timeout",
        severity: "medium",
        suggestedDelay: this.retryConfig.baseDelay * 1.5,
      };
    }

    // Authentication errors - not retryable
    if (
      message.includes("unauthorized") ||
      message.includes("401") ||
      message.includes("403") ||
      message.includes("signature")
    ) {
      return {
        isRetryable: false,
        category: "authentication",
        severity: "critical",
      };
    }

    // Client errors - generally not retryable
    if (
      message.includes("400") ||
      message.includes("404") ||
      message.includes("invalid") ||
      message.includes("bad request")
    ) {
      return {
        isRetryable: false,
        category: "client",
        severity: "medium",
      };
    }

    // Network errors - always retryable (check after timeout to avoid conflicts)
    if (
      message.includes("connection timeout") ||
      message.includes("econnreset") ||
      message.includes("socket hang up") ||
      message.includes("network")
    ) {
      return {
        isRetryable: true,
        category: "network",
        severity: "medium",
        suggestedDelay: this.retryConfig.baseDelay,
      };
    }

    // Default: unknown errors are retryable with caution
    return {
      isRetryable: true,
      category: "network",
      severity: "medium",
      suggestedDelay: this.retryConfig.baseDelay,
    };
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(attempt: number): number {
    const baseDelay = this.retryConfig.baseDelay;
    const multiplier = this.retryConfig.backoffMultiplier;
    const jitterFactor = this.retryConfig.jitterFactor;

    // Exponential backoff: baseDelay * (multiplier ^ attempt)
    let delay = baseDelay * multiplier ** (attempt - 1);

    // Cap at max delay first
    delay = Math.min(delay, this.retryConfig.maxDelay);

    // Add jitter to prevent thundering herd (within bounds)
    const maxJitter = Math.min(
      delay * jitterFactor,
      this.retryConfig.maxDelay - delay
    );
    const jitter = maxJitter * (Math.random() * 2 - 1);
    delay += jitter;

    // Ensure we stay within bounds
    delay = Math.min(delay, this.retryConfig.maxDelay);
    delay = Math.max(delay, baseDelay);

    return delay;
  }

  /**
   * Calculate retry delay with error classification
   */
  calculateRetryDelayWithClassification(
    attempt: number,
    lastError: Error | null
  ): number {
    const baseDelay = this.calculateRetryDelay(attempt);

    if (!lastError) {
      return baseDelay;
    }

    const classification = this.classifyError(lastError);

    // Use suggested delay from classification if available
    if (classification.suggestedDelay) {
      let delay = classification.suggestedDelay;

      // Apply suggested backoff if available
      if (classification.suggestedBackoff && attempt > 1) {
        delay *= classification.suggestedBackoff ** (attempt - 1);
      }

      // Cap at max delay first
      delay = Math.min(delay, this.retryConfig.maxDelay);

      // Add jitter (within bounds)
      const maxJitter = Math.min(
        delay * this.retryConfig.jitterFactor,
        this.retryConfig.maxDelay - delay
      );
      const jitter = maxJitter * (Math.random() * 2 - 1);
      delay += jitter;

      // Ensure we stay within bounds
      delay = Math.min(delay, this.retryConfig.maxDelay);
      delay = Math.max(delay, this.retryConfig.baseDelay);

      return delay;
    }

    return baseDelay;
  }

  /**
   * Handle rate limiting response
   */
  async recordRateLimitingResponse(response: {
    status: number;
    headers: Record<string, string>;
  }): Promise<RateLimitInfo | null> {
    if (response.status !== 429) {
      return null;
    }

    const headers = response.headers;
    const remaining = parseInt(headers["x-ratelimit-remaining"] || "0", 10);
    const limit = parseInt(headers["x-ratelimit-limit"] || "1000", 10);
    const resetTime = parseInt(headers["x-ratelimit-reset"] || "0", 10);
    const retryAfter = parseInt(headers["retry-after"] || "60", 10);

    this.lastRateLimitReset = resetTime * 1000; // Convert to milliseconds

    return {
      remaining,
      limit,
      resetTime: resetTime * 1000,
      retryAfter: retryAfter * 1000,
    };
  }

  /**
   * Handle rate limit error with appropriate delay
   */
  async handleRateLimitError(rateLimitInfo: RateLimitInfo): Promise<void> {
    const now = Date.now();

    // Calculate delay based on rate limit info
    let delay = rateLimitInfo.retryAfter || this.retryConfig.baseDelay * 4;

    // If we have reset time, calculate delay until reset
    if (rateLimitInfo.resetTime > now) {
      const timeUntilReset = rateLimitInfo.resetTime - now;
      delay = Math.min(delay, timeUntilReset + 1000); // Add 1 second buffer
    }

    // Cap delay at max
    delay = Math.min(delay, this.retryConfig.maxDelay);

    console.warn(
      `Rate limited. Waiting ${delay}ms before retry. Remaining: ${rateLimitInfo.remaining}/${rateLimitInfo.limit}`
    );

    await this.sleep(delay);
  }

  /**
   * Update success rate for adaptive retry
   */
  updateSuccessRate(success: boolean): void {
    if (!this.retryConfig.adaptiveRetry) {
      return;
    }

    // Track recent errors for adaptive retry
    if (!success) {
      const error = new Error("Request failed");
      (error as any).timestamp = Date.now();
      this.recentErrors.push(error);

      // Keep only last 100 errors
      if (this.recentErrors.length > 100) {
        this.recentErrors = this.recentErrors.slice(-100);
      }
    }

    // Calculate success rate over recent requests
    const recentFailures = this.recentErrors.filter(
      (error) => Date.now() - ((error as any).timestamp || 0) < 300000 // Last 5 minutes
    ).length;

    // Approximate success rate based on recent failures
    this.successRate = Math.max(0.1, 1 - recentFailures / 100);
  }

  /**
   * Get adaptive retry multiplier based on recent success rate
   */
  getAdaptiveRetryMultiplier(): number {
    if (!this.retryConfig.adaptiveRetry) {
      return 1;
    }

    // Increase retry delay when success rate is low
    if (this.successRate < 0.5) {
      return 2.0; // Double the delay
    } else if (this.successRate < 0.8) {
      return 1.5; // Increase delay by 50%
    }

    return 1.0; // Normal delay
  }

  /**
   * Execute retry logic for a request
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: RequestContext,
    maxRetries?: number
  ): Promise<T> {
    const retries = maxRetries || this.retryConfig.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        context.attempt = attempt;
        const result = await operation();
        this.updateSuccessRate(true);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.updateSuccessRate(false);

        // Check if we should retry (don't retry on last attempt)
        if (
          attempt > retries ||
          !this.shouldRetry(lastError, attempt - 1, retries)
        ) {
          throw lastError;
        }

        // Calculate delay for next retry
        const baseDelay = this.calculateRetryDelayWithClassification(
          attempt,
          lastError
        );
        const adaptiveMultiplier = this.getAdaptiveRetryMultiplier();
        const delay = baseDelay * adaptiveMultiplier;

        console.warn(
          `Request failed (attempt ${attempt}/${retries + 1}). Retrying in ${delay}ms...`,
          {
            error: lastError.message,
            endpoint: context.endpoint,
            requestId: context.requestId,
          }
        );

        await this.sleep(delay);
      }
    }

    throw lastError || new Error("Max retries exceeded");
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current retry configuration
   */
  getRetryConfig(): RetryConfig {
    return { ...this.retryConfig };
  }

  /**
   * Update retry configuration
   */
  updateRetryConfig(updates: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...updates };
  }

  /**
   * Get retry statistics
   */
  getRetryStats(): {
    successRate: number;
    recentErrors: number;
    lastRateLimitReset: number;
  } {
    return {
      successRate: this.successRate,
      recentErrors: this.recentErrors.length,
      lastRateLimitReset: this.lastRateLimitReset,
    };
  }
}

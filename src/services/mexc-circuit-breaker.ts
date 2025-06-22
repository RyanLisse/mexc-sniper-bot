/**
 * MEXC Circuit Breaker and Rate Limiting
 *
 * Extracted from unified-mexc-service.ts for better modularity.
 * Provides reliability patterns and request rate management for MEXC API calls.
 *
 * Features:
 * - Circuit breaker pattern for fault tolerance
 * - Rate limiting for API compliance
 * - Request queuing and throttling
 * - Performance monitoring and metrics
 * - Automatic recovery mechanisms
 */

// ============================================================================
// Circuit Breaker Implementation
// ============================================================================

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  halfOpenMaxRequests: number;
}

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failures: number;
  successes: number;
  lastFailureTime: number;
  totalRequests: number;
  failureRate: number;
}

export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

/**
 * Circuit Breaker for reliable API communication
 * Prevents cascading failures by temporarily blocking requests when failures exceed threshold
 */
export class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private state: CircuitBreakerState = "CLOSED";
  private halfOpenRequestCount = 0;
  private totalRequests = 0;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      recoveryTimeout: config.recoveryTimeout || 60000, // 1 minute
      monitoringPeriod: config.monitoringPeriod || 300000, // 5 minutes
      halfOpenMaxRequests: config.halfOpenMaxRequests || 3,
    };
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === "OPEN") {
      if (this.shouldAttemptReset()) {
        this.state = "HALF_OPEN";
        this.halfOpenRequestCount = 0;
      } else {
        throw new Error(
          `Circuit breaker is OPEN. Last failure: ${new Date(this.lastFailureTime).toISOString()}`
        );
      }
    }

    if (this.state === "HALF_OPEN") {
      if (this.halfOpenRequestCount >= this.config.halfOpenMaxRequests) {
        throw new Error("Circuit breaker is HALF_OPEN and at request limit");
      }
      this.halfOpenRequestCount++;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Check if circuit breaker is open
   */
  isOpen(): boolean {
    return this.state === "OPEN";
  }

  /**
   * Check if circuit breaker is closed (normal operation)
   */
  isClosed(): boolean {
    return this.state === "CLOSED";
  }

  /**
   * Check if circuit breaker is half-open (testing recovery)
   */
  isHalfOpen(): boolean {
    return this.state === "HALF_OPEN";
  }

  /**
   * Get current failure count
   */
  getFailureCount(): number {
    return this.failures;
  }

  /**
   * Get current success count
   */
  getSuccessCount(): number {
    return this.successes;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      totalRequests: this.totalRequests,
      failureRate: this.totalRequests > 0 ? this.failures / this.totalRequests : 0,
    };
  }

  /**
   * Get circuit breaker configuration
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
    this.state = "CLOSED";
    this.halfOpenRequestCount = 0;
    this.totalRequests = 0;
  }

  /**
   * Force circuit breaker to open state
   */
  forceOpen(): void {
    this.state = "OPEN";
    this.lastFailureTime = Date.now();
  }

  /**
   * Force circuit breaker to closed state
   */
  forceClosed(): void {
    this.state = "CLOSED";
    this.failures = 0;
    this.halfOpenRequestCount = 0;
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.successes++;

    if (this.state === "HALF_OPEN") {
      // If we've had enough successful requests in half-open state, close the circuit
      if (this.halfOpenRequestCount >= this.config.halfOpenMaxRequests) {
        this.state = "CLOSED";
        this.failures = 0;
      }
    } else {
      // Reset failure count on successful operation in closed state
      this.failures = 0;
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN") {
      // If we fail in half-open state, go back to open
      this.state = "OPEN";
    } else if (this.failures >= this.config.failureThreshold) {
      // If failures exceed threshold, open the circuit
      this.state = "OPEN";
    }
  }

  /**
   * Check if we should attempt to reset the circuit breaker
   */
  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime > this.config.recoveryTimeout;
  }
}

// ============================================================================
// Rate Limiter Implementation
// ============================================================================

export interface RateLimiterConfig {
  maxRequests: number;
  windowSizeMs: number;
  burstSize: number;
  queueSize: number;
}

export interface RateLimiterStats {
  currentRequests: number;
  queuedRequests: number;
  totalRequests: number;
  rejectedRequests: number;
  averageWaitTime: number;
  currentWindowStart: number;
}

/**
 * Rate Limiter for API request throttling
 * Ensures compliance with MEXC API rate limits
 */
export class RateLimiter {
  private requests: number[] = [];
  private queue: Array<{ resolve: Function; reject: Function; timestamp: number }> = [];
  private config: RateLimiterConfig;
  private totalRequests = 0;
  private rejectedRequests = 0;
  private totalWaitTime = 0;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = {
      maxRequests: config.maxRequests || 50, // MEXC allows ~1200 requests per minute
      windowSizeMs: config.windowSizeMs || 60000, // 1 minute window
      burstSize: config.burstSize || 10, // Allow small bursts
      queueSize: config.queueSize || 100, // Maximum queued requests
    };
  }

  /**
   * Wait if rate limit would be exceeded
   */
  async waitIfNeeded(): Promise<void> {
    return new Promise((resolve, reject) => {
      const now = Date.now();
      this.totalRequests++;

      // Clean up old requests outside the window
      this.requests = this.requests.filter((time) => now - time < this.config.windowSizeMs);

      // Check if we can make the request immediately
      if (this.requests.length < this.config.maxRequests) {
        this.requests.push(now);
        resolve();
        return;
      }

      // Check if queue is full
      if (this.queue.length >= this.config.queueSize) {
        this.rejectedRequests++;
        reject(new Error("Rate limiter queue is full"));
        return;
      }

      // Add to queue
      this.queue.push({ resolve, reject, timestamp: now });
      this.processQueue();
    });
  }

  /**
   * Check if request would be rate limited
   */
  wouldBeRateLimited(): boolean {
    const now = Date.now();
    const recentRequests = this.requests.filter((time) => now - time < this.config.windowSizeMs);
    return recentRequests.length >= this.config.maxRequests;
  }

  /**
   * Get time until next request can be made
   */
  getTimeUntilNextRequest(): number {
    if (!this.wouldBeRateLimited()) {
      return 0;
    }

    const now = Date.now();
    const oldestRequest = Math.min(...this.requests);
    return Math.max(0, this.config.windowSizeMs - (now - oldestRequest));
  }

  /**
   * Get current request count in window
   */
  getCurrentRequestCount(): number {
    const now = Date.now();
    return this.requests.filter((time) => now - time < this.config.windowSizeMs).length;
  }

  /**
   * Get rate limiter statistics
   */
  getStats(): RateLimiterStats {
    const now = Date.now();
    const currentRequests = this.getCurrentRequestCount();
    const averageWaitTime = this.totalRequests > 0 ? this.totalWaitTime / this.totalRequests : 0;
    const currentWindowStart = this.requests.length > 0 ? Math.min(...this.requests) : now;

    return {
      currentRequests,
      queuedRequests: this.queue.length,
      totalRequests: this.totalRequests,
      rejectedRequests: this.rejectedRequests,
      averageWaitTime,
      currentWindowStart,
    };
  }

  /**
   * Get rate limiter configuration
   */
  getConfig(): RateLimiterConfig {
    return { ...this.config };
  }

  /**
   * Reset rate limiter state
   */
  reset(): void {
    this.requests = [];
    this.queue.forEach((item) => item.reject(new Error("Rate limiter reset")));
    this.queue = [];
    this.totalRequests = 0;
    this.rejectedRequests = 0;
    this.totalWaitTime = 0;
  }

  /**
   * Process queued requests
   */
  private processQueue(): void {
    if (this.queue.length === 0) {
      return;
    }

    const now = Date.now();

    // Clean up old requests
    this.requests = this.requests.filter((time) => now - time < this.config.windowSizeMs);

    // Process as many queued requests as possible
    while (this.queue.length > 0 && this.requests.length < this.config.maxRequests) {
      const item = this.queue.shift()!;
      const waitTime = now - item.timestamp;
      this.totalWaitTime += waitTime;

      this.requests.push(now);
      item.resolve();
    }

    // Schedule next processing if queue is not empty
    if (this.queue.length > 0) {
      const delay = this.getTimeUntilNextRequest();
      setTimeout(() => this.processQueue(), Math.max(delay, 100));
    }
  }
}

// ============================================================================
// Combined Reliability Manager
// ============================================================================

export interface ReliabilityConfig {
  circuitBreaker: Partial<CircuitBreakerConfig>;
  rateLimiter: Partial<RateLimiterConfig>;
  enableCircuitBreaker: boolean;
  enableRateLimiter: boolean;
}

/**
 * Combined reliability manager with circuit breaker and rate limiting
 */
export class MexcReliabilityManager {
  private circuitBreaker: CircuitBreaker;
  private rateLimiter: RateLimiter;
  private config: ReliabilityConfig;

  constructor(config: Partial<ReliabilityConfig> = {}) {
    this.config = {
      circuitBreaker: config.circuitBreaker || {},
      rateLimiter: config.rateLimiter || {},
      enableCircuitBreaker: config.enableCircuitBreaker ?? true,
      enableRateLimiter: config.enableRateLimiter ?? true,
    };

    this.circuitBreaker = new CircuitBreaker(this.config.circuitBreaker);
    this.rateLimiter = new RateLimiter(this.config.rateLimiter);
  }

  /**
   * Execute operation with full reliability protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Apply rate limiting first
    if (this.config.enableRateLimiter) {
      await this.rateLimiter.waitIfNeeded();
    }

    // Then apply circuit breaker protection
    if (this.config.enableCircuitBreaker) {
      return this.circuitBreaker.execute(operation);
    }

    return operation();
  }

  /**
   * Get combined statistics
   */
  getStats(): {
    circuitBreaker: CircuitBreakerStats;
    rateLimiter: RateLimiterStats;
  } {
    return {
      circuitBreaker: this.circuitBreaker.getStats(),
      rateLimiter: this.rateLimiter.getStats(),
    };
  }

  /**
   * Check if requests are currently being blocked
   */
  isBlocked(): boolean {
    return (
      (this.config.enableCircuitBreaker && this.circuitBreaker.isOpen()) ||
      (this.config.enableRateLimiter && this.rateLimiter.wouldBeRateLimited())
    );
  }

  /**
   * Get blocking reason
   */
  getBlockingReason(): string | null {
    if (this.config.enableCircuitBreaker && this.circuitBreaker.isOpen()) {
      return "Circuit breaker is open";
    }
    if (this.config.enableRateLimiter && this.rateLimiter.wouldBeRateLimited()) {
      return "Rate limit exceeded";
    }
    return null;
  }

  /**
   * Reset all reliability components
   */
  reset(): void {
    this.circuitBreaker.reset();
    this.rateLimiter.reset();
  }

  /**
   * Get status for compatibility with UnifiedMexcService
   */
  getStatus(): {
    state: CircuitBreakerState;
    failures: number;
    lastFailureTime?: string;
    nextAttemptTime?: string;
  } {
    const cbStats = this.circuitBreaker.getStats();
    return {
      state: cbStats.state,
      failures: cbStats.failures,
      lastFailureTime:
        cbStats.lastFailureTime > 0 ? new Date(cbStats.lastFailureTime).toISOString() : undefined,
      nextAttemptTime: undefined, // Not implemented in current circuit breaker
    };
  }

  /**
   * Get individual components for advanced usage
   */
  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a circuit breaker optimized for MEXC API
 */
export function createMexcCircuitBreaker(config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
  const defaultConfig: Partial<CircuitBreakerConfig> = {
    failureThreshold: 5, // Open after 5 failures
    recoveryTimeout: 60000, // Try recovery after 1 minute
    monitoringPeriod: 300000, // 5 minute monitoring window
    halfOpenMaxRequests: 3, // Test with 3 requests in half-open state
  };

  return new CircuitBreaker({ ...defaultConfig, ...config });
}

/**
 * Create a rate limiter optimized for MEXC API
 */
export function createMexcRateLimiter(config?: Partial<RateLimiterConfig>): RateLimiter {
  const defaultConfig: Partial<RateLimiterConfig> = {
    maxRequests: 50, // Conservative limit for MEXC
    windowSizeMs: 60000, // 1 minute window
    burstSize: 10, // Allow small bursts
    queueSize: 100, // Reasonable queue size
  };

  return new RateLimiter({ ...defaultConfig, ...config });
}

/**
 * Create a complete reliability manager for MEXC API
 */
export function createMexcReliabilityManager(
  config?: Partial<ReliabilityConfig>
): MexcReliabilityManager {
  return new MexcReliabilityManager(config);
}

// ============================================================================
// Global Instance Management
// ============================================================================

let globalReliabilityManager: MexcReliabilityManager | null = null;

/**
 * Get or create the global reliability manager
 */
export function getGlobalReliabilityManager(): MexcReliabilityManager {
  if (!globalReliabilityManager) {
    globalReliabilityManager = createMexcReliabilityManager();
  }
  return globalReliabilityManager;
}

/**
 * Reset the global reliability manager
 */
export function resetGlobalReliabilityManager(): void {
  if (globalReliabilityManager) {
    globalReliabilityManager.reset();
    globalReliabilityManager = null;
  }
}

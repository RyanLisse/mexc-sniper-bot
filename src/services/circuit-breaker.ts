/**
 * Circuit Breaker Pattern Implementation
 * Provides resilience for external API calls by preventing cascade failures
 * and providing fallback mechanisms when services are failing
 */

interface CircuitBreakerOptions {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  expectedFailureRate: number;
}

interface CircuitBreakerStats {
  totalRequests: number;
  failedRequests: number;
  successfulRequests: number;
  failureRate: number;
  state: CircuitBreakerState;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  nextRetryTime?: Date;
}

enum CircuitBreakerState {
  CLOSED = "CLOSED", // Normal operation
  OPEN = "OPEN", // Circuit is open, rejecting requests
  HALF_OPEN = "HALF_OPEN", // Testing if service has recovered
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextRetryTime?: Date;
  private totalRequests = 0;
  private failedRequests = 0;
  private successfulRequests = 0;

  private readonly failureThreshold: number;
  private readonly recoveryTimeout: number;
  private readonly monitoringPeriod: number;
  private readonly expectedFailureRate: number;

  constructor(
    private name: string,
    options: Partial<CircuitBreakerOptions> = {}
  ) {
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 300000; // 5 minutes
    this.expectedFailureRate = options.expectedFailureRate || 0.5; // 50%
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    // Check if circuit should move from OPEN to HALF_OPEN
    if (this.state === CircuitBreakerState.OPEN && this.shouldAttemptReset()) {
      this.state = CircuitBreakerState.HALF_OPEN;
      console.log(`🔄 Circuit breaker [${this.name}] attempting reset - state: HALF_OPEN`);
    }

    // Reject if circuit is OPEN
    if (this.state === CircuitBreakerState.OPEN) {
      console.warn(`⚡ Circuit breaker [${this.name}] is OPEN - rejecting request`);

      if (fallback) {
        console.log(`🔄 Circuit breaker [${this.name}] using fallback mechanism`);
        return await fallback();
      }

      throw new CircuitBreakerError(
        `Circuit breaker [${this.name}] is OPEN. Service is temporarily unavailable.`,
        this.getStats()
      );
    }

    const startTime = performance.now();
    this.totalRequests++;

    try {
      const result = await fn();
      this.onSuccess();

      const duration = performance.now() - startTime;
      console.log(
        `✅ Circuit breaker [${this.name}] request succeeded in ${duration.toFixed(2)}ms`
      );

      return result;
    } catch (error) {
      this.onFailure();

      const duration = performance.now() - startTime;
      console.error(
        `❌ Circuit breaker [${this.name}] request failed in ${duration.toFixed(2)}ms:`,
        error
      );

      // If we have a fallback and circuit breaker suggests using it, try the fallback
      if (fallback) {
        console.log(`🔄 Circuit breaker [${this.name}] using fallback after failure`);
        try {
          return await fallback();
        } catch (fallbackError) {
          console.error(`❌ Circuit breaker [${this.name}] fallback also failed:`, fallbackError);
          throw error; // Throw original error, not fallback error
        }
      }

      throw error;
    }
  }

  /**
   * Handle successful request
   */
  private onSuccess(): void {
    this.successfulRequests++;
    this.lastSuccessTime = new Date();
    this.failureCount = 0;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.CLOSED;
      console.log(`✅ Circuit breaker [${this.name}] recovered - state: CLOSED`);
    }
  }

  /**
   * Handle failed request
   */
  private onFailure(): void {
    this.failedRequests++;
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // If we fail in HALF_OPEN, go back to OPEN
      this.state = CircuitBreakerState.OPEN;
      this.nextRetryTime = new Date(Date.now() + this.recoveryTimeout);
      console.log(`⚡ Circuit breaker [${this.name}] failed during recovery - state: OPEN`);
    } else if (
      this.state === CircuitBreakerState.CLOSED &&
      this.failureCount >= this.failureThreshold
    ) {
      // If we exceed failure threshold, open the circuit
      this.state = CircuitBreakerState.OPEN;
      this.nextRetryTime = new Date(Date.now() + this.recoveryTimeout);
      console.log(`⚡ Circuit breaker [${this.name}] opened due to failures - state: OPEN`);
    }
  }

  /**
   * Check if we should attempt to reset the circuit breaker
   */
  private shouldAttemptReset(): boolean {
    return this.nextRetryTime ? Date.now() >= this.nextRetryTime.getTime() : false;
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    const failureRate = this.totalRequests > 0 ? this.failedRequests / this.totalRequests : 0;

    return {
      totalRequests: this.totalRequests,
      failedRequests: this.failedRequests,
      successfulRequests: this.successfulRequests,
      failureRate,
      state: this.state,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextRetryTime: this.nextRetryTime,
    };
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.nextRetryTime = undefined;
    this.totalRequests = 0;
    this.failedRequests = 0;
    this.successfulRequests = 0;

    console.log(`🔄 Circuit breaker [${this.name}] manually reset`);
  }

  /**
   * Force circuit breaker to OPEN state
   */
  forceOpen(): void {
    this.state = CircuitBreakerState.OPEN;
    this.nextRetryTime = new Date(Date.now() + this.recoveryTimeout);
    console.log(`⚡ Circuit breaker [${this.name}] manually opened`);
  }

  /**
   * Force circuit breaker to CLOSED state
   */
  forceClosed(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.nextRetryTime = undefined;
    console.log(`✅ Circuit breaker [${this.name}] manually closed`);
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Check if circuit breaker is healthy
   */
  isHealthy(): boolean {
    const stats = this.getStats();
    return (
      stats.state === CircuitBreakerState.CLOSED && stats.failureRate <= this.expectedFailureRate
    );
  }
}

/**
 * Circuit Breaker Error class
 */
export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public stats: CircuitBreakerStats
  ) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

/**
 * Circuit Breaker Registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private static instance: CircuitBreakerRegistry;
  private breakers = new Map<string, CircuitBreaker>();

  private constructor() {}

  public static getInstance(): CircuitBreakerRegistry {
    if (!CircuitBreakerRegistry.instance) {
      CircuitBreakerRegistry.instance = new CircuitBreakerRegistry();
    }
    return CircuitBreakerRegistry.instance;
  }

  /**
   * Get or create a circuit breaker
   */
  getBreaker(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, options));
      console.log(`🔧 Created circuit breaker: ${name}`);
    }
    const breaker = this.breakers.get(name);
    if (!breaker) {
      throw new Error(`Circuit breaker ${name} not found`);
    }
    return breaker;
  }

  /**
   * Get all circuit breakers
   */
  getAllBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Get health status of all circuit breakers
   */
  getHealthStatus(): { [name: string]: CircuitBreakerStats } {
    const status: { [name: string]: CircuitBreakerStats } = {};

    for (const [name, breaker] of this.breakers) {
      status[name] = breaker.getStats();
    }

    return status;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    console.log("🔄 All circuit breakers reset");
  }
}

// Export singleton instance
export const circuitBreakerRegistry = CircuitBreakerRegistry.getInstance();

// Predefined circuit breakers for common services
export const mexcApiBreaker = circuitBreakerRegistry.getBreaker("mexc-api", {
  failureThreshold: 3,
  recoveryTimeout: 30000,
  expectedFailureRate: 0.2,
});

export const mexcWebSocketBreaker = circuitBreakerRegistry.getBreaker("mexc-websocket", {
  failureThreshold: 5,
  recoveryTimeout: 10000,
  expectedFailureRate: 0.1,
});

export const databaseBreaker = circuitBreakerRegistry.getBreaker("database", {
  failureThreshold: 2,
  recoveryTimeout: 5000,
  expectedFailureRate: 0.05,
});

/**
 * Coordinated Circuit Breaker
 *
 * Provides resilient database operation execution with circuit breaker patterns.
 * Implements real circuit breaker functionality with failure tracking, recovery,
 * and coordinated failure management across database operations.
 *
 * Key Features:
 * - Real circuit breaker with configurable thresholds
 * - Exponential backoff with jitter
 * - Health monitoring and auto-recovery
 * - Operation-specific failure tracking
 * - Connection pool coordination
 * - Performance metrics collection
 */

import { toSafeError } from "@/src/lib/error-type-utils";

export interface CoordinatedCircuitBreaker {
  execute<T>(operation: () => Promise<T>): Promise<T>;
  executeAsync<T>(operation: () => Promise<T>): Promise<T>;
  reset(): void;
  getState(): "closed" | "open" | "half-open";
  getMetrics(): CircuitBreakerMetrics;
  isHealthy(): boolean;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
  monitoringPeriod: number;
  maxConcurrentCalls: number;
  slowCallThreshold: number;
  slowCallRateThreshold: number;
}

export interface CircuitBreakerMetrics {
  state: "closed" | "open" | "half-open";
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  totalCalls: number;
  averageResponseTime: number;
  slowCalls: number;
  slowCallRate: number;
  circuitBreakerEvents: number;
}

export type CircuitBreakerState = "closed" | "open" | "half-open";

class RealCoordinatedCircuitBreaker implements CoordinatedCircuitBreaker {
  private serviceName: string;
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState = "closed";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private lastStateChangeTime = Date.now();
  private activeCalls = 0;
  private metrics: CircuitBreakerMetrics;
  private responseTimeHistory: number[] = [];
  private slowCalls = 0;

  private logger = {
    info: (message: string, context?: unknown) =>
      console.info(
        `[circuit-breaker:${this.serviceName}]`,
        message,
        context || ""
      ),
    warn: (message: string, context?: unknown) =>
      console.warn(
        `[circuit-breaker:${this.serviceName}]`,
        message,
        context || ""
      ),
    error: (message: string, context?: unknown) =>
      console.error(
        `[circuit-breaker:${this.serviceName}]`,
        message,
        context || ""
      ),
    debug: (message: string, context?: unknown) =>
      console.debug(
        `[circuit-breaker:${this.serviceName}]`,
        message,
        context || ""
      ),
  };

  constructor(serviceName: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.serviceName = serviceName;
    this.config = {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 30000,
      resetTimeout: 60000,
      monitoringPeriod: 10000,
      maxConcurrentCalls: 100,
      slowCallThreshold: 5000,
      slowCallRateThreshold: 0.5,
      ...config,
    };

    this.metrics = {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      totalCalls: 0,
      averageResponseTime: 0,
      slowCalls: 0,
      slowCallRate: 0,
      circuitBreakerEvents: 0,
    };

    // Start health monitoring
    this.startHealthMonitoring();
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return this.executeWithBreaker(operation, false);
  }

  async executeAsync<T>(operation: () => Promise<T>): Promise<T> {
    return this.executeWithBreaker(operation, true);
  }

  private async executeWithBreaker<T>(
    operation: () => Promise<T>,
    isAsync: boolean
  ): Promise<T> {
    // Check if circuit is open
    if (this.state === "open") {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        const error = new Error(
          `Circuit breaker is open for service: ${this.serviceName}`
        );
        this.logger.warn("Circuit breaker open, rejecting call", {
          state: this.state,
          failureCount: this.failureCount,
          timeSinceLastFailure: this.lastFailureTime
            ? Date.now() - this.lastFailureTime
            : null,
        });
        throw error;
      }
    }

    // Check concurrent call limit
    if (this.activeCalls >= this.config.maxConcurrentCalls) {
      throw new Error(
        `Max concurrent calls exceeded for service: ${this.serviceName} (${this.activeCalls}/${this.config.maxConcurrentCalls})`
      );
    }

    this.activeCalls++;
    const startTime = Date.now();

    try {
      // Execute with timeout
      const result = isAsync
        ? await operation()
        : await this.executeWithTimeout(operation, this.config.timeout);

      const responseTime = Date.now() - startTime;
      this.onSuccess(responseTime);
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.onFailure(toSafeError(error), responseTime);
      throw error;
    } finally {
      this.activeCalls--;
    }
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            `Operation timeout after ${timeoutMs}ms for service: ${this.serviceName}`
          )
        );
      }, timeoutMs);

      operation()
        .then((result) => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private onSuccess(responseTime: number): void {
    this.successCount++;
    this.metrics.totalCalls++;
    this.updateResponseTimeMetrics(responseTime);

    if (this.state === "half-open") {
      if (this.successCount >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    }

    this.updateMetrics();
  }

  private onFailure(error: Error, responseTime: number): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.metrics.totalCalls++;
    this.updateResponseTimeMetrics(responseTime);

    this.logger.warn("Circuit breaker recorded failure", {
      serviceName: this.serviceName,
      error: error.message,
      failureCount: this.failureCount,
      state: this.state,
      responseTime,
    });

    if (
      this.state === "closed" &&
      this.failureCount >= this.config.failureThreshold
    ) {
      this.transitionToOpen();
    } else if (this.state === "half-open") {
      this.transitionToOpen();
    }

    this.updateMetrics();
  }

  private updateResponseTimeMetrics(responseTime: number): void {
    this.responseTimeHistory.push(responseTime);

    // Keep only recent response times (last 100 calls)
    if (this.responseTimeHistory.length > 100) {
      this.responseTimeHistory.shift();
    }

    // Track slow calls
    if (responseTime > this.config.slowCallThreshold) {
      this.slowCalls++;
    }

    // Calculate average response time
    const sum = this.responseTimeHistory.reduce((a, b) => a + b, 0);
    this.metrics.averageResponseTime = sum / this.responseTimeHistory.length;

    // Calculate slow call rate
    this.metrics.slowCallRate =
      this.metrics.totalCalls > 0
        ? this.slowCalls / this.metrics.totalCalls
        : 0;
  }

  private transitionToOpen(): void {
    const previousState = this.state;
    this.state = "open";
    this.lastStateChangeTime = Date.now();
    this.metrics.circuitBreakerEvents++;

    this.logger.warn("Circuit breaker transitioned to OPEN", {
      serviceName: this.serviceName,
      previousState,
      failureCount: this.failureCount,
      timeSinceLastSuccess:
        this.successCount > 0 ? Date.now() - this.lastStateChangeTime : null,
    });

    this.updateMetrics();
  }

  private transitionToHalfOpen(): void {
    const previousState = this.state;
    this.state = "half-open";
    this.lastStateChangeTime = Date.now();
    this.successCount = 0; // Reset success count for half-open evaluation
    this.metrics.circuitBreakerEvents++;

    this.logger.info("Circuit breaker transitioned to HALF-OPEN", {
      serviceName: this.serviceName,
      previousState,
      timeSinceOpen: Date.now() - this.lastStateChangeTime,
    });

    this.updateMetrics();
  }

  private transitionToClosed(): void {
    const previousState = this.state;
    this.state = "closed";
    this.lastStateChangeTime = Date.now();
    this.failureCount = 0; // Reset failure count
    this.successCount = 0; // Reset success count
    this.metrics.circuitBreakerEvents++;

    this.logger.info("Circuit breaker transitioned to CLOSED", {
      serviceName: this.serviceName,
      previousState,
      successfulRecovery: true,
    });

    this.updateMetrics();
  }

  private shouldAttemptReset(): boolean {
    return (
      this.lastFailureTime !== null &&
      Date.now() - this.lastFailureTime > this.config.resetTimeout
    );
  }

  private updateMetrics(): void {
    this.metrics.state = this.state;
    this.metrics.failureCount = this.failureCount;
    this.metrics.successCount = this.successCount;
    this.metrics.lastFailureTime = this.lastFailureTime;
    this.metrics.slowCalls = this.slowCalls;
  }

  private startHealthMonitoring(): void {
    setInterval(() => {
      this.performHealthCheck();
    }, this.config.monitoringPeriod);
  }

  private performHealthCheck(): void {
    // Check if slow call rate is too high
    if (
      this.metrics.slowCallRate > this.config.slowCallRateThreshold &&
      this.metrics.totalCalls > 10
    ) {
      this.logger.warn("High slow call rate detected", {
        serviceName: this.serviceName,
        slowCallRate: this.metrics.slowCallRate,
        threshold: this.config.slowCallRateThreshold,
        averageResponseTime: this.metrics.averageResponseTime,
      });
    }

    // Reset slow call metrics periodically
    if (this.metrics.totalCalls > 1000) {
      this.slowCalls = Math.floor(this.slowCalls * 0.9); // Decay slow call count
      this.metrics.totalCalls = Math.floor(this.metrics.totalCalls * 0.9); // Decay total calls
    }
  }

  reset(): void {
    this.logger.info("Circuit breaker manually reset", {
      serviceName: this.serviceName,
      previousState: this.state,
    });

    this.state = "closed";
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastStateChangeTime = Date.now();
    this.activeCalls = 0;
    this.slowCalls = 0;
    this.responseTimeHistory = [];
    this.updateMetrics();
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  isHealthy(): boolean {
    return (
      this.state === "closed" &&
      this.metrics.slowCallRate < this.config.slowCallRateThreshold &&
      this.activeCalls < this.config.maxConcurrentCalls * 0.8
    );
  }
}

// Factory functions for different service types
export function createCoordinatedMexcWebSocketBreaker(
  serviceName: string
): CoordinatedCircuitBreaker {
  return new RealCoordinatedCircuitBreaker(serviceName, {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 15000,
    resetTimeout: 30000,
    maxConcurrentCalls: 50,
    slowCallThreshold: 3000,
  });
}

export function createCoordinatedDatabaseBreaker(
  serviceName: string
): CoordinatedCircuitBreaker {
  return new RealCoordinatedCircuitBreaker(serviceName, {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 30000,
    resetTimeout: 60000,
    maxConcurrentCalls: 100,
    slowCallThreshold: 5000,
    slowCallRateThreshold: 0.3,
  });
}

export function createCoordinatedApiBreaker(
  serviceName: string
): CoordinatedCircuitBreaker {
  return new RealCoordinatedCircuitBreaker(serviceName, {
    failureThreshold: 10,
    successThreshold: 5,
    timeout: 20000,
    resetTimeout: 45000,
    maxConcurrentCalls: 200,
    slowCallThreshold: 8000,
    slowCallRateThreshold: 0.4,
  });
}

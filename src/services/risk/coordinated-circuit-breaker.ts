/**
 * Coordinated Circuit Breaker System
 *
 * Fixes race conditions in circuit breaker operations by implementing:
 * - Atomic state transitions with proper locking
 * - Coordinated multi-service operations
 * - Thread-safe global instance management
 * - Synchronized recovery processes
 */

// ============================================================================
// Coordination Types and Interfaces
// ============================================================================

export interface CircuitBreakerOperation {
  id: string;
  type: "execute" | "reset" | "force_open" | "force_closed" | "recovery";
  serviceId: string;
  timestamp: number;
  priority: "low" | "medium" | "high" | "critical";
}

export interface CircuitBreakerLock {
  acquiredBy: string;
  operationType: string;
  acquiredAt: number;
  expiresAt: number;
}

export interface CoordinationMetrics {
  totalOperations: number;
  concurrentOperations: number;
  lockContentions: number;
  averageWaitTime: number;
  failedAcquisitions: number;
}

// ============================================================================
// Circuit Breaker Coordinator
// ============================================================================

/**
 * Manages coordination between multiple circuit breaker operations
 * Prevents race conditions by serializing critical operations
 */
export class CircuitBreakerCoordinator {
  private static instance: CircuitBreakerCoordinator;
  private locks = new Map<string, CircuitBreakerLock>();
  private operationQueue: CircuitBreakerOperation[] = [];
  private metrics: CoordinationMetrics = {
    totalOperations: 0,
    concurrentOperations: 0,
    lockContentions: 0,
    averageWaitTime: 0,
    failedAcquisitions: 0,
  };

  private constructor() {}

  public static getInstance(): CircuitBreakerCoordinator {
    if (!CircuitBreakerCoordinator.instance) {
      CircuitBreakerCoordinator.instance = new CircuitBreakerCoordinator();
    }
    return CircuitBreakerCoordinator.instance;
  }

  /**
   * Acquire lock for circuit breaker operation with timeout
   */
  async acquireLock(
    circuitBreakerId: string,
    operationType: string,
    serviceId: string,
    timeoutMs = 5000
  ): Promise<boolean> {
    const startTime = Date.now();
    const lockKey = `${circuitBreakerId}:${operationType}`;

    // Check for existing lock
    const existingLock = this.locks.get(lockKey);
    if (existingLock && existingLock.expiresAt > Date.now()) {
      if (existingLock.acquiredBy === serviceId) {
        // Same service can re-acquire lock
        existingLock.expiresAt = Date.now() + timeoutMs;
        return true;
      }

      this.metrics.lockContentions++;

      // Wait for lock to expire or be released
      while (this.locks.has(lockKey) && Date.now() - startTime < timeoutMs) {
        await this.sleep(50); // Check every 50ms
      }

      // Check again after waiting
      const currentLock = this.locks.get(lockKey);
      if (currentLock && currentLock.expiresAt > Date.now()) {
        this.metrics.failedAcquisitions++;
        return false;
      }
    }

    // Acquire lock
    const lock: CircuitBreakerLock = {
      acquiredBy: serviceId,
      operationType,
      acquiredAt: Date.now(),
      expiresAt: Date.now() + timeoutMs,
    };

    this.locks.set(lockKey, lock);

    const waitTime = Date.now() - startTime;
    this.updateWaitTimeMetrics(waitTime);

    return true;
  }

  /**
   * Release lock for circuit breaker operation
   */
  releaseLock(circuitBreakerId: string, operationType: string, serviceId: string): void {
    const lockKey = `${circuitBreakerId}:${operationType}`;
    const lock = this.locks.get(lockKey);

    if (lock && lock.acquiredBy === serviceId) {
      this.locks.delete(lockKey);
    }
  }

  /**
   * Execute operation with coordinated locking
   */
  async executeWithCoordination<T>(
    circuitBreakerId: string,
    operationType: string,
    serviceId: string,
    operation: () => Promise<T>,
    priority: "low" | "medium" | "high" | "critical" = "medium"
  ): Promise<T> {
    this.metrics.totalOperations++;
    this.metrics.concurrentOperations++;

    try {
      // Acquire lock with priority-based timeout
      const timeoutMs = this.getTimeoutForPriority(priority);
      const lockAcquired = await this.acquireLock(
        circuitBreakerId,
        operationType,
        serviceId,
        timeoutMs
      );

      if (!lockAcquired) {
        throw new Error(`Failed to acquire lock for ${operationType} on ${circuitBreakerId}`);
      }

      try {
        // Execute the operation
        const result = await operation();
        return result;
      } finally {
        // Always release lock
        this.releaseLock(circuitBreakerId, operationType, serviceId);
      }
    } finally {
      this.metrics.concurrentOperations--;
    }
  }

  /**
   * Cleanup expired locks
   */
  cleanupExpiredLocks(): void {
    const now = Date.now();
    for (const [key, lock] of Array.from(this.locks.entries())) {
      if (lock.expiresAt <= now) {
        this.locks.delete(key);
      }
    }
  }

  /**
   * Get coordination metrics
   */
  getMetrics(): CoordinationMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset coordination state
   */
  reset(): void {
    this.locks.clear();
    this.operationQueue = [];
    this.metrics = {
      totalOperations: 0,
      concurrentOperations: 0,
      lockContentions: 0,
      averageWaitTime: 0,
      failedAcquisitions: 0,
    };
  }

  private getTimeoutForPriority(priority: string): number {
    switch (priority) {
      case "critical":
        return 15000; // 15 seconds
      case "high":
        return 10000; // 10 seconds
      case "medium":
        return 5000; // 5 seconds
      case "low":
        return 2000; // 2 seconds
      default:
        return 5000;
    }
  }

  private updateWaitTimeMetrics(waitTime: number): void {
    const totalOps = this.metrics.totalOperations;
    if (totalOps === 1) {
      this.metrics.averageWaitTime = waitTime;
    } else {
      const currentTotal = this.metrics.averageWaitTime * (totalOps - 1);
      this.metrics.averageWaitTime = (currentTotal + waitTime) / totalOps;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Coordinated Circuit Breaker Implementation
// ============================================================================

export interface CoordinatedCircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  serviceId: string;
  enableCoordination: boolean;
  coordinationTimeout: number;
}

export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

/**
 * Circuit breaker with coordination support to prevent race conditions
 */
export class CoordinatedCircuitBreaker {
  private state: CircuitBreakerState = "CLOSED";
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private halfOpenRequestCount = 0;
  private readonly coordinator: CircuitBreakerCoordinator;

  constructor(
    private name: string,
    private config: CoordinatedCircuitBreakerConfig
  ) {
    this.coordinator = CircuitBreakerCoordinator.getInstance();
  }

  /**
   * Execute operation with coordinated circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.config.enableCoordination) {
      // Fallback to non-coordinated execution
      return this.executeInternal(operation);
    }

    return this.coordinator.executeWithCoordination(
      this.name,
      "execute",
      this.config.serviceId,
      () => this.executeInternal(operation),
      "medium"
    );
  }

  /**
   * Reset circuit breaker with coordination
   */
  async reset(): Promise<void> {
    if (!this.config.enableCoordination) {
      this.resetInternal();
      return;
    }

    await this.coordinator.executeWithCoordination(
      this.name,
      "reset",
      this.config.serviceId,
      async () => {
        this.resetInternal();
      },
      "high"
    );
  }

  /**
   * Force circuit breaker to open state with coordination
   */
  async forceOpen(): Promise<void> {
    if (!this.config.enableCoordination) {
      this.forceOpenInternal();
      return;
    }

    await this.coordinator.executeWithCoordination(
      this.name,
      "force_open",
      this.config.serviceId,
      async () => {
        this.forceOpenInternal();
      },
      "critical"
    );
  }

  /**
   * Force circuit breaker to closed state with coordination
   */
  async forceClosed(): Promise<void> {
    if (!this.config.enableCoordination) {
      this.forceClosedInternal();
      return;
    }

    await this.coordinator.executeWithCoordination(
      this.name,
      "force_closed",
      this.config.serviceId,
      async () => {
        this.forceClosedInternal();
      },
      "critical"
    );
  }

  /**
   * Get circuit breaker state (read-only, no coordination needed)
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Check if circuit breaker is open (read-only)
   */
  isOpen(): boolean {
    return this.state === "OPEN";
  }

  /**
   * Check if circuit breaker is closed (read-only)
   */
  isClosed(): boolean {
    return this.state === "CLOSED";
  }

  /**
   * Check if circuit breaker is half-open (read-only)
   */
  isHalfOpen(): boolean {
    return this.state === "HALF_OPEN";
  }

  /**
   * Get circuit breaker statistics (read-only)
   */
  getStats() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      halfOpenRequestCount: this.halfOpenRequestCount,
      totalRequests: this.failures + this.successes,
      failureRate:
        this.failures + this.successes > 0 ? this.failures / (this.failures + this.successes) : 0,
    };
  }

  // ============================================================================
  // Internal Implementation (called within coordination locks)
  // ============================================================================

  private async executeInternal<T>(operation: () => Promise<T>): Promise<T> {
    // Check state and potentially transition to HALF_OPEN
    if (this.state === "OPEN" && this.shouldAttemptReset()) {
      this.state = "HALF_OPEN";
      this.halfOpenRequestCount = 0;
    }

    // Reject if circuit is OPEN
    if (this.state === "OPEN") {
      throw new Error(
        `Circuit breaker [${this.name}] is OPEN. Last failure: ${new Date(this.lastFailureTime).toISOString()}`
      );
    }

    // Check half-open request limit
    if (this.state === "HALF_OPEN") {
      if (this.halfOpenRequestCount >= 3) {
        throw new Error(`Circuit breaker [${this.name}] is HALF_OPEN and at request limit`);
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

  private resetInternal(): void {
    this.state = "CLOSED";
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
    this.halfOpenRequestCount = 0;
  }

  private forceOpenInternal(): void {
    this.state = "OPEN";
    this.lastFailureTime = Date.now();
  }

  private forceClosedInternal(): void {
    this.state = "CLOSED";
    this.failures = 0;
    this.halfOpenRequestCount = 0;
  }

  private onSuccess(): void {
    this.successes++;

    if (this.state === "HALF_OPEN") {
      // Successful requests in HALF_OPEN state move to CLOSED
      if (this.halfOpenRequestCount >= 3) {
        this.state = "CLOSED";
        this.failures = 0;
      }
    } else {
      // Reset failure count on success in CLOSED state
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN") {
      // Failure in HALF_OPEN goes back to OPEN
      this.state = "OPEN";
    } else if (this.failures >= this.config.failureThreshold) {
      // Failure threshold exceeded, open the circuit
      this.state = "OPEN";
    }
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime > this.config.recoveryTimeout;
  }
}

// ============================================================================
// Coordinated Registry for Multiple Circuit Breakers
// ============================================================================

export class CoordinatedCircuitBreakerRegistry {
  private static instance: CoordinatedCircuitBreakerRegistry;
  private breakers = new Map<string, CoordinatedCircuitBreaker>();
  private readonly coordinator: CircuitBreakerCoordinator;

  private constructor() {
    this.coordinator = CircuitBreakerCoordinator.getInstance();
  }

  public static getInstance(): CoordinatedCircuitBreakerRegistry {
    if (!CoordinatedCircuitBreakerRegistry.instance) {
      CoordinatedCircuitBreakerRegistry.instance = new CoordinatedCircuitBreakerRegistry();
    }
    return CoordinatedCircuitBreakerRegistry.instance;
  }

  /**
   * Get or create a coordinated circuit breaker
   */
  getBreaker(
    name: string,
    serviceId: string,
    config?: Partial<CoordinatedCircuitBreakerConfig>
  ): CoordinatedCircuitBreaker {
    if (!this.breakers.has(name)) {
      const breakerConfig: CoordinatedCircuitBreakerConfig = {
        failureThreshold: 5,
        recoveryTimeout: 60000,
        serviceId,
        enableCoordination: true,
        coordinationTimeout: 5000,
        ...config,
      };

      this.breakers.set(name, new CoordinatedCircuitBreaker(name, breakerConfig));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Reset all circuit breakers with coordination
   */
  async resetAll(serviceId: string): Promise<void> {
    await this.coordinator.executeWithCoordination(
      "registry",
      "reset_all",
      serviceId,
      async () => {
        const resetPromises = Array.from(this.breakers.values()).map((breaker) => breaker.reset());
        await Promise.all(resetPromises);
      },
      "critical"
    );
  }

  /**
   * Get health status of all circuit breakers (read-only)
   */
  getHealthStatus(): { [name: string]: any } {
    const status: { [name: string]: any } = {};

    for (const [name, breaker] of Array.from(this.breakers)) {
      status[name] = breaker.getStats();
    }

    return status;
  }

  /**
   * Get coordination metrics
   */
  getCoordinationMetrics(): CoordinationMetrics {
    return this.coordinator.getMetrics();
  }

  /**
   * Clean up expired locks
   */
  cleanupExpiredLocks(): void {
    this.coordinator.cleanupExpiredLocks();
  }
}

// ============================================================================
// Integration with Existing Services
// ============================================================================

/**
 * Create coordinated MEXC API circuit breaker
 */
export function createCoordinatedMexcApiBreaker(serviceId: string): CoordinatedCircuitBreaker {
  const registry = CoordinatedCircuitBreakerRegistry.getInstance();
  return registry.getBreaker("mexc-api", serviceId, {
    failureThreshold: 3,
    recoveryTimeout: 30000,
    enableCoordination: true,
  });
}

/**
 * Create coordinated MEXC WebSocket circuit breaker
 */
export function createCoordinatedMexcWebSocketBreaker(
  serviceId: string
): CoordinatedCircuitBreaker {
  const registry = CoordinatedCircuitBreakerRegistry.getInstance();
  return registry.getBreaker("mexc-websocket", serviceId, {
    failureThreshold: 5,
    recoveryTimeout: 10000,
    enableCoordination: true,
  });
}

// Export singleton registry
export const coordinatedCircuitBreakerRegistry = CoordinatedCircuitBreakerRegistry.getInstance();

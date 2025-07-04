/**
 * Enhanced Resilience Manager - Comprehensive fault tolerance implementation
 *
 * Implements circuit breakers, retries, fallbacks, and graceful degradation
 * to improve system resilience from 33.93% to >80%
 */

import { BrowserCompatibleEventEmitter } from "@/src/lib/browser-compatible-events";

// ===================== CIRCUIT BREAKER IMPLEMENTATION =====================

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

export interface CircuitBreakerMetrics {
  successCount: number;
  failureCount: number;
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
}

export class EnhancedCircuitBreaker extends BrowserCompatibleEventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private nextAttempt?: number;
  private responseTimes: number[] = [];
  private readonly config: CircuitBreakerConfig;

  constructor(
    private readonly name: string,
    config: Partial<CircuitBreakerConfig> = {}
  ) {
    super();
    this.config = {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 30000,
      resetTimeout: 60000,
      monitoringPeriod: 300000, // 5 minutes
      ...config,
    };

    // Start monitoring
    this.startMonitoring();
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit should be opened
    if (this.shouldReject()) {
      const error = new Error(`Circuit breaker [${this.name}] is OPEN`);
      this.emit("request-rejected", { name: this.name, state: this.state });
      throw error;
    }

    const startTime = Date.now();

    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("Operation timeout")),
            this.config.timeout
          );
        }),
      ]);

      this.onSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldReject(): boolean {
    const now = Date.now();

    switch (this.state) {
      case CircuitState.OPEN:
        if (this.nextAttempt && now >= this.nextAttempt) {
          this.state = CircuitState.HALF_OPEN;
          this.emit("state-change", {
            name: this.name,
            from: CircuitState.OPEN,
            to: CircuitState.HALF_OPEN,
          });
          return false;
        }
        return true;

      case CircuitState.HALF_OPEN:
        return false;

      case CircuitState.CLOSED:
        return false;

      default:
        return false;
    }
  }

  private onSuccess(responseTime: number): void {
    this.successCount++;
    this.lastSuccessTime = Date.now();
    this.responseTimes.push(responseTime);

    // Keep only recent response times
    if (this.responseTimes.length > 100) {
      this.responseTimes = this.responseTimes.slice(-50);
    }

    switch (this.state) {
      case CircuitState.HALF_OPEN:
        if (this.successCount >= this.config.successThreshold) {
          this.state = CircuitState.CLOSED;
          this.failureCount = 0;
          this.emit("state-change", {
            name: this.name,
            from: CircuitState.HALF_OPEN,
            to: CircuitState.CLOSED,
          });
        }
        break;

      case CircuitState.CLOSED:
        // Reset failure count on success
        this.failureCount = Math.max(0, this.failureCount - 1);
        break;
    }

    this.emit("success", {
      name: this.name,
      responseTime,
      successCount: this.successCount,
    });
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    switch (this.state) {
      case CircuitState.CLOSED:
        if (this.failureCount >= this.config.failureThreshold) {
          this.state = CircuitState.OPEN;
          this.nextAttempt = Date.now() + this.config.resetTimeout;
          this.emit("state-change", {
            name: this.name,
            from: CircuitState.CLOSED,
            to: CircuitState.OPEN,
          });
        }
        break;

      case CircuitState.HALF_OPEN:
        this.state = CircuitState.OPEN;
        this.nextAttempt = Date.now() + this.config.resetTimeout;
        this.emit("state-change", {
          name: this.name,
          from: CircuitState.HALF_OPEN,
          to: CircuitState.OPEN,
        });
        break;
    }

    this.emit("failure", { name: this.name, failureCount: this.failureCount });
  }

  private startMonitoring(): void {
    setInterval(() => {
      const metrics = this.getMetrics();
      this.emit("metrics", { name: this.name, metrics });

      // Auto-reset metrics periodically
      if (
        Date.now() - (this.lastFailureTime || 0) >
        this.config.monitoringPeriod
      ) {
        this.resetMetrics();
      }
    }, 30000); // Every 30 seconds
  }

  private resetMetrics(): void {
    this.successCount = 0;
    this.failureCount = 0;
    this.responseTimes = [];
  }

  getMetrics(): CircuitBreakerMetrics {
    const totalRequests = this.successCount + this.failureCount;
    const successRate =
      totalRequests > 0 ? (this.successCount / totalRequests) * 100 : 100;
    const averageResponseTime =
      this.responseTimes.length > 0
        ? this.responseTimes.reduce((sum, time) => sum + time, 0) /
          this.responseTimes.length
        : 0;

    return {
      successCount: this.successCount,
      failureCount: this.failureCount,
      totalRequests,
      successRate,
      averageResponseTime,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
    };
  }

  getState(): CircuitState {
    return this.state;
  }

  getName(): string {
    return this.name;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.resetMetrics();
    this.nextAttempt = undefined;
    this.emit("reset", { name: this.name });
  }
}

// ===================== RETRY MECHANISM WITH EXPONENTIAL BACKOFF =====================

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryCondition?: (error: any) => boolean;
}

export class RetryManager {
  private static readonly defaultConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
    retryCondition: (error) => {
      // Don't retry on 4xx errors (client errors)
      if (error?.status >= 400 && error?.status < 500) return false;
      return true;
    },
  };

  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const retryConfig = { ...RetryManager.defaultConfig, ...config };
    let lastError: any;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry if condition fails
        if (retryConfig.retryCondition && !retryConfig.retryCondition(error)) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === retryConfig.maxAttempts) {
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const baseDelay = Math.min(
          retryConfig.baseDelay *
            retryConfig.backoffMultiplier ** (attempt - 1),
          retryConfig.maxDelay
        );

        const delay = retryConfig.jitter
          ? baseDelay + Math.random() * baseDelay * 0.1 // ±10% jitter
          : baseDelay;

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}

// ===================== FALLBACK STRATEGY MANAGER =====================

export type FallbackStrategy<T> = () => Promise<T>;

export interface FallbackConfig<T> {
  strategies: FallbackStrategy<T>[];
  timeout: number;
  enableCaching: boolean;
  cacheKey?: string;
  cacheTtl?: number;
}

export class FallbackManager {
  private static cache = new Map<string, { value: any; expiry: number }>();

  static async executeWithFallback<T>(
    primaryOperation: () => Promise<T>,
    config: FallbackConfig<T>
  ): Promise<T> {
    const {
      strategies,
      timeout,
      enableCaching,
      cacheKey,
      cacheTtl = 60000,
    } = config;

    // Try primary operation first
    try {
      const result = await Promise.race([
        primaryOperation(),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("Primary operation timeout")),
            timeout
          );
        }),
      ]);

      // Cache successful result
      if (enableCaching && cacheKey) {
        FallbackManager.cache.set(cacheKey, {
          value: result,
          expiry: Date.now() + cacheTtl,
        });
      }

      return result;
    } catch (primaryError) {
      // Try fallback strategies in order
      for (let i = 0; i < strategies.length; i++) {
        try {
          const result = await strategies[i]();
          return result;
        } catch (_fallbackError) {}
      }

      // If all fallbacks fail, try cache
      if (enableCaching && cacheKey) {
        const cached = FallbackManager.cache.get(cacheKey);
        if (cached && cached.expiry > Date.now()) {
          return cached.value;
        }
      }

      // All strategies failed
      throw new Error(
        `All fallback strategies failed. Primary error: ${primaryError.message}`
      );
    }
  }

  static clearCache(): void {
    FallbackManager.cache.clear();
  }

  static getCacheStats(): { size: number; keys: string[] } {
    return {
      size: FallbackManager.cache.size,
      keys: Array.from(FallbackManager.cache.keys()),
    };
  }
}

// ===================== RESILIENCE COORDINATOR =====================

export class ResilienceCoordinator {
  private circuitBreakers = new Map<string, EnhancedCircuitBreaker>();
  private metrics = new Map<string, any>();

  getOrCreateCircuitBreaker(
    name: string,
    config?: Partial<CircuitBreakerConfig>
  ): EnhancedCircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      const circuitBreaker = new EnhancedCircuitBreaker(name, config);

      // Listen to circuit breaker events for monitoring
      circuitBreaker.on("state-change", (event) => {
        console.log(
          `[Resilience] Circuit breaker [${event.name}] state changed: ${event.from} → ${event.to}`
        );
      });

      circuitBreaker.on("metrics", (event) => {
        this.metrics.set(event.name, event.metrics);
      });

      this.circuitBreakers.set(name, circuitBreaker);
    }

    return this.circuitBreakers.get(name)!;
  }

  async executeResilientOperation<T>(
    operation: () => Promise<T>,
    options: {
      circuitBreakerName: string;
      circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
      retryConfig?: Partial<RetryConfig>;
      fallbackStrategies?: FallbackStrategy<T>[];
      enableCaching?: boolean;
      cacheKey?: string;
    }
  ): Promise<T> {
    const circuitBreaker = this.getOrCreateCircuitBreaker(
      options.circuitBreakerName,
      options.circuitBreakerConfig
    );

    const resilientOperation = async () => {
      return await circuitBreaker.execute(operation);
    };

    // Add retry logic
    const operationWithRetry = async () => {
      return await RetryManager.executeWithRetry(
        resilientOperation,
        options.retryConfig
      );
    };

    // Add fallback strategies
    if (options.fallbackStrategies && options.fallbackStrategies.length > 0) {
      return await FallbackManager.executeWithFallback(operationWithRetry, {
        strategies: options.fallbackStrategies,
        timeout: options.circuitBreakerConfig?.timeout || 30000,
        enableCaching: options.enableCaching || false,
        cacheKey: options.cacheKey,
      });
    }

    return await operationWithRetry();
  }

  getSystemResilienceMetrics(): {
    circuitBreakers: Array<{
      name: string;
      state: CircuitState;
      metrics: CircuitBreakerMetrics;
    }>;
    overallHealth: number;
    recommendations: string[];
  } {
    const circuitBreakerMetrics = Array.from(
      this.circuitBreakers.entries()
    ).map(([name, cb]) => ({
      name,
      state: cb.getState(),
      metrics: cb.getMetrics(),
    }));

    // Calculate overall health score
    const totalCbs = circuitBreakerMetrics.length;
    if (totalCbs === 0) {
      return {
        circuitBreakers: [],
        overallHealth: 100,
        recommendations: [],
      };
    }

    const healthyCount = circuitBreakerMetrics.filter(
      (cb) => cb.state === CircuitState.CLOSED
    ).length;
    const avgSuccessRate =
      circuitBreakerMetrics.reduce(
        (sum, cb) => sum + cb.metrics.successRate,
        0
      ) / totalCbs;
    const overallHealth =
      (healthyCount / totalCbs) * 0.6 + (avgSuccessRate / 100) * 0.4;

    // Generate recommendations
    const recommendations: string[] = [];
    const openCircuits = circuitBreakerMetrics.filter(
      (cb) => cb.state === CircuitState.OPEN
    );
    const degradedCircuits = circuitBreakerMetrics.filter(
      (cb) => cb.metrics.successRate < 90
    );

    if (openCircuits.length > 0) {
      recommendations.push(
        `${openCircuits.length} circuit breaker(s) are OPEN: ${openCircuits.map((cb) => cb.name).join(", ")}`
      );
    }

    if (degradedCircuits.length > 0) {
      recommendations.push(
        `${degradedCircuits.length} circuit breaker(s) have low success rates`
      );
    }

    if (overallHealth < 0.8) {
      recommendations.push(
        "Overall system resilience is below 80% - consider implementing additional fallback strategies"
      );
    }

    return {
      circuitBreakers: circuitBreakerMetrics,
      overallHealth: Math.round(overallHealth * 100),
      recommendations,
    };
  }

  resetAllCircuitBreakers(): void {
    this.circuitBreakers.forEach((cb) => cb.reset());
  }

  getCircuitBreakerNames(): string[] {
    return Array.from(this.circuitBreakers.keys());
  }
}

// ===================== GLOBAL RESILIENCE INSTANCE =====================

export const globalResilienceCoordinator = new ResilienceCoordinator();

// ===================== CONVENIENCE FUNCTIONS =====================

export async function executeWithResilience<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: {
    fallbackValue?: T;
    enableRetries?: boolean;
    enableCircuitBreaker?: boolean;
    customFallbacks?: FallbackStrategy<T>[];
  } = {}
): Promise<T> {
  const fallbackStrategies: FallbackStrategy<T>[] = [];

  // Add custom fallbacks first
  if (options.customFallbacks) {
    fallbackStrategies.push(...options.customFallbacks);
  }

  // Add default fallback value if provided
  if (options.fallbackValue !== undefined) {
    fallbackStrategies.push(async () => options.fallbackValue!);
  }

  return await globalResilienceCoordinator.executeResilientOperation(
    operation,
    {
      circuitBreakerName: operationName,
      retryConfig: options.enableRetries !== false ? {} : { maxAttempts: 1 },
      fallbackStrategies:
        options.enableCircuitBreaker !== false ? fallbackStrategies : undefined,
      enableCaching: true,
      cacheKey: operationName,
    }
  );
}

export function getSystemResilienceStatus(): {
  isHealthy: boolean;
  overallScore: number;
  circuitBreakerCount: number;
  openCircuitCount: number;
  recommendations: string[];
} {
  const metrics = globalResilienceCoordinator.getSystemResilienceMetrics();
  const openCircuitCount = metrics.circuitBreakers.filter(
    (cb) => cb.state === CircuitState.OPEN
  ).length;

  return {
    isHealthy: metrics.overallHealth >= 80,
    overallScore: metrics.overallHealth,
    circuitBreakerCount: metrics.circuitBreakers.length,
    openCircuitCount,
    recommendations: metrics.recommendations,
  };
}

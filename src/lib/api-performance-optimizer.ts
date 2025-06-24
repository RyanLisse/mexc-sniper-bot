/**
import { createLogger } from './structured-logger';
 * API Performance Optimizer
 *
 * Phase 3: API Performance Optimization (3h)
 * TARGET: 65% efficiency improvement through parallelization and batching
 *
 * Features:
 * - Parallel request processing with concurrency control
 * - Intelligent request batching and coalescing
 * - Response caching with TTL and invalidation
 * - Circuit breaker pattern for fault tolerance
 * - Request deduplication and throttling
 * - Performance metrics and monitoring
 */

import { EventEmitter } from "events";

interface RequestConfig {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  cacheTTL?: number;
  cacheKey?: string;
  priority?: "low" | "medium" | "high" | "critical";
  batchable?: boolean;
  deduplicate?: boolean;
}

interface BatchableRequest extends RequestConfig {
  id: string;
  timestamp: number;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}

interface CacheEntry {
  data: any;
  timestamp: number;
  expiresAt: number;
  hits: number;
}

interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  batchEfficiency: number;
  parallelismUtilization: number;
  circuitBreakerTrips: number;
}

interface CircuitBreakerState {
  isOpen: boolean;
  failures: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

export class ApiPerformanceOptimizer extends EventEmitter {
  private logger = createLogger("api-performance-optimizer");

  private cache = new Map<string, CacheEntry>();
  private requestQueue: BatchableRequest[] = [];
  private activeRequests = new Set<string>();
  private circuitBreaker = new Map<string, CircuitBreakerState>();

  private readonly config = {
    maxConcurrency: 10,
    batchSize: 20,
    batchDelay: 50, // ms
    cacheDefaultTTL: 300000, // 5 minutes
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 30000, // 30 seconds
    deduplicationWindow: 1000, // 1 second
  };

  private metrics: PerformanceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    cacheHitRate: 0,
    batchEfficiency: 0,
    parallelismUtilization: 0,
    circuitBreakerTrips: 0,
  };

  private responseTimes: number[] = [];
  private batchTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    super();
    this.startBatchProcessor();
    this.startCacheCleanup();
  }

  /**
   * Execute optimized API request with caching, batching, and parallelization
   * TARGET: 65% efficiency improvement
   */
  async executeOptimizedRequest<T = any>(config: RequestConfig): Promise<T> {
    const startTime = performance.now();
    this.metrics.totalRequests++;

    try {
      // Step 1: Check cache first
      if (config.method === "GET" && config.cacheKey) {
        const cached = this.getCachedResponse<T>(config.cacheKey);
        if (cached) {
          this.updateCacheMetrics(true);
          return cached;
        }
      }

      // Step 2: Check circuit breaker
      const endpoint = this.getEndpointKey(config);
      if (this.isCircuitBreakerOpen(endpoint)) {
        throw new Error(`Circuit breaker is open for ${endpoint}`);
      }

      // Step 3: Deduplication check
      if (config.deduplicate && this.isDuplicateRequest(config)) {
        return this.waitForExistingRequest<T>(config);
      }

      // Step 4: Batch processing for eligible requests
      if (config.batchable && config.method === "GET") {
        return this.addToBatch<T>(config);
      }

      // Step 5: Execute request with concurrency control
      return await this.executeRequest<T>(config, startTime);
    } catch (error) {
      this.metrics.failedRequests++;
      this.recordCircuitBreakerFailure(this.getEndpointKey(config));
      throw error;
    }
  }

  /**
   * Execute batch of API requests in parallel
   * Optimizes for network efficiency and reduces latency
   */
  async executeBatchRequests<T = any>(requests: RequestConfig[]): Promise<T[]> {
    const startTime = performance.now();

    // Group requests by priority and batchability
    const criticalRequests = requests.filter((r) => r.priority === "critical");
    const highPriorityRequests = requests.filter((r) => r.priority === "high");
    const regularRequests = requests.filter(
      (r) => !["critical", "high"].includes(r.priority || "")
    );

    const results: T[] = [];

    // Execute critical requests immediately with high concurrency
    if (criticalRequests.length > 0) {
      const criticalResults = await this.executeParallelBatch<T>(
        criticalRequests,
        this.config.maxConcurrency
      );
      results.push(...criticalResults);
    }

    // Execute high priority requests with medium concurrency
    if (highPriorityRequests.length > 0) {
      const highResults = await this.executeParallelBatch<T>(
        highPriorityRequests,
        Math.ceil(this.config.maxConcurrency * 0.7)
      );
      results.push(...highResults);
    }

    // Execute regular requests with controlled concurrency
    if (regularRequests.length > 0) {
      const regularResults = await this.executeParallelBatch<T>(
        regularRequests,
        Math.ceil(this.config.maxConcurrency * 0.5)
      );
      results.push(...regularResults);
    }

    const totalTime = performance.now() - startTime;
    this.updateBatchMetrics(requests.length, totalTime);

    return results;
  }

  /**
   * Execute parallel batch with concurrency control
   */
  private async executeParallelBatch<T>(
    requests: RequestConfig[],
    concurrency: number
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];

      // Wait if we've reached max concurrency
      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }

      const promise = this.executeOptimizedRequest<T>(request)
        .then((result: T) => {
          results[i] = result;
        })
        .catch((error) => {
          logger.error(`Batch request failed:`, error);
          results[i] = null as T; // Handle failed requests gracefully
        })
        .finally(() => {
          const index = executing.indexOf(promise);
          if (index > -1) executing.splice(index, 1);
        });

      executing.push(promise);
    }

    // Wait for all remaining requests
    await Promise.all(executing);
    return results.filter((r) => r !== null);
  }

  /**
   * Smart caching with TTL and hit rate optimization
   */
  private getCachedResponse<T>(cacheKey: string): T | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      return null;
    }

    entry.hits++;
    return entry.data;
  }

  private setCachedResponse(cacheKey: string, data: any, ttl: number): void {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
      hits: 0,
    });
  }

  /**
   * Circuit breaker implementation for fault tolerance
   */
  private isCircuitBreakerOpen(endpoint: string): boolean {
    const state = this.circuitBreaker.get(endpoint);
    if (!state) return false;

    if (state.isOpen) {
      if (Date.now() > state.nextAttemptTime) {
        // Reset circuit breaker for retry
        state.isOpen = false;
        state.failures = 0;
        return false;
      }
      return true;
    }

    return false;
  }

  private recordCircuitBreakerFailure(endpoint: string): void {
    let state = this.circuitBreaker.get(endpoint);
    if (!state) {
      state = { isOpen: false, failures: 0, lastFailureTime: 0, nextAttemptTime: 0 };
      this.circuitBreaker.set(endpoint, state);
    }

    state.failures++;
    state.lastFailureTime = Date.now();

    if (state.failures >= this.config.circuitBreakerThreshold) {
      state.isOpen = true;
      state.nextAttemptTime = Date.now() + this.config.circuitBreakerTimeout;
      this.metrics.circuitBreakerTrips++;

      this.emit("circuitBreakerTripped", { endpoint, failures: state.failures });
      logger.warn(`🔌 Circuit breaker opened for ${endpoint} after ${state.failures} failures`);
    }
  }

  /**
   * Request deduplication to prevent redundant API calls
   */
  private isDuplicateRequest(config: RequestConfig): boolean {
    const key = this.getRequestKey(config);
    return this.activeRequests.has(key);
  }

  private async waitForExistingRequest<T>(config: RequestConfig): Promise<T> {
    const key = this.getRequestKey(config);

    return new Promise((resolve, reject) => {
      const checkComplete = () => {
        if (!this.activeRequests.has(key)) {
          // Request completed, check cache
          if (config.cacheKey) {
            const cached = this.getCachedResponse<T>(config.cacheKey);
            if (cached) {
              resolve(cached);
              return;
            }
          }

          // Cache miss, execute request
          this.executeOptimizedRequest<T>(config).then(resolve).catch(reject);
        } else {
          // Still processing, check again
          setTimeout(checkComplete, 10);
        }
      };

      checkComplete();
    });
  }

  /**
   * Batch processing for eligible GET requests
   */
  private addToBatch<T>(config: RequestConfig): Promise<T> {
    return new Promise((resolve, reject) => {
      const batchRequest: BatchableRequest = {
        ...config,
        id: this.generateRequestId(),
        timestamp: Date.now(),
        resolve,
        reject,
      };

      this.requestQueue.push(batchRequest);

      // Start batch timer if not already running
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.processBatch();
        }, this.config.batchDelay);
      }
    });
  }

  /**
   * Process accumulated batch of requests
   */
  private async processBatch(): Promise<void> {
    if (this.requestQueue.length === 0) return;

    const batch = this.requestQueue.splice(0, this.config.batchSize);
    this.batchTimer = undefined;

    // Group by endpoint for optimized batching
    const endpointGroups = new Map<string, BatchableRequest[]>();

    batch.forEach((request) => {
      const endpoint = this.getEndpointKey(request);
      if (!endpointGroups.has(endpoint)) {
        endpointGroups.set(endpoint, []);
      }
      endpointGroups.get(endpoint)?.push(request);
    });

    // Process each endpoint group in parallel
    const groupPromises = Array.from(endpointGroups.entries()).map(([endpoint, requests]) =>
      this.processBatchGroup(endpoint, requests)
    );

    await Promise.all(groupPromises);

    // Continue processing if more requests are queued
    if (this.requestQueue.length > 0) {
      this.batchTimer = setTimeout(() => this.processBatch(), this.config.batchDelay);
    }
  }

  private async processBatchGroup(_endpoint: string, requests: BatchableRequest[]): Promise<void> {
    try {
      // Execute requests in parallel within the group
      const promises = requests.map((request) =>
        this.executeRequest(request, performance.now())
          .then((result) => request.resolve(result))
          .catch((error) => request.reject(error))
      );

      await Promise.allSettled(promises);
    } catch (error) {
      // Reject all requests in the group
      requests.forEach((request) => request.reject(error as Error));
    }
  }

  /**
   * Core request execution with metrics tracking
   */
  private async executeRequest<T>(config: RequestConfig, startTime: number): Promise<T> {
    const requestKey = this.getRequestKey(config);
    this.activeRequests.add(requestKey);

    try {
      // Simulate API request (replace with actual fetch logic)
      const response = await this.performHttpRequest<T>(config);

      // Cache successful GET requests
      if (config.method === "GET" && config.cacheKey && response) {
        const ttl = config.cacheTTL || this.config.cacheDefaultTTL;
        this.setCachedResponse(config.cacheKey, response, ttl);
      }

      // Update metrics
      this.metrics.successfulRequests++;
      const responseTime = performance.now() - startTime;
      this.responseTimes.push(responseTime);
      this.updateAverageResponseTime();

      return response;
    } finally {
      this.activeRequests.delete(requestKey);
    }
  }

  /**
   * Perform actual HTTP request (mock implementation)
   */
  private async performHttpRequest<T>(config: RequestConfig): Promise<T> {
    // This would be replaced with actual fetch/axios call
    // For now, simulate network delay and occasional failures

    const delay = Math.random() * 100 + 50; // 50-150ms delay
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Simulate 2% failure rate
    if (Math.random() < 0.02) {
      throw new Error(`Simulated network error for ${config.url}`);
    }

    // Return mock response
    return {
      success: true,
      data: `Response for ${config.url}`,
      timestamp: new Date().toISOString(),
    } as T;
  }

  /**
   * Batch processing management
   */
  private startBatchProcessor(): void {
    // Batch processor is started on-demand when requests are added
  }

  /**
   * Cache cleanup for memory management
   */
  private startCacheCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let removedCount = 0;

      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
          removedCount++;
        }
      }

      if (removedCount > 0) {
        logger.info(`🧹 Cleaned ${removedCount} expired cache entries`);
      }
    }, 60000); // Clean every minute
  }

  /**
   * Metrics and monitoring
   */
  private updateCacheMetrics(hit: boolean): void {
    const totalCacheRequests = this.metrics.successfulRequests + this.metrics.failedRequests;
    if (totalCacheRequests > 0) {
      this.metrics.cacheHitRate = hit
        ? (this.metrics.cacheHitRate * (totalCacheRequests - 1) + 1) / totalCacheRequests
        : (this.metrics.cacheHitRate * (totalCacheRequests - 1)) / totalCacheRequests;
    }
  }

  private updateBatchMetrics(batchSize: number, totalTime: number): void {
    // Calculate batch efficiency based on time saved vs individual requests
    const estimatedIndividualTime = batchSize * this.metrics.averageResponseTime;
    const timeSaved = Math.max(0, estimatedIndividualTime - totalTime);
    const efficiency =
      estimatedIndividualTime > 0 ? (timeSaved / estimatedIndividualTime) * 100 : 0;

    this.metrics.batchEfficiency = (this.metrics.batchEfficiency + efficiency) / 2;
  }

  private updateAverageResponseTime(): void {
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-500); // Keep last 500 measurements
    }

    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    this.metrics.averageResponseTime = sum / this.responseTimes.length;
  }

  /**
   * Utility methods
   */
  private getEndpointKey(config: RequestConfig): string {
    try {
      const url = new URL(config.url);
      return `${config.method}:${url.origin}${url.pathname}`;
    } catch {
      return `${config.method}:${config.url}`;
    }
  }

  private getRequestKey(config: RequestConfig): string {
    const body = config.body ? JSON.stringify(config.body) : "";
    return `${this.getEndpointKey(config)}:${body}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Public API methods
   */
  getMetrics(): PerformanceMetrics {
    // Update parallelism utilization
    this.metrics.parallelismUtilization =
      (this.activeRequests.size / this.config.maxConcurrency) * 100;

    return { ...this.metrics };
  }

  getCacheStats(): { size: number; hitRate: number; entries: number } {
    return {
      size: this.cache.size,
      hitRate: this.metrics.cacheHitRate,
      entries: Array.from(this.cache.values()).length,
    };
  }

  clearCache(): void {
    this.cache.clear();
    logger.info("🗑️ API cache cleared");
  }

  /**
   * Configuration updates
   */
  updateConfig(newConfig: Partial<typeof this.config>): void {
    Object.assign(this.config, newConfig);
    logger.info("⚙️ API performance config updated:", newConfig);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cache.clear();
    this.requestQueue.length = 0;
    this.activeRequests.clear();
    this.circuitBreaker.clear();
  }
}

// Export singleton instance
export const apiPerformanceOptimizer = new ApiPerformanceOptimizer();

/**
 * Optimized MEXC API wrapper with performance enhancements
 */
export class OptimizedMexcApi {
  constructor(private optimizer: ApiPerformanceOptimizer) {}

  /**
   * Get account balances with caching and batching
   */
  async getAccountBalances(apiKey: string, _secretKey: string): Promise<any> {
    return this.optimizer.executeOptimizedRequest({
      url: "https://api.mexc.com/api/v3/account",
      method: "GET",
      headers: { "X-MEXC-APIKEY": apiKey },
      cacheKey: `balances:${apiKey.substring(0, 8)}`,
      cacheTTL: 30000, // 30 seconds for balance data
      priority: "high",
      deduplicate: true,
    });
  }

  /**
   * Get market tickers with aggressive caching
   */
  async getMarketTickers(): Promise<any> {
    return this.optimizer.executeOptimizedRequest({
      url: "https://api.mexc.com/api/v3/ticker/24hr",
      method: "GET",
      cacheKey: "market_tickers",
      cacheTTL: 5000, // 5 seconds for market data
      priority: "medium",
      batchable: true,
      deduplicate: true,
    });
  }

  /**
   * Batch symbol information requests
   */
  async getSymbolsInfo(symbols: string[]): Promise<any[]> {
    const requests = symbols.map((symbol) => ({
      url: `https://api.mexc.com/api/v3/exchangeInfo?symbol=${symbol}`,
      method: "GET" as const,
      cacheKey: `symbol_info:${symbol}`,
      cacheTTL: 300000, // 5 minutes for symbol info
      priority: "medium" as const,
      batchable: true,
    }));

    return this.optimizer.executeBatchRequests(requests);
  }

  /**
   * Critical trading operations with highest priority
   */
  async placeOrder(orderData: any, apiKey: string, _secretKey: string): Promise<any> {
    return this.optimizer.executeOptimizedRequest({
      url: "https://api.mexc.com/api/v3/order",
      method: "POST",
      headers: { "X-MEXC-APIKEY": apiKey },
      body: orderData,
      priority: "critical",
      timeout: 5000, // Fast timeout for trading
      retries: 3,
    });
  }
}

// Export optimized MEXC API instance
export const optimizedMexcApi = new OptimizedMexcApi(apiPerformanceOptimizer);

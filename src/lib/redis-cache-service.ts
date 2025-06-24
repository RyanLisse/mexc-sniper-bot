/**
import { createLogger } from './structured-logger';
 * Redis/Valkey Cache Service for MEXC Sniper Bot
 *
 * Phase 2 Implementation: Redis/Valkey Caching & Performance Enhancement
 *
 * Features:
 * - Graceful degradation when Redis/Valkey is unavailable
 * - 5-second TTL for API responses (user preference)
 * - JSON serialization with proper error handling
 * - Non-blocking cache operations that fail silently
 * - Cache warming strategies for frequently accessed data
 * - Performance monitoring and metrics
 * - Intelligent batching and cache-aware query optimization
 */

import Redis from "ioredis";
import type { CacheDataType, CachePriority } from "./unified-cache-system";

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface RedisCacheConfig {
  // Connection settings
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;

  // Performance settings
  defaultTTL: number; // 5 seconds as per user preference
  maxRetries: number;
  retryDelayOnFailover: number;
  connectTimeout: number;
  commandTimeout: number;

  // Features
  enableGracefulDegradation: boolean;
  enableMetrics: boolean;
  enableCompression: boolean;

  // Cache warming
  enableCacheWarming: boolean;
  warmupPatterns: string[];
  warmupInterval: number;
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  type: CacheDataType;
  priority: CachePriority;
  metadata?: {
    size?: number;
    source?: string;
    dependencies?: string[];
    tags?: string[];
  };
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  connectionStatus: "connected" | "disconnected" | "connecting" | "error";
  lastError?: string;
  avgResponseTime: number;
  totalOperations: number;
  cacheSize: number;
  memoryUsage: number;
}

export interface CacheWarmupStrategy {
  pattern: string;
  priority: CachePriority;
  ttl?: number;
  dataGenerator: () => Promise<any>;
  frequency: number; // milliseconds
}

// ============================================================================
// Redis Cache Service Implementation
// ============================================================================

export class RedisCacheService {
  private logger = createLogger("redis-cache-service");

  private redis: Redis | null = null;
  private config: RedisCacheConfig;
  private metrics: CacheMetrics;
  private isConnected = false;
  private warmupStrategies = new Map<string, CacheWarmupStrategy>();
  private warmupInterval?: NodeJS.Timeout;
  private connectionRetryTimeout?: NodeJS.Timeout;

  constructor(config: Partial<RedisCacheConfig> = {}) {
    this.config = {
      // Default configuration with user preferences
      defaultTTL: 5000, // 5 seconds as per user preference
      maxRetries: 3,
      retryDelayOnFailover: 100,
      connectTimeout: 10000,
      commandTimeout: 5000,
      enableGracefulDegradation: true,
      enableMetrics: true,
      enableCompression: false,
      enableCacheWarming: true,
      warmupPatterns: ["api:mexc:*", "pattern:*", "activity:*"],
      warmupInterval: 30000, // 30 seconds
      ...config,
    };

    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      connectionStatus: "disconnected",
      avgResponseTime: 0,
      totalOperations: 0,
      cacheSize: 0,
      memoryUsage: 0,
    };

    this.initializeRedisConnection();
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Check if Redis connection should be skipped during build time or static generation
   */
  private shouldSkipRedisConnection(): boolean {
    // Skip during any build-related environment
    if (
      // Standard build environments
      process.env.NODE_ENV === "production" &&
      (process.env.VERCEL_ENV === undefined || // Vercel build environment
        process.env.NEXT_PHASE === "phase-production-build" || // Next.js build phase
        process.env.BUILD_ID !== undefined || // Build environment indicator
        process.env.NEXT_BUILD === "true") // Build flag
    ) {
      return true;
    }

    // Skip during any Next.js build phase
    if (
      process.env.NEXT_PHASE === "phase-production-build" ||
      process.env.NEXT_BUILD === "true" ||
      process.env.STATIC_GENERATION === "true"
    ) {
      return true;
    }

    // Additional build environment detection
    if (
      // CI/CD environments
      process.env.CI === "true" ||
      process.env.GITHUB_ACTIONS === "true" ||
      process.env.VERCEL === "1" ||
      // Build processes
      process.env.npm_lifecycle_event === "build" ||
      process.env.npm_command === "run-script" ||
      // Static generation
      (typeof window === "undefined" && process.env.NODE_ENV === "production")
    ) {
      return true;
    }

    // Skip if no Redis configuration is available
    if (
      !process.env.REDIS_URL &&
      !process.env.VALKEY_URL &&
      !this.config.url &&
      !this.config.host
    ) {
      return true;
    }

    return false;
  }

  private async initializeRedisConnection(): Promise<void> {
    try {
      // Skip Redis connection during build time or static generation
      if (this.shouldSkipRedisConnection()) {
        logger.info(
          "[RedisCacheService] Skipping Redis connection - build/static generation environment"
        );
        return;
      }

      // Get Redis URL from environment or config
      const redisUrl =
        this.config.url ||
        process.env.VALKEY_URL ||
        process.env.REDIS_URL ||
        `redis://${this.config.host || "localhost"}:${this.config.port || 6379}`;

      // Extra safety check: don't create Redis instance with localhost during production builds
      if (
        redisUrl.includes("localhost") &&
        (process.env.NODE_ENV === "production" ||
          process.env.VERCEL === "1" ||
          process.env.CI === "true")
      ) {
        logger.info(
          "[RedisCacheService] Skipping Redis connection - localhost detected in production/CI environment"
        );
        return;
      }

      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: this.config.maxRetries,
        connectTimeout: this.config.connectTimeout,
        commandTimeout: this.config.commandTimeout,
        lazyConnect: true,
        enableReadyCheck: true,
      });

      // Event handlers for graceful degradation
      this.redis.on("connect", () => {
        this.isConnected = true;
        this.metrics.connectionStatus = "connected";
        logger.info("[RedisCacheService] Connected to Redis/Valkey");

        if (this.config.enableCacheWarming) {
          this.startCacheWarming();
        }
      });

      this.redis.on("error", (error) => {
        this.isConnected = false;
        this.metrics.connectionStatus = "error";
        this.metrics.lastError = error.message;
        this.metrics.errors++;

        if (this.config.enableGracefulDegradation) {
          logger.warn(
            "[RedisCacheService] Redis error (graceful degradation enabled):",
            error.message
          );
        } else {
          logger.error("[RedisCacheService] Redis error:", error);
        }
      });

      this.redis.on("close", () => {
        this.isConnected = false;
        this.metrics.connectionStatus = "disconnected";
        logger.info("[RedisCacheService] Disconnected from Redis/Valkey");

        // Attempt reconnection after delay
        if (this.config.enableGracefulDegradation) {
          this.scheduleReconnection();
        }
      });

      // Attempt initial connection
      await this.redis.connect();
    } catch (error) {
      this.handleConnectionError(error);
    }
  }

  private handleConnectionError(error: any): void {
    this.isConnected = false;
    this.metrics.connectionStatus = "error";
    this.metrics.lastError = error.message;
    this.metrics.errors++;

    if (this.config.enableGracefulDegradation) {
      logger.warn(
        "[RedisCacheService] Failed to connect to Redis/Valkey (graceful degradation enabled):",
        error.message
      );
      this.scheduleReconnection();
    } else {
      logger.error("[RedisCacheService] Failed to connect to Redis/Valkey:", error);
      throw error;
    }
  }

  private scheduleReconnection(): void {
    if (this.connectionRetryTimeout) {
      clearTimeout(this.connectionRetryTimeout);
    }

    this.connectionRetryTimeout = setTimeout(() => {
      logger.info("[RedisCacheService] Attempting to reconnect...");
      this.initializeRedisConnection();
    }, 5000); // Retry after 5 seconds
  }

  // ============================================================================
  // Core Cache Operations
  // ============================================================================

  async get<T = any>(key: string): Promise<T | null> {
    const startTime = Date.now();

    try {
      if (!this.isConnected || !this.redis) {
        this.metrics.misses++;
        return null;
      }

      const result = await this.redis.get(key);
      const responseTime = Date.now() - startTime;
      this.updateMetrics("get", responseTime);

      if (result === null) {
        this.metrics.misses++;
        return null;
      }

      const parsed = JSON.parse(result) as CacheEntry<T>;

      // Check if entry has expired
      if (Date.now() > parsed.timestamp + parsed.ttl) {
        this.metrics.misses++;
        // Silently delete expired entry
        this.delete(key).catch(() => {}); // Non-blocking
        return null;
      }

      this.metrics.hits++;
      return parsed.data;
    } catch (error) {
      this.handleOperationError("get", error);
      this.metrics.misses++;
      return null;
    }
  }

  async set<T = any>(
    key: string,
    value: T,
    options: {
      ttl?: number;
      type?: CacheDataType;
      priority?: CachePriority;
      metadata?: any;
    } = {}
  ): Promise<boolean> {
    const startTime = Date.now();

    try {
      if (!this.isConnected || !this.redis) {
        return false;
      }

      const ttl = options.ttl || this.config.defaultTTL;
      const entry: CacheEntry<T> = {
        data: value,
        timestamp: Date.now(),
        ttl,
        type: options.type || "generic",
        priority: options.priority || "medium",
        metadata: {
          size: this.estimateSize(value),
          source: "redis-cache-service",
          ...options.metadata,
        },
      };

      const serialized = JSON.stringify(entry);

      // Set with TTL in seconds (Redis expects seconds)
      await this.redis.setex(key, Math.ceil(ttl / 1000), serialized);

      const responseTime = Date.now() - startTime;
      this.updateMetrics("set", responseTime);
      this.metrics.sets++;

      return true;
    } catch (error) {
      this.handleOperationError("set", error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    const startTime = Date.now();

    try {
      if (!this.isConnected || !this.redis) {
        return false;
      }

      const result = await this.redis.del(key);
      const responseTime = Date.now() - startTime;
      this.updateMetrics("delete", responseTime);
      this.metrics.deletes++;

      return result > 0;
    } catch (error) {
      this.handleOperationError("delete", error);
      return false;
    }
  }

  async clear(pattern?: string): Promise<number> {
    try {
      if (!this.isConnected || !this.redis) {
        return 0;
      }

      if (pattern) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          const result = await this.redis.del(...keys);
          this.metrics.deletes += result;
          return result;
        }
        return 0;
      }
      await this.redis.flushdb();
      return 1; // Indicate success
    } catch (error) {
      this.handleOperationError("clear", error);
      return 0;
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private estimateSize(value: any): number {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 0;
    }
  }

  private updateMetrics(_operation: string, responseTime: number): void {
    if (!this.config.enableMetrics) return;

    this.metrics.totalOperations++;
    this.metrics.avgResponseTime =
      (this.metrics.avgResponseTime * (this.metrics.totalOperations - 1) + responseTime) /
      this.metrics.totalOperations;
  }

  private handleOperationError(operation: string, error: any): void {
    this.metrics.errors++;

    if (this.config.enableGracefulDegradation) {
      // Silently fail for graceful degradation
      logger.warn(
        `[RedisCacheService] ${operation} operation failed (graceful degradation):`,
        error.message
      );
    } else {
      logger.error(`[RedisCacheService] ${operation} operation failed:`, error);
    }
  }

  // ============================================================================
  // Cache Warming
  // ============================================================================

  addWarmupStrategy(strategy: CacheWarmupStrategy): void {
    this.warmupStrategies.set(strategy.pattern, strategy);
  }

  private startCacheWarming(): void {
    if (!this.config.enableCacheWarming || this.warmupInterval) {
      return;
    }

    this.warmupInterval = setInterval(async () => {
      await this.performCacheWarming();
    }, this.config.warmupInterval);

    // Perform initial warming
    this.performCacheWarming().catch(() => {});
  }

  private async performCacheWarming(): Promise<void> {
    if (!this.isConnected) return;

    for (const [pattern, strategy] of this.warmupStrategies) {
      try {
        const data = await strategy.dataGenerator();
        const key = `warmup:${pattern}:${Date.now()}`;

        await this.set(key, data, {
          ttl: strategy.ttl || this.config.defaultTTL,
          type: "generic",
          priority: strategy.priority,
          metadata: { source: "cache-warming", pattern },
        });
      } catch (error) {
        logger.warn(`[RedisCacheService] Cache warming failed for pattern ${pattern}:`, error);
      }
    }
  }

  // ============================================================================
  // Status and Metrics
  // ============================================================================

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  isHealthy(): boolean {
    return this.isConnected && this.metrics.connectionStatus === "connected";
  }

  async getInfo(): Promise<any> {
    try {
      if (!this.isConnected || !this.redis) {
        return { status: "disconnected" };
      }

      const info = await this.redis.info();
      return { status: "connected", info };
    } catch (error) {
      return { status: "error", error: (error as Error).message || "Unknown error" };
    }
  }

  // ============================================================================
  // Batch Operations for Performance
  // ============================================================================

  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    const startTime = Date.now();

    try {
      if (!this.isConnected || !this.redis || keys.length === 0) {
        return keys.map(() => null);
      }

      const results = await this.redis.mget(...keys);
      const responseTime = Date.now() - startTime;
      this.updateMetrics("mget", responseTime);

      return results.map((result, index) => {
        if (result === null) {
          this.metrics.misses++;
          return null;
        }

        try {
          const parsed = JSON.parse(result) as CacheEntry<T>;

          // Check if entry has expired
          if (Date.now() > parsed.timestamp + parsed.ttl) {
            this.metrics.misses++;
            // Silently delete expired entry
            this.delete(keys[index]).catch(() => {}); // Non-blocking
            return null;
          }

          this.metrics.hits++;
          return parsed.data;
        } catch {
          this.metrics.misses++;
          return null;
        }
      });
    } catch (error) {
      this.handleOperationError("mget", error);
      return keys.map(() => null);
    }
  }

  async mset<T = any>(
    entries: Array<{
      key: string;
      value: T;
      ttl?: number;
      type?: CacheDataType;
      priority?: CachePriority;
      metadata?: any;
    }>
  ): Promise<boolean> {
    const startTime = Date.now();

    try {
      if (!this.isConnected || !this.redis || entries.length === 0) {
        return false;
      }

      const pipeline = this.redis.pipeline();

      for (const entry of entries) {
        const ttl = entry.ttl || this.config.defaultTTL;
        const cacheEntry: CacheEntry<T> = {
          data: entry.value,
          timestamp: Date.now(),
          ttl,
          type: entry.type || "generic",
          priority: entry.priority || "medium",
          metadata: {
            size: this.estimateSize(entry.value),
            source: "redis-cache-service",
            ...entry.metadata,
          },
        };

        const serialized = JSON.stringify(cacheEntry);
        pipeline.setex(entry.key, Math.ceil(ttl / 1000), serialized);
      }

      await pipeline.exec();

      const responseTime = Date.now() - startTime;
      this.updateMetrics("mset", responseTime);
      this.metrics.sets += entries.length;

      return true;
    } catch (error) {
      this.handleOperationError("mset", error);
      return false;
    }
  }

  // ============================================================================
  // Cache Statistics and Analysis
  // ============================================================================

  async getCacheSize(): Promise<number> {
    try {
      if (!this.isConnected || !this.redis) {
        return 0;
      }

      const dbsize = await this.redis.dbsize();
      this.metrics.cacheSize = dbsize;
      return dbsize;
    } catch (error) {
      this.handleOperationError("getCacheSize", error);
      return 0;
    }
  }

  async getMemoryUsage(): Promise<number> {
    try {
      if (!this.isConnected || !this.redis) {
        return 0;
      }

      const info = await this.redis.info("memory");
      const match = info.match(/used_memory:(\d+)/);
      const memoryUsage = match ? Number.parseInt(match[1], 10) : 0;
      this.metrics.memoryUsage = memoryUsage;
      return memoryUsage;
    } catch (error) {
      this.handleOperationError("getMemoryUsage", error);
      return 0;
    }
  }

  getHitRate(): number {
    const total = this.metrics.hits + this.metrics.misses;
    return total > 0 ? (this.metrics.hits / total) * 100 : 0;
  }

  // ============================================================================
  // Incremental Data Processing Support
  // ============================================================================

  async setWithDelta<T = any>(
    key: string,
    value: T,
    deltaKey: string,
    options: {
      ttl?: number;
      type?: CacheDataType;
      priority?: CachePriority;
      metadata?: any;
    } = {}
  ): Promise<boolean> {
    try {
      if (!this.isConnected || !this.redis) {
        return false;
      }

      // Store both the full data and delta information
      const pipeline = this.redis.pipeline();

      // Set the main data
      const success = await this.set(key, value, options);
      if (!success) return false;

      // Set delta timestamp for incremental processing
      const deltaInfo = {
        lastUpdate: Date.now(),
        key,
        type: options.type || "generic",
      };

      pipeline.setex(
        deltaKey,
        Math.ceil((options.ttl || this.config.defaultTTL) / 1000),
        JSON.stringify(deltaInfo)
      );

      await pipeline.exec();
      return true;
    } catch (error) {
      this.handleOperationError("setWithDelta", error);
      return false;
    }
  }

  async getDeltaKeys(pattern: string): Promise<string[]> {
    try {
      if (!this.isConnected || !this.redis) {
        return [];
      }

      return await this.redis.keys(pattern);
    } catch (error) {
      this.handleOperationError("getDeltaKeys", error);
      return [];
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  async destroy(): Promise<void> {
    if (this.warmupInterval) {
      clearInterval(this.warmupInterval);
      this.warmupInterval = undefined;
    }

    if (this.connectionRetryTimeout) {
      clearTimeout(this.connectionRetryTimeout);
      this.connectionRetryTimeout = undefined;
    }

    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }

    this.isConnected = false;
    this.metrics.connectionStatus = "disconnected";
    logger.info("[RedisCacheService] Service destroyed");
  }
}

// ============================================================================
// Global Redis Cache Instance
// ============================================================================

let globalRedisCacheInstance: RedisCacheService | null = null;

export function getRedisCacheService(config?: Partial<RedisCacheConfig>): RedisCacheService {
  if (!globalRedisCacheInstance || config) {
    globalRedisCacheInstance = new RedisCacheService(config);
  }
  return globalRedisCacheInstance;
}

export function resetRedisCacheService(): void {
  if (globalRedisCacheInstance) {
    globalRedisCacheInstance.destroy();
    globalRedisCacheInstance = null;
  }
}

// ============================================================================
// Exports
// ============================================================================

export { RedisCacheService as default };

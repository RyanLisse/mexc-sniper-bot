/**
 * Database Connection Pool - Enhanced implementation with caching and batch operations
 */

import { trace } from "@opentelemetry/api";

export interface ConnectionPoolConfig {
  maxConnections: number;
  idleTimeout: number;
  connectionTimeout: number;
}

const defaultConfig: ConnectionPoolConfig = {
  maxConnections: 10,
  idleTimeout: 30000,
  connectionTimeout: 5000,
};

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

export class DatabaseConnectionPool {
  private config: ConnectionPoolConfig;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private connections: any[] = [];
  private activeConnections: number = 0;

  constructor(config: ConnectionPoolConfig = defaultConfig) {
    this.config = config;
  }

  async getConnection(): Promise<any> {
    // Simple implementation - return mock connection
    return { id: Date.now(), connected: true };
  }

  async releaseConnection(_connection: any): Promise<void> {
    // Simple implementation - no-op
  }

  getStats() {
    return {
      totalConnections: this.connections.length,
      activeConnections: this.activeConnections,
      idleConnections: this.connections.length - this.activeConnections,
    };
  }

  /**
   * Execute a SELECT query with caching support
   */
  async executeSelect<T>(
    queryFn: () => Promise<T>,
    cacheKey: string,
    cacheTTL: number = 60000
  ): Promise<T> {
    const tracer = trace.getTracer("database-connection-pool");

    return tracer.startActiveSpan(
      `db_pool_select_${cacheKey}`,
      async (span) => {
        try {
          // Check cache first
          const cached = this.getCachedResult<T>(cacheKey);
          if (cached) {
            span.setAttributes({
              "db.cache_hit": true,
              "db.cache_key": cacheKey,
            });
            return cached;
          }

          // Execute query
          span.setAttributes({
            "db.cache_hit": false,
            "db.cache_key": cacheKey,
          });

          const result = await queryFn();

          // Cache the result
          this.setCachedResult(cacheKey, result, cacheTTL);

          return result;
        } catch (error) {
          span.setAttributes({
            "db.error": error instanceof Error ? error.message : String(error),
          });
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Execute a write operation with cache invalidation
   */
  async executeWrite<T>(
    queryFn: () => Promise<T>,
    invalidatePatterns: string[] = []
  ): Promise<T> {
    const tracer = trace.getTracer("database-connection-pool");

    return tracer.startActiveSpan("db_pool_write", async (span) => {
      try {
        this.activeConnections++;

        // Execute the write operation
        const result = await queryFn();

        // Invalidate cache patterns
        if (invalidatePatterns.length > 0) {
          this.invalidateCache(invalidatePatterns);
          span.setAttributes({
            "db.cache_invalidated": true,
            "db.invalidation_patterns": invalidatePatterns.join(", "),
          });
        }

        return result;
      } catch (error) {
        span.setAttributes({
          "db.error": error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        this.activeConnections--;
        span.end();
      }
    });
  }

  /**
   * Execute batch operations with cache invalidation
   */
  async executeBatch<T>(
    operations: (() => Promise<T>)[],
    invalidatePatterns: string[] = []
  ): Promise<T[]> {
    const tracer = trace.getTracer("database-connection-pool");

    return tracer.startActiveSpan("db_pool_batch", async (span) => {
      try {
        this.activeConnections++;

        span.setAttributes({
          "db.batch_size": operations.length,
        });

        // Execute all operations in parallel
        const results = await Promise.all(operations.map((op) => op()));

        // Invalidate cache patterns
        if (invalidatePatterns.length > 0) {
          this.invalidateCache(invalidatePatterns);
          span.setAttributes({
            "db.cache_invalidated": true,
            "db.invalidation_patterns": invalidatePatterns.join(", "),
          });
        }

        return results;
      } catch (error) {
        span.setAttributes({
          "db.error": error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        this.activeConnections--;
        span.end();
      }
    });
  }

  /**
   * Get cached result if available and not expired
   */
  private getCachedResult<T>(cacheKey: string): T | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Entry is expired, remove it
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.value;
  }

  /**
   * Set cached result with TTL
   */
  private setCachedResult<T>(cacheKey: string, value: T, ttl: number): void {
    this.cache.set(cacheKey, {
      value,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Invalidate cache entries matching patterns
   */
  private invalidateCache(patterns: string[]): void {
    const keysToDelete: string[] = [];
    const keys = Array.from(this.cache.keys());

    for (const key of keys) {
      for (const pattern of patterns) {
        if (key.includes(pattern) || key.match(pattern)) {
          keysToDelete.push(key);
          break;
        }
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Shutdown connection pool and cleanup resources
   */
  async shutdown(): Promise<void> {
    // Clear cache
    this.cache.clear();

    // Close all connections
    await Promise.all(
      this.connections.map(async (conn) => {
        try {
          if (conn.end) {
            await conn.end();
          }
        } catch (error) {
          // Log error but don't fail the shutdown
          console.warn("Error closing database connection:", error);
        }
      })
    );

    this.connections = [];
    this.activeConnections = 0;
  }
}

export const connectionPool = new DatabaseConnectionPool();

// Export alias for compatibility
export const databaseConnectionPool = connectionPool;

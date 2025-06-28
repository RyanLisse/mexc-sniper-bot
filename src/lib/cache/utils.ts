/**
 * Cache Utilities
 *
 * Helper functions for cache operations and management
 */

import * as crypto from "node:crypto";
import { createLogger } from "../unified-logger";
import type { CacheDataType, CacheEntry } from "./types";

const logger = createLogger("cache-utils", {
  enableStructuredLogging: process.env.NODE_ENV === "production",
  enablePerformanceLogging: true,
});

/**
 * Generate cache key from multiple components
 */
export function generateCacheKey(...components: (string | number | object)[]): string {
  const keyData = components
    .map((component) =>
      typeof component === "object" ? JSON.stringify(component) : String(component)
    )
    .join(":");

  return crypto.createHash("sha256").update(keyData).digest("hex").substring(0, 32);
}

/**
 * Cache decorator for functions
 */
export function withCache<T extends (...args: any[]) => any>(
  fn: T,
  options: {
    keyGenerator?: (...args: Parameters<T>) => string;
    ttl?: number;
    type?: CacheDataType;
    cacheManager?: any; // Will be properly typed when CacheManager is available
  } = {}
): T {
  const { keyGenerator, ttl, type = "api_response", cacheManager } = options;

  return (async (...args: Parameters<T>) => {
    if (!cacheManager) {
      logger.warn("No cache manager provided to withCache decorator");
      return await fn(...args);
    }

    const cacheKey = keyGenerator ? keyGenerator(...args) : generateCacheKey(fn.name, ...args);

    // Try to get from cache first
    const cached = await cacheManager.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn(...args);
    await cacheManager.set(cacheKey, result, { type, ttl });

    return result;
  }) as T;
}

/**
 * Warm up cache with predefined data
 */
export async function warmUpCache(
  cacheManager: any, // Will be properly typed when CacheManager is available
  data: Array<{
    key: string;
    value: any;
    type?: CacheDataType;
    ttl?: number;
  }>
): Promise<void> {
  logger.info(`Warming up cache with ${data.length} entries...`);

  for (const { key, value, type, ttl } of data) {
    await cacheManager.set(key, value, { type, ttl });
  }

  logger.info("Cache warm-up completed");
}

/**
 * Clean up expired entries from a cache level
 */
export function cleanupLevel(cache: Map<string, CacheEntry>): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of Array.from(cache.entries())) {
    if (now > entry.expiresAt) {
      cache.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Estimate size of a value in bytes
 */
export function estimateSize(value: any): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return 1024; // Default estimate
  }
}

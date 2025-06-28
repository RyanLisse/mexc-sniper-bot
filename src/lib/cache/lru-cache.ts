/**
 * LRU Cache Implementation
 *
 * Least Recently Used cache with performance tracking
 */

import { createLogger } from "../unified-logger";
import type { CacheEntry, CacheMetrics } from "./types";

const _logger = createLogger("lru-cache", {
  enableStructuredLogging: process.env.NODE_ENV === "production",
  enablePerformanceLogging: true,
});

export class LRUCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private metrics: CacheMetrics;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      totalSize: 0,
      memoryUsage: 0,
      hitRate: 0,
      averageAccessTime: 0,
      lastCleanup: Date.now(),
    };
  }

  get(key: string): T | null {
    const startTime = performance.now();
    const entry = this.cache.get(key);

    if (!entry || Date.now() > entry.expiresAt) {
      this.metrics.misses++;
      if (entry) {
        this.cache.delete(key);
      }
      this.updateMetrics(performance.now() - startTime);
      return null;
    }

    // Update access information
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.metrics.hits++;
    this.updateMetrics(performance.now() - startTime);
    return entry.value;
  }

  set(key: string, value: T, ttl: number, metadata?: CacheEntry<T>["metadata"]): boolean {
    const now = Date.now();

    // Remove oldest entry if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.metrics.evictions++;
      }
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: now,
      expiresAt: now + ttl,
      accessCount: 0,
      lastAccessed: now,
      metadata,
    };

    this.cache.set(key, entry);
    this.metrics.sets++;
    this.updateTotalSize();
    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.metrics.deletes++;
      this.updateTotalSize();
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.metrics.totalSize = 0;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry !== undefined && Date.now() <= entry.expiresAt;
  }

  size(): number {
    return this.cache.size;
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  getEntries(): Array<CacheEntry<T>> {
    return Array.from(this.cache.values());
  }

  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    this.metrics.lastCleanup = now;
    this.updateTotalSize();
    return cleaned;
  }

  private updateMetrics(accessTime: number): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;

    // Update average access time (simple moving average)
    this.metrics.averageAccessTime = (this.metrics.averageAccessTime + accessTime) / 2;
  }

  private updateTotalSize(): void {
    this.metrics.totalSize = this.cache.size;
    // Estimate memory usage (rough calculation)
    this.metrics.memoryUsage = this.cache.size * 1024; // Assume 1KB per entry average
  }
}

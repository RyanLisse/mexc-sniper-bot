/**
 * Enhanced Unified Cache System
 * Minimal in-memory implementation for build consistency.
 */

export interface CacheMetrics {
  size: number;
  hits: number;
  misses: number;
}

export interface EnhancedUnifiedCacheSystem {
  get<T>(key: string, namespace?: string): Promise<T | null>;
  set<T>(key: string, value: T, namespace?: string, ttl?: number): Promise<void>;
  delete(key: string, namespace?: string): Promise<void>;
  clear(namespace?: string): Promise<void>;
  getMetrics(): CacheMetrics;
}

interface CacheEntry {
  value: unknown;
  expires: number;
}

class InMemoryUnifiedCache implements EnhancedUnifiedCacheSystem {
  private store: Map<string, Map<string, CacheEntry>> = new Map();
  private hits = 0;
  private misses = 0;
  private defaultTtl = 5 * 60 * 1000; // 5 minutes

  private getNamespace(ns: string): Map<string, CacheEntry> {
    if (!this.store.has(ns)) {
      this.store.set(ns, new Map());
    }
    return this.store.get(ns)!;
  }

  async get<T>(key: string, namespace = 'default'): Promise<T | null> {
    const ns = this.getNamespace(namespace);
    const entry = ns.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (Date.now() > entry.expires) {
      ns.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.value as T;
  }

  async set<T>(
    key: string,
    value: T,
    namespace = 'default',
    ttl = this.defaultTtl
  ): Promise<void> {
    const ns = this.getNamespace(namespace);
    ns.set(key, { value, expires: Date.now() + ttl });
  }

  async delete(key: string, namespace = 'default'): Promise<void> {
    const ns = this.getNamespace(namespace);
    ns.delete(key);
  }

  async clear(namespace?: string): Promise<void> {
    if (namespace) {
      this.getNamespace(namespace).clear();
    } else {
      this.store.clear();
    }
    this.hits = 0;
    this.misses = 0;
  }

  getMetrics(): CacheMetrics {
    let size = 0;
    for (const ns of this.store.values()) size += ns.size;
    return { size, hits: this.hits, misses: this.misses };
  }
}

export const unifiedCache = new InMemoryUnifiedCache();

export function getUnifiedCache(): EnhancedUnifiedCacheSystem {
  return unifiedCache;
}

export default unifiedCache;

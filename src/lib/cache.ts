/**
 * Cache Service
 * Minimal implementation for build optimization
 */

export interface CacheOptions {
  ttl?: number;
  maxSize?: number;
  onEvict?: (key: string, value: any) => void;
}

export class Cache<T = any> {
  private store: Map<string, { value: T; expires: number }> = new Map();
  private options: Required<CacheOptions>;

  constructor(options: CacheOptions = {}) {
    this.options = {
      ttl: options.ttl || 5 * 60 * 1000, // 5 minutes
      maxSize: options.maxSize || 1000,
      onEvict: options.onEvict || (() => {})
    };
  }

  set(key: string, value: T, ttl?: number): void {
    const expires = Date.now() + (ttl || this.options.ttl);
    
    // Check if we need to evict old entries
    if (this.store.size >= this.options.maxSize && !this.store.has(key)) {
      this.evictOldest();
    }

    this.store.set(key, { value, expires });
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expires) {
      this.delete(key);
      return undefined;
    }

    return entry.value;
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expires) {
      this.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const entry = this.store.get(key);
    if (entry) {
      this.options.onEvict(key, entry.value);
      return this.store.delete(key);
    }
    return false;
  }

  clear(): void {
    for (const [key, entry] of this.store) {
      this.options.onEvict(key, entry.value);
    }
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }

  values(): T[] {
    const now = Date.now();
    const values: T[] = [];
    
    for (const [key, entry] of this.store) {
      if (now > entry.expires) {
        this.delete(key);
      } else {
        values.push(entry.value);
      }
    }
    
    return values;
  }

  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestTime = Number.MAX_SAFE_INTEGER;

    for (const [key, entry] of this.store) {
      if (entry.expires < oldestTime) {
        oldestTime = entry.expires;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.store) {
      if (now > entry.expires) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.delete(key);
    }
  }
}

export const defaultCache = new Cache();

// Add missing export aliases for compatibility
export class CacheManager<T = any> extends Cache<T> {
  constructor(options: CacheOptions = {}) {
    super(options);
  }
}

export class LRUCache<T = any> extends Cache<T> {
  constructor(options: CacheOptions = {}) {
    super(options);
  }
}

export const globalCacheManager = new CacheManager();
/**
 * API Response Cache
 * Minimal implementation for build optimization
 */

export interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  key: string;
}

export interface CacheConfig {
  defaultTtl: number;
  maxSize: number;
  enabled: boolean;
}

class ApiResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig = {
    defaultTtl: 5 * 60 * 1000, // 5 minutes
    maxSize: 1000,
    enabled: true
  };

  setConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }

  set(key: string, data: any, ttl?: number): void {
    if (!this.config.enabled) return;

    // Clean up old entries if cache is full
    if (this.cache.size >= this.config.maxSize) {
      this.cleanup();
    }

    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTtl,
      key
    };

    this.cache.set(key, entry);
  }

  get(key: string): any | null {
    if (!this.config.enabled) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    if (!this.config.enabled) return false;
    
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): { size: number; maxSize: number; enabled: boolean } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      enabled: this.config.enabled
    };
  }
}

export const apiResponseCache = new ApiResponseCache();
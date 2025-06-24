/**
 * Credential Caching Service
 *
 * PERFORMANCE OPTIMIZATION: Caches decrypted API credentials to reduce
 * expensive decryption operations on every trading request.
 *
 * Security Features:
 * - Short TTL (5-10 minutes) to limit exposure
 * - Secure memory cleanup on expiration
 * - Access logging for security monitoring
 */

import { getEncryptionService } from "../services/secure-encryption-service";
import { createSafeLogger } from "./structured-logger";

interface CachedCredentials {
  apiKey: string;
  secretKey: string;
  passphrase?: string;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
}

interface CredentialCacheMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  activeEntries: number;
  averageDecryptionTime: number;
}

class CredentialCache {
  private _logger?: ReturnType<typeof createSafeLogger>;
  private getLogger() {
    if (!this._logger) {
      this._logger = createSafeLogger("credential-cache");
    }
    return this._logger;
  }

  private static instance: CredentialCache;
  private cache = new Map<string, CachedCredentials>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_ENTRIES = 100; // Prevent memory bloat
  private cleanupInterval: NodeJS.Timeout;
  private metrics: CredentialCacheMetrics;

  private constructor() {
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      activeEntries: 0,
      averageDecryptionTime: 0,
    };

    // Start cleanup timer
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 60000); // Check every minute

    this.getLogger().info("[CredentialCache] Service initialized with 5-minute TTL");
  }

  static getInstance(): CredentialCache {
    if (!CredentialCache.instance) {
      CredentialCache.instance = new CredentialCache();
    }
    return CredentialCache.instance;
  }

  /**
   * Get cached credentials or decrypt and cache them
   */
  async getCredentials(
    userId: string,
    encryptedApiKey: string,
    encryptedSecretKey: string,
    encryptedPassphrase?: string
  ): Promise<{ apiKey: string; secretKey: string; passphrase?: string }> {
    const startTime = performance.now();
    this.metrics.totalRequests++;

    const cacheKey = this.generateCacheKey(userId, encryptedApiKey, encryptedSecretKey);
    const cached = this.cache.get(cacheKey);

    // Check if cached and not expired
    if (cached && cached.expiresAt > Date.now()) {
      cached.accessCount++;
      cached.lastAccessed = Date.now();
      this.metrics.cacheHits++;
      this.updateMetrics();

      this.getLogger().info(
        `💾 [CredentialCache] Cache HIT for user ${userId} (${cached.accessCount} accesses)`
      );

      return {
        apiKey: cached.apiKey,
        secretKey: cached.secretKey,
        passphrase: cached.passphrase,
      };
    }

    // Cache miss - decrypt credentials
    this.getLogger().info(`🔓 [CredentialCache] Cache MISS for user ${userId} - decrypting...`);
    this.metrics.cacheMisses++;

    const encryptionService = getEncryptionService();

    const decryptedCredentials = {
      apiKey: encryptionService.decrypt(encryptedApiKey),
      secretKey: encryptionService.decrypt(encryptedSecretKey),
      passphrase: encryptedPassphrase ? encryptionService.decrypt(encryptedPassphrase) : undefined,
    };

    // Cache the decrypted credentials
    const cachedEntry: CachedCredentials = {
      ...decryptedCredentials,
      expiresAt: Date.now() + this.TTL_MS,
      accessCount: 1,
      lastAccessed: Date.now(),
    };

    this.cache.set(cacheKey, cachedEntry);

    // Enforce size limit
    if (this.cache.size > this.MAX_ENTRIES) {
      this.evictOldest();
    }

    const decryptionTime = performance.now() - startTime;
    this.updateDecryptionTime(decryptionTime);
    this.updateMetrics();

    this.getLogger().info(
      `✅ [CredentialCache] Cached credentials for user ${userId} (${decryptionTime.toFixed(2)}ms)`
    );

    return decryptedCredentials;
  }

  /**
   * Invalidate cached credentials for a user
   */
  invalidateUser(userId: string): number {
    let removed = 0;
    for (const [key, value] of this.cache.entries()) {
      if (key.startsWith(`${userId}:`)) {
        this.secureDelete(value);
        this.cache.delete(key);
        removed++;
      }
    }

    this.getLogger().info(`🗑️ [CredentialCache] Invalidated ${removed} entries for user ${userId}`);
    this.updateMetrics();
    return removed;
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CredentialCacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear all cached credentials (for security or testing)
   */
  clearAll(): number {
    const count = this.cache.size;

    for (const value of this.cache.values()) {
      this.secureDelete(value);
    }

    this.cache.clear();
    this.updateMetrics();

    this.getLogger().info(`🧹 [CredentialCache] Cleared all ${count} cached entries`);
    return count;
  }

  /**
   * Destroy the cache service
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.clearAll();
    this.getLogger().info("[CredentialCache] Service destroyed");
  }

  // Private methods

  private generateCacheKey(
    userId: string,
    encryptedApiKey: string,
    encryptedSecretKey: string
  ): string {
    // Use a hash of the encrypted data to ensure uniqueness without storing sensitive info
    const crypto = require("node:crypto");
    const hash = crypto
      .createHash("sha256")
      .update(`${userId}:${encryptedApiKey}:${encryptedSecretKey}`)
      .digest("hex")
      .substring(0, 16); // First 16 chars for shorter key

    return `${userId}:${hash}`;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, value] of this.cache.entries()) {
      if (value.expiresAt <= now) {
        this.secureDelete(value);
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.getLogger().info(`🧽 [CredentialCache] Cleaned up ${removed} expired entries`);
      this.updateMetrics();
    }
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, value] of this.cache.entries()) {
      if (value.lastAccessed < oldestTime) {
        oldestTime = value.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const value = this.cache.get(oldestKey)!;
      this.secureDelete(value);
      this.cache.delete(oldestKey);
      this.getLogger().info(`♻️ [CredentialCache] Evicted oldest entry: ${oldestKey}`);
    }
  }

  private secureDelete(credentials: CachedCredentials): void {
    // Overwrite sensitive data before deletion
    credentials.apiKey = "0".repeat(credentials.apiKey.length);
    credentials.secretKey = "0".repeat(credentials.secretKey.length);
    if (credentials.passphrase) {
      credentials.passphrase = "0".repeat(credentials.passphrase.length);
    }
  }

  private updateDecryptionTime(time: number): void {
    // Simple rolling average
    this.metrics.averageDecryptionTime = (this.metrics.averageDecryptionTime + time) / 2;
  }

  private updateMetrics(): void {
    this.metrics.hitRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.cacheHits / this.metrics.totalRequests) * 100
        : 0;
    this.metrics.activeEntries = this.cache.size;
  }
}

// Global instance
export const credentialCache = CredentialCache.getInstance();

// Helper function for easy access
export async function getCachedCredentials(
  userId: string,
  encryptedApiKey: string,
  encryptedSecretKey: string,
  encryptedPassphrase?: string
): Promise<{ apiKey: string; secretKey: string; passphrase?: string }> {
  return credentialCache.getCredentials(
    userId,
    encryptedApiKey,
    encryptedSecretKey,
    encryptedPassphrase
  );
}

export { CredentialCache };

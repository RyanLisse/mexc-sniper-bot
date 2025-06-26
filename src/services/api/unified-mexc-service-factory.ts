/**
 * Unified MEXC Service Factory
 *
 * Provides centralized service initialization to ensure consistency
 * across all API endpoints and prevent credential/connectivity discrepancies.
 * This addresses the root cause of status display contradictions.
 */

import { and, eq } from "drizzle-orm";
import { apiCredentials, db } from "@/src/db";
import { getUnifiedMexcClient, UnifiedMexcClient } from "./mexc-client-factory";
import type { UnifiedMexcConfig } from "./mexc-client-types";
import { getEncryptionService } from "./secure-encryption-service";

// ============================================================================
// Service Factory Configuration
// ============================================================================

interface ServiceFactoryConfig {
  enableGlobalCache: boolean;
  credentialCacheTTL: number;
  serviceInstanceCacheTTL: number;
  fallbackToEnvironment: boolean;
  enableCircuitBreaker: boolean;
}

// ============================================================================
// Credential Cache System
// ============================================================================

interface CachedCredential {
  apiKey: string;
  secretKey: string;
  source: "database" | "environment";
  timestamp: number;
  ttl: number;
}

class CredentialCache {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[unified-mexc-service-factory]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[unified-mexc-service-factory]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[unified-mexc-service-factory]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[unified-mexc-service-factory]", message, context || ""),
  };

  private cache = new Map<string, CachedCredential>();
  private readonly defaultTTL = 300000; // 5 minutes

  set(userId: string, credential: CachedCredential): void {
    this.cache.set(userId, {
      ...credential,
      timestamp: Date.now(),
      ttl: credential.ttl || this.defaultTTL,
    });
  }

  get(userId: string): CachedCredential | null {
    const cached = this.cache.get(userId);
    if (!cached) return null;

    // Check expiration
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(userId);
      return null;
    }

    return cached;
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  clear(): void {
    this.cache.clear();
  }
}

// ============================================================================
// Service Instance Cache
// ============================================================================

interface CachedService {
  instance: UnifiedMexcClient;
  credentials: { apiKey: string; secretKey: string };
  timestamp: number;
  ttl: number;
}

class ServiceInstanceCache {
  private cache = new Map<string, CachedService>();
  private readonly defaultTTL = 600000; // 10 minutes

  private createCacheKey(apiKey: string, secretKey: string): string {
    // Create a hash to avoid storing credentials in cache key
    const crypto = require("crypto");
    return crypto
      .createHash("sha256")
      .update(`${apiKey}:${secretKey}`)
      .digest("hex")
      .substring(0, 16);
  }

  set(apiKey: string, secretKey: string, instance: UnifiedMexcClient, ttl?: number): void {
    const key = this.createCacheKey(apiKey, secretKey);
    this.cache.set(key, {
      instance,
      credentials: { apiKey, secretKey },
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  get(apiKey: string, secretKey: string): UnifiedMexcClient | null {
    const key = this.createCacheKey(apiKey, secretKey);
    const cached = this.cache.get(key);

    if (!cached) return null;

    // Check expiration
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.instance;
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// ============================================================================
// Main Service Factory
// ============================================================================

export class UnifiedMexcServiceFactory {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[unified-mexc-service-factory]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[unified-mexc-service-factory]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[unified-mexc-service-factory]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[unified-mexc-service-factory]", message, context || ""),
  };
  private config: ServiceFactoryConfig;
  private credentialCache = new CredentialCache();
  private serviceCache = new ServiceInstanceCache();
  private encryptionService = getEncryptionService();

  constructor(config: Partial<ServiceFactoryConfig> = {}) {
    this.config = {
      enableGlobalCache: true,
      credentialCacheTTL: 300000, // 5 minutes
      serviceInstanceCacheTTL: 600000, // 10 minutes
      fallbackToEnvironment: true,
      enableCircuitBreaker: true,
      ...config,
    };

    console.info("[UnifiedMexcServiceFactory] Initialized with config:", {
      enableGlobalCache: this.config.enableGlobalCache,
      credentialCacheTTL: this.config.credentialCacheTTL,
      serviceInstanceCacheTTL: this.config.serviceInstanceCacheTTL,
      fallbackToEnvironment: this.config.fallbackToEnvironment,
    });
  }

  // ============================================================================
  // Main Factory Method
  // ============================================================================

  /**
   * Get MEXC service instance with unified credential resolution
   * This is the primary method that should be used across all endpoints
   */
  async getMexcService(options?: {
    userId?: string;
    apiKey?: string;
    secretKey?: string;
    skipCache?: boolean;
    source?: "database" | "environment" | "explicit";
  }): Promise<UnifiedMexcClient> {
    const { userId, apiKey, secretKey, skipCache = false, source } = options || {};

    try {
      // 1. Resolve credentials based on priority
      const credentials = await this.resolveCredentials({
        userId,
        explicitApiKey: apiKey,
        explicitSecretKey: secretKey,
        skipCache,
        preferredSource: source,
      });

      if (!credentials) {
        console.warn(
          "[UnifiedMexcServiceFactory] No valid credentials found, falling back to environment"
        );

        // Check if environment credentials exist with improved validation
        const envApiKey = process.env.MEXC_API_KEY?.trim();
        const envSecretKey = process.env.MEXC_SECRET_KEY?.trim();

        if (!envApiKey || !envSecretKey || envApiKey.length < 10 || envSecretKey.length < 10) {
          console.error("[UnifiedMexcServiceFactory] Invalid or missing environment credentials", {
            hasApiKey: !!envApiKey,
            hasSecretKey: !!envSecretKey,
            apiKeyLength: envApiKey?.length || 0,
            secretKeyLength: envSecretKey?.length || 0,
          });
          throw new Error(
            "No valid MEXC API credentials configured - please verify MEXC_API_KEY and MEXC_SECRET_KEY environment variables"
          );
        }

        console.info("[UnifiedMexcServiceFactory] Using environment credentials as fallback");
        return this.createServiceInstance({
          apiKey: envApiKey,
          secretKey: envSecretKey,
          source: "environment",
        });
      }

      // 2. Check service instance cache
      if (this.config.enableGlobalCache && !skipCache) {
        const cachedService = this.serviceCache.get(credentials.apiKey, credentials.secretKey);
        if (cachedService) {
          console.info("[UnifiedMexcServiceFactory] Using cached service instance");
          return cachedService;
        }
      }

      // 3. Create new service instance
      const service = this.createServiceInstance(credentials);

      // 4. Cache the service instance
      if (this.config.enableGlobalCache && !skipCache) {
        this.serviceCache.set(
          credentials.apiKey,
          credentials.secretKey,
          service,
          this.config.serviceInstanceCacheTTL
        );
      }

      console.info("[UnifiedMexcServiceFactory] Created new service instance:", {
        hasApiKey: Boolean(credentials.apiKey),
        hasSecretKey: Boolean(credentials.secretKey),
        source: credentials.source,
        cached: !skipCache && this.config.enableGlobalCache,
      });

      return service;
    } catch (error) {
      console.error("[UnifiedMexcServiceFactory] Failed to get service:", error);

      // Improved fallback to environment credentials
      if (this.config.fallbackToEnvironment) {
        console.info(
          "[UnifiedMexcServiceFactory] Falling back to environment credentials due to error"
        );

        const envApiKey = process.env.MEXC_API_KEY?.trim();
        const envSecretKey = process.env.MEXC_SECRET_KEY?.trim();

        if (!envApiKey || !envSecretKey) {
          console.error(
            "[UnifiedMexcServiceFactory] Environment fallback failed - no credentials available"
          );
          throw new Error("All credential sources failed - no valid MEXC API credentials found");
        }

        return this.createServiceInstance({
          apiKey: envApiKey,
          secretKey: envSecretKey,
          source: "environment",
        });
      }

      throw error;
    }
  }

  // ============================================================================
  // Credential Resolution
  // ============================================================================

  private async resolveCredentials(options: {
    userId?: string;
    explicitApiKey?: string;
    explicitSecretKey?: string;
    skipCache?: boolean;
    preferredSource?: "database" | "environment" | "explicit";
  }): Promise<{
    apiKey: string;
    secretKey: string;
    source: "database" | "environment" | "explicit";
  } | null> {
    const { userId, explicitApiKey, explicitSecretKey, skipCache, preferredSource } = options;

    // Priority 1: Explicit credentials
    if (explicitApiKey && explicitSecretKey) {
      return {
        apiKey: explicitApiKey,
        secretKey: explicitSecretKey,
        source: "explicit",
      };
    }

    // Priority 2: User-specific database credentials
    if (userId && preferredSource !== "environment") {
      const userCredentials = await this.getUserCredentials(userId, skipCache);
      if (userCredentials) {
        return userCredentials;
      }
    }

    // Priority 3: Environment credentials
    const envApiKey = process.env.MEXC_API_KEY;
    const envSecretKey = process.env.MEXC_SECRET_KEY;

    if (envApiKey && envSecretKey) {
      return {
        apiKey: envApiKey,
        secretKey: envSecretKey,
        source: "environment",
      };
    }

    return null;
  }

  private async getUserCredentials(
    userId: string,
    skipCache = false
  ): Promise<{ apiKey: string; secretKey: string; source: "database" } | null> {
    try {
      // Check cache first
      if (!skipCache && this.config.enableGlobalCache) {
        const cached = this.credentialCache.get(userId);
        if (cached && cached.source === "database") {
          console.info("[UnifiedMexcServiceFactory] Using cached user credentials");
          return {
            apiKey: cached.apiKey,
            secretKey: cached.secretKey,
            source: "database",
          };
        }
      }

      // Validate userId before database query
      if (!userId || userId.trim() === "" || userId === "undefined" || userId === "null") {
        console.warn("[UnifiedMexcServiceFactory] Invalid userId provided:", userId);
        return null;
      }

      // Query database with improved timeout and error handling
      const credentials = await Promise.race([
        db
          .select()
          .from(apiCredentials)
          .where(
            and(
              eq(apiCredentials.userId, userId),
              eq(apiCredentials.provider, "mexc"),
              eq(apiCredentials.isActive, true)
            )
          )
          .limit(1),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Database query timeout after 3 seconds")), 3000)
        ),
      ]);

      if (!credentials || !credentials[0]) {
        console.info(`[UnifiedMexcServiceFactory] No credentials found for user: ${userId}`);
        return null;
      }

      // Decrypt credentials with error handling
      try {
        const apiKey = this.encryptionService.decrypt(credentials[0].encryptedApiKey);
        const secretKey = this.encryptionService.decrypt(credentials[0].encryptedSecretKey);

        // Validate decrypted credentials
        if (!apiKey || !secretKey) {
          console.warn("[UnifiedMexcServiceFactory] Failed to decrypt credentials - empty result");
          return null;
        }

        // Cache credentials
        if (this.config.enableGlobalCache && !skipCache) {
          this.credentialCache.set(userId, {
            apiKey,
            secretKey,
            source: "database",
            timestamp: Date.now(),
            ttl: this.config.credentialCacheTTL,
          });
        }

        console.info("[UnifiedMexcServiceFactory] Retrieved user credentials from database");

        return {
          apiKey,
          secretKey,
          source: "database",
        };
      } catch (decryptError) {
        console.error("[UnifiedMexcServiceFactory] Failed to decrypt credentials:", decryptError);
        return null;
      }
    } catch (error) {
      console.error("[UnifiedMexcServiceFactory] Failed to get user credentials:", error);
      // Don't throw - gracefully fallback to environment credentials
      return null;
    }
  }

  // ============================================================================
  // Service Instance Creation
  // ============================================================================

  private createServiceInstance(credentials: {
    apiKey: string;
    secretKey: string;
    source: "database" | "environment" | "explicit";
  }): UnifiedMexcClient {
    const config: UnifiedMexcConfig = {
      apiKey: credentials.apiKey,
      secretKey: credentials.secretKey,
      baseUrl: process.env.MEXC_BASE_URL || "https://api.mexc.com",
      timeout: 15000, // 15 seconds
      maxRetries: 3,
      retryDelay: 1000,
      rateLimitDelay: 100,
      enableCaching: true,
      cacheTTL: 60000, // 1 minute
    };

    return new UnifiedMexcClient(config);
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Invalidate cached credentials for a user
   */
  invalidateUserCredentials(userId: string): void {
    this.credentialCache.invalidate(userId);
    console.info(`[UnifiedMexcServiceFactory] Invalidated credentials cache for user: ${userId}`);
  }

  /**
   * Clear all service caches
   */
  clearAllCaches(): void {
    this.credentialCache.clear();
    this.serviceCache.clear();
    console.info("[UnifiedMexcServiceFactory] Cleared all caches");
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    credentialCache: { size: number };
    serviceCache: { size: number; keys: string[] };
  } {
    return {
      credentialCache: { size: this.credentialCache.cache.size },
      serviceCache: this.serviceCache.getStats(),
    };
  }

  // ============================================================================
  // Status Synchronization Support
  // ============================================================================

  /**
   * Callback for successful credential operations
   * Invalidates related caches to ensure status consistency
   */
  onCredentialOperationSuccess(userId?: string): void {
    if (userId) {
      this.invalidateUserCredentials(userId);
    }

    // TODO: Implement status synchronization callbacks
    // This would trigger React Query cache invalidation
    console.info(`[UnifiedMexcServiceFactory] Credential operation success - invalidated caches`);
  }

  /**
   * Test service connectivity and credentials
   */
  async testService(service: UnifiedMexcClient): Promise<{
    connectivity: boolean;
    authentication: boolean;
    error?: string;
  }> {
    try {
      // Test basic connectivity
      const connectivityTest = await service.testConnectivity();

      if (!connectivityTest) {
        return {
          connectivity: false,
          authentication: false,
          error: "Failed to connect to MEXC API",
        };
      }

      // Test authentication with account info
      const accountInfo = await service.getAccountInfo();

      if (!accountInfo.success) {
        return {
          connectivity: true,
          authentication: false,
          error: accountInfo.error || "Authentication failed",
        };
      }

      return {
        connectivity: true,
        authentication: true,
      };
    } catch (error) {
      return {
        connectivity: false,
        authentication: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// ============================================================================
// Global Factory Instance
// ============================================================================

let globalServiceFactory: UnifiedMexcServiceFactory | null = null;

/**
 * Get global service factory instance (singleton)
 */
export function getGlobalMexcServiceFactory(): UnifiedMexcServiceFactory {
  if (!globalServiceFactory) {
    globalServiceFactory = new UnifiedMexcServiceFactory();
  }
  return globalServiceFactory;
}

/**
 * Reset global service factory (for testing)
 */
export function resetGlobalMexcServiceFactory(): void {
  globalServiceFactory = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get MEXC service with unified credential resolution
 * This should be used in all API endpoints for consistency
 */
export async function getUnifiedMexcService(options?: {
  userId?: string;
  apiKey?: string;
  secretKey?: string;
  skipCache?: boolean;
}): Promise<UnifiedMexcClient> {
  const factory = getGlobalMexcServiceFactory();
  return factory.getMexcService(options);
}

/**
 * Invalidate user credentials cache
 */
export function invalidateUserCredentialsCache(userId: string): void {
  const factory = getGlobalMexcServiceFactory();
  factory.invalidateUserCredentials(userId);
}

/**
 * Clear all MEXC service caches
 */
export function clearMexcServiceCaches(): void {
  const factory = getGlobalMexcServiceFactory();
  factory.clearAllCaches();
}

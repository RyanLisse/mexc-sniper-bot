import {
  isBrowserEnvironment,
  isNodeEnvironment,
} from "@/src/lib/browser-compatible-events";
/**
 * Unified MEXC Credential Validation Service
 *
 * This service consolidates the functionality from both /mexc/connectivity and /mexc/test-credentials
 * endpoints into a single, comprehensive validation system to eliminate duplicate API calls.
 *
 * Features:
 * - Complete credential validation workflow
 * - Network connectivity testing
 * - Account balance verification
 * - Detailed error reporting
 * - Support for both user and environment credentials
 * - Comprehensive test results
 */

import { getRecommendedMexcService } from "../services/api/mexc-unified-exports";
import { getUserCredentials } from "../services/api/user-credentials-service";
import {
  type ApiResponse,
  type CredentialValidationResult,
  createCredentialResponse,
} from "./api-response";
import { NetworkError, ValidationError } from "./errors";

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface MexcCredentials {
  apiKey: string;
  secretKey: string;
  passphrase?: string;
}

export interface ComprehensiveValidationResult
  extends CredentialValidationResult {
  testResults: {
    networkConnectivity: boolean;
    credentialLoading: boolean;
    accountAccess: boolean;
    balanceRetrieval: boolean;
  };
  performance: {
    connectivityTestMs: number;
    accountTestMs: number;
    totalTestMs: number;
  };
  accountInfo?: {
    balanceCount: number;
    totalValue: number;
    primaryBalances: Array<{
      asset: string;
      free: string;
      locked: string;
    }>;
  };
  diagnostics: {
    ipAllowlisted: boolean;
    permissionsValid: boolean;
    signatureValid: boolean;
    timestampValid: boolean;
  };
}

export interface ValidationOptions {
  includeAccountInfo?: boolean;
  performDiagnostics?: boolean;
  skipCache?: boolean;
  timeoutMs?: number;
}

// ============================================================================
// MEXC Validation Cache
// ============================================================================

interface CachedValidationResult {
  result: ComprehensiveValidationResult;
  timestamp: number;
  expiresAt: number;
}

class MexcValidationCache {
  private cache = new Map<string, CachedValidationResult>();
  private defaultTTL = 60000; // 1 minute for credential validation

  set(key: string, result: ComprehensiveValidationResult, ttl?: number): void {
    const now = Date.now();
    this.cache.set(key, {
      result,
      timestamp: now,
      expiresAt: now + (ttl || this.defaultTTL),
    });
  }

  get(key: string): ComprehensiveValidationResult | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.result;
  }

  clear(): void {
    this.cache.clear();
  }

  generateKey(
    userId: string | undefined,
    credentials?: MexcCredentials
  ): string {
    if (credentials) {
      // Hash the credentials for cache key (don't store actual credentials)
      const hash = this.simpleHash(credentials.apiKey + credentials.secretKey);
      return `credentials-${hash}`;
    }
    return `user-${userId || "anonymous"}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

const validationCache = new MexcValidationCache();

// ============================================================================
// Unified MEXC Validation Service
// ============================================================================

export class UnifiedMexcValidationService {
  /**
   * Comprehensive MEXC credential validation
   * Combines connectivity testing and credential verification
   */
  static async validateCredentials(
    userId?: string,
    providedCredentials?: MexcCredentials,
    options: ValidationOptions = {}
  ): Promise<ComprehensiveValidationResult> {
    const startTime = Date.now();
    const {
      includeAccountInfo = true,
      performDiagnostics = true,
      skipCache = false,
      timeoutMs = 30000,
    } = options;

    // Check cache first
    if (!skipCache) {
      const cacheKey = validationCache.generateKey(userId, providedCredentials);
      const cached = validationCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // Step 1: Validate input credentials if provided
      if (providedCredentials) {
        UnifiedMexcValidationService.validateCredentialFormat(
          providedCredentials
        );
      }

      // Step 2: Determine credential source and load credentials
      const { credentials, source } =
        await UnifiedMexcValidationService.loadCredentials(
          userId,
          providedCredentials
        );

      // Step 3: Test network connectivity
      const connectivityStart = Date.now();
      const connectivityResult =
        await UnifiedMexcValidationService.testConnectivity(
          credentials,
          timeoutMs
        );
      const connectivityTime = Date.now() - connectivityStart;

      if (!connectivityResult.success) {
        return UnifiedMexcValidationService.createFailedResult(
          credentials !== null,
          false,
          source,
          false,
          connectivityResult.error || "Network connectivity failed",
          {
            networkConnectivity: false,
            credentialLoading: credentials !== null,
            accountAccess: false,
            balanceRetrieval: false,
          },
          {
            connectivityTestMs: connectivityTime,
            accountTestMs: 0,
            totalTestMs: Date.now() - startTime,
          }
        );
      }

      // Step 4: Test credential authentication
      const accountStart = Date.now();
      const accountResult =
        await UnifiedMexcValidationService.testAccountAccess(
          credentials,
          includeAccountInfo,
          timeoutMs
        );
      const accountTime = Date.now() - accountStart;

      // Step 5: Perform diagnostics if requested
      let diagnostics = {
        ipAllowlisted: true,
        permissionsValid: true,
        signatureValid: true,
        timestampValid: true,
      };

      if (performDiagnostics && !accountResult.success) {
        diagnostics = UnifiedMexcValidationService.performDiagnostics(
          accountResult.error
        );
      }

      const totalTime = Date.now() - startTime;
      const result: ComprehensiveValidationResult = {
        hasCredentials: credentials !== null,
        credentialsValid: accountResult.success,
        credentialSource: source,
        connected: connectivityResult.success,
        error: accountResult.error,
        testResults: {
          networkConnectivity: connectivityResult.success,
          credentialLoading: credentials !== null,
          accountAccess: accountResult.success,
          balanceRetrieval: accountResult.success && !!accountResult.data,
        },
        performance: {
          connectivityTestMs: connectivityTime,
          accountTestMs: accountTime,
          totalTestMs: totalTime,
        },
        accountInfo:
          accountResult.success && includeAccountInfo
            ? {
                balanceCount: accountResult.data?.balances?.length || 0,
                totalValue: accountResult.data?.totalUsdtValue || 0,
                primaryBalances:
                  UnifiedMexcValidationService.extractPrimaryBalances(
                    accountResult.data?.balances || []
                  ),
              }
            : undefined,
        diagnostics,
      };

      // Cache successful results
      if (!skipCache && result.credentialsValid) {
        const cacheKey = validationCache.generateKey(
          userId,
          providedCredentials
        );
        validationCache.set(cacheKey, result);
      }

      return result;
    } catch (error) {
      const totalTime = Date.now() - startTime;

      if (error instanceof ValidationError) {
        return UnifiedMexcValidationService.createFailedResult(
          false,
          false,
          "none",
          false,
          error.message,
          {
            networkConnectivity: false,
            credentialLoading: false,
            accountAccess: false,
            balanceRetrieval: false,
          },
          {
            connectivityTestMs: 0,
            accountTestMs: 0,
            totalTestMs: totalTime,
          }
        );
      }

      return UnifiedMexcValidationService.createFailedResult(
        false,
        false,
        "none",
        false,
        `Validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        {
          networkConnectivity: false,
          credentialLoading: false,
          accountAccess: false,
          balanceRetrieval: false,
        },
        {
          connectivityTestMs: 0,
          accountTestMs: 0,
          totalTestMs: totalTime,
        }
      );
    }
  }

  /**
   * Test only network connectivity (lightweight check)
   */
  static async testConnectivityOnly(): Promise<{
    connected: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const mexcService = getRecommendedMexcService();
      const result = await mexcService.testConnectivity();

      return {
        connected: result.success,
        responseTime: Date.now() - startTime,
        error: result.success ? undefined : "Connection test failed",
      };
    } catch (error) {
      return {
        connected: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get validation summary for user
   */
  static async getValidationSummary(userId: string): Promise<{
    hasUserCredentials: boolean;
    hasEnvironmentCredentials: boolean;
    preferredSource: "database" | "environment" | "none";
    lastValidation?: {
      timestamp: string;
      wasValid: boolean;
      source: string;
    };
  }> {
    try {
      // Check user credentials
      let hasUserCredentials = false;
      try {
        const userCreds = await getUserCredentials(userId, "mexc");
        hasUserCredentials = !!userCreds;
      } catch {
        // Ignore errors, just means no user credentials
      }

      // Check environment credentials
      const hasEnvironmentCredentials = !!(
        process.env.MEXC_API_KEY && process.env.MEXC_SECRET_KEY
      );

      // Determine preferred source
      let preferredSource: "database" | "environment" | "none" = "none";
      if (hasUserCredentials) {
        preferredSource = "database";
      } else if (hasEnvironmentCredentials) {
        preferredSource = "environment";
      }

      return {
        hasUserCredentials,
        hasEnvironmentCredentials,
        preferredSource,
      };
    } catch (_error) {
      return {
        hasUserCredentials: false,
        hasEnvironmentCredentials: !!(
          process.env.MEXC_API_KEY && process.env.MEXC_SECRET_KEY
        ),
        preferredSource: "none",
      };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private static validateCredentialFormat(credentials: MexcCredentials): void {
    if (!credentials.apiKey || !credentials.secretKey) {
      throw new ValidationError("Both apiKey and secretKey are required");
    }

    if (
      typeof credentials.apiKey !== "string" ||
      typeof credentials.secretKey !== "string"
    ) {
      throw new ValidationError("Credentials must be strings");
    }

    if (credentials.apiKey.length < 10 || credentials.secretKey.length < 20) {
      throw new ValidationError(
        "API key must be at least 10 characters, secret key at least 20 characters"
      );
    }
  }

  private static async loadCredentials(
    userId?: string,
    providedCredentials?: MexcCredentials
  ): Promise<{
    credentials: MexcCredentials | null;
    source: "database" | "environment" | "provided" | "none";
  }> {
    // Use provided credentials first
    if (providedCredentials) {
      return {
        credentials: providedCredentials,
        source: "provided",
      };
    }

    // Try user credentials
    if (userId) {
      try {
        const userCredentials = await getUserCredentials(userId, "mexc");
        if (userCredentials) {
          return {
            credentials: {
              apiKey: userCredentials.apiKey,
              secretKey: userCredentials.secretKey,
            },
            source: "database",
          };
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("Encryption service unavailable")
        ) {
          throw new NetworkError(
            "Encryption service unavailable",
            "encryption-service"
          );
        }
        // Continue to check environment credentials
      }
    }

    // Try environment credentials
    if (process.env.MEXC_API_KEY && process.env.MEXC_SECRET_KEY) {
      return {
        credentials: {
          apiKey: process.env.MEXC_API_KEY,
          secretKey: process.env.MEXC_SECRET_KEY,
        },
        source: "environment",
      };
    }

    return {
      credentials: null,
      source: "none",
    };
  }

  private static async testConnectivity(
    credentials: MexcCredentials | null,
    timeoutMs: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const mexcService = credentials
        ? getRecommendedMexcService(credentials)
        : getRecommendedMexcService();

      // Use Promise.race to implement timeout
      const connectivityPromise = mexcService.testConnectivityWithResponse();
      const timeoutPromise = new Promise<{ success: boolean; error: string }>(
        (_, reject) => {
          setTimeout(
            () => reject(new Error("Connectivity test timeout")),
            timeoutMs
          );
        }
      );

      const result = await Promise.race([connectivityPromise, timeoutPromise]);
      return {
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Connectivity test failed",
      };
    }
  }

  private static async testAccountAccess(
    credentials: MexcCredentials | null,
    includeBalances: boolean,
    timeoutMs: number
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!credentials) {
      return {
        success: false,
        error: "No credentials available",
      };
    }

    try {
      const mexcService = getRecommendedMexcService(credentials);

      // Use Promise.race to implement timeout
      const accountPromise = mexcService.getAccountBalances();
      const timeoutPromise = new Promise<any>((_, reject) => {
        setTimeout(
          () => reject(new Error("Account access test timeout")),
          timeoutMs
        );
      });

      const result = await Promise.race([accountPromise, timeoutPromise]);

      return {
        success: result.success,
        data: includeBalances ? result.data : undefined,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Account access test failed",
      };
    }
  }

  private static performDiagnostics(error?: string): {
    ipAllowlisted: boolean;
    permissionsValid: boolean;
    signatureValid: boolean;
    timestampValid: boolean;
  } {
    if (!error) {
      return {
        ipAllowlisted: true,
        permissionsValid: true,
        signatureValid: true,
        timestampValid: true,
      };
    }

    const errorLower = error.toLowerCase();

    return {
      ipAllowlisted:
        !errorLower.includes("ip") && !errorLower.includes("allowlist"),
      permissionsValid:
        !errorLower.includes("permission") && !errorLower.includes("scope"),
      signatureValid:
        !errorLower.includes("signature") && !errorLower.includes("sign"),
      timestampValid:
        !errorLower.includes("timestamp") && !errorLower.includes("time"),
    };
  }

  private static extractPrimaryBalances(balances: any[]): Array<{
    asset: string;
    free: string;
    locked: string;
  }> {
    return balances
      .filter(
        (balance) =>
          Number.parseFloat(balance.free) > 0 ||
          Number.parseFloat(balance.locked) > 0
      )
      .slice(0, 10) // Top 10 balances
      .map((balance) => ({
        asset: balance.asset,
        free: balance.free,
        locked: balance.locked,
      }));
  }

  private static createFailedResult(
    hasCredentials: boolean,
    credentialsValid: boolean,
    source: "database" | "environment" | "provided" | "none",
    connected: boolean,
    error: string,
    testResults: ComprehensiveValidationResult["testResults"],
    performance: ComprehensiveValidationResult["performance"]
  ): ComprehensiveValidationResult {
    return {
      hasCredentials,
      credentialsValid,
      credentialSource: source,
      connected,
      error,
      testResults,
      performance,
      diagnostics: {
        ipAllowlisted: false,
        permissionsValid: false,
        signatureValid: false,
        timestampValid: false,
      },
    };
  }

  /**
   * Clear validation cache
   */
  static clearCache(): void {
    validationCache.clear();
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick connectivity test
 */
export async function testMexcConnectivity(): Promise<ApiResponse<any>> {
  const result = await UnifiedMexcValidationService.testConnectivityOnly();

  return {
    success: result.connected,
    status: result.connected ? "healthy" : "error",
    message: result.connected
      ? "MEXC API is reachable"
      : "MEXC API is unreachable",
    data: {
      connected: result.connected,
      responseTime: result.responseTime,
    },
    error: result.error,
    meta: {
      timestamp: new Date().toISOString(),
      responseTime: result.responseTime,
    },
  };
}

/**
 * Validate user credentials
 */
export async function validateUserCredentials(
  userId: string,
  options?: ValidationOptions
): Promise<ApiResponse<ComprehensiveValidationResult>> {
  const result = await UnifiedMexcValidationService.validateCredentials(
    userId,
    undefined,
    options
  );
  const response = createCredentialResponse(result, result.accountInfo);
  return {
    ...response,
    data: result as ComprehensiveValidationResult,
  } as ApiResponse<ComprehensiveValidationResult>;
}

/**
 * Test provided credentials
 */
export async function testProvidedCredentials(
  credentials: MexcCredentials,
  options?: ValidationOptions
): Promise<ApiResponse<ComprehensiveValidationResult>> {
  const result = await UnifiedMexcValidationService.validateCredentials(
    undefined,
    credentials,
    options
  );
  const response = createCredentialResponse(result, result.accountInfo);
  return {
    ...response,
    data: result as ComprehensiveValidationResult,
  } as ApiResponse<ComprehensiveValidationResult>;
}

// ============================================================================
// Exports
// ============================================================================

export {
  UnifiedMexcValidationService as default,
  validationCache as mexcValidationCache,
};

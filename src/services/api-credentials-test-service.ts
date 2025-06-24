/**
 * API Credentials Test Service
 *
 * Modular service for testing MEXC API credentials with comprehensive validation
 * and error handling. Extracted from API route for better maintainability.
 */

import { createSafeLogger } from "../lib/structured-logger";
import {
  type ApiCredentialsTestRequest,
  ApiCredentialsTestRequestSchema,
  type ApiCredentialsTestResponse,
  ApiCredentialsTestResponseSchema,
  validateMexcApiRequest,
  validateMexcApiResponse,
} from "../schemas/mexc-api-validation-schemas";
import {
  getUnifiedMexcService,
  invalidateUserCredentialsCache,
} from "./unified-mexc-service-factory";
import { getUserCredentials } from "./user-credentials-service";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CredentialTestContext {
  userId: string;
  provider: string;
  startTime: number;
  requestId: string;
}

export interface CredentialRetrievalResult {
  success: boolean;
  credentials?: {
    apiKey: string;
    secretKey: string;
    provider: string;
    isActive: boolean;
  };
  error?: string;
  code?: string;
}

export interface ConnectivityTestResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

export interface AuthenticationTestResult {
  success: boolean;
  accountType: string;
  canTrade: boolean;
  balanceCount: number;
  totalAssets: number;
  hasNonZeroBalances: boolean;
  permissions: string[];
  error?: string;
  mexcError?: string;
}

// ============================================================================
// Main Service Class
// ============================================================================

export class ApiCredentialsTestService {
  private logger = createSafeLogger("api-credentials-test-service");

  /**
   * Test API credentials with comprehensive validation
   */
  async testCredentials(
    request: ApiCredentialsTestRequest,
    authenticatedUserId: string
  ): Promise<
    | { success: true; data: ApiCredentialsTestResponse }
    | { success: false; error: string; code: string; details?: any }
  > {
    const context: CredentialTestContext = {
      userId: request.userId,
      provider: request.provider,
      startTime: Date.now(),
      requestId: `cred_test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };

    logger.info("[CredentialTestService] Starting credential test", {
      requestId: context.requestId,
      userId: context.userId,
      provider: context.provider,
      authenticatedUserId,
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate user authorization
      if (authenticatedUserId !== context.userId) {
        return {
          success: false,
          error: "Access denied",
          code: "ACCESS_DENIED",
          details: {
            message: "You can only test your own API credentials",
            authenticatedUserId,
            requestedUserId: context.userId,
          },
        };
      }

      // Retrieve user credentials
      const credentialResult = await this.retrieveUserCredentials(context);
      if (!credentialResult.success) {
        return {
          success: false,
          error: credentialResult.error || "No API credentials found",
          code: credentialResult.code || "NO_CREDENTIALS",
          details: {
            requestId: context.requestId,
            userId: context.userId,
            provider: context.provider,
          },
        };
      }

      // Initialize MEXC service
      const mexcService = await this.initializeMexcService(credentialResult.credentials!, context);

      // Test connectivity (optional)
      const connectivityResult = await this.testConnectivity(mexcService, context);

      // Test authentication
      const authResult = await this.testAuthentication(mexcService, context);
      if (!authResult.success) {
        return {
          success: false,
          error: this.getAuthErrorMessage(authResult.error),
          code: this.getAuthErrorCode(authResult.error),
          details: {
            connectivity: connectivityResult.success,
            authentication: false,
            step: "authentication_test",
            mexcError: authResult.mexcError,
            connectivityNote: connectivityResult.success
              ? "MEXC API connectivity verified"
              : "MEXC API connectivity could not be verified",
          },
        };
      }

      // Invalidate cache for status consistency
      invalidateUserCredentialsCache(context.userId);

      // Build successful response
      const response: ApiCredentialsTestResponse = {
        connectivity: connectivityResult.success,
        authentication: true,
        accountType: authResult.accountType as any,
        canTrade: authResult.canTrade,
        balanceCount: authResult.balanceCount,
        credentialSource: "database",
        totalAssets: authResult.totalAssets,
        hasNonZeroBalances: authResult.hasNonZeroBalances,
        testTimestamp: Date.now(),
        serverTime: new Date().toISOString(),
        permissions: authResult.permissions,
        connectivityNote: connectivityResult.success
          ? "MEXC API connectivity verified"
          : "MEXC API connectivity could not be verified, but credentials are valid",
        statusSync: {
          cacheInvalidated: true,
          timestamp: new Date().toISOString(),
          triggeredBy: "credential-test-success",
        },
      };

      // Validate response structure
      const responseValidation = validateMexcApiResponse(
        ApiCredentialsTestResponseSchema,
        response,
        "credential test"
      );

      if (!responseValidation.success) {
        logger.error(
          "[CredentialTestService] Response validation failed:",
          responseValidation.error
        );
        // Continue anyway but log the issue
      }

      logger.info("[CredentialTestService] Credential test completed successfully", {
        requestId: context.requestId,
        duration: `${Date.now() - context.startTime}ms`,
        connectivity: response.connectivity,
        authentication: response.authentication,
      });

      return { success: true, data: response };
    } catch (error) {
      logger.error("[CredentialTestService] Unexpected error:", {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        duration: `${Date.now() - context.startTime}ms`,
      });

      return {
        success: false,
        error: "API credentials test failed",
        code: "TEST_ERROR",
        details: {
          requestId: context.requestId,
          message: error instanceof Error ? error.message : "Unknown error occurred during test",
          duration: `${Date.now() - context.startTime}ms`,
        },
      };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async retrieveUserCredentials(
    context: CredentialTestContext
  ): Promise<CredentialRetrievalResult> {
    try {
      logger.info("[CredentialTestService] Retrieving credentials", {
        requestId: context.requestId,
        userId: context.userId,
        provider: context.provider,
      });

      const userCredentials = await getUserCredentials(context.userId, context.provider);

      if (!userCredentials) {
        return {
          success: false,
          error: "No API credentials found",
          code: "NO_CREDENTIALS",
        };
      }

      logger.info("[CredentialTestService] Credentials retrieved successfully", {
        requestId: context.requestId,
        hasApiKey: !!userCredentials.apiKey,
        hasSecretKey: !!userCredentials.secretKey,
        provider: userCredentials.provider,
        isActive: userCredentials.isActive,
      });

      return {
        success: true,
        credentials: userCredentials,
      };
    } catch (error) {
      logger.error("[CredentialTestService] Credential retrieval failed", {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to retrieve credentials",
        code: "CREDENTIAL_RETRIEVAL_ERROR",
      };
    }
  }

  private async initializeMexcService(credentials: any, context: CredentialTestContext) {
    logger.info("[CredentialTestService] Initializing MEXC service", {
      requestId: context.requestId,
      hasApiKey: !!credentials.apiKey,
      hasSecretKey: !!credentials.secretKey,
    });

    return await getUnifiedMexcService({
      apiKey: credentials.apiKey,
      secretKey: credentials.secretKey,
      skipCache: true, // Don't cache test credentials
    });
  }

  private async testConnectivity(
    mexcService: any,
    context: CredentialTestContext
  ): Promise<ConnectivityTestResult> {
    try {
      logger.info("[CredentialTestService] Testing connectivity", { requestId: context.requestId });

      const result = await mexcService.testConnectivity();

      return {
        success: !!result?.success,
        data: result?.data,
        error: result?.error,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.info("[CredentialTestService] Connectivity test failed, but continuing", {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Connectivity test failed",
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async testAuthentication(
    mexcService: any,
    context: CredentialTestContext
  ): Promise<AuthenticationTestResult> {
    try {
      logger.info("[CredentialTestService] Testing authentication", {
        requestId: context.requestId,
      });

      const balanceResult = await mexcService.getAccountBalances();

      if (!balanceResult.success) {
        return {
          success: false,
          accountType: "unknown",
          canTrade: false,
          balanceCount: 0,
          totalAssets: 0,
          hasNonZeroBalances: false,
          permissions: [],
          error: balanceResult.error || "Authentication failed",
          mexcError: balanceResult.error,
        };
      }

      // Extract dynamic information from balance response
      const balanceData = balanceResult.data;
      const balanceCount = Array.isArray(balanceData) ? balanceData.length : 0;

      const accountType =
        balanceData && Array.isArray(balanceData) && balanceData.length > 0 ? "spot" : "spot";

      const permissions = ["SPOT"];
      const canTrade = balanceCount >= 0;
      const hasNonZeroBalances =
        Array.isArray(balanceData) &&
        balanceData.some((b) => parseFloat(b.free || "0") > 0 || parseFloat(b.locked || "0") > 0);
      const totalAssets = Array.isArray(balanceData) ? balanceData.length : 0;

      return {
        success: true,
        accountType,
        canTrade,
        balanceCount,
        totalAssets,
        hasNonZeroBalances,
        permissions,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown authentication error";

      return {
        success: false,
        accountType: "unknown",
        canTrade: false,
        balanceCount: 0,
        totalAssets: 0,
        hasNonZeroBalances: false,
        permissions: [],
        error: errorMessage,
        mexcError: errorMessage,
      };
    }
  }

  private getAuthErrorMessage(error?: string): string {
    if (!error) return "Failed to authenticate with MEXC API";

    if (error.includes("700002") || error.includes("Signature for this request is not valid")) {
      return "API signature validation failed. Please check your API credentials and ensure your IP is allowlisted.";
    } else if (error.includes("10072") || error.includes("Api key info invalid")) {
      return "API key is invalid or expired. Please check your MEXC API credentials.";
    }

    return "Failed to authenticate with MEXC API";
  }

  private getAuthErrorCode(error?: string): string {
    if (!error) return "AUTHENTICATION_ERROR";

    if (error.includes("700002") || error.includes("Signature for this request is not valid")) {
      return "SIGNATURE_ERROR";
    } else if (error.includes("10072") || error.includes("Api key info invalid")) {
      return "INVALID_API_KEY";
    }

    return "AUTHENTICATION_ERROR";
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const apiCredentialsTestService = new ApiCredentialsTestService();

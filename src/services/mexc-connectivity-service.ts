/**
 * MEXC Connectivity Service
 *
 * Optimized service for testing MEXC API connectivity with comprehensive
 * performance monitoring, error handling, and validation.
 */

import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { ErrorFactory } from "../lib/error-types";
import {
  type ConnectivityMetrics,
  type ConnectivityTestRequest,
  ConnectivityTestRequestSchema,
  type ConnectivityTestResponse,
  ConnectivityTestResponseSchema,
  validateMexcApiRequest,
  validateMexcApiResponse,
} from "../schemas/mexc-api-validation-schemas";
import { getRecommendedMexcService } from "./mexc-unified-exports";
import { getUserCredentials } from "./user-credentials-service";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ConnectivityTestContext {
  requestId: string;
  startTime: number;
  userId?: string;
  includeCredentialTest: boolean;
}

export interface CredentialInfo {
  userCredentials?: any;
  hasUserCredentials: boolean;
  hasEnvironmentCredentials: boolean;
  source: "database" | "environment" | "none";
}

export interface DetailedConnectivityResult {
  connected: boolean;
  retryCount: number;
  latency: number;
  connectionHealth: "excellent" | "good" | "poor" | "failed";
  error?: string;
  attempts: Array<{
    attempt: number;
    latency: number;
    success: boolean;
    error?: string;
  }>;
}

export interface CredentialTestResult {
  hasCredentials: boolean;
  isValid: boolean;
  message: string;
  status: string;
  error?: string;
}

// ============================================================================
// Main Service Class
// ============================================================================

export class MexcConnectivityService {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[mexc-connectivity-service]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[mexc-connectivity-service]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[mexc-connectivity-service]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[mexc-connectivity-service]", message, context || ""),
  };

  /**
   * Test MEXC connectivity with comprehensive validation and monitoring
   */
  async testConnectivity(
    request: ConnectivityTestRequest
  ): Promise<
    | { success: true; data: ConnectivityTestResponse }
    | { success: false; error: string; code: string; details?: any }
  > {
    const context: ConnectivityTestContext = {
      requestId: `mexc_conn_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      startTime: Date.now(),
      userId: request.userId,
      includeCredentialTest: request.includeCredentialTest,
    };

    console.info("[MexcConnectivityService] Starting connectivity test", {
      requestId: context.requestId,
      userId: context.userId,
      includeCredentialTest: context.includeCredentialTest,
      timestamp: new Date().toISOString(),
    });

    try {
      // Get authenticated user if available
      const { getUser } = getKindeServerSession();
      const user = await getUser();
      const authenticatedUserId = user?.id;

      // Get credentials with fallback
      const credentials = await this.getUserCredentialsWithFallback(
        context.userId || authenticatedUserId,
        context
      );

      // Initialize MEXC service
      const mexcService = this.getRecommendedMexcService(
        credentials.userCredentials || undefined,
        context
      );

      // Test basic connectivity with detailed metrics
      const connectivityResult = await this.testMexcConnectivityWithMetrics(mexcService, context);

      // Test credentials if available and requested
      let credentialsResult: CredentialTestResult = {
        hasCredentials: false,
        isValid: false,
        message: "No credentials to test",
        status: "no_credentials",
      };

      if (context.includeCredentialTest && credentials.source !== "none") {
        credentialsResult = await this.testCredentials(mexcService, credentials, context);
      }

      // Build comprehensive response
      const metrics: ConnectivityMetrics = {
        latency: connectivityResult.latency,
        retryCount: connectivityResult.retryCount,
        connectionHealth: connectivityResult.connectionHealth,
        lastSuccessfulCheck: connectivityResult.connected ? new Date().toISOString() : undefined,
      };

      const response: ConnectivityTestResponse = {
        connected: connectivityResult.connected,
        hasCredentials: credentialsResult.hasCredentials,
        credentialsValid: credentialsResult.isValid,
        credentialSource: credentials.source,
        hasUserCredentials: credentials.hasUserCredentials,
        hasEnvironmentCredentials: credentials.hasEnvironmentCredentials,
        message: connectivityResult.connected
          ? credentialsResult.message
          : connectivityResult.error,
        error: connectivityResult.connected ? credentialsResult.error : connectivityResult.error,
        timestamp: new Date().toISOString(),
        status: this.determineOverallStatus(connectivityResult, credentialsResult),
        metrics,
      };

      // Validate response structure
      const responseValidation = validateMexcApiResponse(
        ConnectivityTestResponseSchema,
        response,
        "connectivity test"
      );

      if (!responseValidation.success) {
        console.error(
          "[MexcConnectivityService] Response validation failed:",
          responseValidation.error
        );
        // Continue anyway but log the issue
      }

      console.info("[MexcConnectivityService] Connectivity test completed", {
        requestId: context.requestId,
        duration: `${Date.now() - context.startTime}ms`,
        connected: response.connected,
        credentialsValid: response.credentialsValid,
        connectionHealth: metrics.connectionHealth,
      });

      return { success: true, data: response };
    } catch (error) {
      console.error("[MexcConnectivityService] Unexpected error:", {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        duration: `${Date.now() - context.startTime}ms`,
      });

      return {
        success: false,
        error: "MEXC connectivity test failed",
        code: "CONNECTIVITY_TEST_ERROR",
        details: {
          requestId: context.requestId,
          message:
            error instanceof Error
              ? error.message
              : "Unknown error occurred during connectivity test",
          duration: `${Date.now() - context.startTime}ms`,
        },
      };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async getUserCredentialsWithFallback(
    userId?: string,
    context?: ConnectivityTestContext
  ): Promise<CredentialInfo> {
    let userCredentials = null;
    let hasUserCredentials = false;
    let credentialSource: "database" | "environment" | "none" = "none";

    if (userId) {
      try {
        console.info("[MexcConnectivityService] Fetching credentials for user", {
          requestId: context?.requestId,
          userId,
        });

        userCredentials = await getUserCredentials(userId, "mexc");
        hasUserCredentials = !!userCredentials;

        if (hasUserCredentials) {
          credentialSource = "database";
          console.info("[MexcConnectivityService] User credentials found", {
            requestId: context?.requestId,
            hasApiKey: !!userCredentials?.apiKey,
            hasSecretKey: !!userCredentials?.secretKey,
          });
        }
      } catch (error) {
        // Handle encryption service errors specifically
        if (error instanceof Error && error.message.includes("Encryption service unavailable")) {
          throw ErrorFactory.encryption(
            "Unable to access stored credentials due to server configuration issue"
          );
        }

        console.warn("[MexcConnectivityService] Failed to retrieve user credentials:", {
          requestId: context?.requestId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue to check environment credentials
      }
    }

    const hasEnvironmentCredentials = !!(process.env.MEXC_API_KEY && process.env.MEXC_SECRET_KEY);

    if (!hasUserCredentials && hasEnvironmentCredentials) {
      credentialSource = "environment";
    }

    return {
      userCredentials,
      hasUserCredentials,
      hasEnvironmentCredentials,
      source: credentialSource,
    };
  }

  private getRecommendedMexcService(userCredentials?: any, context?: ConnectivityTestContext) {
    console.info("[MexcConnectivityService] Initializing MEXC service", {
      requestId: context?.requestId,
      hasUserCredentials: !!userCredentials,
    });

    return getRecommendedMexcService(userCredentials);
  }

  private async testMexcConnectivityWithMetrics(
    mexcService: any,
    context: ConnectivityTestContext
  ): Promise<DetailedConnectivityResult> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    let totalLatency = 0;
    let retryCount = 0;
    let lastError: string | undefined;
    const attempts: any[] = [];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const attemptStart = Date.now();

      try {
        const result = await mexcService.testConnectivity();
        const attemptLatency = Date.now() - attemptStart;
        totalLatency += attemptLatency;

        const attemptInfo = {
          attempt: attempt + 1,
          latency: attemptLatency,
          success: false,
          error: undefined as string | undefined,
        };

        // Handle both boolean and MexcServiceResponse types
        let isConnected = false;
        if (typeof result === "boolean") {
          isConnected = result;
        } else {
          isConnected = result?.success === true;
        }

        attemptInfo.success = isConnected;
        attempts.push(attemptInfo);

        if (isConnected) {
          const avgLatency = totalLatency / (attempt + 1);
          const connectionHealth = this.determineConnectionHealth(avgLatency, retryCount);

          console.info("[MexcConnectivityService] Connectivity test successful", {
            requestId: context.requestId,
            attempt: attempt + 1,
            latency: avgLatency,
            connectionHealth,
          });

          return {
            connected: true,
            retryCount,
            latency: avgLatency,
            connectionHealth,
            attempts,
          };
        }

        // If not connected and we have retries left, continue to retry logic
        if (attempt < maxRetries - 1) {
          retryCount++;
          lastError = result?.error || "Connection test failed";
          attemptInfo.error = lastError;
        }
      } catch (error) {
        const attemptLatency = Date.now() - attemptStart;
        totalLatency += attemptLatency;

        const errorMessage = error instanceof Error ? error.message : String(error);

        attempts.push({
          attempt: attempt + 1,
          latency: attemptLatency,
          success: false,
          error: errorMessage,
        });

        console.error("[MexcConnectivityService] Connectivity test failed", {
          requestId: context.requestId,
          attempt: attempt + 1,
          maxRetries,
          error: errorMessage,
        });

        // Don't retry on auth errors or client errors (except rate limiting)
        if (error instanceof Error) {
          const errorMsg = error.message.toLowerCase();
          if (
            errorMsg.includes("401") ||
            errorMsg.includes("403") ||
            errorMsg.includes("invalid") ||
            errorMsg.includes("unauthorized")
          ) {
            console.warn(
              "[MexcConnectivityService] Authentication error detected, skipping retries",
              {
                requestId: context.requestId,
              }
            );
            return {
              connected: false,
              retryCount,
              latency: totalLatency / (attempt + 1),
              connectionHealth: "failed",
              error: errorMessage,
              attempts,
            };
          }
        }

        lastError = errorMessage;

        // If this is the last attempt, return failed result
        if (attempt === maxRetries - 1) {
          const avgLatency = totalLatency / maxRetries;
          return {
            connected: false,
            retryCount,
            latency: avgLatency,
            connectionHealth: "failed",
            error: lastError,
            attempts,
          };
        } else {
          retryCount++;
        }
      }

      // Exponential backoff: wait before retrying
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * 2 ** attempt + Math.random() * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Final fallback (should not reach here)
    return {
      connected: false,
      retryCount,
      latency: totalLatency / maxRetries,
      connectionHealth: "failed",
      error: lastError || "All connection attempts failed",
      attempts,
    };
  }

  private determineConnectionHealth(
    latency: number,
    retryCount: number
  ): "excellent" | "good" | "poor" | "failed" {
    if (retryCount > 0) {
      return retryCount === 1 ? "poor" : "failed";
    }

    if (latency < 500) {
      return "excellent";
    } else if (latency < 2000) {
      return "good";
    } else {
      return "poor";
    }
  }

  private async testCredentials(
    mexcService: any,
    credentials: CredentialInfo,
    context: ConnectivityTestContext
  ): Promise<CredentialTestResult> {
    const hasCredentials = credentials.source !== "none";

    if (!hasCredentials) {
      return {
        hasCredentials: false,
        isValid: false,
        message:
          "MEXC API reachable but no credentials configured. Please add API credentials in your user settings or set environment variables (MEXC_API_KEY, MEXC_SECRET_KEY).",
        status: "no_credentials",
      };
    }

    try {
      console.info("[MexcConnectivityService] Testing credentials", {
        requestId: context.requestId,
        source: credentials.source,
      });

      const accountResult = await mexcService.getAccountBalances();

      const result: CredentialTestResult = {
        hasCredentials: true,
        isValid: accountResult.success,
        message: accountResult.success
          ? `MEXC API connected with valid credentials from ${credentials.source === "database" ? "user settings" : "environment variables"}`
          : `Credentials invalid (source: ${credentials.source}): ${accountResult.error}`,
        status: accountResult.success ? "fully_connected" : "invalid_credentials",
        error: accountResult.success ? undefined : accountResult.error,
      };

      console.info("[MexcConnectivityService] Credential test completed", {
        requestId: context.requestId,
        isValid: result.isValid,
        status: result.status,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      console.error("[MexcConnectivityService] Credential test failed", {
        requestId: context.requestId,
        error: errorMessage,
      });

      return {
        hasCredentials: true,
        isValid: false,
        message: `Credential validation failed (source: ${credentials.source}): ${errorMessage}`,
        status: "invalid_credentials",
        error: errorMessage,
      };
    }
  }

  private determineOverallStatus(
    connectivityResult: DetailedConnectivityResult,
    credentialsResult: CredentialTestResult
  ): string {
    if (!connectivityResult.connected) {
      return "network_error";
    }

    if (!credentialsResult.hasCredentials) {
      return "no_credentials";
    }

    if (!credentialsResult.isValid) {
      return "invalid_credentials";
    }

    return "fully_connected";
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const mexcConnectivityService = new MexcConnectivityService();

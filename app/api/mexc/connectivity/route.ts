import { getRecommendedMexcService } from "../../../../src/services/mexc-unified-exports";
import { getUserCredentials } from "../../../../src/services/user-credentials-service";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { ErrorFactory } from "../../../../src/lib/error-types";
import { errorHandler } from "../../../../src/lib/error-handler-service";
import { createCredentialResponse, apiResponse, handleApiError } from "../../../../src/lib/api-response";

interface ConnectivityResponse {
  connected: boolean;
  hasCredentials: boolean;
  credentialsValid: boolean;
  credentialSource: "database" | "environment" | "none";
  hasUserCredentials: boolean;
  hasEnvironmentCredentials: boolean;
  message?: string;
  error?: string;
  timestamp: string;
  status: string;
  retryCount?: number;
  latency?: number;
  lastSuccessfulCheck?: string;
  connectionHealth: "excellent" | "good" | "poor" | "failed";
}

export async function GET() {
  const requestId = `conn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const startTime = Date.now();
  
  try {
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    const userId = user?.id;
    
    const credentials = await getUserCredentialsWithFallback(userId);
    const mexcService = getRecommendedMexcService(credentials.userCredentials || undefined);
    
    // Test basic connectivity with detailed metrics
    const connectivityResult = await testMexcConnectivityWithMetrics(mexcService);
    const latency = Date.now() - startTime;
    
    if (!connectivityResult.connected) {
      const credentialResult = {
        hasCredentials: false,
        credentialsValid: false,
        credentialSource: credentials.source,
        connected: false,
        error: connectivityResult.error || "MEXC API unreachable",
        details: {
          hasUserCredentials: credentials.hasUserCredentials,
          hasEnvironmentCredentials: credentials.hasEnvironmentCredentials,
          status: "network_error",
          retryCount: connectivityResult.retryCount,
          latency,
          connectionHealth: connectivityResult.connectionHealth,
        }
      };
      const response = createCredentialResponse(credentialResult);
      return apiResponse(response);
    }

    // Test credentials if available
    const credentialsResult = await testCredentials(mexcService, credentials);
    
    const credentialResult = {
      hasCredentials: credentialsResult.hasCredentials,
      credentialsValid: credentialsResult.isValid,
      credentialSource: credentials.source,
      connected: true,
      error: credentialsResult.error,
      details: {
        hasUserCredentials: credentials.hasUserCredentials,
        hasEnvironmentCredentials: credentials.hasEnvironmentCredentials,
        message: credentialsResult.message,
        status: credentialsResult.status,
        retryCount: connectivityResult.retryCount,
        latency,
        connectionHealth: connectivityResult.connectionHealth,
        lastSuccessfulCheck: new Date().toISOString(),
      }
    };
    const response = createCredentialResponse(credentialResult);
    return apiResponse(response);
    
  } catch (error) {
    console.error("[MEXC Connectivity] Error:", error);
    return handleApiError(error, "MEXC connectivity check failed");
  }
}

async function getUserCredentialsWithFallback(userId?: string) {
  let userCredentials = null;
  let hasUserCredentials = false;
  let credentialSource: "database" | "environment" | "none" = "none";
  
  if (userId) {
    try {
      console.log(`[DEBUG] Fetching credentials for user: ${userId}`);
      userCredentials = await getUserCredentials(userId, 'mexc');
      hasUserCredentials = !!userCredentials;
      
      if (hasUserCredentials) {
        credentialSource = "database";
        console.log(`[DEBUG] User credentials found`, {
          hasApiKey: !!userCredentials?.apiKey,
          hasSecretKey: !!userCredentials?.secretKey,
          apiKeyLength: userCredentials?.apiKey?.length || 0,
          secretKeyLength: userCredentials?.secretKey?.length || 0
        });
      }
    } catch (error) {
      // Handle encryption service errors specifically
      if (error instanceof Error && error.message.includes("Encryption service unavailable")) {
        throw ErrorFactory.encryption("Unable to access stored credentials due to server configuration issue");
      }
      
      console.warn("Failed to retrieve user credentials:", error);
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

interface ConnectivityTestResult {
  connected: boolean;
  retryCount: number;
  latency: number;
  connectionHealth: "excellent" | "good" | "poor" | "failed";
  error?: string;
}

async function testMexcConnectivityWithMetrics(mexcService: { testConnectivity: () => Promise<any> }): Promise<ConnectivityTestResult> {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second
  let totalLatency = 0;
  let retryCount = 0;
  let lastError: string | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const attemptStart = Date.now();
    
    try {
      const result = await mexcService.testConnectivity();
      const attemptLatency = Date.now() - attemptStart;
      totalLatency += attemptLatency;
      
      // Handle both boolean and MexcServiceResponse types
      let isConnected = false;
      if (typeof result === 'boolean') {
        isConnected = result;
      } else {
        isConnected = result?.success === true;
      }
      
      if (isConnected) {
        const avgLatency = totalLatency / (attempt + 1);
        const connectionHealth = determineConnectionHealth(avgLatency, retryCount);
        
        return {
          connected: true,
          retryCount,
          latency: avgLatency,
          connectionHealth,
        };
      }
      
      // If not connected and we have retries left, continue to retry logic
      if (attempt < maxRetries - 1) {
        retryCount++;
        lastError = result?.error || "Connection test failed";
      }
      
    } catch (error) {
      const attemptLatency = Date.now() - attemptStart;
      totalLatency += attemptLatency;
      
      console.error(`MEXC connectivity test failed (attempt ${attempt + 1}/${maxRetries}):`, error);
      
      // Don't retry on auth errors or client errors (except rate limiting)
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('401') || errorMsg.includes('403') || 
            errorMsg.includes('invalid') || errorMsg.includes('unauthorized')) {
          console.warn('Authentication error detected, skipping retries');
          return {
            connected: false,
            retryCount,
            latency: totalLatency / (attempt + 1),
            connectionHealth: "failed",
            error: error.message,
          };
        }
      }
      
      lastError = error instanceof Error ? error.message : "Unknown error";
      
      // If this is the last attempt, return failed result
      if (attempt === maxRetries - 1) {
        const avgLatency = totalLatency / maxRetries;
        return {
          connected: false,
          retryCount,
          latency: avgLatency,
          connectionHealth: "failed",
          error: lastError,
        };
      } else {
        retryCount++;
      }
    }
    
    // Exponential backoff: wait before retrying
    if (attempt < maxRetries - 1) {
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // Final fallback (should not reach here)
  return {
    connected: false,
    retryCount,
    latency: totalLatency / maxRetries,
    connectionHealth: "failed",
    error: lastError || "All connection attempts failed",
  };
}

function determineConnectionHealth(latency: number, retryCount: number): "excellent" | "good" | "poor" | "failed" {
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

async function testMexcConnectivity(mexcService: { testConnectivity: () => Promise<any> }): Promise<boolean> {
  const result = await testMexcConnectivityWithMetrics(mexcService);
  return result.connected;
}

async function testCredentials(
  mexcService: { getAccountBalances: () => Promise<{ success: boolean; error?: string }> }, 
  credentials: { source: string }
) {
  const hasCredentials = credentials.source !== "none";
  
  if (!hasCredentials) {
    return {
      hasCredentials: false,
      isValid: false,
      message: "MEXC API reachable but no credentials configured. Please add API credentials in your user settings or set environment variables (MEXC_API_KEY, MEXC_SECRET_KEY).",
      status: "no_credentials",
    };
  }

  try {
    const accountResult = await mexcService.getAccountBalances();
    
    return {
      hasCredentials: true,
      isValid: accountResult.success,
      message: accountResult.success
        ? `MEXC API connected with valid credentials from ${credentials.source === "database" ? "user settings" : "environment variables"}`
        : `Credentials invalid (source: ${credentials.source}): ${accountResult.error}`,
      status: accountResult.success ? "fully_connected" : "invalid_credentials",
      error: accountResult.success ? undefined : accountResult.error,
    };
  } catch (error) {
    return {
      hasCredentials: true,
      isValid: false,
      message: `Credential validation failed (source: ${credentials.source}): ${error instanceof Error ? error.message : "Unknown error"}`,
      status: "invalid_credentials",
      error: error instanceof Error ? error.message : "Credential validation failed",
    };
  }
}

// Removed - using standardized createCredentialResponse instead
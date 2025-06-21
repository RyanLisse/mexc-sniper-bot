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
}

export async function GET() {
  const requestId = `conn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  try {
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    const userId = user?.id;
    
    const credentials = await getUserCredentialsWithFallback(userId);
    const mexcService = getRecommendedMexcService(credentials.userCredentials || undefined);
    
    // Test basic connectivity first
    const isConnected = await testMexcConnectivity(mexcService);
    if (!isConnected) {
      const credentialResult = {
        hasCredentials: false,
        credentialsValid: false,
        credentialSource: credentials.source,
        connected: false,
        error: "MEXC API unreachable",
        details: {
          hasUserCredentials: credentials.hasUserCredentials,
          hasEnvironmentCredentials: credentials.hasEnvironmentCredentials,
          status: "network_error",
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

async function testMexcConnectivity(mexcService: { testConnectivity: () => Promise<any> }): Promise<boolean> {
  try {
    const result = await mexcService.testConnectivity();
    // Handle both boolean and MexcServiceResponse types
    if (typeof result === 'boolean') {
      return result;
    }
    // If it's a MexcServiceResponse, check the success property
    return result?.success === true;
  } catch (error) {
    console.error("MEXC connectivity test failed:", error);
    return false;
  }
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
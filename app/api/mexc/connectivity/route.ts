import { NextResponse } from "next/server";
import { getRecommendedMexcService } from "@/src/services/mexc-unified-exports";
import { getUserCredentials } from "@/src/services/user-credentials-service";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

export async function GET() {
  try {
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    const userId = user?.id;
    
    // Check for user-specific credentials first
    let userCredentials = null;
    let credentialSource = "none";
    let hasUserCredentials = false;
    let hasEnvironmentCredentials = false;
    
    if (userId) {
      try {
        userCredentials = await getUserCredentials(userId, 'mexc');
        hasUserCredentials = !!userCredentials;
      } catch (error) {
        console.error("Error retrieving user credentials:", error);
        // Check if it's an encryption service error
        if (error instanceof Error && error.message.includes("Encryption service unavailable")) {
          return NextResponse.json({
            connected: false,
            hasCredentials: false,
            credentialsValid: false,
            credentialSource: "none",
            hasUserCredentials: false,
            hasEnvironmentCredentials: false,
            error: "Encryption service unavailable - please contact support",
            message: "Unable to access stored credentials due to server configuration issue",
            timestamp: new Date().toISOString(),
            status: "encryption_error"
          }, { status: 500 });
        }
        console.log("No user credentials found, checking environment");
      }
    }
    
    // Check environment credentials
    hasEnvironmentCredentials = !!(process.env.MEXC_API_KEY && process.env.MEXC_SECRET_KEY);
    
    // Determine credential source
    if (hasUserCredentials) {
      credentialSource = "database";
    } else if (hasEnvironmentCredentials) {
      credentialSource = "environment";
    } else {
      credentialSource = "none";
    }
    
    // Initialize service with appropriate credentials
    let mexcService;
    if (userCredentials) {
      mexcService = getRecommendedMexcService({
        apiKey: userCredentials.apiKey,
        secretKey: userCredentials.secretKey
      });
    } else {
      mexcService = getRecommendedMexcService();
    }
    
    // First check basic connectivity (network)
    const basicConnectivity = await mexcService.testConnectivity();
    
    if (!basicConnectivity) {
      return NextResponse.json({
        connected: false,
        hasCredentials: false,
        credentialsValid: false,
        credentialSource,
        hasUserCredentials,
        hasEnvironmentCredentials,
        error: "MEXC API unreachable",
        timestamp: new Date().toISOString(),
        status: "network_error"
      });
    }

    // Check if credentials are configured
    const hasCredentials = mexcService.hasCredentials();
    
    if (!hasCredentials) {
      const noCredsMessage = credentialSource === "none" 
        ? "MEXC API reachable but no credentials configured. Please add API credentials in your user settings or set environment variables (MEXC_API_KEY, MEXC_SECRET_KEY)."
        : "MEXC API reachable but credentials not properly loaded";
        
      return NextResponse.json({
        connected: true, // Network is fine
        hasCredentials: false,
        credentialsValid: false,
        credentialSource,
        hasUserCredentials,
        hasEnvironmentCredentials,
        message: noCredsMessage,
        timestamp: new Date().toISOString(),
        status: "no_credentials"
      });
    }

    // Test actual credentials by trying to get account info
    try {
      const accountResult = await mexcService.getAccountBalances();
      
      const successMessage = accountResult.success
        ? `MEXC API connected with valid credentials from ${credentialSource === "database" ? "user settings" : "environment variables"}`
        : `Credentials invalid (source: ${credentialSource}): ${accountResult.error}`;
      
      return NextResponse.json({
        connected: true,
        hasCredentials: true,
        credentialsValid: accountResult.success,
        credentialSource,
        hasUserCredentials,
        hasEnvironmentCredentials,
        message: successMessage,
        timestamp: new Date().toISOString(),
        status: accountResult.success ? "fully_connected" : "invalid_credentials",
        error: accountResult.success ? undefined : accountResult.error
      });
    } catch (credentialError) {
      return NextResponse.json({
        connected: true,
        hasCredentials: true,
        credentialsValid: false,
        credentialSource,
        hasUserCredentials,
        hasEnvironmentCredentials,
        error: credentialError instanceof Error ? credentialError.message : "Credential validation failed",
        message: `Credential validation failed (source: ${credentialSource}): ${credentialError instanceof Error ? credentialError.message : "Unknown error"}`,
        timestamp: new Date().toISOString(),
        status: "invalid_credentials"
      });
    }
    
  } catch (error) {
    console.error("MEXC connectivity check failed:", error);
    
    return NextResponse.json(
      {
        connected: false,
        hasCredentials: false,
        credentialsValid: false,
        credentialSource: "none",
        hasUserCredentials: false,
        hasEnvironmentCredentials: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        status: "error"
      },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { getRecommendedMexcService } from "@/src/services/mexc-unified-exports";

export async function GET() {
  try {
    const mexcService = getRecommendedMexcService();
    
    // First check basic connectivity (network)
    const basicConnectivity = await mexcService.testConnectivity();
    
    if (!basicConnectivity) {
      return NextResponse.json({
        connected: false,
        hasCredentials: false,
        credentialsValid: false,
        error: "MEXC API unreachable",
        timestamp: new Date().toISOString(),
        status: "network_error"
      });
    }

    // Check if credentials are configured
    const hasCredentials = mexcService.hasCredentials();
    
    if (!hasCredentials) {
      return NextResponse.json({
        connected: true, // Network is fine
        hasCredentials: false,
        credentialsValid: false,
        message: "MEXC API reachable but no credentials configured",
        timestamp: new Date().toISOString(),
        status: "no_credentials"
      });
    }

    // Test actual credentials by trying to get account info
    try {
      const accountResult = await mexcService.getAccountBalances();
      
      return NextResponse.json({
        connected: true,
        hasCredentials: true,
        credentialsValid: accountResult.success,
        message: accountResult.success 
          ? "MEXC API connected with valid credentials" 
          : `Credentials invalid: ${accountResult.error}`,
        timestamp: new Date().toISOString(),
        status: accountResult.success ? "fully_connected" : "invalid_credentials",
        error: accountResult.success ? undefined : accountResult.error
      });
    } catch (credentialError) {
      return NextResponse.json({
        connected: true,
        hasCredentials: true,
        credentialsValid: false,
        error: credentialError instanceof Error ? credentialError.message : "Credential validation failed",
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
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        status: "error"
      },
      { status: 500 }
    );
  }
}
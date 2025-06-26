import { NextRequest, NextResponse } from "next/server";
import { getRecommendedMexcService } from "../../../../src/services/api/mexc-unified-exports";
import { getUserCredentials } from "../../../../src/services/user-credentials-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID required", serviceLayer: true },
        { status: 400 }
      );
    }

    // Get user-specific credentials first
    let userCredentials = null;
    try {
      userCredentials = await getUserCredentials(userId, 'mexc');
    } catch (error) {
      console.error(`Error retrieving credentials for user ${userId}:`, { error });
      // Check if it's an encryption service error
      if (error instanceof Error && error.message.includes("Encryption service unavailable")) {
        return NextResponse.json({
          success: false,
          error: "Encryption service unavailable - please contact support",
          balances: [],
          hasCredentials: false,
          hasUserCredentials: false,
          message: "Unable to access stored credentials due to server configuration issue",
          serviceLayer: true,
          timestamp: new Date().toISOString()
        }, { status: 500 });
      }
      // For other errors, userCredentials remains null and we'll fall back to environment
    }
    
    let mexcService;
    if (userCredentials) {
      // Create service with user's credentials
      mexcService = getRecommendedMexcService({
        apiKey: userCredentials.apiKey,
        secretKey: userCredentials.secretKey
      });
    } else {
      // Fallback to environment credentials if no user credentials
      mexcService = getRecommendedMexcService();
    }

    // Check if service has credentials by testing if we have user credentials or environment credentials
    const hasEnvironmentCredentials = !!(process.env.MEXC_API_KEY && process.env.MEXC_SECRET_KEY);
    const hasAnyCredentials = !!userCredentials || hasEnvironmentCredentials;
    
    if (!hasAnyCredentials) {
      const message = "No MEXC API credentials found. Please configure your API keys in the settings.";
      
      return NextResponse.json({
        success: false,
        error: "MEXC API credentials not configured",
        balances: [],
        hasCredentials: false,
        hasUserCredentials: !!userCredentials,
        message,
        serviceLayer: true,
        timestamp: new Date().toISOString()
      }, { status: 400 }); // Bad Request - client configuration issue
    }

    // Get account balances via service layer
    const balancesResponse = await mexcService.getAccountBalances();

    if (!balancesResponse.success) {
      console.error(`❌ MEXC Account Service Error:`, { error: balancesResponse.error });
      
      // Determine appropriate status code based on error type
      let statusCode = 502; // Default: Bad Gateway (upstream service issue)
      if (balancesResponse.error?.includes("API key") || balancesResponse.error?.includes("signature")) {
        statusCode = 401; // Unauthorized - invalid credentials
      } else if (balancesResponse.error?.includes("IP") || balancesResponse.error?.includes("allowlist")) {
        statusCode = 403; // Forbidden - IP not allowlisted
      } else if (balancesResponse.error?.includes("timeout") || balancesResponse.error?.includes("connect")) {
        statusCode = 504; // Gateway Timeout - connection issues
      }
      
      return NextResponse.json({
        success: false,
        hasCredentials: true,
        balances: [],
        error: balancesResponse.error,
        message: "API credentials configured but account access failed",
        serviceLayer: true,
        executionTimeMs: (balancesResponse as any).executionTimeMs || 0,
        timestamp: balancesResponse.timestamp
      }, { status: statusCode });
    }

    if (!balancesResponse.data) {
      return NextResponse.json({
        success: false,
        error: "No account data received from MEXC API",
        code: "NO_DATA",
        serviceLayer: true,
        timestamp: new Date().toISOString()
      }, { status: 502 }); // Bad Gateway - upstream service issue
    }
    
    const { balances, totalUsdtValue } = balancesResponse.data;
    const lastUpdated = (balancesResponse.data as any).lastUpdated || new Date().toISOString();
    console.info(`✅ MEXC Account Service Success - Found ${balances.length} balances with total value: ${totalUsdtValue.toFixed(2)} USDT`);

    const message = userCredentials
      ? `Using user API credentials - ${balances.length} assets with balance`
      : `Using environment credentials - ${balances.length} assets with balance`;

    return NextResponse.json({
      success: true,
      hasCredentials: true,
      hasUserCredentials: !!userCredentials,
      balances,
      totalUsdtValue,
      lastUpdated,
      message,
      serviceLayer: true,
      cached: (balancesResponse as any).cached || false,
      executionTimeMs: (balancesResponse as any).executionTimeMs || 0,
      timestamp: balancesResponse.timestamp
    });

  } catch (error) {
    console.error("MEXC account fetch failed:", { error: error });
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        balances: [],
        hasCredentials: false,
        serviceLayer: true,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
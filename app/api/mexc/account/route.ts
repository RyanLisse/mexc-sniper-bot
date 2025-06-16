import { NextRequest, NextResponse } from "next/server";
import { getRecommendedMexcService } from "@/src/services/mexc-unified-exports";
import { getUserCredentials } from "@/src/services/user-credentials-service";

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
    const userCredentials = await getUserCredentials(userId, 'mexc');
    
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

    // Check if service has credentials
    if (!mexcService.hasCredentials()) {
      const message = userCredentials 
        ? "User MEXC API credentials are invalid or incomplete"
        : "No MEXC API credentials found. Please configure your API keys in the settings.";
      
      return NextResponse.json({
        success: false,
        error: "MEXC API credentials not configured",
        balances: [],
        hasCredentials: false,
        hasUserCredentials: !!userCredentials,
        message,
        serviceLayer: true,
        timestamp: new Date().toISOString()
      });
    }

    // Get account balances via service layer
    const balancesResponse = await mexcService.getAccountBalances();

    if (!balancesResponse.success) {
      console.error(`❌ MEXC Account Service Error:`, balancesResponse.error);
      
      return NextResponse.json({
        success: false,
        hasCredentials: true,
        balances: [],
        error: balancesResponse.error,
        message: "API credentials configured but account access failed",
        serviceLayer: true,
        executionTimeMs: balancesResponse.executionTimeMs,
        timestamp: balancesResponse.timestamp
      });
    }

    const { balances, totalUsdtValue, lastUpdated } = balancesResponse.data;
    console.log(`✅ MEXC Account Service Success - Found ${balances.length} balances with total value: ${totalUsdtValue.toFixed(2)} USDT`);

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
      cached: balancesResponse.cached,
      executionTimeMs: balancesResponse.executionTimeMs,
      timestamp: balancesResponse.timestamp
    });

  } catch (error) {
    console.error("MEXC account fetch failed:", error);
    
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
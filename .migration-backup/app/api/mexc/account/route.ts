import { NextRequest, NextResponse } from "next/server";
import { getMexcService } from "@/src/services/mexc-service-layer";

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

    const mexcService = getMexcService();

    // Check if service has credentials
    if (!mexcService.hasCredentials()) {
      return NextResponse.json({
        success: false,
        error: "MEXC API credentials not configured",
        balances: [],
        hasCredentials: false,
        message: "Configure MEXC API keys in environment variables to view account balance",
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

    return NextResponse.json({
      success: true,
      hasCredentials: true,
      balances,
      totalUsdtValue,
      lastUpdated,
      message: `Real MEXC account data - ${balances.length} assets with balance`,
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
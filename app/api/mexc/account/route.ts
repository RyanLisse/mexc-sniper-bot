import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID required" },
        { status: 400 }
      );
    }

    // Check for MEXC API credentials
    const apiKey = process.env.MEXC_API_KEY;
    const secretKey = process.env.MEXC_SECRET_KEY;

    if (!apiKey || !secretKey) {
      return NextResponse.json({
        success: false,
        error: "MEXC API credentials not configured",
        balances: [],
        hasCredentials: false,
        message: "Configure MEXC API keys in environment variables to view account balance"
      });
    }

    // Implement real MEXC account balance API call
    try {
      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}`;
      
      // Create signature for MEXC API
      const signature = createHmac('sha256', secretKey)
        .update(queryString)
        .digest('hex');

      const url = `https://api.mexc.com/api/v3/account?${queryString}&signature=${signature}`;
      
      console.log(`🔐 MEXC Account API Request: ${timestamp}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-MEXC-APIKEY': apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ MEXC Account API Error: ${response.status} - ${errorText}`);
        
        return NextResponse.json({
          success: false,
          hasCredentials: true,
          balances: [],
          error: `MEXC API Error: ${response.status} - ${errorText}`,
          message: "API credentials configured but account access failed",
          timestamp: new Date().toISOString()
        });
      }

      const accountData = await response.json();
      console.log(`✅ MEXC Account API Success - Found ${accountData.balances?.length || 0} balances`);

      // Filter balances with actual amounts (free + locked > 0)
      const nonZeroBalances = accountData.balances?.filter((balance: any) => 
        parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0
      ) || [];

      return NextResponse.json({
        success: true,
        hasCredentials: true,
        balances: nonZeroBalances,
        totalBalances: accountData.balances?.length || 0,
        message: `Real MEXC account data - ${nonZeroBalances.length} assets with balance`,
        timestamp: new Date().toISOString()
      });

    } catch (apiError) {
      console.error("MEXC API call failed:", apiError);
      
      return NextResponse.json({
        success: false,
        hasCredentials: true,
        balances: [],
        error: apiError instanceof Error ? apiError.message : "Unknown API error",
        message: "MEXC API credentials configured but request failed",
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error("MEXC account fetch failed:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        balances: [],
        hasCredentials: false,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
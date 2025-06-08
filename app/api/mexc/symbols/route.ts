import { NextRequest, NextResponse } from "next/server";
import { mexcApi } from "@/src/services/enhanced-mexc-api";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vcoinId = searchParams.get('vcoinId');
    
    const symbolsResponse = vcoinId
      ? await mexcApi.getSymbolsForVcoins([vcoinId])
      : await mexcApi.getSymbolsV2();
    
    return NextResponse.json({
      success: true,
      data: symbolsResponse.data.symbols,
      timestamp: new Date().toISOString(),
      count: symbolsResponse.data.symbols.length,
      vcoinId: vcoinId || null
    });
  } catch (error) {
    console.error("MEXC symbols fetch failed:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        data: [],
        timestamp: new Date().toISOString(),
        count: 0
      },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { getUnifiedMexcClient } from "../../../../src/services/mexc-unified-exports";

export async function GET() {
  try {
    const mexcClient = getUnifiedMexcClient();
    const serverTime = await mexcClient.getServerTime();
    
    return NextResponse.json({
      success: true,
      serverTime,
      timestamp: new Date().toISOString(),
      localTime: Date.now()
    });
  } catch (error) {
    console.error("MEXC server time fetch failed:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        serverTime: null,
        timestamp: new Date().toISOString(),
        localTime: Date.now()
      },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { mexcApi } from "@/src/services/enhanced-mexc-api";

export async function GET() {
  try {
    const serverTime = await mexcApi.getServerTime();
    
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
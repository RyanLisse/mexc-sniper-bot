import { NextResponse } from "next/server";
import { mexcApi } from "@/src/services/enhanced-mexc-api";

export async function GET() {
  try {
    const isConnected = await mexcApi.checkConnectivity();
    
    return NextResponse.json({
      connected: isConnected,
      timestamp: new Date().toISOString(),
      status: isConnected ? "connected" : "disconnected"
    });
  } catch (error) {
    console.error("MEXC connectivity check failed:", error);
    
    return NextResponse.json(
      {
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        status: "error"
      },
      { status: 500 }
    );
  }
}
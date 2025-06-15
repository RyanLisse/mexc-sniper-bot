import { NextResponse } from "next/server";
import { getUnifiedMexcClient } from "@/src/services/mexc-unified-exports";

export async function GET() {
  try {
    const mexcClient = getUnifiedMexcClient();
    const isConnected = await mexcClient.testConnectivity();
    
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
import { NextResponse } from "next/server";
import { createSafeLogger } from '../../../../src/lib/structured-logger';
import { getUnifiedMexcClient } from "../../../../src/services/mexc-unified-exports";

const logger = createSafeLogger('route');

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
    logger.error("MEXC server time fetch failed:", { error: error });
    
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
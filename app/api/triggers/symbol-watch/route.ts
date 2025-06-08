import { NextRequest, NextResponse } from "next/server";
import { inngest } from "../../../../src/inngest/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      symbol, 
      vcoinId, 
      symbolName,
      projectName,
      launchTime,
      watchDuration = 3600 
    } = body; // Default 1 hour watch

    // Support both symbol and vcoinId for backward compatibility
    const targetVcoinId = vcoinId || symbol;
    
    if (!targetVcoinId) {
      return NextResponse.json(
        {
          success: false,
          error: "Symbol or vcoinId is required",
        },
        { status: 400 }
      );
    }

    // Trigger the symbol watching workflow with proper data structure
    const event = await inngest.send({
      name: "mexc/symbol.watch",
      data: {
        vcoinId: targetVcoinId,
        symbolName: symbolName || symbol,
        projectName,
        launchTime,
        attempt: 1,
        watchDuration,
        triggeredBy: "ui",
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Symbol analysis workflow triggered for ${symbolName || targetVcoinId}`,
      eventId: event.ids[0],
      vcoinId: targetVcoinId,
      symbolName: symbolName || symbol,
      watchDuration,
    });
  } catch (error) {
    console.error("Failed to trigger symbol watch:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to trigger symbol watching workflow",
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { inngest } from "../../../../src/inngest/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      symbol, 
      analysisData,
      riskParameters = {
        maxPositionSize: 1000,
        stopLossPercentage: 5,
        takeProfitPercentage: 15
      }
    } = body;

    if (!symbol) {
      return NextResponse.json(
        {
          success: false,
          error: "Symbol is required",
        },
        { status: 400 }
      );
    }

    // Trigger the trading strategy creation workflow
    const event = await inngest.send({
      name: "mexc/strategy.create",
      data: {
        symbol,
        analysisData,
        riskParameters,
        triggeredBy: "ui",
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Trading strategy workflow triggered for ${symbol}`,
      eventId: event.ids[0],
      symbol,
      riskParameters,
    });
  } catch (error) {
    console.error("Failed to trigger trading strategy:", { error: error });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to trigger trading strategy workflow",
      },
      { status: 500 }
    );
  }
}
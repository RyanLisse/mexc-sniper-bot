import { NextRequest, NextResponse } from "next/server";
import { inngest } from "../../../../src/inngest/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbols = [] } = body;

    // Trigger the pattern analysis workflow
    const event = await inngest.send({
      name: "mexc/patterns.analyze",
      data: {
        symbols,
        triggeredBy: "ui",
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Pattern analysis workflow triggered",
      eventId: event.ids[0],
      symbols,
    });
  } catch (error) {
    console.error("Failed to trigger pattern analysis:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to trigger pattern analysis workflow",
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/src/inngest/client";

export async function POST(request: NextRequest) {
  try {
    // Trigger the calendar polling workflow
    const event = await inngest.send({
      name: "mexc/calendar.poll",
      data: {
        triggeredBy: "ui",
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Calendar polling workflow triggered",
      eventId: event.ids[0],
    });
  } catch (error) {
    console.error("Failed to trigger calendar poll:", { error: error });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to trigger calendar polling workflow",
      },
      { status: 500 }
    );
  }
}
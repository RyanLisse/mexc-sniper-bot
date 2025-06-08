import { NextResponse } from "next/server";
import { mexcApi } from "@/src/services/enhanced-mexc-api";

export async function GET() {
  try {
    const calendar = await mexcApi.getCalendar();
    
    return NextResponse.json({
      success: true,
      data: calendar.data,
      timestamp: new Date().toISOString(),
      count: calendar.data.length
    });
  } catch (error) {
    console.error("MEXC calendar fetch failed:", error);
    
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
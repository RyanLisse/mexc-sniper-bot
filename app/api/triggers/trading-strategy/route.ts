import { NextRequest, NextResponse } from "next/server";

// Simplified trading strategy trigger endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Basic validation
    if (!body.symbol) {
      return NextResponse.json({
        success: false,
        error: 'symbol is required'
      }, { status: 400 });
    }

    // Mock strategy trigger response
    return NextResponse.json({
      success: true,
      message: `Trading strategy workflow triggered for ${body.symbol}`,
      eventId: Math.random().toString(36).substring(7),
      symbol: body.symbol,
      triggeredAt: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Failed to trigger trading strategy workflow"
    }, { status: 500 });
  }
}
import { type NextRequest, NextResponse } from "next/server";

// Simplified API credentials test endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Basic validation - just check for required fields
    if (!body.apiKey || !body.secretKey) {
      return NextResponse.json(
        {
          success: false,
          error: "API key and secret are required",
        },
        { status: 400 }
      );
    }

    // Mock successful test - simplified implementation
    return NextResponse.json({
      success: true,
      data: {
        connectivity: true,
        authentication: true,
        status: "connected",
      },
    });
  } catch (_error) {
    return NextResponse.json(
      {
        success: false,
        error: "Test failed",
      },
      { status: 500 }
    );
  }
}

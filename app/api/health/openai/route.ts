import { NextResponse } from "next/server";
export async function GET() {
  try {
    // Check if OpenAI API key is configured
    const hasApiKey = !!process.env.OPENAI_API_KEY;

    if (!hasApiKey) {
      return NextResponse.json(
        {
          status: "unhealthy",
          error: "OpenAI API key not configured",
          configured: false,
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // Simple API key validation (check format)
    const apiKey = process.env.OPENAI_API_KEY;
    const isValidFormat = apiKey?.startsWith("sk-") && apiKey.length > 20;

    if (!isValidFormat) {
      return NextResponse.json(
        {
          status: "unhealthy",
          error: "OpenAI API key format is invalid",
          configured: true,
          validFormat: false,
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // For security, we won't test the actual API key from this endpoint
    // But we can confirm it's configured and has the right format
    return NextResponse.json({
      status: "healthy",
      message: "OpenAI API key is configured and formatted correctly",
      configured: true,
      validFormat: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[OpenAI Health Check] Error:", { error: error });
    const errorObj = error as Error | { message?: string };
    return NextResponse.json(
      {
        status: "error",
        error: errorObj?.message || "Unknown error",
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
      }
    );
  }
}

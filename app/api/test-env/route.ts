/**
 * Test Environment Variables API
 * 
 * Simple endpoint to verify environment variables are accessible and formatted correctly
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const mexcApiKey = process.env.MEXC_API_KEY;
    const mexcSecretKey = process.env.MEXC_SECRET_KEY;
    
    console.info("[TestEnv] Environment variable check", {
      hasApiKey: !!mexcApiKey,
      hasSecretKey: !!mexcSecretKey,
      apiKeyLength: mexcApiKey?.length || 0,
      secretKeyLength: mexcSecretKey?.length || 0,
      apiKeyPrefix: mexcApiKey?.substring(0, 8) || 'none',
      secretKeyPrefix: mexcSecretKey?.substring(0, 8) || 'none',
      apiKeyHasSpaces: mexcApiKey?.includes(' ') || false,
      secretKeyHasSpaces: mexcSecretKey?.includes(' ') || false,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      data: {
        hasApiKey: !!mexcApiKey,
        hasSecretKey: !!mexcSecretKey,
        apiKeyLength: mexcApiKey?.length || 0,
        secretKeyLength: mexcSecretKey?.length || 0,
        apiKeyPrefix: mexcApiKey?.substring(0, 8) || 'none',
        secretKeyPrefix: mexcSecretKey?.substring(0, 8) || 'none',
        apiKeyHasSpaces: mexcApiKey?.includes(' ') || false,
        secretKeyHasSpaces: mexcSecretKey?.includes(' ') || false,
      }
    });

  } catch (error) {
    console.error("[TestEnv] Error checking environment", error);
    
    return NextResponse.json({
      success: false,
      error: "Failed to check environment variables",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
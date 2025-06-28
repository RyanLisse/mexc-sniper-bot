/**
 * Account Balance API Endpoint
 * 
 * Provides real-time account balance data with USDT conversion.
 * Supports both user-specific credentials and environment fallback.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { trace } from "@opentelemetry/api";
import { getUnifiedMexcService } from "@/src/services/api/unified-mexc-service-factory";

// Request validation schema - userId is optional for environment fallback
const BalanceRequestSchema = z.object({
  userId: z.string().min(1, "User ID is required").optional(),
});

// Fallback balance data for error scenarios
const createFallbackData = (hasUserCredentials: boolean, credentialsType: string) => ({
  balances: [],
  totalUsdtValue: 0,
  lastUpdated: new Date().toISOString(),
  hasUserCredentials,
  credentialsType,
});

export async function GET(request: NextRequest) {
  try {
    // Extract userId from query parameters (optional)
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    
    // Validate userId format if provided
    if (userId && userId.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: "Invalid userId: cannot be empty",
        meta: {
          code: "INVALID_USER_ID",
          details: "userId must be a non-empty string if provided",
        },
      }, { status: 400 });
    }

    // Determine if we have user credentials or should use environment fallback
    const hasUserCredentials = !!userId;
    const credentialsType = hasUserCredentials ? "user-specific" : "environment-fallback";

    console.info("[BalanceAPI] Starting balance request", {
      userId: userId || "environment-fallback",
      hasApiKey: !!process.env.MEXC_API_KEY,
      hasSecretKey: !!process.env.MEXC_SECRET_KEY,
      nodeEnv: process.env.NODE_ENV,
      credentialsType,
    });

    // In test environment, provide fast fallback for invalid credentials
    if (process.env.NODE_ENV === "test" && 
        (process.env.MEXC_API_KEY === "test-api-key" || 
         process.env.MEXC_SECRET_KEY === "test-secret-key")) {
      const fallbackData = createFallbackData(hasUserCredentials, credentialsType);
      return NextResponse.json({
        success: false,
        error: "Test environment: Invalid API credentials",
        meta: {
          fallbackData,
          code: "TEST_INVALID_CREDENTIALS",
          details: "Using test credentials in test environment",
        },
      }, { status: 401 });
    }

    // Check if credentials are available before proceeding
    if (!process.env.MEXC_API_KEY || !process.env.MEXC_SECRET_KEY) {
      console.error("[BalanceAPI] Missing MEXC credentials in environment");
      const fallbackData = createFallbackData(hasUserCredentials, credentialsType);
      
      return NextResponse.json({
        success: false,
        error: "MEXC API credentials not configured on server",
        meta: {
          fallbackData,
          code: "MISSING_CREDENTIALS",
          details: "Contact administrator to configure MEXC_API_KEY and MEXC_SECRET_KEY",
        },
      }, { status: 503 });
    }

    // Get MEXC account balances using appropriate credentials
    const mexcClient = await getUnifiedMexcService(userId ? { userId } : {});
    console.info("[BalanceAPI] MEXC client created, calling getAccountBalances");
    
    // Add timeout to prevent hanging requests
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Request timeout: MEXC API call took too long")), 15000);
    });
    
    const balanceResponse = await Promise.race([
      mexcClient.getAccountBalances(),
      timeoutPromise
    ]) as Awaited<ReturnType<typeof mexcClient.getAccountBalances>>;

    if (!balanceResponse.success) {
      console.error("[BalanceAPI] Failed to fetch real balance data", {
        error: balanceResponse.error,
        userId: userId || "environment-fallback",
        responseData: balanceResponse.data,
        timestamp: balanceResponse.timestamp,
      });

      const fallbackData = createFallbackData(hasUserCredentials, credentialsType);
      const errorMessage = balanceResponse.error || "Failed to fetch account balance data";
      
      // Determine appropriate status code based on error type
      let statusCode = 500;
      let errorCode = "MEXC_API_ERROR";
      
      if (errorMessage.toLowerCase().includes("unauthorized") || 
          errorMessage.toLowerCase().includes("invalid signature") ||
          errorMessage.toLowerCase().includes("api key") ||
          errorMessage.toLowerCase().includes("authentication")) {
        statusCode = 401;
        errorCode = "MEXC_AUTH_ERROR";
      } else if (errorMessage.toLowerCase().includes("rate limit") ||
                 errorMessage.toLowerCase().includes("too many requests")) {
        statusCode = 429;
        errorCode = "MEXC_RATE_LIMIT";
      } else if (errorMessage.toLowerCase().includes("service unavailable") ||
                 errorMessage.toLowerCase().includes("maintenance")) {
        statusCode = 503;
        errorCode = "MEXC_SERVICE_UNAVAILABLE";
      }

      return NextResponse.json({
        success: false,
        error: errorMessage,
        meta: {
          fallbackData,
          code: errorCode,
          details: "Check server logs for more information",
        },
      }, { status: statusCode });
    }

    const balanceData = balanceResponse.data;

    console.info("[BalanceAPI] Real balance data returned successfully", {
      userId: userId || "environment-fallback",
      balancesCount: balanceData.balances.length,
      totalUsdValue: balanceData.totalUsdtValue,
      timestamp: balanceData.lastUpdated,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...balanceData,
        hasUserCredentials,
        credentialsType,
      },
    });

  } catch (error) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const hasUserCredentials = !!userId;
    const credentialsType = hasUserCredentials ? "user-specific" : "environment-fallback";
    
    console.error("[BalanceAPI] Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error,
      name: error instanceof Error ? error.name : "unknown",
      hasApiKey: !!process.env.MEXC_API_KEY,
      hasSecretKey: !!process.env.MEXC_SECRET_KEY,
    });

    const fallbackData = createFallbackData(hasUserCredentials, credentialsType);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Handle specific error types
    let statusCode = 500;
    let errorCode = "INTERNAL_SERVER_ERROR";
    
    if (errorMessage.includes("Request timeout")) {
      statusCode = 504;
      errorCode = "REQUEST_TIMEOUT";
    } else if (errorMessage.includes("Network") || errorMessage.includes("ENOTFOUND")) {
      statusCode = 503;
      errorCode = "NETWORK_ERROR";
    }

    return NextResponse.json({
      success: false,
      error: errorMessage.includes("Request timeout") 
        ? "Request timeout - MEXC API is taking too long to respond" 
        : "Internal server error - please check MEXC API credentials",
      meta: {
        fallbackData,
        code: errorCode,
        details: errorMessage,
      },
    }, { status: statusCode });
  }
}
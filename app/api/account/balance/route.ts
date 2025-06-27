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
      }, { status: 500 });
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
    const balanceResponse = await mexcClient.getAccountBalances();

    if (!balanceResponse.success) {
      console.error("[BalanceAPI] Failed to fetch real balance data", {
        error: balanceResponse.error,
        userId: userId || "environment-fallback",
        responseData: balanceResponse.data,
        timestamp: balanceResponse.timestamp,
      });

      const fallbackData = createFallbackData(hasUserCredentials, credentialsType);

      return NextResponse.json({
        success: false,
        error: balanceResponse.error || "Failed to fetch account balance data",
        meta: {
          fallbackData,
          code: "MEXC_API_ERROR",
          details: "Check server logs for more information",
        },
      }, { status: 500 });
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

    return NextResponse.json({
      success: false,
      error: "Internal server error - please check MEXC API credentials",
      meta: {
        fallbackData,
        code: "INTERNAL_SERVER_ERROR",
        details: error instanceof Error ? error.message : String(error),
      },
    }, { status: 500 });
  }
}
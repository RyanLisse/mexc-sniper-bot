/**
 * Account Balance API Endpoint
 * 
 * Provides real-time account balance data with USDT conversion.
 * Uses MEXC API credentials from environment variables.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { trace } from "@opentelemetry/api";
import { getMexcService } from "../../../../src/services/api/mexc-unified-exports";

// Request validation schema
const BalanceRequestSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

export async function GET(request: NextRequest) {
  try {
    // Extract and validate userId from query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    const validationResult = BalanceRequestSchema.safeParse({ userId });
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: `Invalid request parameters: ${validationResult.error.issues.map(i => i.message).join(", ")}`,
      }, { status: 400 });
    }

    const { userId: validUserId } = validationResult.data;

    // Get real MEXC account balances using credentials from environment
    const mexcClient = getMexcService();
    const balanceResponse = await mexcClient.getAccountBalances();

    if (!balanceResponse.success) {
      console.error("[BalanceAPI] Failed to fetch real balance data", {
        error: balanceResponse.error,
        userId: validUserId,
      });

      return NextResponse.json({
        success: false,
        error: balanceResponse.error || "Failed to fetch account balance data",
      }, { status: 500 });
    }

    const balanceData = balanceResponse.data;

    console.info("[BalanceAPI] Real balance data returned successfully", {
      userId: validUserId,
      balancesCount: balanceData.balances.length,
      totalUsdValue: balanceData.totalUsdtValue,
      timestamp: balanceData.lastUpdated,
    });

    return NextResponse.json({
      success: true,
      data: balanceData,
    });

  } catch (error) {
    console.error("[BalanceAPI] Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({
      success: false,
      error: "Internal server error - please check MEXC API credentials",
    }, { status: 500 });
  }
}
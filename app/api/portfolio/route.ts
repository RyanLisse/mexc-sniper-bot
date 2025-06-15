import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { snipeTargets, executionHistory } from "@/src/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { 
  createSuccessResponse, 
  createErrorResponse, 
  apiResponse, 
  HTTP_STATUS,
  createValidationErrorResponse
} from "@/src/lib/api-response";
import { handleApiError } from "@/src/lib/error-handler";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return apiResponse(
        createValidationErrorResponse('userId', 'Missing required parameter'),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Get active positions (targets that have been successfully executed)
    const activePositions = await db.select()
    .from(snipeTargets)
    .where(
      and(
        eq(snipeTargets.userId, userId),
        eq(snipeTargets.status, "ready") // Active positions ready for exit monitoring
      )
    )
    .orderBy(desc(snipeTargets.actualExecutionTime));

    // Get recent execution history
    const recentExecutions = await db.select()
      .from(executionHistory)
      .where(eq(executionHistory.userId, userId))
      .orderBy(desc(executionHistory.executedAt))
      .limit(20);

    // Calculate portfolio metrics
    const completedPositions = await db.select()
      .from(snipeTargets)
      .where(
        and(
          eq(snipeTargets.userId, userId),
          eq(snipeTargets.status, "completed")
        )
      );

    // Calculate basic metrics
    let totalProfit = 0;
    let totalTrades = completedPositions.length;
    let successfulTrades = 0;

    // Get current prices for active positions (simplified calculation)
    const positionsWithPnL = await Promise.all(
      activePositions.map(async (position) => {
        try {
          // Get current price from MEXC API
          const response = await fetch(
            `https://api.mexc.com/api/v3/ticker/price?symbol=${position.symbolName}`
          );
          
          let currentPrice = position.executionPrice || 0;
          let unrealizedPnL = 0;
          let unrealizedPnLPercent = 0;

          if (response.ok) {
            const data = await response.json();
            currentPrice = parseFloat(data.price);
            
            if (position.executionPrice && position.actualPositionSize) {
              const entryValue = position.executionPrice * position.actualPositionSize;
              const currentValue = currentPrice * position.actualPositionSize;
              unrealizedPnL = currentValue - entryValue;
              unrealizedPnLPercent = (unrealizedPnL / entryValue) * 100;
            }
          }

          return {
            ...position,
            currentPrice,
            unrealizedPnL,
            unrealizedPnLPercent,
          };
        } catch (error) {
          console.warn(`Could not get price for ${position.symbolName}:`, error);
          return {
            ...position,
            currentPrice: position.executionPrice || 0,
            unrealizedPnL: 0,
            unrealizedPnLPercent: 0,
          };
        }
      })
    );

    // Calculate total unrealized P&L
    const totalUnrealizedPnL = positionsWithPnL.reduce(
      (sum, position) => sum + (position.unrealizedPnL || 0),
      0
    );

    // Calculate success rate from execution history
    const buyExecutions = recentExecutions.filter(
      (exec) => exec.action === "buy" && exec.status === "success"
    );
    const sellExecutions = recentExecutions.filter(
      (exec) => exec.action === "sell" && exec.status === "success"
    );

    const portfolio = {
      activePositions: positionsWithPnL,
      metrics: {
        totalActivePositions: activePositions.length,
        totalUnrealizedPnL,
        totalCompletedTrades: totalTrades,
        successfulTrades: buyExecutions.length,
        successRate: buyExecutions.length > 0 ? (buyExecutions.length / (buyExecutions.length + (recentExecutions.length - buyExecutions.length - sellExecutions.length))) * 100 : 0,
        totalCapitalDeployed: activePositions.reduce(
          (sum, pos) => sum + (pos.positionSizeUsdt || 0),
          0
        ),
      },
      recentActivity: recentExecutions.map((exec) => ({
        id: exec.id,
        symbol: exec.symbolName,
        action: exec.action,
        status: exec.status,
        quantity: exec.executedQuantity,
        price: exec.executedPrice,
        totalCost: exec.totalCost,
        timestamp: exec.executedAt,
        orderId: exec.exchangeOrderId,
      })),
    };

    return apiResponse(
      createSuccessResponse(portfolio, {
        message: "Portfolio data retrieved successfully",
        totalPositions: activePositions.length,
      })
    );
  } catch (error) {
    console.error("❌ Error fetching portfolio:", error);
    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : "Unknown error occurred"
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
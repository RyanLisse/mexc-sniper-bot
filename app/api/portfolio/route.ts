import { NextRequest, NextResponse } from "next/server";
import { createSafeLogger } from '../../../src/lib/structured-logger';
import { db } from "../../../src/db";
import { snipeTargets, executionHistory } from "../../../src/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { 
  createSuccessResponse, 
  createErrorResponse, 
  apiResponse, 
  HTTP_STATUS,
  createValidationErrorResponse
} from "../../../src/lib/api-response";
import { handleApiError } from "../../../src/lib/error-handler";
import {
  PortfolioQuerySchema,
  PortfolioResponseSchema,
  validateApiQuery,
  createValidatedApiResponse,
} from "../../../src/schemas/api-validation-schemas";

const logger = createSafeLogger('route');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Validate query parameters
    const queryValidation = validateApiQuery(PortfolioQuerySchema, searchParams);
    if (!queryValidation.success) {
      return apiResponse(
        createErrorResponse(queryValidation.error),
        HTTP_STATUS.BAD_REQUEST
      );
    }
    
    const { userId } = queryValidation.data;

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
      activePositions.map(async (position: any) => {
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
          logger.warn(`Could not get price for ${position.symbolName}:`, { error: error instanceof Error ? error.message : String(error) });
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
      (exec: any) => exec.action === "buy" && exec.status === "success"
    );
    const sellExecutions = recentExecutions.filter(
      (exec: any) => exec.action === "sell" && exec.status === "success"
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
          (sum: any, pos: any) => sum + (pos.positionSizeUsdt || 0),
          0
        ),
      },
      recentActivity: recentExecutions.map((exec: any) => ({
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

    return NextResponse.json(
      createValidatedApiResponse(
        portfolio,
        PortfolioResponseSchema,
        "Portfolio data retrieved successfully"
      )
    );
  } catch (error) {
    logger.error("❌ Error fetching portfolio:", { error: error });
    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : "Unknown error occurred"
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
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
import {
  PortfolioQuerySchema,
  PortfolioResponseSchema,
  validateApiQuery,
  createValidatedApiResponse,
} from "@/src/schemas/api-validation-schemas";

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

    // Get active positions with database error handling
    let activePositions: any[] = [];
    try {
      activePositions = await Promise.race([
        db.select()
          .from(snipeTargets)
          .where(
            and(
              eq(snipeTargets.userId, userId),
              eq(snipeTargets.status, "ready") // Active positions ready for exit monitoring
            )
          )
          .orderBy(desc(snipeTargets.actualExecutionTime)),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Active positions query timeout')), 8000)
        )
      ]);
    } catch (dbError) {
      console.error('Database error fetching active positions:', { userId, error: dbError });
      // Continue with empty array instead of crashing
      const isDbConnectivityError = dbError instanceof Error && (
        dbError.message.includes('ECONNREFUSED') ||
        dbError.message.includes('timeout') ||
        dbError.message.includes('connection') ||
        dbError.message.includes('ENOTFOUND')
      );
      
      if (isDbConnectivityError) {
        return apiResponse(
          createErrorResponse(
            'Database connectivity issue - portfolio temporarily unavailable',
            { code: 'DB_CONNECTION_ERROR', retryable: true }
          ),
          HTTP_STATUS.SERVICE_UNAVAILABLE
        );
      }
    }

    // Get recent execution history with database error handling
    let recentExecutions: any[] = [];
    try {
      recentExecutions = await Promise.race([
        db.select()
          .from(executionHistory)
          .where(eq(executionHistory.userId, userId))
          .orderBy(desc(executionHistory.executedAt))
          .limit(20),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Execution history query timeout')), 8000)
        )
      ]);
    } catch (dbError) {
      console.error('Database error fetching execution history:', { userId, error: dbError });
      // Continue with empty array - non-critical for portfolio display
    }

    // Get completed positions with database error handling
    let completedPositions: any[] = [];
    try {
      completedPositions = await Promise.race([
        db.select()
          .from(snipeTargets)
          .where(
            and(
              eq(snipeTargets.userId, userId),
              eq(snipeTargets.status, "completed")
            )
          ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Completed positions query timeout')), 8000)
        )
      ]);
    } catch (dbError) {
      console.error('Database error fetching completed positions:', { userId, error: dbError });
      // Continue with empty array - non-critical for portfolio display
    }

    // Calculate basic metrics
    let totalProfit = 0;
    let totalTrades = completedPositions.length;
    let successfulTrades = 0;

    // Helper function to safely parse numbers
    const safeParseFloat = (value: unknown): number => {
      if (typeof value === 'number') return isNaN(value) ? 0 : value;
      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };

    // Helper function to safely calculate PnL
    const calculatePositionPnL = (position: any, currentPrice: number) => {
      const executionPrice = safeParseFloat(position.executionPrice);
      const positionSize = safeParseFloat(position.actualPositionSize);
      
      if (executionPrice <= 0 || positionSize <= 0) {
        return { unrealizedPnL: 0, unrealizedPnLPercent: 0 };
      }
      
      const entryValue = executionPrice * positionSize;
      const currentValue = currentPrice * positionSize;
      const unrealizedPnL = currentValue - entryValue;
      const unrealizedPnLPercent = (unrealizedPnL / entryValue) * 100;
      
      return { unrealizedPnL, unrealizedPnLPercent };
    };

    // Get current prices for active positions with individual error handling
    const positionsWithPnL = await Promise.allSettled(
      activePositions.map(async (position: any) => {
        try {
          // Add timeout to MEXC API call
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(
            `https://api.mexc.com/api/v3/ticker/price?symbol=${position.symbolName}`,
            { 
              signal: controller.signal,
              headers: { 'User-Agent': 'mexc-sniper-bot/1.0' }
            }
          );
          
          clearTimeout(timeoutId);
          
          let currentPrice = safeParseFloat(position.executionPrice);
          let pnlData = { unrealizedPnL: 0, unrealizedPnLPercent: 0 };

          if (response.ok) {
            const data = await response.json();
            const fetchedPrice = safeParseFloat(data?.price);
            
            if (fetchedPrice > 0) {
              currentPrice = fetchedPrice;
              pnlData = calculatePositionPnL(position, currentPrice);
            }
          } else {
            console.warn(`MEXC API error for ${position.symbolName}: ${response.status}`);
          }

          return {
            ...position,
            currentPrice,
            ...pnlData,
          };
        } catch (error) {
          console.warn(`Price fetch failed for ${position.symbolName}:`, { 
            error: error instanceof Error ? error.message : String(error) 
          });
          return {
            ...position,
            currentPrice: safeParseFloat(position.executionPrice),
            unrealizedPnL: 0,
            unrealizedPnLPercent: 0,
          };
        }
      })
    );

    // Extract successful results and filter out failures
    const successfulPositions = positionsWithPnL
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value);

    // Calculate total unrealized P&L with safe math
    const totalUnrealizedPnL = successfulPositions.reduce(
      (sum, position) => sum + safeParseFloat(position.unrealizedPnL),
      0
    );

    // Calculate success rate from execution history with safe math
    const buyExecutions = recentExecutions.filter(
      (exec: any) => exec?.action === "buy" && exec?.status === "success"
    );
    const sellExecutions = recentExecutions.filter(
      (exec: any) => exec?.action === "sell" && exec?.status === "success"
    );

    // Safe success rate calculation
    const calculateSuccessRate = (): number => {
      const totalExecutions = recentExecutions.length;
      const successfulExecutions = buyExecutions.length + sellExecutions.length;
      
      if (totalExecutions === 0) return 0;
      return Math.round((successfulExecutions / totalExecutions) * 100 * 100) / 100; // Round to 2 decimals
    };

    // Safe capital calculation
    const totalCapitalDeployed = activePositions.reduce(
      (sum: number, pos: any) => sum + safeParseFloat(pos.positionSizeUsdt),
      0
    );

    const portfolio = {
      activePositions: successfulPositions,
      metrics: {
        totalActivePositions: activePositions.length,
        totalUnrealizedPnL: Math.round(totalUnrealizedPnL * 100) / 100, // Round to 2 decimals
        totalCompletedTrades: totalTrades,
        successfulTrades: buyExecutions.length,
        successRate: calculateSuccessRate(),
        totalCapitalDeployed: Math.round(totalCapitalDeployed * 100) / 100, // Round to 2 decimals
      },
      recentActivity: recentExecutions.map((exec: any) => ({
        id: exec?.id || 'unknown',
        symbol: exec?.symbolName || 'N/A',
        action: (exec?.action as 'buy' | 'sell') || 'buy',
        status: (exec?.status as 'success' | 'failed' | 'pending') || 'pending',
        quantity: safeParseFloat(exec?.executedQuantity) || 0,
        price: safeParseFloat(exec?.executedPrice) || 0,
        totalCost: safeParseFloat(exec?.totalCost) || 0,
        timestamp: exec?.executedAt || new Date().toISOString(),
        orderId: exec?.exchangeOrderId || 'unknown',
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
    console.error("❌ Error fetching portfolio:", { error: error });
    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : "Unknown error occurred"
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
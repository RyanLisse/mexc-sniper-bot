import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { multiPhaseTradingService } from "@/src/services/multi-phase-trading-service";
import { createExecutorFromStrategy } from "@/src/services/multi-phase-executor";
import { rateLimiter } from "@/src/lib/rate-limiter";
import { createApiResponse, createSuccessResponse, createErrorResponse } from "@/src/lib/api-response";

// ===========================================
// INDIVIDUAL STRATEGY MANAGEMENT
// ===========================================

const UpdateStrategySchema = z.object({
  status: z.enum(["pending", "active", "paused", "completed", "failed", "cancelled"]).optional(),
  currentPrice: z.number().positive().optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  aiInsights: z.string().optional(),
});

const ExecutionActionSchema = z.object({
  action: z.enum(["execute_phase", "update_price", "pause", "resume", "cancel"]),
  phaseNumber: z.number().positive().optional(),
  currentPrice: z.number().positive().optional(),
  executionPrice: z.number().positive().optional(),
  executedQuantity: z.number().positive().optional(),
  fees: z.number().min(0).optional(),
  exchangeOrderId: z.string().optional(),
  slippage: z.number().optional(),
});

// GET /api/strategies/[id] - Get specific strategy with detailed information
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Rate limiting
    const rateLimitResult = rateLimiter.checkRateLimit(rateLimiter.getClientIP(request), "strategies_read");
    if (!rateLimitResult.success) {
      return createApiResponse(createErrorResponse("Rate limit exceeded"), 429);
    }

    // Authentication
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    
    if (!user?.id) {
      return createApiResponse(createErrorResponse("Unauthorized"), 401);
    }

    const strategyId = parseInt(id);
    if (isNaN(strategyId)) {
      return createApiResponse(createErrorResponse("Invalid strategy ID"), 400);
    }

    // Get strategy
    const strategy = await multiPhaseTradingService.getStrategyById(strategyId, user.id);
    if (!strategy) {
      return createApiResponse(createErrorResponse("Strategy not found"), 404);
    }

    // Get phase executions
    const executions = await multiPhaseTradingService.getStrategyPhaseExecutions(
      strategyId,
      user.id
    );

    // Create executor for current state analysis
    const executor = await createExecutorFromStrategy(strategy, user.id);
    const phaseStatus = executor.getPhaseStatus();
    const analytics = executor.getExecutionAnalytics();

    // Calculate performance metrics
    const performanceMetrics = await multiPhaseTradingService.calculatePerformanceMetrics(
      strategyId,
      user.id
    );

    // Get current price analysis if current price is available
    let currentAnalysis = null;
    if (strategy.currentPrice) {
      const executionResult = executor.executePhases(strategy.currentPrice, { dryRun: true });
      currentAnalysis = {
        phasesToExecute: executionResult.phasesToExecute,
        summary: executionResult.summary,
        visualization: executor.getPhaseVisualization(strategy.currentPrice),
      };
    }

    return createApiResponse(createSuccessResponse({
      strategy,
      executions,
      phaseStatus,
      analytics,
      performanceMetrics,
      currentAnalysis,
    }));

  } catch (error) {
    console.error("Error fetching strategy:", error);
    return createApiResponse(createErrorResponse("Failed to fetch strategy"), 500);
  }
}

// PUT /api/strategies/[id] - Update strategy
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Rate limiting
    const rateLimitResult = rateLimiter.checkRateLimit(rateLimiter.getClientIP(request), "strategies_update");
    if (!rateLimitResult.success) {
      return createApiResponse(createErrorResponse("Rate limit exceeded"), 429);
    }

    // Authentication
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    
    if (!user?.id) {
      return createApiResponse(createErrorResponse("Unauthorized"), 401);
    }

    const strategyId = parseInt(id);
    if (isNaN(strategyId)) {
      return createApiResponse(createErrorResponse("Invalid strategy ID"), 400);
    }

    // Parse request body
    const body = await request.json();
    const data = UpdateStrategySchema.parse(body);

    // Prepare update data
    const updateData: any = {};
    
    if (data.status) updateData.status = data.status;
    if (data.currentPrice) updateData.currentPrice = data.currentPrice;
    if (data.name) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.aiInsights) updateData.aiInsights = data.aiInsights;

    // Calculate PnL if current price is provided
    if (data.currentPrice) {
      const strategy = await multiPhaseTradingService.getStrategyById(strategyId, user.id);
      if (strategy) {
        const executor = await createExecutorFromStrategy(strategy, user.id);
        const summary = executor.executePhases(data.currentPrice, { dryRun: true }).summary;
        
        updateData.unrealizedPnl = summary.unrealizedProfit;
        updateData.unrealizedPnlPercent = (summary.unrealizedProfit / strategy.positionSizeUsdt) * 100;
        updateData.totalPnl = summary.realizedProfit + summary.unrealizedProfit;
        updateData.totalPnlPercent = ((summary.realizedProfit + summary.unrealizedProfit) / strategy.positionSizeUsdt) * 100;
        updateData.remainingPosition = summary.totalRemaining;
      }
    }

    // Update strategy
    const updatedStrategy = await multiPhaseTradingService.updateStrategyStatus(
      strategyId,
      user.id,
      data.status || "active",
      updateData
    );

    if (!updatedStrategy) {
      return createApiResponse(createErrorResponse("Strategy not found"), 404);
    }

    return createApiResponse(createSuccessResponse({ strategy: updatedStrategy }));

  } catch (error) {
    console.error("Error updating strategy:", error);
    
    if (error instanceof z.ZodError) {
      return createApiResponse(createErrorResponse("Invalid request data"), 400);
    }

    return createApiResponse(createErrorResponse("Failed to update strategy"), 500);
  }
}

// POST /api/strategies/[id]/execute - Execute strategy actions
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Rate limiting
    const rateLimitResult = rateLimiter.checkRateLimit(rateLimiter.getClientIP(request), "strategies_execute");
    if (!rateLimitResult.success) {
      return createApiResponse(createErrorResponse("Rate limit exceeded"), 429);
    }

    // Authentication
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    
    if (!user?.id) {
      return createApiResponse(createErrorResponse("Unauthorized"), 401);
    }

    const strategyId = parseInt(id);
    if (isNaN(strategyId)) {
      return createApiResponse(createErrorResponse("Invalid strategy ID"), 400);
    }

    // Parse request body
    const body = await request.json();
    const data = ExecutionActionSchema.parse(body);

    const strategy = await multiPhaseTradingService.getStrategyById(strategyId, user.id);
    if (!strategy) {
      return createApiResponse(createErrorResponse("Strategy not found"), 404);
    }

    const executor = await createExecutorFromStrategy(strategy, user.id);
    let result: any = {};

    switch (data.action) {
      case "execute_phase":
        if (!data.phaseNumber || !data.executionPrice || !data.executedQuantity) {
          return createApiResponse(createErrorResponse("Phase number, execution price, and executed quantity are required"), 400);
        }

        await executor.recordPhaseExecution(
          data.phaseNumber,
          data.executionPrice,
          data.executedQuantity,
          {
            fees: data.fees,
            slippage: data.slippage,
            exchangeOrderId: data.exchangeOrderId,
          }
        );

        result = {
          message: `Phase ${data.phaseNumber} executed successfully`,
          phaseStatus: executor.getPhaseStatus(),
          analytics: executor.getExecutionAnalytics(),
        };
        break;

      case "update_price":
        if (!data.currentPrice) {
          return createApiResponse(createErrorResponse("Current price is required"), 400);
        }

        const executionResult = executor.executePhases(data.currentPrice, { dryRun: true });
        
        // Update strategy with new price and analysis
        await multiPhaseTradingService.updateStrategyStatus(strategyId, user.id, strategy.status, {
          currentPrice: data.currentPrice,
          unrealizedPnl: executionResult.summary.unrealizedProfit,
          unrealizedPnlPercent: (executionResult.summary.unrealizedProfit / strategy.positionSizeUsdt) * 100,
          totalPnl: executionResult.summary.realizedProfit + executionResult.summary.unrealizedProfit,
          totalPnlPercent: ((executionResult.summary.realizedProfit + executionResult.summary.unrealizedProfit) / strategy.positionSizeUsdt) * 100,
        });

        result = {
          message: "Price updated successfully",
          phasesToExecute: executionResult.phasesToExecute,
          summary: executionResult.summary,
          visualization: executor.getPhaseVisualization(data.currentPrice),
        };
        break;

      case "pause":
        await multiPhaseTradingService.updateStrategyStatus(strategyId, user.id, "paused");
        result = { message: "Strategy paused successfully" };
        break;

      case "resume":
        await multiPhaseTradingService.updateStrategyStatus(strategyId, user.id, "active");
        result = { message: "Strategy resumed successfully" };
        break;

      case "cancel":
        await multiPhaseTradingService.updateStrategyStatus(strategyId, user.id, "cancelled", {
          completedAt: new Date(),
        });
        result = { message: "Strategy cancelled successfully" };
        break;

      default:
        return createApiResponse(createErrorResponse("Invalid action"), 400);
    }

    return createApiResponse(createSuccessResponse(result));

  } catch (error) {
    console.error("Error executing strategy action:", error);
    
    if (error instanceof z.ZodError) {
      return createApiResponse(createErrorResponse("Invalid request data"), 400);
    }

    return createApiResponse(createErrorResponse("Failed to execute strategy action"), 500);
  }
}

// DELETE /api/strategies/[id] - Delete strategy
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Rate limiting
    const rateLimitResult = rateLimiter.checkRateLimit(rateLimiter.getClientIP(request), "strategies_delete");
    if (!rateLimitResult.success) {
      return createApiResponse(createErrorResponse("Rate limit exceeded"), 429);
    }

    // Authentication
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    
    if (!user?.id) {
      return createApiResponse(createErrorResponse("Unauthorized"), 401);
    }

    const strategyId = parseInt(id);
    if (isNaN(strategyId)) {
      return createApiResponse(createErrorResponse("Invalid strategy ID"), 400);
    }

    // Check if strategy exists and belongs to user
    const strategy = await multiPhaseTradingService.getStrategyById(strategyId, user.id);
    if (!strategy) {
      return createApiResponse(createErrorResponse("Strategy not found"), 404);
    }

    // Only allow deletion of inactive strategies
    if (strategy.status === "active") {
      return createApiResponse(createErrorResponse("Cannot delete active strategy. Pause or cancel it first."), 400);
    }

    // Mark as cancelled instead of actual deletion for data integrity
    await multiPhaseTradingService.updateStrategyStatus(strategyId, user.id, "cancelled", {
      completedAt: new Date(),
    });

    return createApiResponse(createSuccessResponse(null));

  } catch (error) {
    console.error("Error deleting strategy:", error);
    return createApiResponse(createErrorResponse("Failed to delete strategy"), 500);
  }
}
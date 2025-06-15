import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { multiPhaseTradingService } from "@/src/services/multi-phase-trading-service";
import { createExecutorFromStrategy } from "@/src/services/multi-phase-executor";
import { rateLimiter } from "@/src/lib/rate-limiter";
import { ApiResponse } from "@/src/lib/api-response";

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
  { params }: { params: { id: string } }
) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimiter.check(request, "strategies_read", 100, 60);
    if (!rateLimitResult.success) {
      return ApiResponse.error("Rate limit exceeded", 429);
    }

    // Authentication
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    
    if (!user?.id) {
      return ApiResponse.error("Unauthorized", 401);
    }

    const strategyId = parseInt(params.id);
    if (isNaN(strategyId)) {
      return ApiResponse.error("Invalid strategy ID", 400);
    }

    // Get strategy
    const strategy = await multiPhaseTradingService.getStrategyById(strategyId, user.id);
    if (!strategy) {
      return ApiResponse.error("Strategy not found", 404);
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

    return ApiResponse.success({
      strategy,
      executions,
      phaseStatus,
      analytics,
      performanceMetrics,
      currentAnalysis,
    });

  } catch (error) {
    console.error("Error fetching strategy:", error);
    return ApiResponse.error("Failed to fetch strategy", 500);
  }
}

// PUT /api/strategies/[id] - Update strategy
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimiter.check(request, "strategies_update", 30, 60);
    if (!rateLimitResult.success) {
      return ApiResponse.error("Rate limit exceeded", 429);
    }

    // Authentication
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    
    if (!user?.id) {
      return ApiResponse.error("Unauthorized", 401);
    }

    const strategyId = parseInt(params.id);
    if (isNaN(strategyId)) {
      return ApiResponse.error("Invalid strategy ID", 400);
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
      return ApiResponse.error("Strategy not found", 404);
    }

    return ApiResponse.success(
      { strategy: updatedStrategy },
      "Strategy updated successfully"
    );

  } catch (error) {
    console.error("Error updating strategy:", error);
    
    if (error instanceof z.ZodError) {
      return ApiResponse.error("Invalid request data", 400, {
        details: error.errors
      });
    }

    return ApiResponse.error("Failed to update strategy", 500);
  }
}

// POST /api/strategies/[id]/execute - Execute strategy actions
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimiter.check(request, "strategies_execute", 20, 60);
    if (!rateLimitResult.success) {
      return ApiResponse.error("Rate limit exceeded", 429);
    }

    // Authentication
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    
    if (!user?.id) {
      return ApiResponse.error("Unauthorized", 401);
    }

    const strategyId = parseInt(params.id);
    if (isNaN(strategyId)) {
      return ApiResponse.error("Invalid strategy ID", 400);
    }

    // Parse request body
    const body = await request.json();
    const data = ExecutionActionSchema.parse(body);

    const strategy = await multiPhaseTradingService.getStrategyById(strategyId, user.id);
    if (!strategy) {
      return ApiResponse.error("Strategy not found", 404);
    }

    const executor = await createExecutorFromStrategy(strategy, user.id);
    let result: any = {};

    switch (data.action) {
      case "execute_phase":
        if (!data.phaseNumber || !data.executionPrice || !data.executedQuantity) {
          return ApiResponse.error("Phase number, execution price, and executed quantity are required", 400);
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
          return ApiResponse.error("Current price is required", 400);
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
        return ApiResponse.error("Invalid action", 400);
    }

    return ApiResponse.success(result);

  } catch (error) {
    console.error("Error executing strategy action:", error);
    
    if (error instanceof z.ZodError) {
      return ApiResponse.error("Invalid request data", 400, {
        details: error.errors
      });
    }

    return ApiResponse.error("Failed to execute strategy action", 500);
  }
}

// DELETE /api/strategies/[id] - Delete strategy
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimiter.check(request, "strategies_delete", 10, 60);
    if (!rateLimitResult.success) {
      return ApiResponse.error("Rate limit exceeded", 429);
    }

    // Authentication
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    
    if (!user?.id) {
      return ApiResponse.error("Unauthorized", 401);
    }

    const strategyId = parseInt(params.id);
    if (isNaN(strategyId)) {
      return ApiResponse.error("Invalid strategy ID", 400);
    }

    // Check if strategy exists and belongs to user
    const strategy = await multiPhaseTradingService.getStrategyById(strategyId, user.id);
    if (!strategy) {
      return ApiResponse.error("Strategy not found", 404);
    }

    // Only allow deletion of inactive strategies
    if (strategy.status === "active") {
      return ApiResponse.error("Cannot delete active strategy. Pause or cancel it first.", 400);
    }

    // Mark as cancelled instead of actual deletion for data integrity
    await multiPhaseTradingService.updateStrategyStatus(strategyId, user.id, "cancelled", {
      completedAt: new Date(),
    });

    return ApiResponse.success(
      null,
      "Strategy deleted successfully"
    );

  } catch (error) {
    console.error("Error deleting strategy:", error);
    return ApiResponse.error("Failed to delete strategy", 500);
  }
}
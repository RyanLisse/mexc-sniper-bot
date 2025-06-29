import { NextRequest, NextResponse } from "next/server";
import { apiAuthWrapper } from "@/src/lib/api-auth";
import { createApiResponse } from "@/src/lib/api-response";

// Lazy import cache services to prevent build-time initialization
const getCacheWarmingService = () => {
  try {
    // Only import during runtime, not build time
    const {
      getCacheWarmingService: _getCacheWarmingService,
    } = require("@/src/lib/cache-warming-service");
    return _getCacheWarmingService();
  } catch (error) {
    console.warn(
      "[Cache Warming Trigger] Failed to load cache warming service:",
      { error: error },
    );
    return null;
  }
};

export const POST = apiAuthWrapper(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { strategy, strategies, force = false } = body;

    if (!strategy && !strategies) {
      return createApiResponse(
        {
          success: false,
          error: "Strategy name or strategies array is required",
        },
        400,
      );
    }

    let results: any[] = [];

    if (strategy) {
      // Trigger single strategy
      const result = await triggerSingleStrategy(strategy, force);
      results.push(result);
    } else if (strategies && Array.isArray(strategies)) {
      // Trigger multiple strategies
      results = await Promise.all(
        strategies.map((strategyName: string) =>
          triggerSingleStrategy(strategyName, force),
        ),
      );
    }

    const successCount = results.filter((r) => r.success).length;
    const totalCount = results.length;

    return createApiResponse({
      success: successCount > 0,
      data: {
        triggered: successCount,
        total: totalCount,
        results,
        message: `${successCount}/${totalCount} cache warming strategies triggered successfully`,
      },
    });
  } catch (error) {
    console.error("[Cache Warming Trigger] Error:", { error: error });
    return createApiResponse(
      {
        success: false,
        error: "Failed to trigger cache warming",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      },
      500,
    );
  }
});

async function triggerSingleStrategy(
  strategyName: string,
  force: boolean = false,
) {
  try {
    console.info(
      `[Cache Warming Trigger] Triggering strategy: ${strategyName}`,
    );

    // Check if strategy exists
    const cacheWarmingService = getCacheWarmingService();
    if (!cacheWarmingService) {
      return {
        strategy: strategyName,
        success: false,
        error: "Cache warming service not available during build time",
      };
    }
    const strategies = cacheWarmingService.getStrategies();
    const strategy = strategies.get(strategyName);

    if (!strategy) {
      return {
        strategy: strategyName,
        success: false,
        error: `Strategy '${strategyName}' not found`,
        availableStrategies: Array.from(strategies.keys()),
      };
    }

    if (!strategy.enabled && !force) {
      return {
        strategy: strategyName,
        success: false,
        error: `Strategy '${strategyName}' is disabled`,
        message: "Use force=true to trigger disabled strategies",
      };
    }

    // Execute the strategy
    const startTime = Date.now();
    await cacheWarmingService.executeStrategy(strategyName);
    const executionTime = Date.now() - startTime;

    return {
      strategy: strategyName,
      success: true,
      message: `Strategy '${strategyName}' executed successfully`,
      executionTime,
      triggeredAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(
      `[Cache Warming Trigger] Error executing strategy ${strategyName}:`,
      { error },
    );
    return {
      strategy: strategyName,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      triggeredAt: new Date().toISOString(),
    };
  }
}

// GET endpoint to list available strategies
export async function GET(request: NextRequest) {
  try {
    const cacheWarmingService = getCacheWarmingService();
    if (!cacheWarmingService) {
      return createApiResponse({
        success: true,
        data: {
          availableStrategies: [],
          strategies: [],
          serviceMetrics: {
            isActive: false,
            totalExecutions: 0,
            successRate: 0,
            lastExecution: null,
          },
          message: "Cache warming service not available during build time",
        },
      });
    }
    const strategies = cacheWarmingService.getStrategies();
    const metrics = cacheWarmingService.getMetrics();

    return createApiResponse({
      success: true,
      data: {
        availableStrategies: Array.from(strategies.keys()),
        strategies: (Array.from(strategies.entries()) as [string, any][]).map(
          ([name, strategy]) => ({
            name,
            enabled: strategy.enabled,
            priority: strategy.priority,
            frequency: strategy.frequency,
            description: getStrategyDescription(name),
            lastRun: strategy.lastRun
              ? new Date(strategy.lastRun).toISOString()
              : null,
            canTrigger: true,
          }),
        ),
        serviceMetrics: {
          isActive: !!cacheWarmingService, // Service exists and is initialized
          totalExecutions: metrics.totalRuns,
          successRate:
            metrics.totalRuns > 0
              ? (metrics.successfulRuns / metrics.totalRuns) * 100
              : 0,
          lastExecution: metrics.lastWarmupTime
            ? new Date(metrics.lastWarmupTime).toISOString()
            : null,
        },
      },
    });
  } catch (error) {
    console.error("[Cache Warming Trigger] Error getting strategies:", {
      error: error,
    });
    return createApiResponse(
      {
        success: false,
        error: "Failed to get available strategies",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      },
      500,
    );
  }
}

function getStrategyDescription(strategyName: string): string {
  const descriptions: Record<string, string> = {
    "mexc-symbols": "Warm up MEXC symbol data for faster trading decisions",
    "pattern-data":
      "Pre-load pattern detection data for 3.5+ hour advance detection",
    "activity-data": "Cache recent activity data for enhanced pattern analysis",
    "calendar-data": "Warm up upcoming coin listing calendar data",
    "user-preferences": "Cache user trading preferences and settings",
    "market-data": "Pre-load market data for real-time analysis",
  };

  return (
    descriptions[strategyName] || `Cache warming strategy: ${strategyName}`
  );
}

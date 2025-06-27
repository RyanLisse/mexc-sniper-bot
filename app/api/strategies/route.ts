import { NextRequest, NextResponse } from "next/server";
import { getCoreTrading } from "@/src/services/trading/consolidated/core-trading/base-service";
import { 
  TRADING_STRATEGIES,
  TradingStrategyManager,
  type TradingStrategy as MultiPhaseStrategy
} from "@/src/services/trading/trading-strategy-manager";
import { 
  createSuccessResponse, 
  createErrorResponse, 
  apiResponse, 
  HTTP_STATUS 
} from "@/src/lib/api-response";
import { handleApiError } from "@/src/lib/error-handler";

const coreTrading = getCoreTrading();
const strategyManager = new TradingStrategyManager();

/**
 * GET /api/strategies
 * Returns available multi-phase strategies, their performance, and current active strategy
 */
export async function GET() {
  try {
    // Get current active strategy from local strategy manager
    const activeStrategy = strategyManager.getActiveStrategy();
    
    // Get all available multi-phase strategies
    const availableStrategies = Object.values(TRADING_STRATEGIES);
    
    // Get performance metrics from Core Trading Service
    const performanceMetrics = await coreTrading.getPerformanceMetrics();
    const serviceStatus = await coreTrading.getServiceStatus();
    
    // Map strategy performance data (using strategy performance or defaults)
    const strategyPerformance = availableStrategies.reduce((acc, strategy) => {
      const strategyStats = performanceMetrics.strategyPerformance[strategy.id] || {
        trades: 0,
        successRate: 0,
        averagePnL: 0,
        maxDrawdown: 0,
      };
      
      acc[strategy.id] = {
        strategyId: strategy.id,
        successRate: strategyStats.successRate,
        averageProfit: strategyStats.averagePnL,
        totalTrades: strategyStats.trades,
        winRate: strategyStats.successRate, // Use success rate as win rate for now
        maxDrawdown: strategyStats.maxDrawdown,
        sharpeRatio: calculateSharpeRatio(strategyStats), // Simplified calculation
      };
      
      return acc;
    }, {} as Record<string, any>);

    // Get current active positions from Core Trading Service
    const activePositions = await coreTrading.getActivePositions();
    
    // Transform positions to match UI expectations
    const transformedPositions = activePositions.map(position => ({
      symbol: position.symbol,
      entryPrice: position.entryPrice,
      currentPrice: position.currentPrice || position.entryPrice,
      quantity: position.quantity,
      currentPnL: position.unrealizedPnL || 0,
      currentPnLPercentage: calculatePnLPercentage(position.entryPrice, position.currentPrice || position.entryPrice),
      triggeredLevels: calculateTriggeredLevels(position, activeStrategy),
      nextTarget: calculateNextTarget(position, activeStrategy),
    }));

    const response = {
      // Current strategy state
      activeStrategy: {
        id: activeStrategy.id,
        name: activeStrategy.name,
        description: activeStrategy.description,
        levels: activeStrategy.levels,
      },
      
      // All available strategies
      availableStrategies,
      
      // Performance data for all strategies
      strategyPerformance,
      
      // Current positions using the active strategy
      activePositions: transformedPositions,
      
      // System status
      tradingStatus: {
        isActive: serviceStatus.autoSnipingEnabled,
        tradingEnabled: serviceStatus.tradingEnabled,
        paperTradingMode: serviceStatus.paperTradingMode,
        healthStatus: serviceStatus.isHealthy,
      },
      
      // Real-time metrics
      metrics: {
        totalPnL: performanceMetrics.totalPnL,
        totalTrades: performanceMetrics.totalTrades,
        successRate: performanceMetrics.successRate,
        activePositionCount: activePositions.length,
        maxPositions: serviceStatus.maxPositions,
        uptime: serviceStatus.uptime,
      },
    };
    
    return apiResponse(
      createSuccessResponse(response, {
        message: "Strategies data retrieved successfully"
      }),
      HTTP_STATUS.OK
    );
  } catch (error) {
    console.error("Strategies GET error:", { error: error });
    return handleApiError(error, { message: "Failed to get strategies data" });
  }
}

/**
 * POST /api/strategies
 * Updates the active strategy and propagates changes to Core Trading Service
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, strategyId, config } = body as { 
      action: string; 
      strategyId?: string; 
      config?: Record<string, unknown>;
    };

    if (!action) {
      return apiResponse(
        createErrorResponse("Action is required", {
          message: "Please specify action: switch, update, or configure"
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    switch (action) {
      case "switch":
        if (!strategyId) {
          return apiResponse(
            createErrorResponse("Strategy ID is required for switch action", {
              message: "Please provide strategyId to switch to"
            }),
            HTTP_STATUS.BAD_REQUEST
          );
        }

        // Switch strategy in local manager
        const switchSuccess = strategyManager.switchStrategy(strategyId);
        if (!switchSuccess) {
          return apiResponse(
            createErrorResponse("Invalid strategy ID", {
              message: `Strategy '${strategyId}' not found`,
              availableStrategies: Object.keys(TRADING_STRATEGIES)
            }),
            HTTP_STATUS.BAD_REQUEST
          );
        }

        // Update Core Trading Service configuration to reflect new strategy
        const newStrategy = strategyManager.getActiveStrategy();
        const coreConfig = mapMultiPhaseToCoreTradingConfig(newStrategy);
        
        const updateResult = await coreTrading.updateConfig(coreConfig);
        if (!updateResult.success) {
          return apiResponse(
            createErrorResponse("Failed to update Core Trading Service", {
              message: updateResult.error,
              strategy: strategyId
            }),
            HTTP_STATUS.INTERNAL_SERVER_ERROR
          );
        }

        console.info("🔄 Strategy switched successfully:", { 
          strategyId, 
          strategyName: newStrategy.name 
        });
        
        return apiResponse(
          createSuccessResponse(
            { 
              activeStrategy: newStrategy,
              coreConfigUpdated: true 
            },
            { message: `Strategy switched to '${newStrategy.name}' successfully` }
          ),
          HTTP_STATUS.OK
        );

      case "update":
        if (!config) {
          return apiResponse(
            createErrorResponse("Configuration is required for update action", {
              message: "Please provide config object for update"
            }),
            HTTP_STATUS.BAD_REQUEST
          );
        }
        
        // Update Core Trading Service configuration directly
        const configUpdateResult = await coreTrading.updateConfig(config);
        if (!configUpdateResult.success) {
          return apiResponse(
            createErrorResponse("Failed to update configuration", {
              message: configUpdateResult.error
            }),
            HTTP_STATUS.INTERNAL_SERVER_ERROR
          );
        }

        console.info("⚙️ Strategy configuration updated:", { context: config });
        
        return apiResponse(
          createSuccessResponse(
            { configUpdated: true },
            { message: "Strategy configuration updated successfully" }
          ),
          HTTP_STATUS.OK
        );

      case "configure":
        // Get current service status and configuration
        const currentStatus = await coreTrading.getServiceStatus();
        const currentMetrics = await coreTrading.getPerformanceMetrics();
        
        return apiResponse(
          createSuccessResponse(
            { 
              status: currentStatus,
              metrics: currentMetrics,
              activeStrategy: strategyManager.getActiveStrategy()
            },
            { message: "Current strategy configuration retrieved" }
          ),
          HTTP_STATUS.OK
        );

      default:
        return apiResponse(
          createErrorResponse("Invalid action", {
            message: "Action must be one of: switch, update, configure",
            availableActions: ["switch", "update", "configure"]
          }),
          HTTP_STATUS.BAD_REQUEST
        );
    }
  } catch (error) {
    console.error("Strategies POST error:", { error: error });
    return handleApiError(error, { message: "Failed to process strategy request" });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map multi-phase strategy to Core Trading Service configuration
 */
function mapMultiPhaseToCoreTradingConfig(strategy: MultiPhaseStrategy): Record<string, unknown> {
  // Extract key parameters from multi-phase strategy
  const maxTarget = Math.max(...strategy.levels.map(l => l.percentage));
  const avgSellPercentage = strategy.levels.reduce((sum, l) => sum + l.sellPercentage, 0) / strategy.levels.length;
  
  // Map to Core Trading Service configuration
  return {
    defaultStrategy: strategy.id,
    // Multi-phase settings
    enableMultiPhase: true,
    phaseCount: strategy.levels.length,
    phaseDelayMs: getPhaseDelayForStrategy(strategy.id),
    // Take profit based on maximum target
    takeProfitPercent: maxTarget,
    // Position sizing based on sell percentages
    maxPositionSize: avgSellPercentage / 100,
    // Strategy-specific configurations
    confidenceThreshold: getConfidenceThresholdForStrategy(strategy.id),
    enableAutoSnipe: shouldEnableAutoSnipeForStrategy(strategy.id),
    snipeDelayMs: getSnipeDelayForStrategy(strategy.id),
  };
}

/**
 * Calculate PnL percentage
 */
function calculatePnLPercentage(entryPrice: number, currentPrice: number): number {
  if (entryPrice <= 0) return 0;
  return ((currentPrice - entryPrice) / entryPrice) * 100;
}

/**
 * Calculate triggered levels for a position based on active strategy
 */
function calculateTriggeredLevels(position: any, strategy: MultiPhaseStrategy): number {
  if (!position.entryPrice || !position.currentPrice) return 0;
  
  const priceIncrease = calculatePnLPercentage(position.entryPrice, position.currentPrice);
  return strategy.levels.filter(level => priceIncrease >= level.percentage).length;
}

/**
 * Calculate next target for a position
 */
function calculateNextTarget(position: any, strategy: MultiPhaseStrategy): number {
  if (!position.entryPrice || !position.currentPrice) return 0;
  
  const priceIncrease = calculatePnLPercentage(position.entryPrice, position.currentPrice);
  const nextLevel = strategy.levels.find(level => priceIncrease < level.percentage);
  
  if (nextLevel) {
    return position.entryPrice * nextLevel.multiplier;
  }
  
  // If all levels are triggered, return the highest target
  const maxLevel = strategy.levels[strategy.levels.length - 1];
  return position.entryPrice * maxLevel.multiplier;
}

/**
 * Calculate simplified Sharpe ratio
 */
function calculateSharpeRatio(strategyStats: any): number {
  // Simplified calculation - in reality this would need more data
  if (strategyStats.trades < 10) return 0;
  
  const riskAdjustedReturn = strategyStats.averagePnL / Math.max(strategyStats.maxDrawdown, 1);
  return Math.min(Math.max(riskAdjustedReturn / 10, 0), 5); // Cap between 0 and 5
}

/**
 * Get phase delay based on strategy type
 */
function getPhaseDelayForStrategy(strategyId: string): number {
  const delays: Record<string, number> = {
    conservative: 10000, // 10 seconds
    normal: 5000,        // 5 seconds
    highPriceIncrease: 3000, // 3 seconds
    scalping: 1000,      // 1 second
    diamond: 15000,      // 15 seconds
  };
  return delays[strategyId] || 5000;
}

/**
 * Get confidence threshold based on strategy type
 */
function getConfidenceThresholdForStrategy(strategyId: string): number {
  const thresholds: Record<string, number> = {
    conservative: 85,
    normal: 75,
    highPriceIncrease: 65,
    scalping: 70,
    diamond: 60,
  };
  return thresholds[strategyId] || 75;
}

/**
 * Determine if auto-snipe should be enabled for strategy
 */
function shouldEnableAutoSnipeForStrategy(strategyId: string): boolean {
  const autoSnipeStrategies = ['normal', 'highPriceIncrease', 'scalping'];
  return autoSnipeStrategies.includes(strategyId);
}

/**
 * Get snipe delay based on strategy type
 */
function getSnipeDelayForStrategy(strategyId: string): number {
  const delays: Record<string, number> = {
    conservative: 2000,  // 2 seconds
    normal: 1000,        // 1 second
    highPriceIncrease: 500, // 0.5 seconds
    scalping: 100,       // 0.1 seconds
    diamond: 5000,       // 5 seconds
  };
  return delays[strategyId] || 1000;
}
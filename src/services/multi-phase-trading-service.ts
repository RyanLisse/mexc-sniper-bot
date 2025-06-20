import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  type NewStrategyPhaseExecution,
  type NewTradingStrategy,
  type StrategyPhaseExecution,
  type StrategyTemplate,
  type TradingStrategy,
  strategyPhaseExecutions,
  strategyTemplates,
  tradingStrategies,
} from "../db/schemas/strategies";

// ===========================================
// MULTI-PHASE TRADING STRATEGY SERVICE
// ===========================================

// Zod schemas for type safety
export const PriceMultiplierSchema = z.object({
  percentage: z.number().min(0),
  multiplier: z.number().min(1),
  sellPercentage: z.number().min(0).max(100),
});

export const TradingStrategyConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  levels: z.array(PriceMultiplierSchema),
});

// Type definitions
export type PriceMultiplier = z.infer<typeof PriceMultiplierSchema>;
export type TradingStrategyConfig = z.infer<typeof TradingStrategyConfigSchema>;

// Pre-defined strategy configurations
export const PREDEFINED_STRATEGIES: Record<string, TradingStrategyConfig> = {
  normal: {
    id: "normal",
    name: "Normal Multi-Phase Strategy",
    description: "Standard multi-phase strategy with 4 exit points",
    levels: [
      { percentage: 50, multiplier: 1.5, sellPercentage: 25 },
      { percentage: 100, multiplier: 2.0, sellPercentage: 25 },
      { percentage: 125, multiplier: 2.25, sellPercentage: 20 },
      { percentage: 175, multiplier: 2.75, sellPercentage: 10 },
    ],
  },
  conservative: {
    id: "conservative",
    name: "Conservative Multi-Phase Strategy",
    description: "Early profit-taking with lower targets",
    levels: [
      { percentage: 10, multiplier: 1.1, sellPercentage: 30 },
      { percentage: 20, multiplier: 1.2, sellPercentage: 40 },
      { percentage: 30, multiplier: 1.3, sellPercentage: 30 },
    ],
  },
  highPriceIncrease: {
    id: "high-price-increase",
    name: "Aggressive Multi-Phase Strategy",
    description: "Agressieve multi-phase strategie voor hogere targets",
    levels: [
      { percentage: 100, multiplier: 2.0, sellPercentage: 15 },
      { percentage: 150, multiplier: 2.5, sellPercentage: 15 },
      { percentage: 200, multiplier: 3.0, sellPercentage: 25 },
      { percentage: 300, multiplier: 4.0, sellPercentage: 25 },
    ],
  },
  aggressive: {
    id: "aggressive",
    name: "Aggressive Multi-Phase Strategy",
    description: "High targets for maximum gains",
    levels: [
      { percentage: 100, multiplier: 2.0, sellPercentage: 15 },
      { percentage: 150, multiplier: 2.5, sellPercentage: 15 },
      { percentage: 200, multiplier: 3.0, sellPercentage: 25 },
      { percentage: 300, multiplier: 4.0, sellPercentage: 25 },
    ],
  },
  scalping: {
    id: "scalping",
    name: "Scalping Multi-Phase Strategy",
    description: "Quick profits with small targets",
    levels: [
      { percentage: 5, multiplier: 1.05, sellPercentage: 20 },
      { percentage: 10, multiplier: 1.1, sellPercentage: 30 },
      { percentage: 15, multiplier: 1.15, sellPercentage: 30 },
      { percentage: 20, multiplier: 1.2, sellPercentage: 20 },
    ],
  },
  diamond: {
    id: "diamond",
    name: "Diamond Hands Multi-Phase Strategy",
    description: "Long-term holds with very high targets",
    levels: [
      { percentage: 200, multiplier: 3.0, sellPercentage: 10 },
      { percentage: 500, multiplier: 6.0, sellPercentage: 20 },
      { percentage: 1000, multiplier: 11.0, sellPercentage: 30 },
      { percentage: 2000, multiplier: 21.0, sellPercentage: 20 },
    ],
  },
};

// Strategy execution result interface
export interface StrategyExecutionResult {
  phasesToExecute: Array<{
    phase: number;
    level: PriceMultiplier;
    amount: number;
    expectedProfit: number;
  }>;
  summary: {
    totalSold: number;
    totalRemaining: number;
    realizedProfit: number;
    unrealizedProfit: number;
    completedPhases: number;
    nextPhaseTarget: number | null;
  };
}

// Multi-Phase Trading Strategy Service
export class MultiPhaseTradingService {
  // Initialize predefined strategy templates in database
  async initializePredefinedStrategies(): Promise<void> {
    for (const [strategyId, config] of Object.entries(PREDEFINED_STRATEGIES)) {
      const existing = await db
        .select()
        .from(strategyTemplates)
        .where(eq(strategyTemplates.strategyId, strategyId));

      if (existing.length === 0) {
        await db.insert(strategyTemplates).values({
          strategyId: config.id,
          name: config.name,
          description: config.description || "",
          type: "multi_phase",
          riskLevel: this.determineRiskLevel(config.levels),
          defaultSettings: JSON.stringify(config.levels),
          isBuiltIn: true,
        });
      }
    }
  }

  // Create a new trading strategy for a user
  async createTradingStrategy(params: {
    userId: string;
    name: string;
    symbol: string;
    vcoinId?: string;
    entryPrice: number;
    positionSize: number;
    positionSizeUsdt: number;
    strategyConfig: TradingStrategyConfig;
    stopLossPercent: number;
    description?: string;
  }): Promise<TradingStrategy> {
    const validated = TradingStrategyConfigSchema.parse(params.strategyConfig);

    const strategyData: NewTradingStrategy = {
      userId: params.userId,
      name: params.name,
      symbol: params.symbol,
      vcoinId: params.vcoinId,
      entryPrice: params.entryPrice,
      positionSize: params.positionSize,
      positionSizeUsdt: params.positionSizeUsdt,
      levels: JSON.stringify(validated.levels),
      stopLossPercent: params.stopLossPercent,
      totalPhases: validated.levels.length,
      description: params.description,
      status: "pending",
    };

    const [strategy] = await db.insert(tradingStrategies).values(strategyData).returning();
    return strategy;
  }

  // Get trading strategies for a user
  async getUserStrategies(
    userId: string,
    options?: {
      status?: string;
      symbol?: string;
      limit?: number;
    }
  ): Promise<TradingStrategy[]> {
    const conditions = [eq(tradingStrategies.userId, userId)];

    if (options?.status) {
      conditions.push(eq(tradingStrategies.status, options.status));
    }

    if (options?.symbol) {
      conditions.push(eq(tradingStrategies.symbol, options.symbol));
    }

    const baseQuery = db
      .select()
      .from(tradingStrategies)
      .where(and(...conditions))
      .orderBy(desc(tradingStrategies.createdAt));

    if (options?.limit) {
      return await baseQuery.limit(options.limit);
    }

    return await baseQuery;
  }

  // Get strategy by ID
  async getStrategyById(strategyId: number, userId: string): Promise<TradingStrategy | null> {
    const [strategy] = await db
      .select()
      .from(tradingStrategies)
      .where(and(eq(tradingStrategies.id, strategyId), eq(tradingStrategies.userId, userId)))
      .limit(1);

    return strategy || null;
  }

  // Update strategy status
  async updateStrategyStatus(
    strategyId: number,
    userId: string,
    status: string,
    additionalData?: Partial<TradingStrategy>
  ): Promise<TradingStrategy | null> {
    const updateData = {
      status,
      updatedAt: new Date(),
      ...additionalData,
    };

    if (status === "active" && !additionalData?.activatedAt) {
      updateData.activatedAt = new Date();
    }

    if (status === "completed" && !additionalData?.completedAt) {
      updateData.completedAt = new Date();
    }

    const [updated] = await db
      .update(tradingStrategies)
      .set(updateData)
      .where(and(eq(tradingStrategies.id, strategyId), eq(tradingStrategies.userId, userId)))
      .returning();

    return updated || null;
  }

  // Calculate strategy execution based on current price
  calculateExecution(
    strategy: TradingStrategy,
    currentPrice: number,
    executedPhases: Set<number> = new Set()
  ): StrategyExecutionResult {
    const levels: PriceMultiplier[] = JSON.parse(strategy.levels);
    const entryPrice = strategy.entryPrice;
    const totalAmount = strategy.positionSize;
    const priceIncrease = ((currentPrice - entryPrice) / entryPrice) * 100;

    const phasesToExecute: Array<{
      phase: number;
      level: PriceMultiplier;
      amount: number;
      expectedProfit: number;
    }> = [];

    // Check which phases should be executed
    levels.forEach((level, index) => {
      const phaseNumber = index + 1;
      if (priceIncrease >= level.percentage && !executedPhases.has(phaseNumber)) {
        const amount = (totalAmount * level.sellPercentage) / 100;
        const targetPrice = entryPrice * level.multiplier;
        const expectedProfit = amount * (targetPrice - entryPrice);

        phasesToExecute.push({
          phase: phaseNumber,
          level,
          amount,
          expectedProfit,
        });
      }
    });

    // Calculate summary
    const totalSold = Array.from(executedPhases).reduce((sum, phaseNum) => {
      const level = levels[phaseNum - 1];
      return sum + (totalAmount * level.sellPercentage) / 100;
    }, 0);

    const totalRemaining = totalAmount - totalSold;
    const realizedProfit = 0; // This would come from actual execution history
    const unrealizedProfit = totalRemaining * (currentPrice - entryPrice);

    // Find next phase target
    let nextPhaseTarget: number | null = null;
    for (let i = 0; i < levels.length; i++) {
      if (!executedPhases.has(i + 1)) {
        nextPhaseTarget = entryPrice * levels[i].multiplier;
        break;
      }
    }

    return {
      phasesToExecute,
      summary: {
        totalSold,
        totalRemaining,
        realizedProfit,
        unrealizedProfit,
        completedPhases: executedPhases.size,
        nextPhaseTarget,
      },
    };
  }

  // Record phase execution
  async recordPhaseExecution(params: {
    strategyId: number;
    userId: string;
    phaseNumber: number;
    targetPrice: number;
    executionPrice: number;
    executedQuantity: number;
    profit: number;
    fees?: number;
    exchangeOrderId?: string;
    exchangeResponse?: string;
  }): Promise<StrategyPhaseExecution> {
    const phaseData: NewStrategyPhaseExecution = {
      userId: params.userId,
      strategyId: params.strategyId,
      phaseNumber: params.phaseNumber,
      targetPercentage: 0, // This should be calculated from strategy levels
      targetPrice: params.targetPrice,
      targetMultiplier: params.targetPrice / params.executionPrice, // Approximation
      plannedSellPercentage: 0, // This should come from strategy levels
      executionStatus: "executed",
      triggerPrice: params.targetPrice,
      executionPrice: params.executionPrice,
      executedQuantity: params.executedQuantity,
      executedValue: params.executionPrice * params.executedQuantity,
      profit: params.profit,
      profitPercent: (params.profit / (params.executionPrice * params.executedQuantity)) * 100,
      fees: params.fees || 0,
      exchangeOrderId: params.exchangeOrderId,
      exchangeResponse: params.exchangeResponse,
      triggeredAt: new Date(),
      executedAt: new Date(),
    };

    const [execution] = await db.insert(strategyPhaseExecutions).values(phaseData).returning();

    // Update strategy with execution info
    await this.updateStrategyAfterExecution(params.strategyId, params.userId);

    return execution;
  }

  // Get phase executions for a strategy
  async getStrategyPhaseExecutions(
    strategyId: number,
    userId: string
  ): Promise<StrategyPhaseExecution[]> {
    return await db
      .select()
      .from(strategyPhaseExecutions)
      .where(
        and(
          eq(strategyPhaseExecutions.strategyId, strategyId),
          eq(strategyPhaseExecutions.userId, userId)
        )
      )
      .orderBy(asc(strategyPhaseExecutions.phaseNumber));
  }

  // Update strategy performance after phase execution
  private async updateStrategyAfterExecution(strategyId: number, userId: string): Promise<void> {
    const executions = await this.getStrategyPhaseExecutions(strategyId, userId);
    const strategy = await this.getStrategyById(strategyId, userId);

    if (!strategy) return;

    const totalRealizedPnl = executions.reduce((sum, exec) => sum + (exec.profit || 0), 0);
    const _totalFees = executions.reduce((sum, exec) => sum + (exec.fees || 0), 0);
    const executedPhases = executions.filter((exec) => exec.executionStatus === "executed").length;

    await db
      .update(tradingStrategies)
      .set({
        realizedPnl: totalRealizedPnl,
        executedPhases,
        lastExecutionAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tradingStrategies.id, strategyId));
  }

  // Get all strategy templates
  async getStrategyTemplates(): Promise<StrategyTemplate[]> {
    return await db.select().from(strategyTemplates).where(eq(strategyTemplates.isActive, true));
  }

  // Get strategy template by ID
  async getStrategyTemplate(templateId: string): Promise<StrategyTemplate | null> {
    const [template] = await db
      .select()
      .from(strategyTemplates)
      .where(eq(strategyTemplates.strategyId, templateId))
      .limit(1);

    return template || null;
  }

  // Get predefined strategies
  getPredefinedStrategies(): Record<string, TradingStrategyConfig> {
    return PREDEFINED_STRATEGIES;
  }

  // Validate a trading strategy configuration
  validateStrategy(strategyConfig: TradingStrategyConfig): boolean {
    try {
      TradingStrategyConfigSchema.parse(strategyConfig);
      return true;
    } catch (error) {
      console.error("Strategy validation failed:", error);
      return false;
    }
  }

  // Helper method to determine risk level from strategy levels
  private determineRiskLevel(levels: PriceMultiplier[]): "low" | "medium" | "high" {
    const avgTarget = levels.reduce((sum, level) => sum + level.percentage, 0) / levels.length;

    if (avgTarget < 30) return "low";
    if (avgTarget < 100) return "medium";
    return "high";
  }

  // Calculate strategy performance metrics
  async calculatePerformanceMetrics(
    strategyId: number,
    userId: string
  ): Promise<{
    totalPnl: number;
    totalPnlPercent: number;
    maxDrawdown: number;
    sharpeRatio: number;
    winRate: number;
    avgExecutionTime: number;
  }> {
    const strategy = await this.getStrategyById(strategyId, userId);
    const executions = await this.getStrategyPhaseExecutions(strategyId, userId);

    if (!strategy) {
      throw new Error("Strategy not found");
    }

    const successfulExecutions = executions.filter((exec) => exec.executionStatus === "executed");
    const totalPnl = successfulExecutions.reduce((sum, exec) => sum + (exec.profit || 0), 0);
    const initialInvestment = strategy.positionSizeUsdt;
    const totalPnlPercent = (totalPnl / initialInvestment) * 100;

    // Calculate other metrics
    const winRate =
      successfulExecutions.length > 0
        ? (successfulExecutions.filter((exec) => (exec.profit || 0) > 0).length /
            successfulExecutions.length) *
          100
        : 0;

    const avgExecutionTime =
      successfulExecutions.length > 0
        ? successfulExecutions.reduce((sum, exec) => {
            if (exec.triggeredAt && exec.executedAt) {
              return sum + (exec.executedAt.getTime() - exec.triggeredAt.getTime());
            }
            return sum;
          }, 0) / successfulExecutions.length
        : 0;

    // Calculate max drawdown
    const maxDrawdown = this.calculateMaxDrawdown(successfulExecutions, initialInvestment);
    
    // Calculate Sharpe ratio
    const sharpeRatio = this.calculateSharpeRatio(successfulExecutions, initialInvestment);

    return {
      totalPnl,
      totalPnlPercent,
      maxDrawdown,
      sharpeRatio,
      winRate,
      avgExecutionTime: avgExecutionTime / 1000, // Convert to seconds
    };
  }

  /**
   * Calculate maximum drawdown percentage
   * Max drawdown is the maximum percentage decline from a portfolio peak to trough
   */
  private calculateMaxDrawdown(executions: any[], initialInvestment: number): number {
    if (executions.length === 0) return 0;

    let portfolioValue = initialInvestment;
    let peak = portfolioValue;
    let maxDrawdown = 0;

    // Calculate cumulative portfolio value and track peak-to-trough declines
    for (const execution of executions) {
      portfolioValue += execution.profit || 0;
      
      // Update peak if we've reached a new high
      if (portfolioValue > peak) {
        peak = portfolioValue;
      }
      
      // Calculate current drawdown from peak
      const currentDrawdown = ((peak - portfolioValue) / peak) * 100;
      
      // Update max drawdown if current is worse
      if (currentDrawdown > maxDrawdown) {
        maxDrawdown = currentDrawdown;
      }
    }

    return maxDrawdown;
  }

  /**
   * Calculate Sharpe ratio
   * Sharpe ratio = (average return - risk-free rate) / standard deviation of returns
   * Using 0% risk-free rate for crypto trading
   */
  private calculateSharpeRatio(executions: any[], initialInvestment: number): number {
    if (executions.length < 2) return 0; // Need at least 2 data points for std dev

    // Calculate returns as percentages for each execution
    const returns = executions.map(exec => ((exec.profit || 0) / initialInvestment) * 100);
    
    // Calculate average return
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    
    // Calculate standard deviation of returns
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);
    
    // Return Sharpe ratio (using 0% risk-free rate)
    return stdDev === 0 ? 0 : avgReturn / stdDev;
  }
}

// Export singleton instance
export const multiPhaseTradingService = new MultiPhaseTradingService();

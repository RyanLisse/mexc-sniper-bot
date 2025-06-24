import { createLogger } from "../lib/structured-logger";
import type { MultiPhaseExecutor } from "./multi-phase-executor";

export interface PositionInfo {
  hasPosition: boolean;
  symbol?: string;
  entryPrice?: number;
  currentSize?: number;
  marketValue?: number;
  unrealizedPnL?: number;
  unrealizedPnLPercent?: number;
  duration?: number;
  phases?: {
    total: number;
    completed: number;
    remaining: number;
    nextTarget?: number;
  };
}

export interface OptimalEntryCalculation {
  entryPrice: number;
  confidence: number;
  reasoning: string;
  adjustments: string[];
}

export interface PartialFillResult {
  fillPercentage: number;
  remainingAmount: number;
  status: "partial" | "complete";
  nextAction: string;
  adjustments?: {
    priceAdjustment?: number;
    sizeAdjustment?: number;
    timeoutAdjustment?: number;
  };
}

export interface PositionInitResult {
  success: boolean;
  positionId: string;
  details: {
    symbol: string;
    entryPrice: number;
    amount: number;
    value: number;
    timestamp: string;
    status: string;
  };
  error?: string;
}

/**
 * Position management for multi-phase trading
 */
export class MultiPhasePositionManager {
  private logger = createLogger("multi-phase-position-manager");

  constructor(
    private entryPrice: number,
    private position: number,
    private symbol: string | undefined,
    private executor: MultiPhaseExecutor
  ) {}

  /**
   * Calculate optimal entry point for a symbol based on market conditions
   */
  calculateOptimalEntry(
    _symbol: string,
    conditions?: {
      volatility?: number;
      volume?: number;
      momentum?: number;
      support?: number;
      resistance?: number;
    }
  ): OptimalEntryCalculation {
    let basePrice = this.entryPrice;
    let confidence = 80;
    const adjustments: string[] = [];
    let reasoning = `Base entry at ${basePrice}`;

    if (conditions) {
      // Adjust for volatility
      if (conditions.volatility !== undefined) {
        if (conditions.volatility > 0.8) {
          basePrice *= 0.98;
          confidence -= 15;
          adjustments.push("Reduced entry by 2% due to high volatility");
        } else if (conditions.volatility < 0.3) {
          basePrice *= 1.01;
          confidence += 5;
          adjustments.push("Increased entry by 1% due to low volatility stability");
        }
      }

      // Adjust for volume
      if (conditions.volume !== undefined) {
        if (conditions.volume > 2.0) {
          confidence += 10;
          adjustments.push("High volume confirms entry point");
        } else if (conditions.volume < 0.5) {
          confidence -= 25;
          adjustments.push("Low volume reduces entry confidence");
        } else if (conditions.volume < 0.2) {
          confidence -= 40;
          adjustments.push("Very low volume indicates insufficient liquidity");
        }
      }

      // Adjust for momentum
      if (conditions.momentum !== undefined) {
        if (conditions.momentum > 0.7) {
          basePrice *= 1.02;
          confidence += 10;
          adjustments.push("Increased entry by 2% due to strong bullish momentum");
        } else if (conditions.momentum < -0.5) {
          basePrice *= 0.95;
          confidence -= 20;
          adjustments.push("Reduced entry by 5% due to bearish momentum");
        }
      }

      // Consider support and resistance levels
      if (conditions.support && conditions.resistance) {
        const range = conditions.resistance - conditions.support;
        const optimalEntry = conditions.support + range * 0.2;

        if (Math.abs(basePrice - optimalEntry) / basePrice > 0.05) {
          basePrice = optimalEntry;
          confidence += 15;
          adjustments.push(`Adjusted to optimal technical entry at ${optimalEntry.toFixed(4)}`);
        }
      }

      reasoning = `Optimal entry calculated considering: ${Object.keys(conditions).join(", ")}`;
    }

    confidence = Math.max(10, Math.min(95, confidence));

    return {
      entryPrice: Number(basePrice.toFixed(6)),
      confidence,
      reasoning,
      adjustments,
    };
  }

  /**
   * Initialize a new trading position
   */
  initializePosition(symbol: string, entryPrice: number, amount: number): PositionInitResult {
    try {
      if (!symbol || entryPrice <= 0 || amount <= 0) {
        return {
          success: false,
          positionId: "",
          details: {
            symbol: "",
            entryPrice: 0,
            amount: 0,
            value: 0,
            timestamp: "",
            status: "failed",
          },
          error: "Invalid position parameters",
        };
      }

      const positionId = `pos-${symbol}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const value = entryPrice * amount;

      const details = {
        symbol,
        entryPrice,
        amount,
        value,
        timestamp: new Date().toISOString(),
        status: "active",
      };

      this.logger.info(
        `Position initialized: ${symbol} @ ${entryPrice} x ${amount} = ${value} USDT`
      );

      return {
        success: true,
        positionId,
        details,
      };
    } catch (error) {
      this.logger.error("Position initialization failed:", error);
      return {
        success: false,
        positionId: "",
        details: {
          symbol: "",
          entryPrice: 0,
          amount: 0,
          value: 0,
          timestamp: "",
          status: "failed",
        },
        error: `Position initialization failed: ${error}`,
      };
    }
  }

  /**
   * Handle partial fill of trade execution
   */
  handlePartialFill(
    _action: string,
    executedAmount: number,
    totalAmount: number
  ): PartialFillResult {
    const fillPercentage = (executedAmount / totalAmount) * 100;
    const remainingAmount = totalAmount - executedAmount;
    const status = remainingAmount > 0.001 ? "partial" : "complete";

    let nextAction = "continue";
    const adjustments: any = {};

    // Determine next action based on fill percentage
    if (fillPercentage >= 95) {
      nextAction = "complete_order";
    } else if (fillPercentage >= 50) {
      nextAction = "continue_execution";
      adjustments.priceAdjustment = 0.001;
    } else if (fillPercentage >= 20) {
      nextAction = "adjust_strategy";
      adjustments.priceAdjustment = 0.002;
      adjustments.sizeAdjustment = 0.8;
    } else {
      nextAction = "reassess_market";
      adjustments.priceAdjustment = 0.005;
      adjustments.timeoutAdjustment = 2.0;
    }

    this.logger.info(
      `Partial fill handled: ${fillPercentage.toFixed(1)}% filled, ${nextAction} recommended`
    );

    return {
      fillPercentage,
      remainingAmount,
      status,
      nextAction,
      adjustments: Object.keys(adjustments).length > 0 ? adjustments : undefined,
    };
  }

  /**
   * Get current position information
   */
  getPositionInfo(): PositionInfo {
    const hasPosition = this.position > 0;

    if (!hasPosition) {
      return { hasPosition: false };
    }

    const currentPrice = this.entryPrice;
    const marketValue = this.position * currentPrice;
    const costBasis = this.position * this.entryPrice;
    const unrealizedPnL = marketValue - costBasis;
    const unrealizedPnLPercent = (unrealizedPnL / costBasis) * 100;

    const phaseStatus = this.executor.getPhaseStatus();
    const summary = this.executor.calculateSummary(currentPrice);

    return {
      hasPosition: true,
      symbol: this.symbol,
      entryPrice: this.entryPrice,
      currentSize: this.position,
      marketValue,
      unrealizedPnL,
      unrealizedPnLPercent,
      duration: 0,
      phases: {
        total: phaseStatus.totalPhases,
        completed: phaseStatus.completedPhases,
        remaining: phaseStatus.totalPhases - phaseStatus.completedPhases,
        nextTarget: summary.nextPhaseTarget,
      },
    };
  }

  /**
   * Update position parameters
   */
  updatePosition(newPosition: number, newSymbol?: string): void {
    this.position = newPosition;
    if (newSymbol) {
      this.symbol = newSymbol;
    }
  }

  /**
   * Get position size
   */
  getPositionSize(): number {
    return this.position;
  }

  /**
   * Get entry price
   */
  getEntryPrice(): number {
    return this.entryPrice;
  }

  /**
   * Get symbol
   */
  getSymbol(): string | undefined {
    return this.symbol;
  }
}

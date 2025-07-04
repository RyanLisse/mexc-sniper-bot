/**
 * Risk Validator
 * Handles trade risk validation and pre-trade risk checks
 */

import { toSafeError } from "@/src/lib/error-type-utils";
import type { ModuleContext, Position, TradeParameters } from "../types";

export interface RiskLimits {
  maxPortfolioRisk: number;
  maxSinglePositionRisk: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  maxConcurrentPositions: number;
  maxCorrelatedExposure: number;
  minAccountBalance: number;
}

export interface RiskValidationResult {
  passed: boolean;
  riskScore: number;
  adjustedQuantity?: number;
  warnings: string[];
  errors: string[];
  checks: {
    portfolioRisk: RiskCheckResult;
    concentrationRisk: RiskCheckResult;
    correlationRisk: RiskCheckResult;
    dailyLossLimit: RiskCheckResult;
    marketConditions: RiskCheckResult;
    accountBalance: RiskCheckResult;
  };
}

export interface RiskCheckResult {
  passed: boolean;
  critical: boolean;
  score: number;
  message: string;
  warnings: string[];
}

export class RiskValidator {
  private context: ModuleContext;
  private riskLimits: RiskLimits;

  constructor(context: ModuleContext, riskLimits: RiskLimits) {
    this.context = context;
    this.riskLimits = riskLimits;
  }

  async validateTradeRisk(
    params: TradeParameters
  ): Promise<RiskValidationResult> {
    try {
      const warnings: string[] = [];
      const errors: string[] = [];

      // Perform all risk checks
      const [
        portfolioRiskCheck,
        concentrationCheck,
        correlationCheck,
        dailyLossCheck,
        marketCheck,
        balanceCheck,
      ] = await Promise.all([
        this.checkPortfolioRisk(params),
        this.checkConcentrationRisk(params),
        this.checkCorrelationRisk(params),
        this.checkDailyLossLimit(params),
        this.checkMarketConditions(params),
        this.checkMinimumBalance(),
      ]);

      // Calculate overall risk score
      const riskScore = this.calculateRiskScore([
        portfolioRiskCheck,
        concentrationCheck,
        correlationCheck,
        dailyLossCheck,
        marketCheck,
        balanceCheck,
      ]);

      // Determine if trade should be rejected
      let passed = true;
      let adjustedQuantity = params.quantity;

      // Check for critical failures
      if (!portfolioRiskCheck.passed) {
        if (portfolioRiskCheck.critical) {
          errors.push(portfolioRiskCheck.message);
          passed = false;
        } else {
          warnings.push(portfolioRiskCheck.message);
        }
      }

      if (!concentrationCheck.passed) {
        if (concentrationCheck.critical) {
          errors.push(concentrationCheck.message);
          passed = false;
        } else {
          warnings.push(concentrationCheck.message);
        }
      }

      if (!correlationCheck.passed) {
        if (correlationCheck.critical) {
          errors.push(correlationCheck.message);
          passed = false;
        } else {
          warnings.push(correlationCheck.message);
        }
      }

      if (!dailyLossCheck.passed) {
        errors.push(dailyLossCheck.message);
        passed = false;
      }

      if (marketCheck.warnings.length > 0) {
        warnings.push(...marketCheck.warnings);
      }

      if (!balanceCheck.passed) {
        errors.push(balanceCheck.message);
        passed = false;
      }

      // Apply position size adjustments based on risk score
      if (riskScore > 50 && params.quoteOrderQty) {
        const adjustment = Math.max(0.5, 1 - (riskScore - 50) / 100);
        adjustedQuantity = params.quantity * adjustment;
        warnings.push(
          `Position size adjusted by ${Math.round((1 - adjustment) * 100)}% due to elevated risk`
        );
      }

      if (riskScore > 70) {
        warnings.push(
          "High risk trade - consider reducing position size or waiting for better conditions"
        );
      }

      return {
        passed,
        riskScore,
        adjustedQuantity:
          adjustedQuantity !== params.quantity ? adjustedQuantity : undefined,
        warnings,
        errors,
        checks: {
          portfolioRisk: portfolioRiskCheck,
          concentrationRisk: concentrationCheck,
          correlationRisk: correlationCheck,
          dailyLossLimit: dailyLossCheck,
          marketConditions: marketCheck,
          accountBalance: balanceCheck,
        },
      };
    } catch (error) {
      return {
        passed: false,
        riskScore: 100,
        warnings: [],
        errors: [`Risk validation failed: ${toSafeError(error).message}`],
        checks: {
          portfolioRisk: this.createFailedCheck("Portfolio risk check failed"),
          concentrationRisk: this.createFailedCheck(
            "Concentration risk check failed"
          ),
          correlationRisk: this.createFailedCheck(
            "Correlation risk check failed"
          ),
          dailyLossLimit: this.createFailedCheck(
            "Daily loss limit check failed"
          ),
          marketConditions: this.createFailedCheck(
            "Market conditions check failed"
          ),
          accountBalance: this.createFailedCheck(
            "Account balance check failed"
          ),
        },
      };
    }
  }

  private async checkPortfolioRisk(
    params: TradeParameters
  ): Promise<RiskCheckResult> {
    try {
      const currentPortfolioValue = await this.getPortfolioValue();
      const tradeValue = params.quantity * (params.price || 0);
      const portfolioRiskPercentage =
        (tradeValue / currentPortfolioValue) * 100;

      const passed =
        portfolioRiskPercentage <= this.riskLimits.maxPortfolioRisk;
      const critical =
        portfolioRiskPercentage > this.riskLimits.maxPortfolioRisk * 1.5;

      return {
        passed,
        critical,
        score: Math.min(
          100,
          (portfolioRiskPercentage / this.riskLimits.maxPortfolioRisk) * 100
        ),
        message: passed
          ? `Portfolio risk acceptable (${portfolioRiskPercentage.toFixed(2)}%)`
          : `Portfolio risk too high (${portfolioRiskPercentage.toFixed(2)}% > ${this.riskLimits.maxPortfolioRisk}%)`,
        warnings: [],
      };
    } catch (error) {
      return this.createFailedCheck(
        `Portfolio risk check failed: ${toSafeError(error).message}`
      );
    }
  }

  private async checkConcentrationRisk(
    params: TradeParameters
  ): Promise<RiskCheckResult> {
    try {
      const positions = await this.getActivePositions();
      const symbolPositions = positions.filter(
        (p) => p.symbol === params.symbol
      );
      const existingExposure = symbolPositions.reduce(
        (sum, p) => sum + p.entryPrice * p.quantity,
        0
      );
      const newExposure = params.quantity * (params.price || 0);
      const totalExposure = existingExposure + newExposure;

      const portfolioValue = await this.getPortfolioValue();
      const concentrationPercentage = (totalExposure / portfolioValue) * 100;

      const passed =
        concentrationPercentage <= this.riskLimits.maxSinglePositionRisk;
      const critical =
        concentrationPercentage > this.riskLimits.maxSinglePositionRisk * 1.5;

      return {
        passed,
        critical,
        score: Math.min(
          100,
          (concentrationPercentage / this.riskLimits.maxSinglePositionRisk) *
            100
        ),
        message: passed
          ? `Concentration risk acceptable (${concentrationPercentage.toFixed(2)}%)`
          : `Concentration risk too high (${concentrationPercentage.toFixed(2)}% > ${this.riskLimits.maxSinglePositionRisk}%)`,
        warnings: [],
      };
    } catch (error) {
      return this.createFailedCheck(
        `Concentration risk check failed: ${toSafeError(error).message}`
      );
    }
  }

  private async checkCorrelationRisk(
    params: TradeParameters
  ): Promise<RiskCheckResult> {
    try {
      const positions = await this.getActivePositions();
      const correlationRisk = await this.calculateCorrelationRisk(
        positions,
        params.symbol
      );

      const passed = correlationRisk <= this.riskLimits.maxCorrelatedExposure;
      const critical =
        correlationRisk > this.riskLimits.maxCorrelatedExposure * 1.5;

      return {
        passed,
        critical,
        score: Math.min(
          100,
          (correlationRisk / this.riskLimits.maxCorrelatedExposure) * 100
        ),
        message: passed
          ? `Correlation risk acceptable (${correlationRisk.toFixed(2)}%)`
          : `Correlation risk too high (${correlationRisk.toFixed(2)}% > ${this.riskLimits.maxCorrelatedExposure}%)`,
        warnings: [],
      };
    } catch (error) {
      return this.createFailedCheck(
        `Correlation risk check failed: ${toSafeError(error).message}`
      );
    }
  }

  private async checkDailyLossLimit(
    params: TradeParameters
  ): Promise<RiskCheckResult> {
    try {
      const dailyPnL = await this.calculateDailyPnL();
      const potential_loss = params.quantity * (params.price || 0) * 0.1; // Assume 10% max loss
      const potentialDailyLoss = Math.abs(dailyPnL) + potential_loss;

      const passed = potentialDailyLoss <= this.riskLimits.maxDailyLoss;

      return {
        passed,
        critical: !passed,
        score: Math.min(
          100,
          (potentialDailyLoss / this.riskLimits.maxDailyLoss) * 100
        ),
        message: passed
          ? `Daily loss limit acceptable (${potentialDailyLoss.toFixed(2)} USDT)`
          : `Daily loss limit exceeded (${potentialDailyLoss.toFixed(2)} > ${this.riskLimits.maxDailyLoss} USDT)`,
        warnings: [],
      };
    } catch (error) {
      return this.createFailedCheck(
        `Daily loss limit check failed: ${toSafeError(error).message}`
      );
    }
  }

  private async checkMarketConditions(
    params: TradeParameters
  ): Promise<RiskCheckResult> {
    try {
      // Simplified market conditions check
      const warnings: string[] = [];
      let riskScore = 0;

      // Check market volatility (simplified)
      const recentTrades = await this.getRecentTrades(params.symbol);
      if (recentTrades.length > 0) {
        const volatility = this.calculateVolatility(recentTrades);
        if (volatility > 0.05) {
          warnings.push("High market volatility detected");
          riskScore += 20;
        }
      }

      // Check liquidity (simplified)
      const orderBook = await this.getOrderBook(params.symbol);
      if (orderBook && orderBook.depth < 10) {
        warnings.push("Low liquidity detected");
        riskScore += 15;
      }

      return {
        passed: true,
        critical: false,
        score: riskScore,
        message:
          warnings.length > 0
            ? warnings.join(", ")
            : "Market conditions acceptable",
        warnings,
      };
    } catch (error) {
      return this.createFailedCheck(
        `Market conditions check failed: ${toSafeError(error).message}`
      );
    }
  }

  private async checkMinimumBalance(): Promise<RiskCheckResult> {
    try {
      const currentBalance = await this.getAccountBalance();
      const passed = currentBalance >= this.riskLimits.minAccountBalance;

      return {
        passed,
        critical: !passed,
        score: passed ? 0 : 100,
        message: passed
          ? `Account balance sufficient (${currentBalance.toFixed(2)} USDT)`
          : `Account balance too low (${currentBalance.toFixed(2)} < ${this.riskLimits.minAccountBalance} USDT)`,
        warnings: [],
      };
    } catch (error) {
      return this.createFailedCheck(
        `Account balance check failed: ${toSafeError(error).message}`
      );
    }
  }

  private calculateRiskScore(checks: RiskCheckResult[]): number {
    const weights = [0.3, 0.2, 0.2, 0.15, 0.1, 0.05]; // Weighted importance
    return checks.reduce((sum, check, index) => {
      const weight = weights[index] || 0.1;
      return sum + check.score * weight;
    }, 0);
  }

  private createFailedCheck(message: string): RiskCheckResult {
    return {
      passed: false,
      critical: true,
      score: 100,
      message,
      warnings: [],
    };
  }

  // Helper methods
  private async getPortfolioValue(): Promise<number> {
    try {
      const balance = await this.context.mexcService.getAccountBalance();
      return balance.totalBalance || 0;
    } catch (error) {
      this.context.logger.error("Failed to get portfolio value", { error });
      return 0;
    }
  }

  private async getActivePositions(): Promise<Position[]> {
    return Array.from(
      this.context.positionManager.getActivePositions().values()
    );
  }

  private async calculateCorrelationRisk(
    positions: Position[],
    symbol: string
  ): Promise<number> {
    // Simplified correlation calculation
    const symbolGroups = this.groupSymbolsByCategory(
      positions.map((p) => p.symbol).concat(symbol)
    );
    const maxGroupExposure = Math.max(...Object.values(symbolGroups));
    return maxGroupExposure;
  }

  private groupSymbolsByCategory(symbols: string[]): Record<string, number> {
    const groups: Record<string, number> = {};

    symbols.forEach((symbol) => {
      // Simplified categorization
      const category = symbol.includes("BTC")
        ? "Bitcoin"
        : symbol.includes("ETH")
          ? "Ethereum"
          : symbol.includes("USDT")
            ? "Stablecoin"
            : "Other";

      groups[category] = (groups[category] || 0) + 1;
    });

    return groups;
  }

  private async calculateDailyPnL(): Promise<number> {
    try {
      const trades = await this.context.mexcService.getRecentTrades();
      const today = new Date().toDateString();

      return trades
        .filter((trade) => new Date(trade.timestamp).toDateString() === today)
        .reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    } catch (error) {
      this.context.logger.error("Failed to calculate daily PnL", { error });
      return 0;
    }
  }

  private async getRecentTrades(symbol: string): Promise<any[]> {
    try {
      return await this.context.mexcService.getRecentTrades({ symbol });
    } catch (error) {
      this.context.logger.error("Failed to get recent trades", { error });
      return [];
    }
  }

  private calculateVolatility(trades: any[]): number {
    if (trades.length < 2) return 0;

    const prices = trades.map((t) => parseFloat(t.price));
    const returns = prices
      .slice(1)
      .map((price, i) => Math.log(price / prices[i]));
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) /
      returns.length;

    return Math.sqrt(variance);
  }

  private async getOrderBook(symbol: string): Promise<any> {
    try {
      return await this.context.mexcService.getOrderBook({ symbol });
    } catch (error) {
      this.context.logger.error("Failed to get order book", { error });
      return null;
    }
  }

  private async getAccountBalance(): Promise<number> {
    try {
      const balance = await this.context.mexcService.getAccountBalance();
      return balance.totalBalance || 0;
    } catch (error) {
      this.context.logger.error("Failed to get account balance", { error });
      return 0;
    }
  }
}

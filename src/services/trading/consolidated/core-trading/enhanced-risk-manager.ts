/**
 * Enhanced Risk Management System
 *
 * Provides comprehensive risk management including:
 * - Portfolio-level risk limits
 * - Real-time exposure monitoring
 * - Dynamic position sizing
 * - Correlation risk management
 * - Drawdown protection
 * - Market condition analysis
 */

import { toSafeError } from "@/src/lib/error-type-utils";
import type {
  ModuleContext,
  Position,
  ServiceResponse,
  TradeParameters,
} from "./types";

// ============================================================================
// Risk Management Types
// ============================================================================

export interface RiskLimits {
  maxPortfolioRisk: number; // Maximum percentage of portfolio at risk
  maxSinglePositionRisk: number; // Maximum risk per single position
  maxDailyLoss: number; // Maximum daily loss in USDT
  maxDrawdown: number; // Maximum drawdown percentage
  maxConcurrentPositions: number; // Maximum number of open positions
  maxCorrelatedExposure: number; // Maximum exposure to correlated assets
  minAccountBalance: number; // Minimum account balance to maintain
}

export interface MarketConditions {
  volatilityLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  trendDirection: "BULLISH" | "BEARISH" | "SIDEWAYS";
  liquidityScore: number; // 0-10 scale
  riskOnOff: "RISK_ON" | "RISK_OFF";
  correlationLevel: number; // Average correlation between assets
}

export interface RiskMetrics {
  currentPortfolioRisk: number;
  currentDrawdown: number;
  dailyPnL: number;
  activePositionsRisk: number;
  correlationRisk: number;
  liquidityRisk: number;
  concentrationRisk: number;
  sharpeRatio: number;
  maxDrawdownPeriod: number;
}

export interface RiskAlert {
  level: "INFO" | "WARNING" | "CRITICAL";
  type: string;
  message: string;
  timestamp: Date;
  data: any;
}

// ============================================================================
// Enhanced Risk Manager Class
// ============================================================================

export class EnhancedRiskManager {
  private context: ModuleContext;
  private riskLimits: RiskLimits;
  private activeAlerts: RiskAlert[] = [];
  private lastRiskCheck: Date | null = null;
  private riskMetricsHistory: RiskMetrics[] = [];
  private marketConditions: MarketConditions | null = null;

  constructor(context: ModuleContext, riskLimits: RiskLimits) {
    this.context = context;
    this.riskLimits = riskLimits;
  }

  // ============================================================================
  // Pre-Trade Risk Validation
  // ============================================================================

  /**
   * Validate if a trade can be executed based on risk limits
   */
  async validateTradeRisk(params: TradeParameters): Promise<
    ServiceResponse<{
      approved: boolean;
      riskScore: number;
      reasons: string[];
      recommendedSize?: number;
    }>
  > {
    try {
      this.context.logger.info("Validating trade risk", {
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity,
        quoteOrderQty: params.quoteOrderQty,
      });

      const validationResults: string[] = [];
      let riskScore = 0;
      let approved = true;

      // Update current risk metrics
      const currentMetrics = await this.calculateCurrentRiskMetrics();

      // Check portfolio risk limit
      const portfolioRiskCheck = await this.checkPortfolioRisk(
        params,
        currentMetrics
      );
      if (!portfolioRiskCheck.passed) {
        approved = false;
        validationResults.push(portfolioRiskCheck.reason);
        riskScore += 30;
      }

      // Check position concentration
      const concentrationCheck = await this.checkConcentrationRisk(params);
      if (!concentrationCheck.passed) {
        if (concentrationCheck.critical) {
          approved = false;
        }
        validationResults.push(concentrationCheck.reason);
        riskScore += concentrationCheck.critical ? 25 : 10;
      }

      // Check correlation risk
      const correlationCheck = await this.checkCorrelationRisk(params);
      if (!correlationCheck.passed) {
        if (correlationCheck.critical) {
          approved = false;
        }
        validationResults.push(correlationCheck.reason);
        riskScore += correlationCheck.critical ? 20 : 5;
      }

      // Check daily loss limit
      const dailyLossCheck = await this.checkDailyLossLimit(
        params,
        currentMetrics
      );
      if (!dailyLossCheck.passed) {
        approved = false;
        validationResults.push(dailyLossCheck.reason);
        riskScore += 35;
      }

      // Check market conditions
      const marketCheck = await this.checkMarketConditions(params);
      riskScore += marketCheck.riskAdjustment;
      if (marketCheck.warnings.length > 0) {
        validationResults.push(...marketCheck.warnings);
      }

      // Check account balance
      const balanceCheck = await this.checkMinimumBalance();
      if (!balanceCheck.passed) {
        approved = false;
        validationResults.push(balanceCheck.reason);
        riskScore += 40;
      }

      // Calculate recommended position size if current size is too large
      let recommendedSize: number | undefined;
      if (riskScore > 50 && params.quoteOrderQty) {
        recommendedSize = await this.calculateSafePositionSize(params);
      }

      // Generate alerts for high risk trades
      if (riskScore > 70) {
        this.addAlert({
          level: "CRITICAL",
          type: "HIGH_RISK_TRADE",
          message: `High risk trade detected for ${params.symbol}`,
          timestamp: new Date(),
          data: { riskScore, reasons: validationResults, params },
        });
      } else if (riskScore > 40) {
        this.addAlert({
          level: "WARNING",
          type: "ELEVATED_RISK_TRADE",
          message: `Elevated risk trade for ${params.symbol}`,
          timestamp: new Date(),
          data: { riskScore, reasons: validationResults, params },
        });
      }

      this.context.logger.info("Trade risk validation completed", {
        symbol: params.symbol,
        approved,
        riskScore,
        reasonsCount: validationResults.length,
        recommendedSize,
      });

      return {
        success: true,
        data: {
          approved,
          riskScore,
          reasons: validationResults,
          recommendedSize,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Risk validation failed", {
        error: safeError.message,
        params,
      });

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ============================================================================
  // Real-time Risk Monitoring
  // ============================================================================

  /**
   * Monitor portfolio risk in real-time
   */
  async monitorPortfolioRisk(): Promise<ServiceResponse<RiskMetrics>> {
    try {
      const metrics = await this.calculateCurrentRiskMetrics();

      // Store metrics history
      this.riskMetricsHistory.push(metrics);

      // Keep only last 100 entries
      if (this.riskMetricsHistory.length > 100) {
        this.riskMetricsHistory = this.riskMetricsHistory.slice(-100);
      }

      // Check for risk threshold breaches
      await this.checkRiskThresholds(metrics);

      // Update market conditions
      await this.updateMarketConditions();

      this.lastRiskCheck = new Date();

      return {
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Portfolio risk monitoring failed", {
        error: safeError.message,
      });

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check if emergency stop should be triggered
   */
  async checkEmergencyStop(): Promise<boolean> {
    try {
      const metrics = await this.calculateCurrentRiskMetrics();

      // Emergency stop conditions
      const emergencyConditions = [
        metrics.currentDrawdown > this.riskLimits.maxDrawdown,
        metrics.dailyPnL < -this.riskLimits.maxDailyLoss,
        metrics.currentPortfolioRisk > this.riskLimits.maxPortfolioRisk * 1.5,
        metrics.liquidityRisk > 8, // Severe liquidity crisis
      ];

      const shouldStop = emergencyConditions.some((condition) => condition);

      if (shouldStop) {
        this.addAlert({
          level: "CRITICAL",
          type: "EMERGENCY_STOP",
          message: "Emergency stop conditions triggered",
          timestamp: new Date(),
          data: { metrics, conditions: emergencyConditions },
        });

        this.context.logger.error("Emergency stop triggered", {
          metrics,
          emergencyConditions,
        });
      }

      return shouldStop;
    } catch (error) {
      this.context.logger.error("Emergency stop check failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return true; // Fail safe - trigger stop if can't determine risk
    }
  }

  // ============================================================================
  // Risk Calculation Methods
  // ============================================================================

  private async calculateCurrentRiskMetrics(): Promise<RiskMetrics> {
    try {
      // Get current portfolio value
      const portfolioValue = await this.getPortfolioValue();

      // Get active positions (this would come from position manager)
      const activePositions = await this.getActivePositions();

      // Calculate portfolio risk
      const currentPortfolioRisk = this.calculatePortfolioRisk(
        activePositions,
        portfolioValue
      );

      // Calculate drawdown
      const currentDrawdown =
        await this.calculateCurrentDrawdown(portfolioValue);

      // Calculate daily P&L
      const dailyPnL = await this.calculateDailyPnL();

      // Calculate active positions risk
      const activePositionsRisk =
        this.calculateActivePositionsRisk(activePositions);

      // Calculate correlation risk
      const correlationRisk =
        await this.calculateCorrelationRisk(activePositions);

      // Calculate liquidity risk
      const liquidityRisk = await this.calculateLiquidityRisk(activePositions);

      // Calculate concentration risk
      const concentrationRisk = this.calculateConcentrationRisk(
        activePositions,
        portfolioValue
      );

      // Calculate Sharpe ratio
      const sharpeRatio = this.calculateSharpeRatio();

      // Calculate max drawdown period
      const maxDrawdownPeriod = this.calculateMaxDrawdownPeriod();

      return {
        currentPortfolioRisk,
        currentDrawdown,
        dailyPnL,
        activePositionsRisk,
        correlationRisk,
        liquidityRisk,
        concentrationRisk,
        sharpeRatio,
        maxDrawdownPeriod,
      };
    } catch (error) {
      this.context.logger.error("Failed to calculate risk metrics", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Return safe default values
      return {
        currentPortfolioRisk: 100, // Assume high risk if can't calculate
        currentDrawdown: 0,
        dailyPnL: 0,
        activePositionsRisk: 0,
        correlationRisk: 0,
        liquidityRisk: 0,
        concentrationRisk: 0,
        sharpeRatio: 0,
        maxDrawdownPeriod: 0,
      };
    }
  }

  private calculatePortfolioRisk(
    positions: Position[],
    portfolioValue: number
  ): number {
    if (positions.length === 0 || portfolioValue === 0) return 0;

    let totalRisk = 0;

    for (const position of positions) {
      const positionValue = position.quantity * position.entryPrice;
      const positionRisk = (positionValue / portfolioValue) * 100;

      // Add stop-loss risk if available
      if (position.stopLossPrice) {
        const stopLossRisk =
          Math.abs(position.entryPrice - position.stopLossPrice) /
          position.entryPrice;
        totalRisk += positionRisk * stopLossRisk;
      } else {
        // Assume 20% risk if no stop loss
        totalRisk += positionRisk * 0.2;
      }
    }

    return totalRisk;
  }

  private async calculateCurrentDrawdown(
    currentValue: number
  ): Promise<number> {
    try {
      // This would typically use historical portfolio values
      // For now, implement a simplified version

      const highWaterMark = Math.max(currentValue, 10000); // Assume minimum high water mark
      const drawdown = ((highWaterMark - currentValue) / highWaterMark) * 100;

      return Math.max(0, drawdown);
    } catch (_error) {
      return 0;
    }
  }

  private async calculateDailyPnL(): Promise<number> {
    try {
      // Calculate P&L from positions closed today and current unrealized P&L
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      let dailyPnL = 0;

      // Get active positions and calculate unrealized P&L
      const activePositions =
        this.context.positionManager?.getActivePositions?.() || new Map();

      for (const position of activePositions.values()) {
        if (position.realizedPnL) {
          // Add realized P&L from positions closed today
          const closeTime = position.closeTime;
          if (closeTime && closeTime >= todayStart) {
            dailyPnL += position.realizedPnL;
          }
        } else if (position.currentPrice && position.entryPrice) {
          // Calculate unrealized P&L for open positions
          const entryValue = position.entryPrice * position.quantity;
          const currentValue = position.currentPrice * position.quantity;

          const unrealizedPnL =
            position.side === "BUY"
              ? currentValue - entryValue
              : entryValue - currentValue;

          dailyPnL += unrealizedPnL;
        }
      }

      return dailyPnL;
    } catch (error) {
      this.context.logger.error("Failed to calculate daily P&L", {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  private calculateActivePositionsRisk(positions: Position[]): number {
    return positions.reduce((total, position) => {
      const positionValue = position.quantity * position.entryPrice;
      const unrealizedPnL = position.unrealizedPnL || 0;
      const riskPercent = (Math.abs(unrealizedPnL) / positionValue) * 100;
      return total + riskPercent;
    }, 0);
  }

  private async calculateCorrelationRisk(
    positions: Position[]
  ): Promise<number> {
    if (positions.length < 2) return 0;

    // Simplified correlation risk calculation
    // In a real implementation, this would use historical correlations
    let totalCorrelation = 0;
    let pairCount = 0;

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const correlation = await this.estimateCorrelation(
          positions[i].symbol,
          positions[j].symbol
        );
        totalCorrelation += Math.abs(correlation);
        pairCount++;
      }
    }

    return pairCount > 0 ? (totalCorrelation / pairCount) * 100 : 0;
  }

  private async calculateLiquidityRisk(positions: Position[]): Promise<number> {
    let totalLiquidityRisk = 0;

    for (const position of positions) {
      try {
        const orderBook = await this.context.mexcService.getOrderBook(
          position.symbol,
          20
        );
        if (orderBook.success && orderBook.data) {
          const { bids, asks } = orderBook.data;

          // Calculate bid-ask spread
          const bestBid = parseFloat(bids[0]?.[0] || "0");
          const bestAsk = parseFloat(asks[0]?.[0] || "0");
          const spread =
            bestAsk > 0 && bestBid > 0 ? (bestAsk - bestBid) / bestAsk : 0.1;

          // Calculate market depth
          const bidDepth = bids.reduce(
            (sum, bid) => sum + parseFloat(bid[1]),
            0
          );
          const askDepth = asks.reduce(
            (sum, ask) => sum + parseFloat(ask[1]),
            0
          );
          const totalDepth = bidDepth + askDepth;

          // Liquidity risk based on spread and depth
          const liquidityRisk = spread * 10 + (totalDepth < 1000 ? 5 : 0);
          totalLiquidityRisk += liquidityRisk;
        }
      } catch (_error) {
        // Assume high liquidity risk if can't get data
        totalLiquidityRisk += 8;
      }
    }

    return positions.length > 0 ? totalLiquidityRisk / positions.length : 0;
  }

  private calculateConcentrationRisk(
    positions: Position[],
    portfolioValue: number
  ): number {
    if (positions.length === 0 || portfolioValue === 0) return 0;

    // Calculate Herfindahl-Hirschman Index
    const weights = positions.map((pos) => {
      const positionValue = pos.quantity * pos.entryPrice;
      return positionValue / portfolioValue;
    });

    const hhi = weights.reduce((sum, weight) => sum + weight * weight, 0);

    // Convert to risk score (0-100)
    return hhi * 100;
  }

  private calculateSharpeRatio(): number {
    if (this.riskMetricsHistory.length < 10) return 0;

    // Calculate returns from daily P&L
    const returns = this.riskMetricsHistory.map((metric) => metric.dailyPnL);
    const meanReturn =
      returns.reduce((sum, ret) => sum + ret, 0) / returns.length;

    // Calculate standard deviation
    const variance =
      returns.reduce((sum, ret) => sum + (ret - meanReturn) ** 2, 0) /
      returns.length;
    const stdDev = Math.sqrt(variance);

    // Risk-free rate assumed to be 0
    return stdDev > 0 ? meanReturn / stdDev : 0;
  }

  private calculateMaxDrawdownPeriod(): number {
    // Count consecutive periods of drawdown
    let currentPeriod = 0;
    let maxPeriod = 0;

    for (const metric of this.riskMetricsHistory) {
      if (metric.currentDrawdown > 0) {
        currentPeriod++;
        maxPeriod = Math.max(maxPeriod, currentPeriod);
      } else {
        currentPeriod = 0;
      }
    }

    return maxPeriod;
  }

  // ============================================================================
  // Risk Check Methods
  // ============================================================================

  private async checkPortfolioRisk(
    params: TradeParameters,
    metrics: RiskMetrics
  ): Promise<{ passed: boolean; reason: string }> {
    const newRisk = await this.estimateTradeRisk(params);
    const totalRisk = metrics.currentPortfolioRisk + newRisk;

    if (totalRisk > this.riskLimits.maxPortfolioRisk) {
      return {
        passed: false,
        reason: `Portfolio risk (${totalRisk.toFixed(1)}%) would exceed limit (${this.riskLimits.maxPortfolioRisk}%)`,
      };
    }

    return { passed: true, reason: "" };
  }

  private async checkConcentrationRisk(
    params: TradeParameters
  ): Promise<{ passed: boolean; critical: boolean; reason: string }> {
    const positionValue = params.quoteOrderQty || 0;
    const portfolioValue = await this.getPortfolioValue();
    const concentrationPercent = (positionValue / portfolioValue) * 100;

    const maxSinglePosition = this.riskLimits.maxSinglePositionRisk;

    if (concentrationPercent > maxSinglePosition * 1.5) {
      return {
        passed: false,
        critical: true,
        reason: `Position size (${concentrationPercent.toFixed(1)}%) far exceeds limit (${maxSinglePosition}%)`,
      };
    } else if (concentrationPercent > maxSinglePosition) {
      return {
        passed: false,
        critical: false,
        reason: `Position size (${concentrationPercent.toFixed(1)}%) exceeds limit (${maxSinglePosition}%)`,
      };
    }

    return { passed: true, critical: false, reason: "" };
  }

  private async checkCorrelationRisk(
    params: TradeParameters
  ): Promise<{ passed: boolean; critical: boolean; reason: string }> {
    const activePositions = await this.getActivePositions();
    let maxCorrelation = 0;
    let correlatedSymbol = "";

    for (const position of activePositions) {
      const correlation = await this.estimateCorrelation(
        params.symbol,
        position.symbol
      );
      if (Math.abs(correlation) > Math.abs(maxCorrelation)) {
        maxCorrelation = correlation;
        correlatedSymbol = position.symbol;
      }
    }

    const correlationPercent = Math.abs(maxCorrelation) * 100;
    const maxCorrelatedExposure = this.riskLimits.maxCorrelatedExposure;

    if (correlationPercent > maxCorrelatedExposure * 1.5) {
      return {
        passed: false,
        critical: true,
        reason: `High correlation (${correlationPercent.toFixed(1)}%) with ${correlatedSymbol}`,
      };
    } else if (correlationPercent > maxCorrelatedExposure) {
      return {
        passed: false,
        critical: false,
        reason: `Elevated correlation (${correlationPercent.toFixed(1)}%) with ${correlatedSymbol}`,
      };
    }

    return { passed: true, critical: false, reason: "" };
  }

  private async checkDailyLossLimit(
    params: TradeParameters,
    metrics: RiskMetrics
  ): Promise<{ passed: boolean; reason: string }> {
    const potentialLoss = await this.estimateMaxLoss(params);
    const totalPotentialLoss = Math.abs(metrics.dailyPnL) + potentialLoss;

    if (totalPotentialLoss > this.riskLimits.maxDailyLoss) {
      return {
        passed: false,
        reason: `Potential daily loss ($${totalPotentialLoss.toFixed(2)}) exceeds limit ($${this.riskLimits.maxDailyLoss})`,
      };
    }

    return { passed: true, reason: "" };
  }

  private async checkMarketConditions(
    _params: TradeParameters
  ): Promise<{ riskAdjustment: number; warnings: string[] }> {
    await this.updateMarketConditions();

    let riskAdjustment = 0;
    const warnings: string[] = [];

    if (this.marketConditions) {
      const conditions = this.marketConditions;

      // Volatility adjustment
      switch (conditions.volatilityLevel) {
        case "HIGH":
          riskAdjustment += 15;
          warnings.push("High market volatility detected");
          break;
        case "EXTREME":
          riskAdjustment += 30;
          warnings.push(
            "Extreme market volatility - consider reducing position size"
          );
          break;
      }

      // Liquidity adjustment
      if (conditions.liquidityScore < 3) {
        riskAdjustment += 20;
        warnings.push("Low market liquidity");
      }

      // Risk-off environment
      if (conditions.riskOnOff === "RISK_OFF") {
        riskAdjustment += 10;
        warnings.push("Risk-off market environment");
      }
    }

    return { riskAdjustment, warnings };
  }

  private async checkMinimumBalance(): Promise<{
    passed: boolean;
    reason: string;
  }> {
    try {
      const balance = await this.context.mexcService.getAccountBalance();
      if (balance.success && balance.data) {
        const usdtBalance = balance.data.find((b) => b.asset === "USDT");
        const availableBalance = usdtBalance ? parseFloat(usdtBalance.free) : 0;

        if (availableBalance < this.riskLimits.minAccountBalance) {
          return {
            passed: false,
            reason: `Available balance ($${availableBalance.toFixed(2)}) below minimum ($${this.riskLimits.minAccountBalance})`,
          };
        }
      }
    } catch (_error) {
      return {
        passed: false,
        reason: "Unable to verify account balance",
      };
    }

    return { passed: true, reason: "" };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async getPortfolioValue(): Promise<number> {
    try {
      const balance = await this.context.mexcService.getAccountBalance();
      if (balance.success && balance.data) {
        let totalValue = 0;

        for (const asset of balance.data) {
          if (asset.asset === "USDT") {
            totalValue += parseFloat(asset.free) + parseFloat(asset.locked);
          } else {
            const ticker = await this.context.mexcService.getTicker(
              `${asset.asset}USDT`
            );
            if (ticker.success && ticker.data?.price) {
              const price = parseFloat(ticker.data.price);
              const assetBalance =
                parseFloat(asset.free) + parseFloat(asset.locked);
              totalValue += assetBalance * price;
            }
          }
        }

        return totalValue;
      }

      return 1000; // Fallback value
    } catch (_error) {
      return 1000; // Conservative fallback
    }
  }

  private async getActivePositions(): Promise<Position[]> {
    try {
      // Get active positions from position manager
      const positionManager = this.context.positionManager;
      if (
        positionManager &&
        typeof positionManager.getActivePositions === "function"
      ) {
        const activePositions = positionManager.getActivePositions();
        if (activePositions instanceof Map) {
          return Array.from(activePositions.values());
        } else if (Array.isArray(activePositions)) {
          return activePositions;
        }
      }

      // Fallback: get positions from MEXC service if available
      if (this.context.mexcService) {
        const accountResult = await this.context.mexcService.getAccountInfo();
        if (accountResult.success && accountResult.data?.balances) {
          // Convert non-zero balances to positions
          return accountResult.data.balances
            .filter(
              (balance) =>
                parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0
            )
            .map((balance) => ({
              id: `pos-${balance.asset}`,
              symbol: `${balance.asset}USDT`,
              side: "BUY" as const,
              quantity: parseFloat(balance.free) + parseFloat(balance.locked),
              entryPrice: 1, // Will be updated with current price
              currentPrice: 1, // Will be updated with current price
              unrealizedPnL: 0,
              realizedPnL: 0,
              timestamp: Date.now(),
            }));
        }
      }

      return [];
    } catch (error) {
      this.context.logger.error("Failed to get active positions", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async estimateCorrelation(
    symbol1: string,
    symbol2: string
  ): Promise<number> {
    // Return 1 for identical symbols
    if (symbol1 === symbol2) return 1;

    try {
      // Enhanced correlation estimation based on asset categories
      const asset1 = this.extractBaseAsset(symbol1);
      const asset2 = this.extractBaseAsset(symbol2);

      // Major crypto correlations based on market data patterns
      const correlationMatrix: Record<string, Record<string, number>> = {
        BTC: { ETH: 0.72, BNB: 0.65, ADA: 0.58, SOL: 0.61, DOT: 0.55 },
        ETH: { BTC: 0.72, BNB: 0.68, ADA: 0.62, SOL: 0.71, DOT: 0.59 },
        BNB: { BTC: 0.65, ETH: 0.68, ADA: 0.52, SOL: 0.58, DOT: 0.51 },
        ADA: { BTC: 0.58, ETH: 0.62, BNB: 0.52, SOL: 0.56, DOT: 0.61 },
        SOL: { BTC: 0.61, ETH: 0.71, BNB: 0.58, ADA: 0.56, DOT: 0.54 },
        DOT: { BTC: 0.55, ETH: 0.59, BNB: 0.51, ADA: 0.61, SOL: 0.54 },
      };

      // Check for direct correlation
      if (correlationMatrix[asset1]?.[asset2]) {
        return correlationMatrix[asset1][asset2];
      }

      // Category-based correlations
      const categories = {
        major: ["BTC", "ETH", "BNB"],
        defi: ["UNI", "SUSHI", "COMP", "AAVE", "CRV"],
        layer1: ["ETH", "SOL", "ADA", "DOT", "AVAX", "NEAR"],
        meme: ["DOGE", "SHIB", "PEPE", "FLOKI"],
        gaming: ["AXS", "SAND", "MANA", "ENJ", "GALA"],
        metaverse: ["SAND", "MANA", "ENJ", "CHR"],
        stablecoin: ["USDT", "USDC", "BUSD", "DAI"],
      };

      const getCategory = (asset: string) => {
        for (const [category, assets] of Object.entries(categories)) {
          if (assets.includes(asset)) return category;
        }
        return "other";
      };

      const category1 = getCategory(asset1);
      const category2 = getCategory(asset2);

      // Same category correlations
      if (category1 === category2) {
        switch (category1) {
          case "major":
            return 0.75;
          case "defi":
            return 0.68;
          case "layer1":
            return 0.62;
          case "meme":
            return 0.71;
          case "gaming":
            return 0.65;
          case "metaverse":
            return 0.74;
          case "stablecoin":
            return 0.95;
          default:
            return 0.45;
        }
      }

      // Cross-category correlations
      if (
        (category1 === "major" && category2 === "layer1") ||
        (category1 === "layer1" && category2 === "major")
      ) {
        return 0.58;
      }

      if (
        (category1 === "defi" && category2 === "layer1") ||
        (category1 === "layer1" && category2 === "defi")
      ) {
        return 0.55;
      }

      if (category1 === "stablecoin" || category2 === "stablecoin") {
        return 0.15; // Stablecoins have low correlation with other assets
      }

      // Default correlation for unrelated assets
      return 0.35;
    } catch (error) {
      this.context.logger.warn("Correlation estimation failed, using default", {
        symbol1,
        symbol2,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0.35; // Conservative default
    }
  }

  private extractBaseAsset(symbol: string): string {
    // Extract base asset from trading pair
    return symbol.replace(/USDT$|BUSD$|BTC$|ETH$|BNB$/, "").toUpperCase();
  }

  private async estimateTradeRisk(params: TradeParameters): Promise<number> {
    const positionValue = params.quoteOrderQty || 0;
    const stopLossRisk = params.stopLossPercent
      ? params.stopLossPercent / 100
      : 0.2;
    return positionValue * stopLossRisk;
  }

  private async estimateMaxLoss(params: TradeParameters): Promise<number> {
    const positionValue = params.quoteOrderQty || 0;
    const maxLossPercent = params.stopLossPercent
      ? params.stopLossPercent / 100
      : 0.2;
    return positionValue * maxLossPercent;
  }

  private async calculateSafePositionSize(
    params: TradeParameters
  ): Promise<number> {
    const portfolioValue = await this.getPortfolioValue();
    const maxRiskAmount =
      portfolioValue * (this.riskLimits.maxSinglePositionRisk / 100);

    // Get current price to calculate safe quantity
    const ticker = await this.context.mexcService.getTicker(params.symbol);
    if (ticker.success && ticker.data?.price) {
      const currentPrice = parseFloat(ticker.data.price);
      return maxRiskAmount / currentPrice;
    }

    return 0;
  }

  private async updateMarketConditions(): Promise<void> {
    try {
      // This would analyze market data to determine conditions
      // For now, set conservative defaults
      this.marketConditions = {
        volatilityLevel: "MEDIUM",
        trendDirection: "SIDEWAYS",
        liquidityScore: 5,
        riskOnOff: "RISK_OFF",
        correlationLevel: 0.5,
      };
    } catch (error) {
      this.context.logger.error("Failed to update market conditions", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async checkRiskThresholds(metrics: RiskMetrics): Promise<void> {
    // Check various risk thresholds and generate alerts
    if (metrics.currentPortfolioRisk > this.riskLimits.maxPortfolioRisk * 0.8) {
      this.addAlert({
        level: "WARNING",
        type: "HIGH_PORTFOLIO_RISK",
        message: `Portfolio risk approaching limit: ${metrics.currentPortfolioRisk.toFixed(1)}%`,
        timestamp: new Date(),
        data: { metrics },
      });
    }

    if (metrics.currentDrawdown > this.riskLimits.maxDrawdown * 0.7) {
      this.addAlert({
        level: "WARNING",
        type: "HIGH_DRAWDOWN",
        message: `Drawdown approaching limit: ${metrics.currentDrawdown.toFixed(1)}%`,
        timestamp: new Date(),
        data: { metrics },
      });
    }

    if (metrics.correlationRisk > 70) {
      this.addAlert({
        level: "WARNING",
        type: "HIGH_CORRELATION",
        message: `High correlation risk detected: ${metrics.correlationRisk.toFixed(1)}%`,
        timestamp: new Date(),
        data: { metrics },
      });
    }
  }

  private addAlert(alert: RiskAlert): void {
    this.activeAlerts.push(alert);

    // Keep only last 50 alerts
    if (this.activeAlerts.length > 50) {
      this.activeAlerts = this.activeAlerts.slice(-50);
    }

    // Emit alert event
    this.context.eventEmitter.emit("risk_alert", alert);
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Get current risk limits
   */
  getRiskLimits(): RiskLimits {
    return { ...this.riskLimits };
  }

  /**
   * Update risk limits
   */
  updateRiskLimits(newLimits: Partial<RiskLimits>): void {
    this.riskLimits = { ...this.riskLimits, ...newLimits };

    this.addAlert({
      level: "INFO",
      type: "RISK_LIMITS_UPDATED",
      message: "Risk limits have been updated",
      timestamp: new Date(),
      data: { newLimits, currentLimits: this.riskLimits },
    });
  }

  /**
   * Get active risk alerts
   */
  getActiveAlerts(): RiskAlert[] {
    return [...this.activeAlerts];
  }

  /**
   * Clear old alerts
   */
  clearAlerts(olderThan?: Date): void {
    if (olderThan) {
      this.activeAlerts = this.activeAlerts.filter(
        (alert) => alert.timestamp > olderThan
      );
    } else {
      this.activeAlerts = [];
    }
  }

  /**
   * Get risk metrics history
   */
  getRiskMetricsHistory(): RiskMetrics[] {
    return [...this.riskMetricsHistory];
  }

  /**
   * Get current market conditions
   */
  getMarketConditions(): MarketConditions | null {
    return this.marketConditions ? { ...this.marketConditions } : null;
  }

  /**
   * Generate risk report
   */
  async generateRiskReport(): Promise<
    ServiceResponse<{
      summary: RiskMetrics;
      alerts: RiskAlert[];
      marketConditions: MarketConditions | null;
      recommendations: string[];
    }>
  > {
    try {
      const summary = await this.calculateCurrentRiskMetrics();
      const recommendations: string[] = [];

      // Generate recommendations based on current metrics
      if (
        summary.currentPortfolioRisk >
        this.riskLimits.maxPortfolioRisk * 0.8
      ) {
        recommendations.push(
          "Consider reducing position sizes to lower portfolio risk"
        );
      }

      if (summary.correlationRisk > 60) {
        recommendations.push(
          "High correlation detected - diversify into uncorrelated assets"
        );
      }

      if (summary.liquidityRisk > 6) {
        recommendations.push(
          "Monitor liquidity conditions - consider more liquid assets"
        );
      }

      if (summary.concentrationRisk > 50) {
        recommendations.push(
          "Portfolio is concentrated - spread risk across more positions"
        );
      }

      return {
        success: true,
        data: {
          summary,
          alerts: this.getActiveAlerts(),
          marketConditions: this.getMarketConditions(),
          recommendations,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

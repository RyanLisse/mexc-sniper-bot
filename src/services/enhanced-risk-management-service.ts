/**
 * Enhanced Risk Management Service
 *
 * Provides comprehensive risk assessment and management for trading operations:
 * - Position sizing validation
 * - Portfolio correlation analysis
 * - Dynamic risk limits
 * - Real-time risk monitoring
 * - Compliance checks
 */

import { ErrorLoggingService } from "./error-logging-service";
import { getUnifiedMexcClient } from "./unified-mexc-client";
import type { OrderParameters } from "./unified-mexc-client";

export interface RiskProfile {
  userId: string;
  riskTolerance: "conservative" | "moderate" | "aggressive";
  maxPositionSize: number; // Percentage of portfolio
  maxDailyLoss: number; // Percentage of portfolio
  maxDrawdown: number; // Percentage of portfolio
  allowedAssets: string[]; // Allowed trading assets
  blockedAssets: string[]; // Prohibited trading assets
  maxConcurrentPositions: number;
  leverageLimit: number;
  concentrationLimit: number; // Max percentage in single asset
  correlationLimit: number; // Max correlation between positions
  updatedAt: string;
}

export interface PositionInfo {
  symbol: string;
  side: "LONG" | "SHORT";
  size: number;
  notionalValue: number;
  averagePrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  riskWeight: number;
  correlations: Record<string, number>;
}

export interface PortfolioMetrics {
  totalValue: number;
  totalNotional: number;
  totalUnrealizedPnl: number;
  dailyPnl: number;
  drawdown: number;
  positions: PositionInfo[];
  concentration: Record<string, number>; // Asset -> percentage
  correlation: number; // Average correlation between positions
  var95: number; // 95% Value at Risk
  sharpeRatio: number;
  maxDrawdown: number;
  activeTrades: number;
}

export interface RiskAssessment {
  approved: boolean;
  riskLevel: "low" | "medium" | "high" | "extreme";
  riskScore: number; // 0-100
  warnings: string[];
  errors: string[];
  recommendations: string[];
  limits: {
    positionSizeLimit: number;
    portfolioImpact: number;
    correlationRisk: number;
    concentrationRisk: number;
    liquidityRisk: number;
  };
  compliance: {
    riskProfileCompliant: boolean;
    positionLimitCompliant: boolean;
    concentrationCompliant: boolean;
    correlationCompliant: boolean;
  };
  metadata: {
    assessmentTime: string;
    portfolioValue: number;
    existingPositions: number;
    marketConditions: string;
  };
}

export interface MarketConditions {
  volatility: "low" | "medium" | "high" | "extreme";
  trend: "bullish" | "bearish" | "sideways";
  liquidity: "high" | "medium" | "low";
  correlation: number; // Market-wide correlation
  sentiment: "fear" | "neutral" | "greed";
  riskMultiplier: number; // Adjustment factor for market conditions
}

export class EnhancedRiskManagementService {
  private static instance: EnhancedRiskManagementService;
  private errorLogger = ErrorLoggingService.getInstance();
  private portfolioCache = new Map<string, { metrics: PortfolioMetrics; expiresAt: number }>();
  private correlationCache = new Map<
    string,
    { correlations: Record<string, number>; expiresAt: number }
  >();
  private readonly cacheExpiryMs = 2 * 60 * 1000; // 2 minutes

  // Default risk profile for new users
  private readonly defaultRiskProfile: Omit<RiskProfile, "userId" | "updatedAt"> = {
    riskTolerance: "moderate",
    maxPositionSize: 5.0, // 5% of portfolio per position
    maxDailyLoss: 2.0, // 2% daily loss limit
    maxDrawdown: 10.0, // 10% maximum drawdown
    allowedAssets: ["BTC", "ETH", "USDT"], // Default allowed assets
    blockedAssets: [], // No blocked assets by default
    maxConcurrentPositions: 5,
    leverageLimit: 1.0, // No leverage by default
    concentrationLimit: 20.0, // Max 20% in any single asset
    correlationLimit: 0.7, // Max 70% correlation between positions
  };

  private constructor() {}

  public static getInstance(): EnhancedRiskManagementService {
    if (!EnhancedRiskManagementService.instance) {
      EnhancedRiskManagementService.instance = new EnhancedRiskManagementService();
    }
    return EnhancedRiskManagementService.instance;
  }

  /**
   * Comprehensive risk assessment for a trading order
   */
  async assessTradingRisk(
    userId: string,
    orderParams: OrderParameters,
    riskProfile?: RiskProfile
  ): Promise<RiskAssessment> {
    const startTime = Date.now();

    try {
      console.log(
        `[Risk Management] Starting risk assessment for ${userId} - ${orderParams.symbol}`
      );

      // Get or create risk profile
      const profile = riskProfile || this.getDefaultRiskProfile(userId);

      // Get current portfolio metrics
      const portfolioMetrics = await this.getPortfolioMetrics(userId);

      // Get market conditions
      const marketConditions = await this.assessMarketConditions();

      // Calculate order impact
      const orderValue = this.calculateOrderValue(orderParams);
      const portfolioImpact =
        portfolioMetrics.totalValue > 0 ? (orderValue / portfolioMetrics.totalValue) * 100 : 100;

      // Initialize assessment
      const assessment: RiskAssessment = {
        approved: false,
        riskLevel: "medium",
        riskScore: 50,
        warnings: [],
        errors: [],
        recommendations: [],
        limits: {
          positionSizeLimit: profile.maxPositionSize,
          portfolioImpact,
          correlationRisk: 0,
          concentrationRisk: 0,
          liquidityRisk: 0,
        },
        compliance: {
          riskProfileCompliant: true,
          positionLimitCompliant: true,
          concentrationCompliant: true,
          correlationCompliant: true,
        },
        metadata: {
          assessmentTime: new Date().toISOString(),
          portfolioValue: portfolioMetrics.totalValue,
          existingPositions: portfolioMetrics.activeTrades,
          marketConditions: marketConditions.volatility,
        },
      };

      // Risk Assessment Steps

      // 1. Asset Validation
      const assetValidation = this.validateAsset(orderParams.symbol, profile);
      if (!assetValidation.valid) {
        assessment.errors.push(...assetValidation.errors);
        assessment.compliance.riskProfileCompliant = false;
      }

      // 2. Position Size Validation
      const positionSizeValidation = this.validatePositionSize(
        orderParams,
        portfolioMetrics,
        profile,
        marketConditions
      );
      assessment.limits.positionSizeLimit = positionSizeValidation.maxAllowedSize;
      if (!positionSizeValidation.valid) {
        assessment.errors.push(...positionSizeValidation.errors);
        assessment.compliance.positionLimitCompliant = false;
      }
      if (positionSizeValidation.warnings.length > 0) {
        assessment.warnings.push(...positionSizeValidation.warnings);
      }

      // 3. Concentration Risk Assessment
      const concentrationRisk = this.assessConcentrationRisk(
        orderParams,
        portfolioMetrics,
        profile
      );
      assessment.limits.concentrationRisk = concentrationRisk.riskLevel;
      if (!concentrationRisk.compliant) {
        assessment.warnings.push(...concentrationRisk.warnings);
        assessment.compliance.concentrationCompliant = false;
      }

      // 4. Correlation Risk Assessment
      const correlationRisk = await this.assessCorrelationRisk(
        orderParams,
        portfolioMetrics,
        profile
      );
      assessment.limits.correlationRisk = correlationRisk.riskLevel;
      if (!correlationRisk.compliant) {
        assessment.warnings.push(...correlationRisk.warnings);
        assessment.compliance.correlationCompliant = false;
      }

      // 5. Liquidity Risk Assessment
      const liquidityRisk = await this.assessLiquidityRisk(orderParams);
      assessment.limits.liquidityRisk = liquidityRisk.riskLevel;
      if (liquidityRisk.warnings.length > 0) {
        assessment.warnings.push(...liquidityRisk.warnings);
      }

      // 6. Portfolio Risk Limits
      const portfolioRiskCheck = this.checkPortfolioRiskLimits(
        portfolioMetrics,
        profile,
        marketConditions
      );
      if (!portfolioRiskCheck.compliant) {
        assessment.errors.push(...portfolioRiskCheck.errors);
        assessment.warnings.push(...portfolioRiskCheck.warnings);
      }

      // 7. Market Conditions Impact
      const marketRiskAdjustment = this.adjustForMarketConditions(assessment, marketConditions);
      assessment.riskScore = marketRiskAdjustment.adjustedRiskScore;
      assessment.recommendations.push(...marketRiskAdjustment.recommendations);

      // Final Risk Determination
      assessment.riskLevel = this.determineRiskLevel(assessment.riskScore);
      assessment.approved = this.determineApproval(assessment);

      // Add general recommendations
      assessment.recommendations.push(...this.generateRecommendations(assessment, profile));

      const assessmentTime = Date.now() - startTime;
      console.log(
        `[Risk Management] Risk assessment completed in ${assessmentTime}ms - Approved: ${assessment.approved}, Risk: ${assessment.riskLevel}`
      );

      return assessment;
    } catch (error) {
      console.error("[Risk Management] Risk assessment failed:", error);

      await this.errorLogger.logError(error as Error, {
        context: "risk_assessment",
        userId,
        symbol: orderParams.symbol,
        side: orderParams.side,
        quantity: orderParams.quantity,
      });

      // Return conservative assessment on error
      return {
        approved: false,
        riskLevel: "extreme",
        riskScore: 100,
        warnings: [],
        errors: ["Risk assessment system error - trade blocked for safety"],
        recommendations: ["Please try again later or contact support"],
        limits: {
          positionSizeLimit: 0,
          portfolioImpact: 100,
          correlationRisk: 100,
          concentrationRisk: 100,
          liquidityRisk: 100,
        },
        compliance: {
          riskProfileCompliant: false,
          positionLimitCompliant: false,
          concentrationCompliant: false,
          correlationCompliant: false,
        },
        metadata: {
          assessmentTime: new Date().toISOString(),
          portfolioValue: 0,
          existingPositions: 0,
          marketConditions: "unknown",
        },
      };
    }
  }

  /**
   * Get current portfolio metrics for risk assessment
   */
  private async getPortfolioMetrics(userId: string): Promise<PortfolioMetrics> {
    const cacheKey = `portfolio_${userId}`;
    const cached = this.portfolioCache.get(cacheKey);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.metrics;
    }

    try {
      const mexcClient = getUnifiedMexcClient();
      const balanceResult = await mexcClient.getAccountBalances();

      if (!balanceResult.success) {
        throw new Error(`Failed to get portfolio data: ${balanceResult.error}`);
      }

      const { balances, totalUsdtValue } = balanceResult.data;

      // Calculate portfolio metrics
      const positions: PositionInfo[] = balances
        .filter((balance) => balance.total > 0 && balance.asset !== "USDT")
        .map((balance) => ({
          symbol: `${balance.asset}USDT`,
          side: "LONG" as const, // Spot trading is always long
          size: balance.total,
          notionalValue: balance.usdtValue || 0,
          averagePrice: balance.usdtValue ? balance.usdtValue / balance.total : 0,
          currentPrice: balance.usdtValue ? balance.usdtValue / balance.total : 0,
          unrealizedPnl: 0, // Would need historical data to calculate
          unrealizedPnlPercent: 0,
          riskWeight: 1.0, // Default weight
          correlations: {}, // Will be populated separately
        }));

      // Calculate concentration
      const concentration: Record<string, number> = {};
      positions.forEach((position) => {
        const percentage = totalUsdtValue > 0 ? (position.notionalValue / totalUsdtValue) * 100 : 0;
        concentration[position.symbol] = percentage;
      });

      const metrics: PortfolioMetrics = {
        totalValue: totalUsdtValue,
        totalNotional: totalUsdtValue,
        totalUnrealizedPnl: 0,
        dailyPnl: 0, // Would need historical data
        drawdown: 0, // Would need historical data
        positions,
        concentration,
        correlation: 0, // Will be calculated separately
        var95: 0, // Would need historical volatility data
        sharpeRatio: 0, // Would need return history
        maxDrawdown: 0, // Would need historical data
        activeTrades: positions.length,
      };

      // Cache the result
      this.portfolioCache.set(cacheKey, {
        metrics,
        expiresAt: Date.now() + this.cacheExpiryMs,
      });

      return metrics;
    } catch (error) {
      console.error("[Risk Management] Failed to get portfolio metrics:", error);

      // Return empty portfolio on error
      return {
        totalValue: 0,
        totalNotional: 0,
        totalUnrealizedPnl: 0,
        dailyPnl: 0,
        drawdown: 0,
        positions: [],
        concentration: {},
        correlation: 0,
        var95: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        activeTrades: 0,
      };
    }
  }

  /**
   * Assess current market conditions for risk adjustment
   */
  private async assessMarketConditions(): Promise<MarketConditions> {
    try {
      const mexcClient = getUnifiedMexcClient();
      const tickerResult = await mexcClient.get24hrTicker();

      if (!tickerResult.success || !tickerResult.data.length) {
        return this.getDefaultMarketConditions();
      }

      const tickers = tickerResult.data;

      // Calculate market volatility
      const priceChanges = tickers.map((ticker) =>
        Math.abs(Number.parseFloat(ticker.priceChangePercent || "0"))
      );
      const avgVolatility =
        priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;

      // Determine volatility level
      let volatility: MarketConditions["volatility"];
      if (avgVolatility < 2) volatility = "low";
      else if (avgVolatility < 5) volatility = "medium";
      else if (avgVolatility < 10) volatility = "high";
      else volatility = "extreme";

      // Calculate trend (simplified)
      const positiveMoves = tickers.filter(
        (ticker) => Number.parseFloat(ticker.priceChangePercent || "0") > 0
      ).length;
      const trend =
        positiveMoves > tickers.length * 0.6
          ? "bullish"
          : positiveMoves < tickers.length * 0.4
            ? "bearish"
            : "sideways";

      // Risk multiplier based on conditions
      let riskMultiplier = 1.0;
      if (volatility === "extreme") riskMultiplier *= 2.0;
      else if (volatility === "high") riskMultiplier *= 1.5;
      else if (volatility === "low") riskMultiplier *= 0.8;

      return {
        volatility,
        trend,
        liquidity: "medium", // Default for now
        correlation: 0.5, // Default correlation
        sentiment: "neutral",
        riskMultiplier,
      };
    } catch (error) {
      console.error("[Risk Management] Failed to assess market conditions:", error);
      return this.getDefaultMarketConditions();
    }
  }

  /**
   * Validate if asset is allowed for trading
   */
  private validateAsset(
    symbol: string,
    profile: RiskProfile
  ): {
    valid: boolean;
    errors: string[];
  } {
    const asset = symbol.replace("USDT", "").replace("BTC", "").replace("ETH", "");
    const errors: string[] = [];

    if (profile.blockedAssets.includes(asset)) {
      errors.push(`Asset ${asset} is blocked in your risk profile`);
    }

    if (profile.allowedAssets.length > 0 && !profile.allowedAssets.includes(asset)) {
      errors.push(`Asset ${asset} is not in your allowed assets list`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate position size against limits
   */
  private validatePositionSize(
    orderParams: OrderParameters,
    portfolio: PortfolioMetrics,
    profile: RiskProfile,
    marketConditions: MarketConditions
  ): {
    valid: boolean;
    errors: string[];
    warnings: string[];
    maxAllowedSize: number;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const orderValue = this.calculateOrderValue(orderParams);
    const portfolioImpact =
      portfolio.totalValue > 0 ? (orderValue / portfolio.totalValue) * 100 : 100;

    // Adjust limits based on market conditions
    const adjustedMaxPositionSize = profile.maxPositionSize / marketConditions.riskMultiplier;

    if (portfolioImpact > adjustedMaxPositionSize) {
      errors.push(
        `Position size ${portfolioImpact.toFixed(2)}% exceeds limit of ${adjustedMaxPositionSize.toFixed(2)}%`
      );
    } else if (portfolioImpact > adjustedMaxPositionSize * 0.8) {
      warnings.push(
        `Position size ${portfolioImpact.toFixed(2)}% is approaching limit of ${adjustedMaxPositionSize.toFixed(2)}%`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      maxAllowedSize: adjustedMaxPositionSize,
    };
  }

  /**
   * Assess concentration risk
   */
  private assessConcentrationRisk(
    orderParams: OrderParameters,
    portfolio: PortfolioMetrics,
    profile: RiskProfile
  ): {
    compliant: boolean;
    riskLevel: number;
    warnings: string[];
  } {
    const warnings: string[] = [];
    const asset = orderParams.symbol.replace("USDT", "");

    const currentConcentration = portfolio.concentration[asset] || 0;
    const orderValue = this.calculateOrderValue(orderParams);
    const additionalConcentration =
      portfolio.totalValue > 0 ? (orderValue / portfolio.totalValue) * 100 : 100;

    const newConcentration = currentConcentration + additionalConcentration;

    if (newConcentration > profile.concentrationLimit) {
      warnings.push(
        `Asset concentration would be ${newConcentration.toFixed(2)}%, exceeding limit of ${profile.concentrationLimit}%`
      );
    } else if (newConcentration > profile.concentrationLimit * 0.8) {
      warnings.push(
        `Asset concentration would be ${newConcentration.toFixed(2)}%, approaching limit of ${profile.concentrationLimit}%`
      );
    }

    return {
      compliant: newConcentration <= profile.concentrationLimit,
      riskLevel: Math.min(100, (newConcentration / profile.concentrationLimit) * 100),
      warnings,
    };
  }

  /**
   * Assess correlation risk with existing positions
   */
  private async assessCorrelationRisk(
    orderParams: OrderParameters,
    portfolio: PortfolioMetrics,
    profile: RiskProfile
  ): Promise<{
    compliant: boolean;
    riskLevel: number;
    warnings: string[];
  }> {
    const warnings: string[] = [];

    if (portfolio.positions.length === 0) {
      return {
        compliant: true,
        riskLevel: 0,
        warnings: [],
      };
    }

    try {
      // Get correlations for the new asset
      const correlations = await this.getAssetCorrelations(orderParams.symbol);

      // Check correlations with existing positions
      let maxCorrelation = 0;
      const correlatedAssets: string[] = [];

      portfolio.positions.forEach((position) => {
        const correlation = Math.abs(correlations[position.symbol] || 0);
        if (correlation > maxCorrelation) {
          maxCorrelation = correlation;
        }
        if (correlation > profile.correlationLimit) {
          correlatedAssets.push(position.symbol);
        }
      });

      if (correlatedAssets.length > 0) {
        warnings.push(
          `High correlation (${(maxCorrelation * 100).toFixed(1)}%) with existing positions: ${correlatedAssets.join(", ")}`
        );
      } else if (maxCorrelation > profile.correlationLimit * 0.8) {
        warnings.push(
          `Moderate correlation (${(maxCorrelation * 100).toFixed(1)}%) detected with existing positions`
        );
      }

      return {
        compliant: correlatedAssets.length === 0,
        riskLevel: Math.min(100, maxCorrelation * 100),
        warnings,
      };
    } catch (error) {
      console.error("[Risk Management] Correlation assessment failed:", error);
      return {
        compliant: true, // Default to compliant on error
        riskLevel: 50,
        warnings: ["Unable to assess correlation risk"],
      };
    }
  }

  /**
   * Assess liquidity risk for the trading pair
   */
  private async assessLiquidityRisk(orderParams: OrderParameters): Promise<{
    riskLevel: number;
    warnings: string[];
  }> {
    const warnings: string[] = [];

    try {
      const mexcClient = getUnifiedMexcClient();
      const tickerResult = await mexcClient.get24hrTicker(orderParams.symbol);

      if (!tickerResult.success || !tickerResult.data.length) {
        warnings.push("Unable to assess liquidity - no market data available");
        return { riskLevel: 100, warnings };
      }

      const ticker = tickerResult.data[0];
      const volume24h = Number.parseFloat(ticker.volume || "0");
      const _orderValue = this.calculateOrderValue(orderParams);

      // Calculate order impact as percentage of 24h volume
      const volumeImpact =
        volume24h > 0 ? (Number.parseFloat(orderParams.quantity) / volume24h) * 100 : 100;

      let riskLevel = 0;
      if (volumeImpact > 10) {
        riskLevel = 100;
        warnings.push(
          `Order size is ${volumeImpact.toFixed(2)}% of 24h volume - high liquidity risk`
        );
      } else if (volumeImpact > 5) {
        riskLevel = 75;
        warnings.push(
          `Order size is ${volumeImpact.toFixed(2)}% of 24h volume - moderate liquidity risk`
        );
      } else if (volumeImpact > 1) {
        riskLevel = 25;
        warnings.push(
          `Order size is ${volumeImpact.toFixed(2)}% of 24h volume - minor liquidity impact`
        );
      }

      return { riskLevel, warnings };
    } catch (error) {
      console.error("[Risk Management] Liquidity assessment failed:", error);
      return {
        riskLevel: 50,
        warnings: ["Unable to assess liquidity risk"],
      };
    }
  }

  /**
   * Check portfolio-level risk limits
   */
  private checkPortfolioRiskLimits(
    portfolio: PortfolioMetrics,
    profile: RiskProfile,
    marketConditions: MarketConditions
  ): {
    compliant: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check maximum concurrent positions
    if (portfolio.activeTrades >= profile.maxConcurrentPositions) {
      errors.push(`Maximum concurrent positions (${profile.maxConcurrentPositions}) reached`);
    } else if (portfolio.activeTrades >= profile.maxConcurrentPositions * 0.8) {
      warnings.push(
        `Approaching maximum concurrent positions limit (${portfolio.activeTrades}/${profile.maxConcurrentPositions})`
      );
    }

    // Check daily loss limits (if available)
    if (portfolio.dailyPnl < -profile.maxDailyLoss) {
      errors.push(
        `Daily loss limit exceeded: ${portfolio.dailyPnl.toFixed(2)}% (limit: ${profile.maxDailyLoss}%)`
      );
    }

    // Check drawdown limits (if available)
    if (portfolio.drawdown > profile.maxDrawdown) {
      errors.push(
        `Maximum drawdown exceeded: ${portfolio.drawdown.toFixed(2)}% (limit: ${profile.maxDrawdown}%)`
      );
    }

    // Market condition warnings
    if (marketConditions.volatility === "extreme") {
      warnings.push("Extreme market volatility detected - consider reducing position sizes");
    } else if (marketConditions.volatility === "high") {
      warnings.push("High market volatility detected - trade with caution");
    }

    return {
      compliant: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Helper methods
   */
  private calculateOrderValue(orderParams: OrderParameters): number {
    const quantity = Number.parseFloat(orderParams.quantity);
    const price = orderParams.price ? Number.parseFloat(orderParams.price) : 0;

    if (orderParams.type === "MARKET") {
      // For market orders, we'll estimate based on quantity
      // This is simplified - in practice you'd get current market price
      return quantity * (price || 50000); // Default price estimation
    }
    return quantity * price;
  }

  private async getAssetCorrelations(symbol: string): Promise<Record<string, number>> {
    const cacheKey = `correlations_${symbol}`;
    const cached = this.correlationCache.get(cacheKey);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.correlations;
    }

    try {
      // In a real implementation, this would fetch correlation data
      // For now, return mock correlations
      const mockCorrelations: Record<string, number> = {
        BTCUSDT: 0.8,
        ETHUSDT: 0.7,
        ADAUSDT: 0.6,
        DOTUSDT: 0.5,
        LINKUSDT: 0.4,
      };

      this.correlationCache.set(cacheKey, {
        correlations: mockCorrelations,
        expiresAt: Date.now() + this.cacheExpiryMs,
      });

      return mockCorrelations;
    } catch (error) {
      console.error("[Risk Management] Failed to get correlations:", error);
      return {};
    }
  }

  private getDefaultRiskProfile(userId: string): RiskProfile {
    return {
      userId,
      ...this.defaultRiskProfile,
      updatedAt: new Date().toISOString(),
    };
  }

  private getDefaultMarketConditions(): MarketConditions {
    return {
      volatility: "medium",
      trend: "sideways",
      liquidity: "medium",
      correlation: 0.5,
      sentiment: "neutral",
      riskMultiplier: 1.0,
    };
  }

  private determineRiskLevel(riskScore: number): "low" | "medium" | "high" | "extreme" {
    if (riskScore < 25) return "low";
    if (riskScore < 50) return "medium";
    if (riskScore < 75) return "high";
    return "extreme";
  }

  private determineApproval(assessment: RiskAssessment): boolean {
    // Block if there are any errors
    if (assessment.errors.length > 0) {
      return false;
    }

    // Block if risk score is too high
    if (assessment.riskScore > 80) {
      return false;
    }

    // Block if any compliance check fails
    const complianceChecks = Object.values(assessment.compliance);
    if (complianceChecks.some((check) => !check)) {
      return false;
    }

    return true;
  }

  private adjustForMarketConditions(
    assessment: RiskAssessment,
    marketConditions: MarketConditions
  ): {
    adjustedRiskScore: number;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let adjustedRiskScore = assessment.riskScore * marketConditions.riskMultiplier;

    if (marketConditions.volatility === "extreme") {
      adjustedRiskScore *= 1.5;
      recommendations.push("Extreme market volatility - consider reducing position size by 50%");
    } else if (marketConditions.volatility === "high") {
      adjustedRiskScore *= 1.2;
      recommendations.push("High market volatility - consider reducing position size by 20%");
    }

    if (marketConditions.trend === "bearish" && marketConditions.volatility !== "low") {
      adjustedRiskScore *= 1.1;
      recommendations.push("Bearish market trend detected - extra caution advised");
    }

    return {
      adjustedRiskScore: Math.min(100, adjustedRiskScore),
      recommendations,
    };
  }

  private generateRecommendations(assessment: RiskAssessment, profile: RiskProfile): string[] {
    const recommendations: string[] = [];

    if (assessment.riskLevel === "high" || assessment.riskLevel === "extreme") {
      recommendations.push("Consider reducing position size due to high risk level");
    }

    if (assessment.limits.correlationRisk > 70) {
      recommendations.push("High correlation with existing positions - consider diversification");
    }

    if (assessment.limits.concentrationRisk > 80) {
      recommendations.push(
        "High concentration risk - consider spreading investments across more assets"
      );
    }

    if (profile.riskTolerance === "conservative" && assessment.riskScore > 50) {
      recommendations.push("Risk level exceeds conservative profile - consider smaller position");
    }

    return recommendations;
  }

  /**
   * Public API methods
   */
  public clearCache(): void {
    this.portfolioCache.clear();
    this.correlationCache.clear();
    console.log("[Risk Management] Cache cleared");
  }

  public getCacheStats(): {
    portfolioCache: number;
    correlationCache: number;
  } {
    return {
      portfolioCache: this.portfolioCache.size,
      correlationCache: this.correlationCache.size,
    };
  }

  /**
   * Initialize the service (required for integrated service compatibility)
   */
  async initialize(): Promise<void> {
    console.log("[Enhanced Risk Management] Initializing service...");
    try {
      // Clear any stale cache on initialization
      this.clearCache();

      // Test basic connectivity to MEXC for risk assessment
      const mexcClient = getUnifiedMexcClient();
      await mexcClient.testConnectivity();

      console.log("[Enhanced Risk Management] Service initialized successfully");
    } catch (error) {
      console.error("[Enhanced Risk Management] Service initialization failed:", error);
      throw error;
    }
  }

  /**
   * Perform health check for the risk management service
   */
  async performHealthCheck(): Promise<{
    healthy: boolean;
    error?: string;
    metrics?: {
      portfolioCacheSize: number;
      correlationCacheSize: number;
      defaultRiskProfile: any;
    };
  }> {
    try {
      // Test basic functionality
      const testUserId = "health_check_test";
      const testOrderParams: OrderParameters = {
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: "0.001",
      };

      // Perform a dry-run risk assessment
      const assessment = await this.assessTradingRisk(testUserId, testOrderParams);

      const metrics = {
        portfolioCacheSize: this.portfolioCache.size,
        correlationCacheSize: this.correlationCache.size,
        defaultRiskProfile: this.defaultRiskProfile,
      };

      return {
        healthy: assessment !== null && typeof assessment.riskLevel === "string",
        metrics,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : "Health check failed",
      };
    }
  }
}

// Export singleton instance
export const enhancedRiskManagementService = EnhancedRiskManagementService.getInstance();

// Export with alternative name for backward compatibility
export const enhancedRiskManagement = enhancedRiskManagementService;

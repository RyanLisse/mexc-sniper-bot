/**
 * Portfolio Analysis Service
 *
 * Handles portfolio analytics, top assets analysis, and enhanced portfolio features.
 * Extracted from unified-mexc-portfolio.ts for modularity.
 *
 * Features:
 * - Top assets analysis
 * - Enhanced portfolio data
 * - Portfolio performance analytics
 * - Asset allocation analysis
 */

import type { BalanceEntry } from "../../data/modules/mexc-api-types";
import type {
  PerformanceData,
  PortfolioPriceCalculationService,
} from "./price-calculation-service";

export interface EnhancedPortfolioData {
  balances: BalanceEntry[];
  totalValue: number;
  performance24h: PerformanceData;
  topAssets: BalanceEntry[];
  diversification: {
    dominantAsset: string;
    dominantAssetPercentage: number;
    totalAssets: number;
    significantAssets: number; // Assets > 1% of portfolio
  };
}

export interface PortfolioAnalysis {
  summary: {
    totalValue: number;
    totalAssets: number;
    activeAssets: number;
    diversificationScore: number; // 0-100, higher is more diversified
  };
  allocation: Array<{
    asset: string;
    value: number;
    percentage: number;
    change24h: number;
    changePercent24h: number;
  }>;
  performance: {
    value24h: number;
    valuePercent24h: number;
    bestPerformer: { asset: string; change: number };
    worstPerformer: { asset: string; change: number };
  };
  risk: {
    concentrationRisk: "LOW" | "MEDIUM" | "HIGH";
    volatilityScore: number;
    recommendations: string[];
  };
}

export class PortfolioAnalysisService {
  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[portfolio-analysis]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[portfolio-analysis]", message, context || ""),
    error: (message: string, context?: unknown) =>
      console.error("[portfolio-analysis]", message, context || ""),
    debug: (message: string, context?: unknown) =>
      console.debug("[portfolio-analysis]", message, context || ""),
  };

  constructor(
    private priceCalculationService: PortfolioPriceCalculationService
  ) {}

  /**
   * Get top assets by value
   */
  async getTopAssets(
    balances: BalanceEntry[],
    limit = 10
  ): Promise<BalanceEntry[]> {
    try {
      this.logger.debug("Getting top assets", { limit });

      if (!balances || balances.length === 0) {
        return [];
      }

      // Filter for significant balances
      const significantBalances = balances.filter(
        (balance) =>
          parseFloat(balance.free) + parseFloat(balance.locked) > 0.001
      );

      if (significantBalances.length === 0) {
        return [];
      }

      // Get current prices
      const assets = significantBalances.map((balance) => balance.asset);
      const pricesResult =
        await this.priceCalculationService.fetchRealTimePrices(assets);

      if (!pricesResult.success || !pricesResult.data) {
        this.logger.warn("Failed to fetch prices for top assets analysis");
        return significantBalances.slice(0, limit);
      }

      const prices = pricesResult.data;

      // Calculate values and sort
      const balancesWithValues = significantBalances
        .map((balance) => {
          const totalBalance =
            parseFloat(balance.free) + parseFloat(balance.locked);
          const priceData = prices[balance.asset];
          const value = priceData ? totalBalance * priceData.price : 0;

          return {
            ...balance,
            calculatedValue: value,
          };
        })
        .sort((a, b) => b.calculatedValue - a.calculatedValue);

      const topAssets = balancesWithValues.slice(0, limit).map((balance) => {
        // Remove the calculated value from the returned object
        const { calculatedValue, ...originalBalance } = balance;
        return originalBalance;
      });

      this.logger.info("Successfully retrieved top assets", {
        topAssetsCount: topAssets.length,
        totalValue: balancesWithValues.reduce(
          (sum, b) => sum + b.calculatedValue,
          0
        ),
      });

      return topAssets;
    } catch (error) {
      this.logger.error("Error getting top assets", { error });
      return balances.slice(0, limit);
    }
  }

  /**
   * Get enhanced portfolio data with analysis
   */
  async getEnhancedPortfolio(
    balances: BalanceEntry[],
    includePerformance = true
  ): Promise<{
    success: boolean;
    data?: EnhancedPortfolioData;
    error?: string;
  }> {
    try {
      this.logger.debug("Getting enhanced portfolio data", {
        balancesCount: balances.length,
        includePerformance,
      });

      if (!balances || balances.length === 0) {
        return {
          success: true,
          data: {
            balances: [],
            totalValue: 0,
            performance24h: {
              currentValue: 0,
              change24h: 0,
              changePercent24h: 0,
              volume24h: 0,
            },
            topAssets: [],
            diversification: {
              dominantAsset: "N/A",
              dominantAssetPercentage: 0,
              totalAssets: 0,
              significantAssets: 0,
            },
          },
        };
      }

      // Calculate total value
      const totalValue =
        await this.priceCalculationService.calculateTotalValue(balances);

      // Get performance data if requested
      let performance24h: PerformanceData = {
        currentValue: totalValue,
        change24h: 0,
        changePercent24h: 0,
        volume24h: 0,
      };

      if (includePerformance) {
        const performanceResult =
          await this.priceCalculationService.calculate24hPerformance(balances);
        if (performanceResult.success && performanceResult.data) {
          performance24h = performanceResult.data;
        }
      }

      // Get top assets
      const topAssets = await this.getTopAssets(balances, 10);

      // Calculate diversification metrics
      const diversification = await this.calculateDiversification(
        balances,
        totalValue
      );

      const enhancedData: EnhancedPortfolioData = {
        balances,
        totalValue,
        performance24h,
        topAssets,
        diversification,
      };

      this.logger.info("Successfully generated enhanced portfolio data", {
        totalValue,
        topAssetsCount: topAssets.length,
        dominantAsset: diversification.dominantAsset,
      });

      return { success: true, data: enhancedData };
    } catch (error) {
      this.logger.error("Error getting enhanced portfolio", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get comprehensive portfolio analysis
   */
  async getPortfolioAnalysis(
    balances: BalanceEntry[]
  ): Promise<{ success: boolean; data?: PortfolioAnalysis; error?: string }> {
    try {
      this.logger.debug("Getting portfolio analysis", {
        balancesCount: balances.length,
      });

      if (!balances || balances.length === 0) {
        return {
          success: true,
          data: this.getEmptyAnalysis(),
        };
      }

      // Get significant balances
      const significantBalances = balances.filter(
        (balance) =>
          parseFloat(balance.free) + parseFloat(balance.locked) > 0.001
      );

      if (significantBalances.length === 0) {
        return {
          success: true,
          data: this.getEmptyAnalysis(),
        };
      }

      // Calculate total value
      const totalValue =
        await this.priceCalculationService.calculateTotalValue(balances);

      // Get prices for allocation analysis
      const assets = significantBalances.map((balance) => balance.asset);
      const pricesResult =
        await this.priceCalculationService.fetchRealTimePrices(assets);

      if (!pricesResult.success || !pricesResult.data) {
        return {
          success: false,
          error: pricesResult.error || "Failed to fetch prices",
        };
      }

      const prices = pricesResult.data;

      // Calculate allocation
      const allocation = significantBalances
        .map((balance) => {
          const totalBalance =
            parseFloat(balance.free) + parseFloat(balance.locked);
          const priceData = prices[balance.asset];
          const value = priceData ? totalBalance * priceData.price : 0;
          const percentage = totalValue > 0 ? (value / totalValue) * 100 : 0;

          return {
            asset: balance.asset,
            value,
            percentage,
            change24h: priceData?.change24h || 0,
            changePercent24h: priceData?.change24h
              ? (priceData.change24h /
                  (priceData.price - priceData.change24h)) *
                100
              : 0,
          };
        })
        .sort((a, b) => b.value - a.value);

      // Calculate performance metrics
      const performanceResult =
        await this.priceCalculationService.calculate24hPerformance(balances);
      const performance24h = performanceResult.data || {
        currentValue: totalValue,
        change24h: 0,
        changePercent24h: 0,
        volume24h: 0,
      };

      // Find best and worst performers
      const validPerformers = allocation.filter(
        (asset) => asset.changePercent24h !== 0
      );
      const bestPerformer =
        validPerformers.length > 0
          ? validPerformers.reduce((best, current) =>
              current.changePercent24h > best.changePercent24h ? current : best
            )
          : { asset: "N/A", change: 0 };

      const worstPerformer =
        validPerformers.length > 0
          ? validPerformers.reduce((worst, current) =>
              current.changePercent24h < worst.changePercent24h
                ? current
                : worst
            )
          : { asset: "N/A", change: 0 };

      // Calculate risk metrics
      const diversificationScore =
        this.calculateDiversificationScore(allocation);
      const concentrationRisk = this.assessConcentrationRisk(allocation);
      const volatilityScore = this.calculateVolatilityScore(allocation);
      const recommendations = this.generateRecommendations(
        allocation,
        concentrationRisk
      );

      const analysis: PortfolioAnalysis = {
        summary: {
          totalValue,
          totalAssets: balances.length,
          activeAssets: significantBalances.length,
          diversificationScore,
        },
        allocation,
        performance: {
          value24h: performance24h.change24h,
          valuePercent24h: performance24h.changePercent24h,
          bestPerformer: {
            asset: bestPerformer.asset,
            change: bestPerformer.change || bestPerformer.changePercent24h,
          },
          worstPerformer: {
            asset: worstPerformer.asset,
            change: worstPerformer.change || worstPerformer.changePercent24h,
          },
        },
        risk: {
          concentrationRisk,
          volatilityScore,
          recommendations,
        },
      };

      this.logger.info("Successfully generated portfolio analysis", {
        totalValue,
        diversificationScore,
        concentrationRisk,
      });

      return { success: true, data: analysis };
    } catch (error) {
      this.logger.error("Error getting portfolio analysis", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Calculate diversification metrics
   */
  private async calculateDiversification(
    balances: BalanceEntry[],
    totalValue: number
  ): Promise<{
    dominantAsset: string;
    dominantAssetPercentage: number;
    totalAssets: number;
    significantAssets: number;
  }> {
    const significantBalances = balances.filter(
      (balance) => parseFloat(balance.free) + parseFloat(balance.locked) > 0.001
    );

    if (significantBalances.length === 0 || totalValue === 0) {
      return {
        dominantAsset: "N/A",
        dominantAssetPercentage: 0,
        totalAssets: balances.length,
        significantAssets: 0,
      };
    }

    // Get asset values
    const assets = significantBalances.map((balance) => balance.asset);
    const pricesResult =
      await this.priceCalculationService.fetchRealTimePrices(assets);

    if (!pricesResult.success || !pricesResult.data) {
      return {
        dominantAsset: "N/A",
        dominantAssetPercentage: 0,
        totalAssets: balances.length,
        significantAssets: significantBalances.length,
      };
    }

    const prices = pricesResult.data;
    let dominantAsset = "N/A";
    let maxValue = 0;

    for (const balance of significantBalances) {
      const totalBalance =
        parseFloat(balance.free) + parseFloat(balance.locked);
      const priceData = prices[balance.asset];
      const value = priceData ? totalBalance * priceData.price : 0;

      if (value > maxValue) {
        maxValue = value;
        dominantAsset = balance.asset;
      }
    }

    const dominantAssetPercentage =
      totalValue > 0 ? (maxValue / totalValue) * 100 : 0;
    const significantAssets = significantBalances.length;

    return {
      dominantAsset,
      dominantAssetPercentage,
      totalAssets: balances.length,
      significantAssets,
    };
  }

  private getEmptyAnalysis(): PortfolioAnalysis {
    return {
      summary: {
        totalValue: 0,
        totalAssets: 0,
        activeAssets: 0,
        diversificationScore: 0,
      },
      allocation: [],
      performance: {
        value24h: 0,
        valuePercent24h: 0,
        bestPerformer: { asset: "N/A", change: 0 },
        worstPerformer: { asset: "N/A", change: 0 },
      },
      risk: {
        concentrationRisk: "LOW",
        volatilityScore: 0,
        recommendations: [],
      },
    };
  }

  private calculateDiversificationScore(allocation: any[]): number {
    if (allocation.length <= 1) return 0;

    // Calculate Herfindahl-Hirschman Index (inverted for diversification)
    const hhi = allocation.reduce((sum, asset) => {
      const share = asset.percentage / 100;
      return sum + share * share;
    }, 0);

    // Convert to 0-100 scale (lower HHI = higher diversification)
    return Math.max(0, Math.min(100, (1 - hhi) * 100));
  }

  private assessConcentrationRisk(
    allocation: any[]
  ): "LOW" | "MEDIUM" | "HIGH" {
    if (allocation.length === 0) return "LOW";

    const topAssetPercentage = allocation[0]?.percentage || 0;

    if (topAssetPercentage > 70) return "HIGH";
    if (topAssetPercentage > 40) return "MEDIUM";
    return "LOW";
  }

  private calculateVolatilityScore(allocation: any[]): number {
    if (allocation.length === 0) return 0;

    const changes = allocation.map((asset) => Math.abs(asset.changePercent24h));
    const avgVolatility =
      changes.reduce((sum, change) => sum + change, 0) / changes.length;

    return Math.min(100, avgVolatility);
  }

  private generateRecommendations(
    allocation: any[],
    concentrationRisk: "LOW" | "MEDIUM" | "HIGH"
  ): string[] {
    const recommendations: string[] = [];

    if (concentrationRisk === "HIGH") {
      recommendations.push("Consider reducing concentration in top asset");
      recommendations.push("Diversify portfolio across multiple asset classes");
    }

    if (allocation.length < 3) {
      recommendations.push(
        "Consider adding more assets for better diversification"
      );
    }

    const stablecoins = allocation.filter((asset) =>
      ["USDT", "USDC", "BUSD", "DAI"].includes(asset.asset)
    );

    if (stablecoins.length === 0) {
      recommendations.push("Consider holding some stablecoins for stability");
    }

    return recommendations;
  }
}

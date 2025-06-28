"use client";

import type { PortfolioService } from "../../application/interfaces/trading-repository";
import {
  type BalanceEntry,
  BalanceEntrySchema,
  type MexcServiceResponse,
  type Portfolio,
  PortfolioSchema,
  type Ticker,
  type UnifiedMexcConfig,
  validateMexcData,
} from "../../schemas/unified/mexc-api-schemas";
import { BaseMexcService } from "./base-mexc-service";
import { MexcApiClient } from "./mexc-api-client";

/**
 * MEXC Portfolio Service
 * Handles account balances, portfolio analysis, and asset management
 * Implements PortfolioService interface for service compliance
 */
export class MexcPortfolioService extends BaseMexcService implements PortfolioService {
  private apiClient: MexcApiClient;

  constructor(config: Partial<UnifiedMexcConfig> = {}) {
    super(config);
    this.apiClient = new MexcApiClient(this.config);
  }

  // ============================================================================
  // PortfolioService Interface Implementation
  // ============================================================================

  /**
   * Get account balance (simplified)
   * Implements PortfolioService.getAccountBalance interface
   */
  async getAccountBalance(): Promise<{
    success: boolean;
    data?: Array<{
      asset: string;
      free: string;
      locked: string;
      total?: number;
      usdtValue?: number;
    }>;
    error?: string;
  }> {
    try {
      const portfolioResponse = await this.getAccountBalancesInternal();
      if (!portfolioResponse.success || !portfolioResponse.data) {
        return {
          success: false,
          error: portfolioResponse.error || "Failed to get account balances",
        };
      }

      // Map Portfolio assets to interface format
      const balances = portfolioResponse.data.assets.map((asset) => ({
        asset: asset.asset,
        free: asset.free,
        locked: asset.locked,
        total: asset.total,
        usdtValue: asset.usdtValue,
      }));

      return {
        success: true,
        data: balances,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get account balances (enhanced portfolio) - Internal method
   */
  private async getAccountBalancesInternal(): Promise<MexcServiceResponse<Portfolio>> {
    try {
      const balancesResponse = await this.apiClient.getAccountBalances();

      if (
        !balancesResponse?.success ||
        !balancesResponse.data?.balances ||
        !Array.isArray(balancesResponse.data.balances)
      ) {
        throw new Error("Invalid balances response");
      }

      const validatedBalances = this.validateAndMapArray(
        balancesResponse.data.balances,
        BalanceEntrySchema
      ) as BalanceEntry[];

      // Filter out zero balances for performance
      const nonZeroBalances = validatedBalances.filter(
        (balance) => Number.parseFloat(balance.free) > 0 || Number.parseFloat(balance.locked) > 0
      );

      const portfolio: Portfolio = {
        totalValue: 0,
        totalValueUsdt: 0,
        assets: nonZeroBalances,
      };

      const portfolioValidation = validateMexcData(PortfolioSchema, portfolio);
      if (!portfolioValidation.success) {
        throw new Error(portfolioValidation.error || "Failed to validate portfolio data");
      }

      return {
        success: true,
        data: portfolioValidation.data,
        timestamp: new Date().toISOString(),
        source: "mexc-portfolio-service",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        source: "mexc-portfolio-service",
      };
    }
  }

  /**
   * Get account balances (implements PortfolioService interface)
   */
  async getAccountBalances(): Promise<{
    success: boolean;
    data?: {
      balances: Array<{
        asset: string;
        free: string;
        locked: string;
        total?: number;
        usdtValue?: number;
      }>;
      totalUsdtValue: number;
      totalValue: number;
      totalValueBTC: number;
      allocation: Record<string, number>;
      performance24h: { change: number; changePercent: number };
    };
    error?: string;
  }> {
    try {
      const portfolioResponse = await this.getAccountBalancesInternal();

      if (!portfolioResponse.success || !portfolioResponse.data) {
        return {
          success: false,
          error: portfolioResponse.error || "Failed to get account balances",
        };
      }

      const portfolioData = portfolioResponse.data;

      // Map Portfolio to interface format
      return {
        success: true,
        data: {
          balances: portfolioData.assets.map((asset) => ({
            asset: asset.asset,
            free: asset.free,
            locked: asset.locked,
            total: Number.parseFloat(asset.free) + Number.parseFloat(asset.locked),
            usdtValue: asset.usdtValue,
          })),
          totalUsdtValue: portfolioData.totalValueUsdt || portfolioData.totalValue || 0,
          totalValue: portfolioData.totalValue || 0,
          totalValueBTC: 0, // Calculate BTC value if needed
          allocation: {}, // Calculate allocation percentages if needed
          performance24h: { change: 0, changePercent: 0 }, // Calculate performance if needed
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get account information with trading permissions
   * Implements PortfolioService.getAccountInfo interface
   */
  async getAccountInfo(): Promise<{
    success: boolean;
    data?: {
      accountType: string;
      canTrade: boolean;
      canWithdraw: boolean;
      canDeposit: boolean;
      balances: Array<{
        asset: string;
        free: string;
        locked: string;
      }>;
    };
    error?: string;
  }> {
    try {
      const balancesResponse = await this.getAccountBalancesInternal();
      if (!balancesResponse.success || !balancesResponse.data) {
        return {
          success: false,
          error: balancesResponse.error || "Failed to get account balances",
        };
      }

      // Map Portfolio assets to interface format
      const balances = balancesResponse.data.assets.map((asset) => ({
        asset: asset.asset,
        free: asset.free,
        locked: asset.locked,
      }));

      return {
        success: true,
        data: {
          accountType: "SPOT",
          canTrade: true,
          canWithdraw: true,
          canDeposit: true,
          balances,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Calculate total portfolio value in USDT
   * Implements PortfolioService.getTotalPortfolioValue interface
   */
  async getTotalPortfolioValue(): Promise<number> {
    try {
      const portfolioResponse = await this.getAccountBalancesInternal();
      if (!portfolioResponse.success || !portfolioResponse.data) {
        return 0;
      }
      return portfolioResponse.data.totalValueUsdt || portfolioResponse.data.totalValue || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Check if user has sufficient balance for trading
   * Implements PortfolioService.hasSufficientBalance interface
   */
  async hasSufficientBalance(asset: string, requiredAmount: number): Promise<boolean> {
    try {
      const portfolioResponse = await this.getAccountBalancesInternal();
      if (!portfolioResponse.success || !portfolioResponse.data) {
        return false;
      }

      const assetBalance = portfolioResponse.data.assets.find((balance) => balance.asset === asset);

      if (!assetBalance) {
        return false;
      }

      const availableAmount = Number.parseFloat(assetBalance.free);
      return availableAmount >= requiredAmount;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get balance for a specific asset
   * Implements PortfolioService.getAssetBalance interface
   */
  async getAssetBalance(asset: string): Promise<{ free: string; locked: string } | null> {
    try {
      const portfolioResponse = await this.getAccountBalancesInternal();
      if (!portfolioResponse.success || !portfolioResponse.data) {
        return null;
      }

      const assetBalance = portfolioResponse.data.assets.find((balance) => balance.asset === asset);

      return assetBalance
        ? {
            free: assetBalance.free,
            locked: assetBalance.locked,
          }
        : null;
    } catch (error) {
      return null;
    }
  }

  // ============================================================================
  // Additional Portfolio Methods (Non-interface)
  // ============================================================================

  /**
   * Get enhanced portfolio with market data
   */
  async getEnhancedPortfolio(tickers?: Ticker[]): Promise<MexcServiceResponse<Portfolio>> {
    try {
      const balancesResponse = await this.getAccountBalancesInternal();

      if (!balancesResponse.success || !balancesResponse.data) {
        throw new Error("Failed to get account balances");
      }

      const portfolio = balancesResponse.data;

      // If tickers provided, calculate enhanced metrics
      if (tickers && tickers.length > 0) {
        const enhancedPortfolio = this.calculatePortfolioMetrics(portfolio.assets, tickers);
        return {
          success: true,
          data: enhancedPortfolio,
          timestamp: new Date().toISOString(),
          source: "mexc-portfolio-service",
        };
      }

      return {
        success: true,
        data: portfolio,
        timestamp: new Date().toISOString(),
        source: "mexc-portfolio-service",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        source: "mexc-portfolio-service",
      };
    }
  }

  /**
   * Calculate detailed portfolio metrics
   */
  private calculatePortfolioMetrics(assets: BalanceEntry[], tickers: Ticker[]): Portfolio {
    const tickerMap = new Map(tickers.map((t) => [t.symbol, t]));
    let totalUsdtValue = 0;
    let totalPnl = 0;

    // Calculate enhanced balance data
    const enhancedAssets = assets.map((balance) => {
      const total = Number.parseFloat(balance.free) + Number.parseFloat(balance.locked);
      let usdtValue = 0;

      if (balance.asset === "USDT") {
        usdtValue = total;
      } else if (balance.asset === "BTC") {
        // Get BTC/USDT price for USDT value
        const btcTicker = tickerMap.get("BTCUSDT");
        if (btcTicker?.lastPrice) {
          usdtValue = total * Number.parseFloat(btcTicker.lastPrice);
        }
      } else {
        // Try to find ticker for this asset
        const assetTicker =
          tickerMap.get(`${balance.asset}USDT`) ||
          tickerMap.get(`${balance.asset}BTC`) ||
          tickerMap.get(`${balance.asset}ETH`);

        if (assetTicker?.lastPrice && assetTicker.priceChangePercent) {
          const price = Number.parseFloat(assetTicker.lastPrice);
          const priceChange = Number.parseFloat(assetTicker.priceChangePercent);

          if (assetTicker.symbol.endsWith("USDT")) {
            usdtValue = total * price;
          } else if (assetTicker.symbol.endsWith("BTC")) {
            const btcValue = total * price;
            // Convert to USDT using BTC price
            const btcTicker = tickerMap.get("BTCUSDT");
            if (btcTicker?.lastPrice) {
              usdtValue = btcValue * Number.parseFloat(btcTicker.lastPrice);
            }
          }

          // Calculate PnL
          const dailyPnl = usdtValue * (priceChange / 100);
          totalPnl += dailyPnl;
        }
      }

      totalUsdtValue += usdtValue;

      return {
        ...balance,
        total,
        usdtValue: Number.parseFloat(usdtValue.toFixed(6)),
      };
    });

    const pnlPercent = totalUsdtValue > 0 ? (totalPnl / totalUsdtValue) * 100 : 0;

    return {
      totalValue: Number.parseFloat(totalUsdtValue.toFixed(6)),
      totalValueUsdt: Number.parseFloat(totalUsdtValue.toFixed(6)),
      totalPnL: Number.parseFloat(totalPnl.toFixed(6)),
      totalPnLPercent: Number.parseFloat(pnlPercent.toFixed(2)),
      assets: enhancedAssets,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get portfolio analysis with risk metrics
   */
  async getPortfolioAnalysis(): Promise<MexcServiceResponse<any>> {
    try {
      const portfolioResponse = await this.getAccountBalancesInternal();

      if (!portfolioResponse.success || !portfolioResponse.data) {
        throw new Error("Failed to get portfolio data");
      }

      const portfolio = portfolioResponse.data;

      // Calculate basic risk metrics
      const assetCount = portfolio.assets.length;
      // Create simple allocation based on asset values
      const allocation = this.calculateAllocation(portfolio.assets);
      const concentrationRisk = this.calculateConcentrationRisk(allocation);
      const diversificationScore = this.calculateDiversificationScore(assetCount, allocation);

      const analysisData = {
        summary: {
          totalAssets: assetCount,
          totalValue: portfolio.totalValueUsdt || portfolio.totalValue,
          performance24h: {
            pnl: portfolio.totalPnL || 0,
            pnlPercent: portfolio.totalPnLPercent || 0,
          },
        },
        risk: {
          concentrationRisk,
          diversificationScore,
          riskLevel: this.assessRiskLevel(concentrationRisk, diversificationScore),
        },
        recommendations: this.generateRecommendations(concentrationRisk, diversificationScore),
      };

      return {
        success: true,
        data: analysisData,
        timestamp: new Date().toISOString(),
        source: "mexc-portfolio-service",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        source: "mexc-portfolio-service",
      };
    }
  }

  /**
   * Calculate allocation percentages from assets
   */
  private calculateAllocation(assets: BalanceEntry[]): Record<string, number> {
    const allocation: Record<string, number> = {};
    let totalValue = 0;

    // First pass: calculate total value
    assets.forEach((asset) => {
      if (asset.usdtValue) {
        totalValue += asset.usdtValue;
      }
    });

    // Second pass: calculate percentages
    if (totalValue > 0) {
      assets.forEach((asset) => {
        if (asset.usdtValue && asset.usdtValue > 0) {
          allocation[asset.asset] = Number.parseFloat(
            ((asset.usdtValue / totalValue) * 100).toFixed(2)
          );
        }
      });
    }

    return allocation;
  }

  /**
   * Calculate concentration risk (0-100, higher = more risk)
   */
  private calculateConcentrationRisk(allocation: Record<string, number>): number {
    const allocations = Object.values(allocation);
    if (allocations.length === 0) return 0;

    // Calculate Herfindahl-Hirschman Index (HHI)
    const hhi = allocations.reduce((sum, percentage) => sum + (percentage / 100) ** 2, 0);

    // Convert to 0-100 scale (higher = more concentrated = more risk)
    return Number.parseFloat((hhi * 100).toFixed(2));
  }

  /**
   * Calculate diversification score (0-100, higher = better diversified)
   */
  private calculateDiversificationScore(
    assetCount: number,
    allocation: Record<string, number>
  ): number {
    if (assetCount === 0) return 0;

    const maxAllocation = Math.max(...Object.values(allocation));

    // Ideal diversification: many assets with balanced allocation
    const assetScore = Math.min(assetCount / 10, 1) * 50; // Up to 50 points for asset count
    const balanceScore = (1 - maxAllocation / 100) * 50; // Up to 50 points for balance

    return Number.parseFloat((assetScore + balanceScore).toFixed(2));
  }

  /**
   * Assess overall risk level
   */
  private assessRiskLevel(concentrationRisk: number, diversificationScore: number): string {
    if (concentrationRisk > 50 || diversificationScore < 30) return "HIGH";
    if (concentrationRisk > 25 || diversificationScore < 60) return "MEDIUM";
    return "LOW";
  }

  /**
   * Generate portfolio recommendations
   */
  private generateRecommendations(
    concentrationRisk: number,
    diversificationScore: number
  ): string[] {
    const recommendations: string[] = [];

    if (concentrationRisk > 50) {
      recommendations.push("Consider reducing position sizes in dominant assets");
    }

    if (diversificationScore < 40) {
      recommendations.push("Consider diversifying across more assets");
    }

    if (concentrationRisk < 20 && diversificationScore > 80) {
      recommendations.push("Well-diversified portfolio - maintain balance");
    }

    return recommendations;
  }
}

/**
 * Create and return a singleton instance
 */
let portfolioServiceInstance: MexcPortfolioService | null = null;

export function getMexcPortfolioService(config?: UnifiedMexcConfig): MexcPortfolioService {
  if (!portfolioServiceInstance) {
    portfolioServiceInstance = new MexcPortfolioService(config);
  }
  return portfolioServiceInstance;
}

export function resetMexcPortfolioService(): void {
  portfolioServiceInstance = null;
}

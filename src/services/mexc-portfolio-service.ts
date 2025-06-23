"use client";

import { BaseMexcService } from "./base-mexc-service";
import { MexcApiClient } from "./mexc-api-client";
import {
  type BalanceEntry,
  BalanceEntrySchema,
  type MexcServiceResponse,
  type Portfolio,
  PortfolioSchema,
  type Ticker,
  type UnifiedMexcConfig,
  validateMexcData,
} from "./mexc-schemas";

/**
 * MEXC Portfolio Service
 * Handles account balances, portfolio analysis, and asset management
 */
export class MexcPortfolioService extends BaseMexcService {
  private apiClient: MexcApiClient;

  constructor(config: Partial<UnifiedMexcConfig> = {}) {
    super(config);
    this.apiClient = new MexcApiClient(this.config);
  }

  /**
   * Get account balances
   */
  async getAccountBalances(): Promise<MexcServiceResponse<Portfolio>> {
    return this.executeRequest(
      "getAccountBalances",
      async () => {
        const balancesResponse = await this.apiClient.get("/api/v3/account");
        
        if (!balancesResponse?.balances || !Array.isArray(balancesResponse.balances)) {
          throw new Error("Invalid balances response");
        }

        const validatedBalances = this.validateAndMapArray(
          balancesResponse.balances,
          (balance: any) => validateMexcData(balance, BalanceEntrySchema)
        ) as BalanceEntry[];

        // Filter out zero balances for performance
        const nonZeroBalances = validatedBalances.filter(
          (balance) => parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0
        );

        const portfolio: Portfolio = {
          totalValue: 0,
          totalValueBTC: 0,
          totalUsdtValue: 0,
          balances: nonZeroBalances,
          allocation: {},
          performance24h: {
            pnl: 0,
            pnlPercent: 0,
            gainers: 0,
            losers: 0,
          },
        };

        return validateMexcData(portfolio, PortfolioSchema);
      },
      {
        enableTelemetry: true,
        cacheKey: "account_balances",
        cacheTTL: 30000, // 30 seconds cache
      }
    );
  }

  /**
   * Get enhanced portfolio with market data
   */
  async getEnhancedPortfolio(tickers?: Ticker[]): Promise<MexcServiceResponse<Portfolio>> {
    return this.executeRequest(
      "getEnhancedPortfolio",
      async () => {
        const balancesResponse = await this.getAccountBalances();
        
        if (!balancesResponse.success || !balancesResponse.data) {
          throw new Error("Failed to get account balances");
        }

        const portfolio = balancesResponse.data;
        
        // If tickers provided, calculate enhanced metrics
        if (tickers && tickers.length > 0) {
          return this.calculatePortfolioMetrics(portfolio.balances, tickers);
        }

        return portfolio;
      },
      {
        enableTelemetry: true,
        cacheKey: "enhanced_portfolio",
        cacheTTL: 10000, // 10 seconds cache for real-time data
      }
    );
  }

  /**
   * Calculate detailed portfolio metrics
   */
  private calculatePortfolioMetrics(balances: BalanceEntry[], tickers: Ticker[]): Portfolio {
    const tickerMap = new Map(tickers.map((t) => [t.symbol, t]));
    let totalUsdtValue = 0;
    let totalValueBTC = 0;
    const allocation: Record<string, number> = {};
    let totalPnl = 0;
    let gainers = 0;
    let losers = 0;

    // Calculate enhanced balance data
    const enhancedBalances = balances.map((balance) => {
      const total = parseFloat(balance.free) + parseFloat(balance.locked);
      let usdtValue = 0;
      let btcValue = 0;

      if (balance.asset === "USDT") {
        usdtValue = total;
      } else if (balance.asset === "BTC") {
        btcValue = total;
        // Get BTC/USDT price for USDT value
        const btcTicker = tickerMap.get("BTCUSDT");
        if (btcTicker) {
          usdtValue = total * parseFloat(btcTicker.lastPrice);
        }
      } else {
        // Try to find ticker for this asset
        const assetTicker = 
          tickerMap.get(`${balance.asset}USDT`) ||
          tickerMap.get(`${balance.asset}BTC`) ||
          tickerMap.get(`${balance.asset}ETH`);

        if (assetTicker) {
          const price = parseFloat(assetTicker.lastPrice);
          const priceChange = parseFloat(assetTicker.priceChangePercent);

          if (assetTicker.symbol.endsWith("USDT")) {
            usdtValue = total * price;
          } else if (assetTicker.symbol.endsWith("BTC")) {
            btcValue = total * price;
            // Convert to USDT using BTC price
            const btcTicker = tickerMap.get("BTCUSDT");
            if (btcTicker) {
              usdtValue = btcValue * parseFloat(btcTicker.lastPrice);
            }
          }

          // Calculate PnL
          const dailyPnl = usdtValue * (priceChange / 100);
          totalPnl += dailyPnl;

          if (priceChange > 0) gainers++;
          else if (priceChange < 0) losers++;
        }
      }

      totalUsdtValue += usdtValue;
      totalValueBTC += btcValue;

      return {
        ...balance,
        total,
        usdtValue: parseFloat(usdtValue.toFixed(6)),
      };
    });

    // Calculate allocation percentages
    enhancedBalances.forEach((balance) => {
      if (balance.usdtValue && balance.usdtValue > 0) {
        allocation[balance.asset] = parseFloat(
          ((balance.usdtValue / totalUsdtValue) * 100).toFixed(2)
        );
      }
    });

    const pnlPercent = totalUsdtValue > 0 ? (totalPnl / totalUsdtValue) * 100 : 0;

    return {
      totalValue: parseFloat(totalUsdtValue.toFixed(6)),
      totalValueBTC: parseFloat(totalValueBTC.toFixed(8)),
      totalUsdtValue: parseFloat(totalUsdtValue.toFixed(6)),
      balances: enhancedBalances,
      allocation,
      performance24h: {
        pnl: parseFloat(totalPnl.toFixed(6)),
        pnlPercent: parseFloat(pnlPercent.toFixed(2)),
        gainers,
        losers,
      },
    };
  }

  /**
   * Get portfolio analysis with risk metrics
   */
  async getPortfolioAnalysis(): Promise<MexcServiceResponse<any>> {
    return this.executeRequest(
      "getPortfolioAnalysis",
      async () => {
        const portfolioResponse = await this.getAccountBalances();
        
        if (!portfolioResponse.success || !portfolioResponse.data) {
          throw new Error("Failed to get portfolio data");
        }

        const portfolio = portfolioResponse.data;
        
        // Calculate basic risk metrics
        const assetCount = portfolio.balances.length;
        const concentrationRisk = this.calculateConcentrationRisk(portfolio.allocation);
        const diversificationScore = this.calculateDiversificationScore(assetCount, portfolio.allocation);

        return {
          summary: {
            totalAssets: assetCount,
            totalValue: portfolio.totalUsdtValue,
            performance24h: portfolio.performance24h,
          },
          risk: {
            concentrationRisk,
            diversificationScore,
            riskLevel: this.assessRiskLevel(concentrationRisk, diversificationScore),
          },
          recommendations: this.generateRecommendations(concentrationRisk, diversificationScore),
        };
      },
      {
        enableTelemetry: true,
        cacheKey: "portfolio_analysis",
        cacheTTL: 60000, // 1 minute cache
      }
    );
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
    return parseFloat((hhi * 100).toFixed(2));
  }

  /**
   * Calculate diversification score (0-100, higher = better diversified)
   */
  private calculateDiversificationScore(assetCount: number, allocation: Record<string, number>): number {
    if (assetCount === 0) return 0;

    const maxAllocation = Math.max(...Object.values(allocation));
    
    // Ideal diversification: many assets with balanced allocation
    const assetScore = Math.min(assetCount / 10, 1) * 50; // Up to 50 points for asset count
    const balanceScore = (1 - maxAllocation / 100) * 50; // Up to 50 points for balance
    
    return parseFloat((assetScore + balanceScore).toFixed(2));
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
  private generateRecommendations(concentrationRisk: number, diversificationScore: number): string[] {
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
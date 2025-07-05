/**
 * Unified MEXC Portfolio Module
 *
 * Portfolio and account-specific methods for the MEXC service.
 * Extracted from unified-mexc-service-v2.ts for better modularity.
 * Implements PortfolioService interface for service compliance.
 */

import type { PortfolioService } from "@/src/application/interfaces/trading-repository";
import type {
  BalanceEntry,
  MexcServiceResponse,
} from "../data/modules/mexc-api-types";
import type { MexcCacheLayer } from "../data/modules/mexc-cache-layer";
import type { MexcCoreClient } from "../data/modules/mexc-core-client";
import { PortfolioAnalysisService } from "./portfolio/portfolio-analysis-service";
import { PortfolioValidationService } from "./portfolio/portfolio-validation-service";
import { PortfolioPriceCalculationService } from "./portfolio/price-calculation-service";

// ============================================================================
// Portfolio Service Module - Implements PortfolioService Interface
// ============================================================================

export class UnifiedMexcPortfolioModule implements PortfolioService {
  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[unified-mexc-portfolio]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[unified-mexc-portfolio]", message, context || ""),
    error: (message: string, context?: unknown) =>
      console.error("[unified-mexc-portfolio]", message, context || ""),
    debug: (message: string, context?: unknown) =>
      console.debug("[unified-mexc-portfolio]", message, context || ""),
  };

  private priceCalculationService: PortfolioPriceCalculationService;
  private analysisService: PortfolioAnalysisService;
  private validationService: PortfolioValidationService;

  constructor(
    private coreClient: MexcCoreClient,
    private cacheLayer: MexcCacheLayer
  ) {
    this.priceCalculationService = new PortfolioPriceCalculationService(
      this.coreClient,
      this.cacheLayer
    );
    this.analysisService = new PortfolioAnalysisService(
      this.priceCalculationService
    );
    this.validationService = new PortfolioValidationService(
      this.coreClient,
      this.cacheLayer,
      this.priceCalculationService
    );
  }

  // ============================================================================
  // PortfolioService Interface Implementation
  // ============================================================================

  /**
   * Get account balance
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
      const result = await this.getAccountBalanceInternal();

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to get account balance",
        };
      }

      // Map internal format to interface format
      const balances = (result.data || []).map((balance: BalanceEntry) => ({
        asset: balance.asset,
        free: balance.free,
        locked: balance.locked,
        total: balance.total,
        usdtValue: balance.usdtValue,
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
   * Get enhanced account balances with portfolio metrics
   * Implements PortfolioService.getAccountBalances interface
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
      const result = await this.getAccountBalancesInternal();

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to get account balances",
        };
      }

      // Map internal format to interface format
      const balances = (result.data?.balances || []).map(
        (balance: BalanceEntry) => ({
          asset: balance.asset,
          free: balance.free,
          locked: balance.locked,
          total: balance.total,
          usdtValue: balance.usdtValue,
        })
      );

      return {
        success: true,
        data: {
          balances,
          totalUsdtValue: result.data?.totalUsdtValue || 0,
          totalValue: result.data?.totalValue || 0,
          totalValueBTC: result.data?.totalValueBTC || 0,
          allocation: result.data?.allocation || {},
          performance24h: result.data?.performance24h || {
            change: 0,
            changePercent: 0,
          },
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
      const result = await this.getAccountInfoInternal();

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to get account info",
        };
      }

      // Map internal format to interface format
      const balances = (result.data?.balances || []).map(
        (balance: BalanceEntry) => ({
          asset: balance.asset,
          free: balance.free,
          locked: balance.locked,
        })
      );

      return {
        success: true,
        data: {
          accountType: result.data?.accountType || "SPOT",
          canTrade: result.data?.canTrade || false,
          canWithdraw: result.data?.canWithdraw || false,
          canDeposit: result.data?.canDeposit || false,
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
      const balanceResult = await this.getAccountBalanceInternal();
      if (!balanceResult.success || !balanceResult.data) {
        return 0;
      }

      return await this.priceCalculationService.calculateTotalValue(
        balanceResult.data
      );
    } catch (error) {
      this.logger.error("Failed to get portfolio value:", error);
      return 0;
    }
  }

  /**
   * Check if user has sufficient balance for trading
   * Implements PortfolioService.hasSufficientBalance interface
   */
  async hasSufficientBalance(
    asset: string,
    requiredAmount: number
  ): Promise<boolean> {
    try {
      const balanceResponse = await this.getAccountBalanceInternal();
      if (!balanceResponse.success || !balanceResponse.data) {
        return false;
      }

      const assetBalance = balanceResponse.data.find(
        (balance) => balance.asset === asset
      );
      if (!assetBalance) {
        return false;
      }

      const availableAmount = Number.parseFloat(assetBalance.free);
      return availableAmount >= requiredAmount;
    } catch (error) {
      this.logger.error("Failed to check balance sufficiency:", error);
      return false;
    }
  }

  /**
   * Get balance for a specific asset
   * Implements PortfolioService.getAssetBalance interface
   */
  async getAssetBalance(
    asset: string
  ): Promise<{ free: string; locked: string } | null> {
    try {
      const balancesResponse = await this.getAccountBalancesInternal();
      if (!balancesResponse.success) {
        return null;
      }

      const assetBalance = balancesResponse.data?.balances.find(
        (balance) => balance.asset === asset
      );

      return assetBalance
        ? {
            free: assetBalance.free,
            locked: assetBalance.locked,
          }
        : null;
    } catch (error) {
      this.logger.error("Failed to get asset balance:", error);
      return null;
    }
  }

  // ============================================================================
  // Internal Methods for Module Use
  // ============================================================================

  /**
   * Get account balance (internal method for module use)
   */
  async getAccountBalanceInternal(): Promise<
    MexcServiceResponse<BalanceEntry[]>
  > {
    const result = await this.cacheLayer.getOrSet(
      "account:balance",
      async () => {
        try {
          const balanceResponse = await this.coreClient.getAccountBalance();

          if (!balanceResponse.success) {
            return balanceResponse;
          }

          const rawBalances = balanceResponse.data || [];

          // Get real-time prices for enhanced balance data
          const priceData = await this.fetchRealTimePrices(rawBalances);

          // Enhance balances with real USDT values
          const enhancedBalances = rawBalances.map(
            (balance: Record<string, unknown>) => {
              const free = parseFloat(String(balance.free || "0"));
              const locked = parseFloat(String(balance.locked || "0"));
              const total = free + locked;

              let usdtValue = 0;
              if (balance.asset === "USDT") {
                usdtValue = total;
              } else {
                const price = priceData[String(balance.asset || "")];
                if (price && price > 0) {
                  usdtValue = total * price;
                }
              }

              return {
                asset: String(balance.asset || ""),
                free: String(balance.free || "0"),
                locked: String(balance.locked || "0"),
                total,
                usdtValue: Number.parseFloat(usdtValue.toFixed(6)),
              };
            }
          );

          return {
            success: true,
            data: enhancedBalances,
            timestamp: new Date().toISOString(),
          } as MexcServiceResponse<BalanceEntry[]>;
        } catch (error) {
          this.logger.error("Error in getAccountBalanceInternal:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: Date.now(),
            source: "unified-mexc-portfolio",
          };
        }
      },
      "user" // 10 minute cache for user data
    );

    // Null safety: Check if result exists before returning
    if (!result) {
      return {
        success: false,
        error: "Cache layer returned undefined response",
        timestamp: Date.now(),
        source: "unified-mexc-portfolio",
      };
    }

    return result;
  }

  /**
   * Get account balances as Portfolio object (internal method)
   */
  async getAccountBalancesInternal(): Promise<
    MexcServiceResponse<{
      balances: BalanceEntry[];
      totalUsdtValue: number;
      totalValue: number;
      totalValueBTC: number;
      allocation: Record<string, number>;
      performance24h: { change: number; changePercent: number };
    }>
  > {
    try {
      // Get the basic balance data
      const balanceResponse = await this.coreClient.getAccountBalance();

      if (!balanceResponse.success) {
        return {
          success: false,
          error: balanceResponse.error || "Failed to fetch account balance",
          timestamp: Date.now(),
          source: "unified-mexc-portfolio",
        };
      }

      const rawBalances = balanceResponse.data || [];
      if (rawBalances.length === 0) {
        return {
          success: true,
          data: {
            balances: [],
            totalUsdtValue: 0,
            totalValue: 0,
            totalValueBTC: 0,
            allocation: {},
            performance24h: { change: 0, changePercent: 0 },
          },
          timestamp: Date.now(),
          source: "unified-mexc-portfolio",
        };
      }

      // Get real-time prices for USDT value calculations
      const priceData = await this.fetchRealTimePrices(rawBalances);

      // Transform raw balances to include calculated fields with real prices
      const balances = await Promise.all(
        rawBalances.map(async (balance: Record<string, unknown>) => {
          const free = parseFloat(String(balance.free || "0"));
          const locked = parseFloat(String(balance.locked || "0"));
          const total = free + locked;

          // Calculate USDT value using real-time prices
          let usdtValue = 0;
          const assetName = String(balance.asset || "");
          if (assetName === "USDT") {
            usdtValue = total;
          } else {
            const price = priceData[assetName];
            if (price && price > 0) {
              usdtValue = total * price;
            }
          }

          return {
            asset: assetName,
            free: String(balance.free || "0"),
            locked: String(balance.locked || "0"),
            total,
            usdtValue: Number.parseFloat(usdtValue.toFixed(6)),
          };
        })
      );

      // Calculate portfolio metrics
      const totalUsdtValue = balances.reduce(
        (sum, balance) => sum + (balance.usdtValue || 0),
        0
      );
      const totalValue = totalUsdtValue;

      // Get BTC price for BTC conversion
      const btcPrice = priceData.BTC || 0;
      const totalValueBTC = btcPrice > 0 ? totalUsdtValue / btcPrice : 0;

      // Calculate allocation percentages
      const allocation: Record<string, number> = {};
      if (totalUsdtValue > 0) {
        balances.forEach((balance) => {
          if (balance.usdtValue && balance.usdtValue > 0) {
            allocation[balance.asset] = Number.parseFloat(
              ((balance.usdtValue / totalUsdtValue) * 100).toFixed(2)
            );
          }
        });
      }

      // Calculate 24h performance data
      const performance24h = await this.calculate24hPerformance(
        balances,
        priceData
      );

      return {
        success: true,
        data: {
          balances,
          totalUsdtValue: Number.parseFloat(totalUsdtValue.toFixed(6)),
          totalValue: Number.parseFloat(totalValue.toFixed(6)),
          totalValueBTC: Number.parseFloat(totalValueBTC.toFixed(8)),
          allocation,
          performance24h,
        },
        timestamp: new Date().toISOString(),
      } as MexcServiceResponse<any>;
    } catch (error) {
      this.logger.error("Error in getAccountBalancesInternal:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        timestamp: Date.now(),
        source: "unified-mexc-portfolio",
      };
    }
  }

  /**
   * Get account information with balances (internal method)
   */
  async getAccountInfoInternal(): Promise<
    MexcServiceResponse<{
      accountType: string;
      canTrade: boolean;
      canWithdraw: boolean;
      canDeposit: boolean;
      balances: BalanceEntry[];
    }>
  > {
    try {
      const balanceResponse = await this.getAccountBalanceInternal();

      if (!balanceResponse.success) {
        return {
          success: false,
          error: balanceResponse.error,
          timestamp: Date.now(),
          source: "unified-mexc-portfolio",
        };
      }

      return {
        success: true,
        data: {
          accountType: "SPOT", // MEXC spot trading account
          canTrade: true,
          canWithdraw: true,
          canDeposit: true,
          balances: balanceResponse.data || [],
        },
        timestamp: Date.now(),
        source: "unified-mexc-portfolio",
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get account info",
        timestamp: Date.now(),
        source: "unified-mexc-portfolio",
      };
    }
  }

  // ============================================================================
  // Real-Time Price Fetching Methods (Delegated to Price Calculation Service)
  // ============================================================================

  // ============================================================================
  // Validation and Testing Methods (Delegated to Validation Service)
  // ============================================================================

  // ============================================================================
  // Additional Helper Methods
  // ============================================================================

  /**
   * Get top assets by value
   */
  async getTopAssets(limit = 10): Promise<BalanceEntry[]> {
    try {
      const balances = await this.getAccountBalancesInternal();
      if (!balances.success) {
        return [];
      }

      return (
        balances.data?.balances
          .filter((b) => (b.usdtValue || 0) > 0)
          .slice(0, limit) || []
      );
    } catch (error) {
      this.logger.error("Failed to get top assets:", error);
      return [];
    }
  }

  /**
   * Get enhanced portfolio with market data
   */
  async getEnhancedPortfolio(
    tickers?: Record<string, unknown>[]
  ): Promise<MexcServiceResponse<Record<string, unknown>>> {
    try {
      const balancesResponse = await this.getAccountBalancesInternal();

      if (!balancesResponse.success || !balancesResponse.data) {
        throw new Error("Failed to get account balances");
      }

      const portfolio = balancesResponse.data;

      // If tickers provided, calculate enhanced metrics
      if (tickers && tickers.length > 0) {
        const enhancedPortfolio = this.calculatePortfolioMetrics(
          portfolio.balances,
          tickers
        );
        return {
          success: true,
          data: enhancedPortfolio,
          timestamp: Date.now(),
          source: "unified-mexc-portfolio",
        };
      }

      return {
        success: true,
        data: portfolio,
        timestamp: Date.now(),
        source: "unified-mexc-portfolio",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
        source: "unified-mexc-portfolio",
      };
    }
  }

  /**
   * Get portfolio analysis with risk metrics
   */
  async getPortfolioAnalysis(): Promise<
    MexcServiceResponse<Record<string, unknown>>
  > {
    try {
      const portfolioResponse = await this.getAccountBalancesInternal();

      if (!portfolioResponse.success || !portfolioResponse.data) {
        throw new Error("Failed to get portfolio data");
      }

      const portfolio = portfolioResponse.data;

      // Calculate basic risk metrics
      const assetCount = portfolio.balances.length;
      // Create simple allocation based on asset values
      const allocation = this.calculateAllocation(portfolio.balances);
      const concentrationRisk = this.calculateConcentrationRisk(allocation);
      const diversificationScore = this.calculateDiversificationScore(
        assetCount,
        allocation
      );

      const analysisData = {
        summary: {
          totalAssets: assetCount,
          totalValue: portfolio.totalUsdtValue || portfolio.totalValue,
          performance24h: {
            pnl: (portfolio as any).totalPnL || 0,
            pnlPercent: (portfolio as any).totalPnLPercent || 0,
          },
        },
        risk: {
          concentrationRisk,
          diversificationScore,
          riskLevel: this.assessRiskLevel(
            concentrationRisk,
            diversificationScore
          ),
        },
        recommendations: this.generateRecommendations(
          concentrationRisk,
          diversificationScore
        ),
      };

      return {
        success: true,
        data: analysisData,
        timestamp: Date.now(),
        source: "unified-mexc-portfolio",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
        source: "unified-mexc-portfolio",
      };
    }
  }
}

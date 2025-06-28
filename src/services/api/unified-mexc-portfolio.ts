/**
 * Unified MEXC Portfolio Module
 *
 * Portfolio and account-specific methods for the MEXC service.
 * Extracted from unified-mexc-service-v2.ts for better modularity.
 * Implements PortfolioService interface for service compliance.
 */

import type { PortfolioService } from "@/src/application/interfaces/trading-repository";
import type { BalanceEntry, MexcServiceResponse } from "../data/modules/mexc-api-types";
import type { MexcCacheLayer } from "../data/modules/mexc-cache-layer";
import type { MexcCoreClient } from "../data/modules/mexc-core-client";

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

  constructor(
    private coreClient: MexcCoreClient,
    private cacheLayer: MexcCacheLayer
  ) {}

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
      const balances = (result.data?.balances || []).map((balance: BalanceEntry) => ({
        asset: balance.asset,
        free: balance.free,
        locked: balance.locked,
        total: balance.total,
        usdtValue: balance.usdtValue,
      }));

      return {
        success: true,
        data: {
          balances,
          totalUsdtValue: result.data?.totalUsdtValue || 0,
          totalValue: result.data?.totalValue || 0,
          totalValueBTC: result.data?.totalValueBTC || 0,
          allocation: result.data?.allocation || {},
          performance24h: result.data?.performance24h || { change: 0, changePercent: 0 },
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
      const balances = (result.data?.balances || []).map((balance: BalanceEntry) => ({
        asset: balance.asset,
        free: balance.free,
        locked: balance.locked,
      }));

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
      const balances = await this.getAccountBalancesInternal();
      return balances.success ? balances.data?.totalUsdtValue || 0 : 0;
    } catch (error) {
      this.logger.error("Failed to get portfolio value:", error);
      return 0;
    }
  }

  /**
   * Check if user has sufficient balance for trading
   * Implements PortfolioService.hasSufficientBalance interface
   */
  async hasSufficientBalance(asset: string, requiredAmount: number): Promise<boolean> {
    try {
      const balanceResponse = await this.getAccountBalanceInternal();
      if (!balanceResponse.success || !balanceResponse.data) {
        return false;
      }

      const assetBalance = balanceResponse.data.find((balance) => balance.asset === asset);
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
  async getAssetBalance(asset: string): Promise<{ free: string; locked: string } | null> {
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
  async getAccountBalanceInternal(): Promise<MexcServiceResponse<BalanceEntry[]>> {
    return this.cacheLayer.getOrSet(
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
          const enhancedBalances = rawBalances.map((balance: Record<string, unknown>) => {
            const free = parseFloat(balance.free || "0");
            const locked = parseFloat(balance.locked || "0");
            const total = free + locked;

            let usdtValue = 0;
            if (balance.asset === "USDT") {
              usdtValue = total;
            } else {
              const price = priceData[balance.asset];
              if (price && price > 0) {
                usdtValue = total * price;
              }
            }

            return {
              asset: balance.asset,
              free: balance.free,
              locked: balance.locked,
              total,
              usdtValue: Number.parseFloat(usdtValue.toFixed(6)),
            };
          });

          return {
            success: true,
            data: enhancedBalances,
            timestamp: Date.now(),
            source: "unified-mexc-portfolio",
          };
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
          const free = parseFloat(balance.free || "0");
          const locked = parseFloat(balance.locked || "0");
          const total = free + locked;

          // Calculate USDT value using real-time prices
          let usdtValue = 0;
          if (balance.asset === "USDT") {
            usdtValue = total;
          } else {
            const price = priceData[balance.asset];
            if (price && price > 0) {
              usdtValue = total * price;
            }
          }

          return {
            asset: balance.asset,
            free: balance.free,
            locked: balance.locked,
            total,
            usdtValue: Number.parseFloat(usdtValue.toFixed(6)),
          };
        })
      );

      // Calculate portfolio metrics
      const totalUsdtValue = balances.reduce((sum, balance) => sum + (balance.usdtValue || 0), 0);
      const totalValue = totalUsdtValue;

      // Get BTC price for BTC conversion
      const btcPrice = priceData["BTC"] || 0;
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
      const performance24h = await this.calculate24hPerformance(balances, priceData);

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
        timestamp: Date.now(),
        source: "unified-mexc-portfolio",
      };
    } catch (error) {
      this.logger.error("Error in getAccountBalancesInternal:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
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
        error: error instanceof Error ? error.message : "Failed to get account info",
        timestamp: Date.now(),
        source: "unified-mexc-portfolio",
      };
    }
  }

  // ============================================================================
  // Real-Time Price Fetching Methods
  // ============================================================================

  /**
   * Fetch real-time prices for all assets in USDT
   */
  private async fetchRealTimePrices(
    balances: Record<string, unknown>[]
  ): Promise<Record<string, number>> {
    const priceData: Record<string, number> = {};

    try {
      // Extract unique assets (excluding USDT)
      const assets = [
        ...new Set(balances.map((b) => b.asset as string).filter((asset) => asset !== "USDT")),
      ];

      if (assets.length === 0) {
        return priceData;
      }

      // Use efficient batch ticker fetch for multiple assets
      if (assets.length > 3) {
        try {
          const allTickersResult = await this.coreClient.getAllTickers();

          if (allTickersResult.success && Array.isArray(allTickersResult.data)) {
            // Create a map for quick lookups
            const tickerMap = new Map<string, Record<string, unknown>>();
            allTickersResult.data.forEach((ticker) => {
              if (ticker.symbol && ticker.lastPrice) {
                tickerMap.set(ticker.symbol, ticker);
              }
            });

            // Get BTC/USDT rate for conversions
            const btcUsdtTicker = tickerMap.get("BTCUSDT");
            const btcUsdtRate = btcUsdtTicker ? parseFloat(btcUsdtTicker.lastPrice) : 0;

            if (btcUsdtRate > 0) {
              priceData["BTC"] = btcUsdtRate;
            }

            // Process each asset
            for (const asset of assets) {
              // Try USDT pair first
              const usdtSymbol = `${asset}USDT`;
              const usdtTicker = tickerMap.get(usdtSymbol);

              if (usdtTicker?.lastPrice) {
                const price = parseFloat(usdtTicker.lastPrice);
                if (price > 0) {
                  priceData[asset] = price;
                  continue;
                }
              }

              // Try BTC pair if USDT pair not available
              if (btcUsdtRate > 0) {
                const btcSymbol = `${asset}BTC`;
                const btcTicker = tickerMap.get(btcSymbol);

                if (btcTicker?.lastPrice) {
                  const btcPrice = parseFloat(btcTicker.lastPrice);
                  if (btcPrice > 0) {
                    priceData[asset] = btcPrice * btcUsdtRate;
                  }
                }
              }
            }

            return priceData;
          }
        } catch (error) {
          this.logger.warn(
            "Batch ticker fetch failed, falling back to individual requests:",
            error
          );
        }
      }

      // Fallback to individual requests for small asset counts or if batch fails
      const pricePromises = assets.map(async (asset) => {
        try {
          // Try USDT pair first
          const usdtSymbol = `${asset}USDT`;
          const tickerResult = await this.coreClient.getTicker(usdtSymbol);

          if (tickerResult.success && tickerResult.data?.lastPrice) {
            const price = parseFloat(tickerResult.data.lastPrice);
            if (price > 0) {
              priceData[asset] = price;
              return;
            }
          }

          // If USDT pair fails, try BTC pair and convert
          const btcSymbol = `${asset}BTC`;
          const btcTickerResult = await this.coreClient.getTicker(btcSymbol);

          if (btcTickerResult.success && btcTickerResult.data?.lastPrice) {
            const btcPrice = parseFloat(btcTickerResult.data.lastPrice);

            // Get BTC/USDT rate if not already available
            let btcUsdtRate = priceData["BTC"];
            if (!btcUsdtRate) {
              const btcUsdtResult = await this.coreClient.getTicker("BTCUSDT");
              if (btcUsdtResult.success && btcUsdtResult.data?.lastPrice) {
                btcUsdtRate = parseFloat(btcUsdtResult.data.lastPrice);
                priceData["BTC"] = btcUsdtRate;
              }
            }

            if (btcUsdtRate && btcUsdtRate > 0) {
              priceData[asset] = btcPrice * btcUsdtRate;
            }
          }
        } catch (error) {
          this.logger.warn(`Error fetching price for ${asset}:`, error);
        }
      });

      await Promise.allSettled(pricePromises);

      // Ensure BTC price is available for portfolio calculations
      if (!priceData["BTC"]) {
        try {
          const btcUsdtResult = await this.coreClient.getTicker("BTCUSDT");
          if (btcUsdtResult.success && btcUsdtResult.data?.lastPrice) {
            priceData["BTC"] = parseFloat(btcUsdtResult.data.lastPrice);
          }
        } catch (error) {
          this.logger.warn("Error fetching BTC/USDT price:", error);
        }
      }

      return priceData;
    } catch (error) {
      this.logger.error("Error in fetchRealTimePrices:", error);
      return priceData;
    }
  }

  /**
   * Calculate 24h performance data
   */
  private async calculate24hPerformance(
    balances: Record<string, unknown>[],
    priceData: Record<string, number>
  ): Promise<{ change: number; changePercent: number }> {
    try {
      let totalChange = 0;
      let totalCurrentValue = 0;

      // Extract assets that have USDT values
      const assetsWithValue = balances.filter(
        (balance) => balance.usdtValue && (balance.usdtValue as number) > 0
      );

      if (assetsWithValue.length === 0) {
        return { change: 0, changePercent: 0 };
      }

      // Get all ticker data at once for efficiency
      let tickerMap: Map<string, Record<string, unknown>> | null = null;
      try {
        const allTickersResult = await this.coreClient.getAllTickers();
        if (allTickersResult.success && Array.isArray(allTickersResult.data)) {
          tickerMap = new Map();
          allTickersResult.data.forEach((ticker) => {
            if (ticker.symbol && ticker.priceChangePercent !== undefined) {
              tickerMap!.set(ticker.symbol, ticker);
            }
          });
        }
      } catch (error) {
        this.logger.warn("Failed to fetch all tickers for performance calculation:", error);
      }

      for (const balance of assetsWithValue) {
        const usdtValue = balance.usdtValue as number;
        totalCurrentValue += usdtValue;

        try {
          let priceChangePercent = 0;

          if (balance.asset === "USDT") {
            // USDT doesn't change against itself, use 0% change
            priceChangePercent = 0;
          } else {
            const symbol = `${balance.asset}USDT`;

            if (tickerMap && tickerMap.has(symbol)) {
              // Use cached ticker data
              const ticker = tickerMap.get(symbol);
              priceChangePercent = ticker.priceChangePercent
                ? parseFloat(ticker.priceChangePercent)
                : 0;
            } else {
              // Fallback to individual ticker request
              const tickerResult = await this.coreClient.getTicker(symbol);
              if (tickerResult.success && tickerResult.data?.priceChangePercent) {
                priceChangePercent = parseFloat(tickerResult.data.priceChangePercent);
              }
            }
          }

          if (priceChangePercent !== 0) {
            const assetChange = usdtValue * (priceChangePercent / 100);
            totalChange += assetChange;
          }
        } catch (error) {
          // Ignore individual asset errors for performance calculation
          this.logger.debug(`Skipping performance calculation for ${balance.asset}:`, error);
        }
      }

      const changePercent =
        totalCurrentValue > 0 ? (totalChange / (totalCurrentValue - totalChange)) * 100 : 0;

      return {
        change: Number.parseFloat(totalChange.toFixed(6)),
        changePercent: Number.parseFloat(changePercent.toFixed(2)),
      };
    } catch (error) {
      this.logger.error("Error calculating 24h performance:", error);
      return { change: 0, changePercent: 0 };
    }
  }

  // ============================================================================
  // Validation and Testing Methods
  // ============================================================================

  /**
   * Validate that real-time price fetching is working correctly
   */
  async validatePriceFetching(): Promise<{
    success: boolean;
    btcPrice?: number;
    ethPrice?: number;
    samplePrices?: Record<string, number>;
    error?: string;
  }> {
    try {
      // Test fetching common cryptocurrency prices
      const testAssets = [{ asset: "BTC" }, { asset: "ETH" }, { asset: "BNB" }];
      const priceData = await this.fetchRealTimePrices(testAssets);

      const result = {
        success: Object.keys(priceData).length > 0,
        btcPrice: priceData["BTC"],
        ethPrice: priceData["ETH"],
        samplePrices: priceData,
      };

      if (!result.success) {
        return {
          success: false,
          error: "No prices were fetched successfully",
        };
      }

      this.logger.info("Price fetching validation successful:", result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error("Price fetching validation failed:", errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Test the complete balance retrieval flow
   */
  async testBalanceRetrieval(): Promise<{
    success: boolean;
    hasRealPrices: boolean;
    balanceCount: number;
    totalValue?: number;
    error?: string;
  }> {
    try {
      const balanceResult = await this.getAccountBalance();

      if (!balanceResult.success) {
        return {
          success: false,
          hasRealPrices: false,
          balanceCount: 0,
          error: balanceResult.error || "Failed to get account balance",
        };
      }

      const balances = balanceResult.data || [];
      const hasRealPrices = balances.some(
        (balance) => balance.usdtValue && balance.usdtValue > 0 && balance.asset !== "USDT"
      );

      const totalValue = balances.reduce((sum, balance) => sum + (balance.usdtValue || 0), 0);

      return {
        success: true,
        hasRealPrices,
        balanceCount: balances.length,
        totalValue,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        hasRealPrices: false,
        balanceCount: 0,
        error: errorMessage,
      };
    }
  }

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

      return balances.data?.balances.filter((b) => (b.usdtValue || 0) > 0).slice(0, limit) || [];
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
        const enhancedPortfolio = this.calculatePortfolioMetrics(portfolio.balances, tickers);
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
  async getPortfolioAnalysis(): Promise<MexcServiceResponse<Record<string, unknown>>> {
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
      const diversificationScore = this.calculateDiversificationScore(assetCount, allocation);

      const analysisData = {
        summary: {
          totalAssets: assetCount,
          totalValue: portfolio.totalUsdtValue || portfolio.totalValue,
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
   * Calculate detailed portfolio metrics
   */
  private calculatePortfolioMetrics(
    assets: BalanceEntry[],
    tickers: Record<string, unknown>[]
  ): Record<string, unknown> {
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

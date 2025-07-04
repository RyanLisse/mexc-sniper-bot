/**
 * Portfolio Price Calculation Service
 *
 * Handles real-time price fetching and portfolio value calculations.
 * Extracted from unified-mexc-portfolio.ts for modularity.
 *
 * Features:
 * - Real-time price fetching
 * - 24h performance calculations
 * - Portfolio value calculations
 * - Price caching and optimization
 */

import type { BalanceEntry } from "../../data/modules/mexc-api-types";
import type { MexcCacheLayer } from "../../data/modules/mexc-cache-layer";
import type { MexcCoreClient } from "../../data/modules/mexc-core-client";

export interface PriceData {
  symbol: string;
  price: number;
  change24h?: number;
  volume24h?: number;
}

export interface PerformanceData {
  currentValue: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
}

export class PortfolioPriceCalculationService {
  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[portfolio-price-calculation]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[portfolio-price-calculation]", message, context || ""),
    error: (message: string, context?: unknown) =>
      console.error("[portfolio-price-calculation]", message, context || ""),
    debug: (message: string, context?: unknown) =>
      console.debug("[portfolio-price-calculation]", message, context || ""),
  };

  constructor(
    private coreClient: MexcCoreClient,
    private cacheLayer: MexcCacheLayer
  ) {}

  /**
   * Fetch real-time prices for given assets
   */
  async fetchRealTimePrices(assets: string[]): Promise<{
    success: boolean;
    data?: Record<string, PriceData>;
    error?: string;
  }> {
    try {
      this.logger.debug("Fetching real-time prices", { assets });

      if (!assets || assets.length === 0) {
        return { success: true, data: {} };
      }

      // Filter out stablecoins and base currencies that don't need price conversion
      const stablecoins = ["USDT", "USDC", "BUSD", "DAI"];
      const assetsNeedingPrices = assets.filter(
        (asset) => !stablecoins.includes(asset.toUpperCase())
      );

      if (assetsNeedingPrices.length === 0) {
        // All assets are stablecoins, return 1.0 prices
        const stablePrices: Record<string, PriceData> = {};
        for (const asset of assets) {
          stablePrices[asset] = {
            symbol: asset,
            price: 1.0,
            change24h: 0,
            volume24h: 0,
          };
        }
        return { success: true, data: stablePrices };
      }

      // Use cache for price data
      const cacheKey = `portfolio-prices-${assetsNeedingPrices.sort().join(",")}`;
      const cachedPrices = await this.cacheLayer.get(cacheKey);

      if (cachedPrices && typeof cachedPrices === "object") {
        this.logger.debug("Using cached prices", { cacheKey });
        return {
          success: true,
          data: cachedPrices as Record<string, PriceData>,
        };
      }

      // Fetch prices from API
      const prices: Record<string, PriceData> = {};

      // Add stablecoin prices
      for (const asset of assets) {
        if (stablecoins.includes(asset.toUpperCase())) {
          prices[asset] = {
            symbol: asset,
            price: 1.0,
            change24h: 0,
            volume24h: 0,
          };
        }
      }

      // Fetch other asset prices
      const pricePromises = assetsNeedingPrices.map(async (asset) => {
        try {
          const symbol = `${asset.toUpperCase()}USDT`;
          const response = await this.coreClient.makeRequest(
            "GET",
            "/api/v3/ticker/24hr",
            { symbol }
          );

          if (response.success && response.data) {
            const ticker = response.data;
            return {
              asset,
              price: parseFloat(ticker.lastPrice || "0"),
              change24h: parseFloat(ticker.priceChange || "0"),
              volume24h: parseFloat(ticker.volume || "0"),
            };
          }
          return null;
        } catch (error) {
          this.logger.warn(`Failed to fetch price for ${asset}`, { error });
          return null;
        }
      });

      const priceResults = await Promise.allSettled(pricePromises);

      for (let i = 0; i < priceResults.length; i++) {
        const result = priceResults[i];
        if (result.status === "fulfilled" && result.value) {
          const { asset, price, change24h, volume24h } = result.value;
          prices[asset] = {
            symbol: asset,
            price,
            change24h,
            volume24h,
          };
        }
      }

      // Cache the results for 1 minute
      await this.cacheLayer.set(cacheKey, prices, 60);

      this.logger.info("Successfully fetched real-time prices", {
        assetsCount: Object.keys(prices).length,
      });

      return { success: true, data: prices };
    } catch (error) {
      this.logger.error("Error fetching real-time prices", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Calculate 24h portfolio performance
   */
  async calculate24hPerformance(
    balances: BalanceEntry[]
  ): Promise<{ success: boolean; data?: PerformanceData; error?: string }> {
    try {
      this.logger.debug("Calculating 24h performance", {
        balancesCount: balances.length,
      });

      if (!balances || balances.length === 0) {
        return {
          success: true,
          data: {
            currentValue: 0,
            change24h: 0,
            changePercent24h: 0,
            volume24h: 0,
          },
        };
      }

      // Get assets with non-zero balances
      const significantBalances = balances.filter(
        (balance) =>
          parseFloat(balance.free) + parseFloat(balance.locked) > 0.001
      );

      if (significantBalances.length === 0) {
        return {
          success: true,
          data: {
            currentValue: 0,
            change24h: 0,
            changePercent24h: 0,
            volume24h: 0,
          },
        };
      }

      const assets = significantBalances.map((balance) => balance.asset);
      const pricesResult = await this.fetchRealTimePrices(assets);

      if (!pricesResult.success || !pricesResult.data) {
        return {
          success: false,
          error: pricesResult.error || "Failed to fetch prices",
        };
      }

      const prices = pricesResult.data;
      let currentValue = 0;
      let change24h = 0;
      let volume24h = 0;

      for (const balance of significantBalances) {
        const totalBalance =
          parseFloat(balance.free) + parseFloat(balance.locked);
        const priceData = prices[balance.asset];

        if (priceData && totalBalance > 0) {
          const assetValue = totalBalance * priceData.price;
          const assetChange24h = totalBalance * (priceData.change24h || 0);

          currentValue += assetValue;
          change24h += assetChange24h;
          volume24h += priceData.volume24h || 0;
        }
      }

      const previousValue = currentValue - change24h;
      const changePercent24h =
        previousValue > 0 ? (change24h / previousValue) * 100 : 0;

      const performanceData: PerformanceData = {
        currentValue,
        change24h,
        changePercent24h,
        volume24h,
      };

      this.logger.info("Successfully calculated 24h performance", {
        currentValue,
        changePercent24h: changePercent24h.toFixed(2),
      });

      return { success: true, data: performanceData };
    } catch (error) {
      this.logger.error("Error calculating 24h performance", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Calculate total portfolio value in USDT
   */
  async calculateTotalValue(balances: BalanceEntry[]): Promise<number> {
    try {
      if (!balances || balances.length === 0) {
        return 0;
      }

      const significantBalances = balances.filter(
        (balance) =>
          parseFloat(balance.free) + parseFloat(balance.locked) > 0.001
      );

      if (significantBalances.length === 0) {
        return 0;
      }

      const assets = significantBalances.map((balance) => balance.asset);
      const pricesResult = await this.fetchRealTimePrices(assets);

      if (!pricesResult.success || !pricesResult.data) {
        this.logger.warn(
          "Failed to fetch prices for portfolio value calculation"
        );
        return 0;
      }

      const prices = pricesResult.data;
      let totalValue = 0;

      for (const balance of significantBalances) {
        const totalBalance =
          parseFloat(balance.free) + parseFloat(balance.locked);
        const priceData = prices[balance.asset];

        if (priceData && totalBalance > 0) {
          totalValue += totalBalance * priceData.price;
        }
      }

      return totalValue;
    } catch (error) {
      this.logger.error("Error calculating total portfolio value", { error });
      return 0;
    }
  }

  /**
   * Validate price fetching functionality
   */
  async validatePriceFetching(): Promise<{
    success: boolean;
    results: Array<{
      asset: string;
      success: boolean;
      price?: number;
      error?: string;
    }>;
  }> {
    const testAssets = ["BTC", "ETH", "BNB", "USDT"];
    const results: Array<{
      asset: string;
      success: boolean;
      price?: number;
      error?: string;
    }> = [];

    for (const asset of testAssets) {
      try {
        const priceResult = await this.fetchRealTimePrices([asset]);

        if (priceResult.success && priceResult.data?.[asset]) {
          results.push({
            asset,
            success: true,
            price: priceResult.data[asset].price,
          });
        } else {
          results.push({
            asset,
            success: false,
            error: priceResult.error || "No price data returned",
          });
        }
      } catch (error) {
        results.push({
          asset,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((result) => result.success).length;
    const overallSuccess = successCount > 0;

    this.logger.info("Price fetching validation completed", {
      successCount,
      totalAssets: testAssets.length,
      overallSuccess,
    });

    return {
      success: overallSuccess,
      results,
    };
  }
}

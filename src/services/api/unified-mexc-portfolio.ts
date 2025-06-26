/**
 * Unified MEXC Portfolio Module
 *
 * Portfolio and account-specific methods for the MEXC service.
 * Extracted from unified-mexc-service-v2.ts for better modularity.
 */

import type { BalanceEntry, MexcServiceResponse } from "../data/modules/mexc-api-types";
import type { MexcCacheLayer } from "../data/modules/mexc-cache-layer";
import type { MexcCoreClient } from "../data/modules/mexc-core-client";

// ============================================================================
// Portfolio Service Module
// ============================================================================

export class UnifiedMexcPortfolioModule {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[unified-mexc-portfolio]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[unified-mexc-portfolio]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[unified-mexc-portfolio]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[unified-mexc-portfolio]", message, context || ""),
  };

  constructor(
    private coreClient: MexcCoreClient,
    private cacheLayer: MexcCacheLayer
  ) {}

  // ============================================================================
  // Account & Portfolio Methods
  // ============================================================================

  /**
   * Get account balance
   */
  async getAccountBalance(): Promise<MexcServiceResponse<BalanceEntry[]>> {
    return this.cacheLayer.getOrSet(
      "account:balance",
      () => this.coreClient.getAccountBalance(),
      "user" // 10 minute cache for user data
    );
  }

  /**
   * Get account balances as Portfolio object
   */
  async getAccountBalances(): Promise<
    MexcServiceResponse<{
      balances: BalanceEntry[];
      totalUsdtValue: number;
      totalValue: number;
      totalValueBTC: number;
      allocation: Record<string, number>;
      performance24h: { change: number; changePercent: number };
    }>
  > {
    // Get the basic balance data
    const balanceResponse = await this.coreClient.getAccountBalance();

    if (!balanceResponse.success) {
      // Return error in Portfolio format
      return {
        success: false,
        error: balanceResponse.error,
        timestamp: Date.now(),
        source: "unified-mexc-portfolio",
      };
    }

    const rawBalances = balanceResponse.data || [];

    // Transform raw balances to include calculated fields
    const balances = rawBalances.map((balance: any) => {
      const free = parseFloat(balance.free || "0");
      const locked = parseFloat(balance.locked || "0");
      const total = free + locked;

      // For now, use simplified USDT value calculation
      // In production, this should fetch real-time prices from MEXC price API
      let usdtValue = 0;
      if (balance.asset === "USDT") {
        usdtValue = total;
      } else if (balance.asset === "BTC") {
        usdtValue = total * 40000; // Placeholder BTC price
      } else if (balance.asset === "ETH") {
        usdtValue = total * 2500; // Placeholder ETH price
      } else {
        usdtValue = total * 1; // Placeholder for other assets
      }

      return {
        asset: balance.asset,
        free: balance.free,
        locked: balance.locked,
        total,
        usdtValue,
      };
    });

    // Calculate portfolio metrics
    const totalUsdtValue = balances.reduce((sum, balance) => sum + (balance.usdtValue || 0), 0);
    const totalValue = totalUsdtValue; // For now, treat as same as USDT value
    const totalValueBTC = totalUsdtValue * 0.000025; // Rough BTC conversion (this should be fetched from price API)

    // Calculate allocation percentages
    const allocation: Record<string, number> = {};
    if (totalUsdtValue > 0) {
      balances.forEach((balance) => {
        if (balance.usdtValue && balance.usdtValue > 0) {
          allocation[balance.asset] = (balance.usdtValue / totalUsdtValue) * 100;
        }
      });
    }

    // Placeholder performance data (should be calculated from historical data)
    const performance24h = {
      change: 0,
      changePercent: 0,
    };

    return {
      success: true,
      data: {
        balances,
        totalUsdtValue,
        totalValue,
        totalValueBTC,
        allocation,
        performance24h,
      },
      timestamp: Date.now(),
      source: "unified-mexc-portfolio",
    };
  }

  /**
   * Get account information with balances
   */
  async getAccountInfo(): Promise<
    MexcServiceResponse<{
      accountType: string;
      canTrade: boolean;
      canWithdraw: boolean;
      canDeposit: boolean;
      balances: BalanceEntry[];
    }>
  > {
    try {
      const balanceResponse = await this.getAccountBalance();

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

  /**
   * Calculate total portfolio value in USDT
   */
  async getTotalPortfolioValue(): Promise<number> {
    try {
      const balances = await this.getAccountBalances();
      return balances.success ? balances.data.totalUsdtValue : 0;
    } catch (error) {
      this.logger.error("Failed to get portfolio value:", error);
      return 0;
    }
  }

  /**
   * Get top assets by value
   */
  async getTopAssets(limit = 10): Promise<BalanceEntry[]> {
    try {
      const balances = await this.getAccountBalances();
      if (!balances.success) {
        return [];
      }

      return balances.data.balances.filter((b) => (b.usdtValue || 0) > 0).slice(0, limit);
    } catch (error) {
      this.logger.error("Failed to get top assets:", error);
      return [];
    }
  }

  /**
   * Check if user has sufficient balance for trading
   */
  async hasSufficientBalance(asset: string, requiredAmount: number): Promise<boolean> {
    try {
      const balanceResponse = await this.getAccountBalance();
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
   */
  async getAssetBalance(asset: string): Promise<{ free: string; locked: string } | null> {
    try {
      const balancesResponse = await this.getAccountBalances();
      if (!balancesResponse.success) {
        return null;
      }

      const assetBalance = balancesResponse.data.balances.find(
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
}

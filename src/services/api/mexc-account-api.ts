/**
 * MEXC Account API Methods
 *
 * Authenticated account methods including account info and balance retrieval.
 * Extracted from unified-mexc-client.ts for better modularity.
 */

import { getGlobalErrorRecoveryService } from "../risk/mexc-error-recovery-service";
import type {
  BalanceEntry,
  UnifiedMexcConfig,
  UnifiedMexcResponse,
} from "./mexc-client-types";
import { BalanceEntrySchema } from "./mexc-client-types";
import { MexcMarketDataClient } from "./mexc-market-data";

// ============================================================================
// Account API Client
// ============================================================================

export class MexcAccountApiClient extends MexcMarketDataClient {
  protected accountLogger = {
    info: (message: string, context?: any) =>
      console.info("[mexc-account-api]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[mexc-account-api]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[mexc-account-api]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[mexc-account-api]", message, context || ""),
  };

  constructor(config: UnifiedMexcConfig = {}) {
    super(config);
  }

  // ============================================================================
  // Account Information
  // ============================================================================

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<
    UnifiedMexcResponse<Record<string, unknown>>
  > {
    if (!this.config.apiKey || !this.config.secretKey) {
      return {
        success: false,
        data: {},
        error: "MEXC API credentials not configured for account info",
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const response = await this.makeRequest(
        "/api/v3/account",
        {},
        true,
        true
      ); // Skip cache for account info
      return response as UnifiedMexcResponse<Record<string, unknown>>;
    } catch (error) {
      console.error("[MexcAccountApi] Account info failed:", error);
      return {
        success: false,
        data: {},
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ============================================================================
  // Balance Management
  // ============================================================================

  /**
   * Get account balances with USDT conversion
   */
  async getAccountBalances(): Promise<
    UnifiedMexcResponse<{
      balances: BalanceEntry[];
      totalUsdtValue: number;
      lastUpdated: string;
    }>
  > {
    if (!this.config.apiKey || !this.config.secretKey) {
      console.error("[MexcAccountApi] MEXC API credentials not configured");
      return {
        success: false,
        data: {
          balances: [],
          totalUsdtValue: 0,
          lastUpdated: new Date().toISOString(),
        },
        error:
          "MEXC API credentials not configured. Please add MEXC_API_KEY and MEXC_SECRET_KEY to your environment variables.",
        timestamp: new Date().toISOString(),
      };
    }

    // Use error recovery service for this critical operation
    const recoveryService = getGlobalErrorRecoveryService();

    try {
      console.info(
        "[MexcAccountApi] Fetching account balances with error recovery..."
      );

      // Get account info with balances using error recovery
      const accountResponse = await recoveryService.handleMexcApiCall(
        () =>
          this.makeRequest<{
            balances: Array<{
              asset: string;
              free: string;
              locked: string;
            }>;
          }>("/api/v3/account", {}, true, true), // Skip cache for account info
        // Fallback: Try with environment credentials if available
        this.config.apiKey !== process.env.MEXC_API_KEY &&
          process.env.MEXC_API_KEY &&
          process.env.MEXC_SECRET_KEY
          ? () => {
              const fallbackClient = new MexcAccountApiClient({
                apiKey: process.env.MEXC_API_KEY!,
                secretKey: process.env.MEXC_SECRET_KEY!,
                baseUrl: this.config.baseUrl,
                timeout: this.config.timeout,
              });
              return fallbackClient.makeRequest<{
                balances: Array<{
                  asset: string;
                  free: string;
                  locked: string;
                }>;
              }>("/api/v3/account", {}, true, true);
            }
          : undefined,
        "Account Balances"
      );

      console.info("[MexcAccountApi] Raw account response:", {
        success: accountResponse.success,
        hasData: !!accountResponse.data,
        hasBalances: !!accountResponse.data?.balances,
        balancesLength: accountResponse.data?.balances?.length,
        error: accountResponse.error,
        timestamp: accountResponse.timestamp,
      });

      // Handle nested MEXC API response structure: response.data.data.balances
      // MEXC API returns data.data = null when account has no balances (valid case)
      const actualBalances =
        (accountResponse.data && "balances" in accountResponse.data
          ? (accountResponse.data as { balances: any[] }).balances
          : []) || [];
      const hasValidData = accountResponse.success && accountResponse.data;

      if (!hasValidData) {
        console.error("[MexcAccountApi] Account response validation failed:", {
          success: accountResponse.success,
          hasData: !!accountResponse.data,
          hasDirectBalances: !!(
            accountResponse.data && "balances" in accountResponse.data
          ),
          hasActualBalances: !!actualBalances,
          error: accountResponse.error,
          data: accountResponse.data,
        });

        return {
          success: false,
          data: {
            balances: [],
            totalUsdtValue: 0,
            lastUpdated: new Date().toISOString(),
          },
          error: accountResponse.error || "Invalid account balance response",
          timestamp: new Date().toISOString(),
        };
      }

      // Get valid trading pairs for USDT conversion validation
      const exchangeInfo = await this.getExchangeInfo();
      console.info("[MexcAccountApi] Exchange info response:", {
        success: exchangeInfo.success,
        hasData: !!exchangeInfo.data,
        isArray: Array.isArray(exchangeInfo.data),
        symbolsCount: Array.isArray(exchangeInfo.data)
          ? exchangeInfo.data.length
          : 0,
        error: exchangeInfo.error,
      });

      const validTradingPairs = new Set(
        exchangeInfo.success
          ? exchangeInfo.data
              .filter(
                (symbol) =>
                  symbol.quoteAsset === "USDT" && symbol.status === "1"
              )
              .map((symbol) => symbol.symbol)
          : []
      );

      console.info("[MexcAccountApi] Valid trading pairs:", {
        count: validTradingPairs.size,
        samplePairs: Array.from(validTradingPairs).slice(0, 10),
      });

      // Filter non-zero balances first
      const nonZeroBalances = actualBalances.filter((balance: any) => {
        const total =
          Number.parseFloat(balance.free) + Number.parseFloat(balance.locked);
        return total > 0;
      });

      console.info("[MexcAccountApi] Non-zero balances:", {
        count: nonZeroBalances.length,
        assets: nonZeroBalances.map((b: any) => b.asset),
      });

      // Get symbols we need prices for (excluding USDT)
      const symbolsNeeded = nonZeroBalances
        .filter((balance: any) => balance.asset !== "USDT")
        .map((balance: any) => `${balance.asset}USDT`)
        .filter((symbol: any) => validTradingPairs.has(symbol));

      console.info("[MexcAccountApi] Symbols needed for pricing:", {
        count: symbolsNeeded.length,
        symbols: symbolsNeeded,
        allPossibleSymbols: nonZeroBalances
          .filter((balance: any) => balance.asset !== "USDT")
          .map((balance: any) => `${balance.asset}USDT`),
      });

      // Fetch prices for specific symbols
      const priceMap = new Map<string, number>();

      for (const symbol of symbolsNeeded) {
        try {
          console.info(`[MexcAccountApi] Fetching price for ${symbol}...`);
          const tickerResponse = await this.get24hrTicker(symbol);
          console.info(`[MexcAccountApi] Ticker response for ${symbol}:`, {
            success: tickerResponse.success,
            dataLength: tickerResponse.data?.length || 0,
            hasData: !!tickerResponse.data,
            error: tickerResponse.error,
          });

          if (tickerResponse.success && tickerResponse.data.length > 0) {
            const ticker = tickerResponse.data[0];
            console.info(`[MexcAccountApi] Ticker data for ${symbol}:`, {
              lastPrice: ticker?.lastPrice,
              price: ticker?.price,
              symbol: ticker?.symbol,
            });

            // MEXC API uses lastPrice as the primary price field
            const price = ticker?.lastPrice || ticker?.price;
            if (price && Number.parseFloat(price) > 0) {
              priceMap.set(symbol, Number.parseFloat(price));
              console.info(
                `[MexcAccountApi] ✅ Price found for ${symbol}: ${price}`
              );
            } else {
              console.warn(`[MexcAccountApi] ❌ Invalid price for ${symbol}:`, {
                price,
                lastPrice: ticker?.lastPrice,
                regularPrice: ticker?.price,
              });
            }
          } else {
            console.warn(`[MexcAccountApi] ❌ No ticker data for ${symbol}:`, {
              success: tickerResponse.success,
              dataLength: tickerResponse.data?.length || 0,
              error: tickerResponse.error,
            });
          }
        } catch (error) {
          console.error(
            `[MexcAccountApi] Failed to get price for ${symbol}:`,
            error
          );
        }
      }

      // Process balances with fetched prices
      const balances: BalanceEntry[] = nonZeroBalances
        .map((balance: any): BalanceEntry | null => {
          const total =
            Number.parseFloat(balance.free) + Number.parseFloat(balance.locked);
          let usdtValue = 0;

          if (balance.asset === "USDT") {
            usdtValue = total;
          } else {
            const symbol = `${balance.asset}USDT`;
            const price = priceMap.get(symbol);

            if (price && price > 0) {
              usdtValue = total * price;
              this.accountLogger.debug(
                `[MexcAccountApi] USDT conversion: ${balance.asset} (${total}) @ ${price} = ${usdtValue.toFixed(6)} USDT`
              );
            }
          }

          try {
            return BalanceEntrySchema.parse({
              asset: balance.asset,
              free: balance.free,
              locked: balance.locked,
              total,
              usdtValue,
            });
          } catch (_error) {
            console.warn("[MexcAccountApi] Invalid balance entry:", balance);
            return null;
          }
        })
        .filter(
          (balance: BalanceEntry | null): balance is BalanceEntry =>
            balance !== null
        )
        .sort(
          (a: BalanceEntry, b: BalanceEntry) =>
            (b.usdtValue || 0) - (a.usdtValue || 0)
        ); // Sort by USDT value desc

      const totalUsdtValue = balances.reduce(
        (sum, balance) => sum + (balance.usdtValue || 0),
        0
      );
      const balancesWithValue = balances.filter((b) => (b.usdtValue || 0) > 0);

      console.info(
        `[MexcAccountApi] Retrieved ${balances.length} non-zero balances (${balancesWithValue.length} with USDT value), total value: ${totalUsdtValue.toFixed(2)} USDT`
      );

      return {
        success: true,
        data: {
          balances,
          totalUsdtValue,
          lastUpdated: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
        requestId: accountResponse.requestId,
      };
    } catch (error) {
      console.error("[MexcAccountApi] Account balances failed:", error);

      // Provide more helpful error messages for common MEXC API issues
      let errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      if (
        errorMessage.includes("700002") ||
        errorMessage.includes("Signature for this request is not valid")
      ) {
        errorMessage =
          "MEXC API signature validation failed. This is likely due to: 1) IP address not allowlisted for API key, 2) Invalid API credentials, or 3) Clock synchronization issues. Please check your MEXC API key settings and ensure your deployment IP is allowlisted.";
      } else if (
        errorMessage.includes("10072") ||
        errorMessage.includes("Api key info invalid")
      ) {
        errorMessage =
          "MEXC API key is invalid or expired. Please check your MEXC_API_KEY and MEXC_SECRET_KEY environment variables.";
      }

      return {
        success: false,
        data: {
          balances: [],
          totalUsdtValue: 0,
          lastUpdated: new Date().toISOString(),
        },
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get balance for a specific asset
   */
  async getAssetBalance(
    asset: string
  ): Promise<{ free: string; locked: string } | null> {
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
      console.error("[MexcAccountApi] Failed to get asset balance:", error);
      return null;
    }
  }

  // ============================================================================
  // Account Status and Permissions
  // ============================================================================

  /**
   * Check if account can trade
   */
  async canTrade(): Promise<boolean> {
    try {
      const accountInfo = await this.getAccountInfo();
      if (!accountInfo.success) {
        return false;
      }

      // MEXC account info includes canTrade field
      return Boolean(accountInfo.data?.canTrade);
    } catch (error) {
      console.error(
        "[MexcAccountApi] Failed to check trading permission:",
        error
      );
      return false;
    }
  }

  /**
   * Get account type (SPOT, MARGIN, FUTURES)
   */
  async getAccountType(): Promise<string> {
    try {
      const accountInfo = await this.getAccountInfo();
      if (!accountInfo.success) {
        return "UNKNOWN";
      }

      return (accountInfo.data?.accountType as string) || "SPOT";
    } catch (error) {
      console.error("[MexcAccountApi] Failed to get account type:", error);
      return "UNKNOWN";
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Calculate total portfolio value in USDT
   */
  async getTotalPortfolioValue(): Promise<number> {
    try {
      const balances = await this.getAccountBalances();
      return balances.success ? balances.data.totalUsdtValue : 0;
    } catch (error) {
      console.error("[MexcAccountApi] Failed to get portfolio value:", error);
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

      return balances.data.balances
        .filter((b) => (b.usdtValue || 0) > 0)
        .slice(0, limit);
    } catch (error) {
      console.error("[MexcAccountApi] Failed to get top assets:", error);
      return [];
    }
  }

  /**
   * Check if user has sufficient balance for trading
   */
  async hasSufficientBalance(
    asset: string,
    requiredAmount: number
  ): Promise<boolean> {
    try {
      const balance = await this.getAssetBalance(asset);
      if (!balance) {
        return false;
      }

      const availableAmount = Number.parseFloat(balance.free);
      return availableAmount >= requiredAmount;
    } catch (error) {
      console.error(
        "[MexcAccountApi] Failed to check balance sufficiency:",
        error
      );
      return false;
    }
  }
}

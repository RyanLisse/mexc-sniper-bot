/**
 * MEXC Core Account Client
 *
 * Account-related methods for MEXC API communication.
 * Extracted from core client for better separation of concerns.
 */

import type { BalanceEntry, MexcServiceResponse } from "./mexc-api-types";
import type { MexcCoreHttpClient } from "./mexc-core-http";

// ============================================================================
// Account Operations
// ============================================================================

export class MexcCoreAccountClient {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[mexc-core-account]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[mexc-core-account]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[mexc-core-account]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[mexc-core-account]", message, context || ""),
  };

  constructor(private httpClient: MexcCoreHttpClient) {}

  // ============================================================================
  // Account Information Methods
  // ============================================================================

  /**
   * Get account balance
   */
  async getAccountBalance(): Promise<MexcServiceResponse<BalanceEntry[]>> {
    const startTime = Date.now();

    try {
      const config = this.httpClient.getConfig();
      const timestamp = Date.now();
      const url = `${config.baseUrl}/api/v3/account?timestamp=${timestamp}`;
      const response = await this.httpClient.makeAuthenticatedRequest(url, {
        method: "GET",
      });

      // MEXC API returns account data directly in response, not nested under 'data'
      if (response.balances && Array.isArray(response.balances)) {
        const balances = response.balances
          .filter(
            (balance: any) =>
              Number.parseFloat(balance.free) > 0 || Number.parseFloat(balance.locked) > 0
          )
          .map((balance: any) => ({
            asset: balance.asset,
            free: balance.free,
            locked: balance.locked,
          }));

        return {
          success: true,
          data: balances,
          timestamp: Date.now(),
          source: "mexc-core-account",
        };
      }

      return {
        success: false,
        error: "Invalid balance response format",
        timestamp: Date.now(),
        source: "mexc-core-account",
      };
    } catch (error) {
      return this.httpClient.handleError(error, "getAccountBalance", startTime);
    }
  }

  /**
   * Get account information (comprehensive account data)
   */
  async getAccountInfo(): Promise<MexcServiceResponse<any>> {
    const startTime = Date.now();

    try {
      const config = this.httpClient.getConfig();
      const timestamp = Date.now();
      const url = `${config.baseUrl}/api/v3/account?timestamp=${timestamp}`;
      const response = await this.httpClient.makeAuthenticatedRequest(url, {
        method: "GET",
      });

      return {
        success: true,
        data: response,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        source: "mexc-core-account",
      };
    } catch (error) {
      return this.httpClient.handleError(error, "getAccountInfo", startTime);
    }
  }

  /**
   * Check account permissions and status
   */
  async checkAccountPermissions(): Promise<
    MexcServiceResponse<{
      canTrade: boolean;
      canWithdraw: boolean;
      canDeposit: boolean;
      permissions: string[];
    }>
  > {
    const startTime = Date.now();

    try {
      const accountInfo = await this.getAccountInfo();

      if (!accountInfo.success) {
        return {
          success: false,
          error: accountInfo.error,
          timestamp: Date.now(),
          source: "mexc-core-account",
        };
      }

      const permissions = accountInfo.data?.permissions || [];

      return {
        success: true,
        data: {
          canTrade: permissions.includes("SPOT"),
          canWithdraw: permissions.includes("WITHDRAWALS") || permissions.includes("WITHDRAWAL"),
          canDeposit: permissions.includes("DEPOSITS") || permissions.includes("DEPOSIT"),
          permissions: permissions,
        },
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        source: "mexc-core-account",
      };
    } catch (error) {
      return this.httpClient.handleError(error, "checkAccountPermissions", startTime);
    }
  }

  /**
   * Get trading fees for account
   */
  async getTradingFees(symbol?: string): Promise<MexcServiceResponse<any>> {
    const startTime = Date.now();

    try {
      const config = this.httpClient.getConfig();
      const timestamp = Date.now();

      let url = `${config.baseUrl}/api/v3/tradeFee?timestamp=${timestamp}`;
      if (symbol) {
        url += `&symbol=${symbol}`;
      }

      const response = await this.httpClient.makeAuthenticatedRequest(url, {
        method: "GET",
      });

      return {
        success: true,
        data: response,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        source: "mexc-core-account",
      };
    } catch (error) {
      return this.httpClient.handleError(error, "getTradingFees", startTime);
    }
  }

  /**
   * Get account status and API limits
   */
  async getAccountStatus(): Promise<
    MexcServiceResponse<{
      accountType: string;
      canTrade: boolean;
      apiRestricted: boolean;
      rateLimits: any[];
    }>
  > {
    const startTime = Date.now();

    try {
      const accountInfo = await this.getAccountInfo();

      if (!accountInfo.success) {
        return {
          success: false,
          error: accountInfo.error,
          timestamp: Date.now(),
          source: "mexc-core-account",
        };
      }

      const data = accountInfo.data;

      return {
        success: true,
        data: {
          accountType: data.accountType || "SPOT",
          canTrade: data.canTrade !== false,
          apiRestricted: data.permissions && !data.permissions.includes("SPOT"),
          rateLimits: data.rateLimits || [],
        },
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        source: "mexc-core-account",
      };
    } catch (error) {
      return this.httpClient.handleError(error, "getAccountStatus", startTime);
    }
  }

  /**
   * Get balance for a specific asset
   */
  async getAssetBalance(asset: string): Promise<MexcServiceResponse<BalanceEntry | null>> {
    const startTime = Date.now();

    try {
      const balanceResult = await this.getAccountBalance();

      if (!balanceResult.success) {
        return {
          success: false,
          error: balanceResult.error,
          timestamp: Date.now(),
          source: "mexc-core-account",
        };
      }

      const assetBalance = balanceResult.data?.find(
        (balance) => balance.asset.toUpperCase() === asset.toUpperCase()
      );

      return {
        success: true,
        data: assetBalance || null,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        source: "mexc-core-account",
      };
    } catch (error) {
      return this.httpClient.handleError(error, "getAssetBalance", startTime);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new MEXC account client instance
 */
export function createMexcCoreAccountClient(httpClient: MexcCoreHttpClient): MexcCoreAccountClient {
  return new MexcCoreAccountClient(httpClient);
}

// ============================================================================
// Exports
// ============================================================================

export default MexcCoreAccountClient;

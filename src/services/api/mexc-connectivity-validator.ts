/**
 * MEXC Connectivity Validator
 *
 * Comprehensive network connectivity and API validation service
 * that addresses all identified connectivity issues and provides
 * reliable status reporting across all endpoints.
 */

import { toSafeError } from "@/src/lib/error-type-utils";
import { getUnifiedMexcService } from "./unified-mexc-service-factory";

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ConnectivityValidationResult {
  overall: "READY" | "PARTIAL" | "BLOCKED";
  connectivity: {
    apiReachable: boolean;
    responseTime?: number;
    serverTime?: number;
  };
  authentication: {
    valid: boolean;
    accountAccessible: boolean;
    permissions: string[];
    accountType?: string;
    canTrade?: boolean;
  };
  balances: {
    accessible: boolean;
    totalAssets: number;
    usdtBalance?: number;
    sufficientForTrading: boolean;
  };
  trading: {
    ordersAllowed: boolean;
    hasUsdtPairs: boolean;
    tradingStatus: string;
  };
  errors: string[];
  warnings: string[];
  recommendations: string[];
  timestamp: string;
}

// ============================================================================
// MEXC Connectivity Validator Implementation
// ============================================================================

export class MexcConnectivityValidator {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[mexc-connectivity-validator]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[mexc-connectivity-validator]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[mexc-connectivity-validator]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[mexc-connectivity-validator]", message, context || ""),
  };

  private timeout = 15000; // 15 seconds
  private minPositionSize = 10; // Minimum USDT for trading

  constructor(options?: {
    timeout?: number;
    minPositionSize?: number;
  }) {
    if (options?.timeout) this.timeout = options.timeout;
    if (options?.minPositionSize) this.minPositionSize = options.minPositionSize;
  }

  /**
   * Perform comprehensive connectivity validation
   */
  async validateConnectivity(options?: {
    userId?: string;
    apiKey?: string;
    secretKey?: string;
    skipCache?: boolean;
  }): Promise<ConnectivityValidationResult> {
    const result: ConnectivityValidationResult = {
      overall: "BLOCKED",
      connectivity: { apiReachable: false },
      authentication: { valid: false, accountAccessible: false, permissions: [] },
      balances: { accessible: false, totalAssets: 0, sufficientForTrading: false },
      trading: { ordersAllowed: false, hasUsdtPairs: false, tradingStatus: "unknown" },
      errors: [],
      warnings: [],
      recommendations: [],
      timestamp: new Date().toISOString(),
    };

    console.info("[MexcConnectivityValidator] Starting comprehensive validation...");

    try {
      // Get MEXC service instance
      const mexcService = await getUnifiedMexcService({
        userId: options?.userId,
        apiKey: options?.apiKey,
        secretKey: options?.secretKey,
        skipCache: options?.skipCache || false,
      });

      // Step 1: Test basic connectivity
      await this.testBasicConnectivity(mexcService, result);

      // Step 2: Test authentication (only if connectivity works)
      if (result.connectivity.apiReachable) {
        await this.testAuthentication(mexcService, result);
      }

      // Step 3: Test balance access (only if authenticated)
      if (result.authentication.valid) {
        await this.testBalanceAccess(mexcService, result);
      }

      // Step 4: Test trading capabilities (only if balances accessible)
      if (result.balances.accessible) {
        await this.testTradingCapabilities(mexcService, result);
      }

      // Step 5: Determine overall status
      this.determineOverallStatus(result);

      console.info("[MexcConnectivityValidator] Validation completed:", {
        overall: result.overall,
        connectivity: result.connectivity.apiReachable,
        authentication: result.authentication.valid,
        balances: result.balances.accessible,
        trading: result.trading.ordersAllowed,
      });

      return result;
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("[MexcConnectivityValidator] Validation failed:", safeError.message);

      result.errors.push(`Validation failed: ${safeError.message}`);
      result.recommendations.push("Check network connectivity and API credentials");

      return result;
    }
  }

  // ============================================================================
  // Individual Test Methods
  // ============================================================================

  private async testBasicConnectivity(
    mexcService: any,
    result: ConnectivityValidationResult
  ): Promise<void> {
    console.info("[MexcConnectivityValidator] Testing basic connectivity...");

    try {
      const startTime = Date.now();
      const isConnected = await mexcService.testConnectivity();
      const responseTime = Date.now() - startTime;

      if (isConnected) {
        result.connectivity.apiReachable = true;
        result.connectivity.responseTime = responseTime;

        // Get server time
        try {
          const serverTime = await mexcService.getServerTime();
          result.connectivity.serverTime = serverTime;
        } catch (error) {
          console.warn("[MexcConnectivityValidator] Could not get server time:", error);
        }

        console.info(
          `[MexcConnectivityValidator] ✅ API connectivity successful (${responseTime}ms)`
        );
      } else {
        result.errors.push("Cannot reach MEXC API endpoints");
        result.recommendations.push("Check internet connectivity and DNS resolution");
        console.info("[MexcConnectivityValidator] ❌ API connectivity failed");
      }
    } catch (error) {
      const safeError = toSafeError(error);
      result.errors.push(`Connectivity test failed: ${safeError.message}`);
      console.error("[MexcConnectivityValidator] Connectivity test error:", safeError.message);
    }
  }

  private async testAuthentication(
    mexcService: any,
    result: ConnectivityValidationResult
  ): Promise<void> {
    console.info("[MexcConnectivityValidator] Testing authentication...");

    try {
      const accountInfo = await mexcService.getAccountInfo();

      if (accountInfo.success && accountInfo.data) {
        result.authentication.valid = true;
        result.authentication.accountAccessible = true;
        result.authentication.accountType = accountInfo.data.accountType || "SPOT";
        result.authentication.canTrade = accountInfo.data.canTrade !== false;
        result.authentication.permissions = accountInfo.data.permissions || ["SPOT"];

        console.info("[MexcConnectivityValidator] ✅ Authentication successful:", {
          accountType: result.authentication.accountType,
          canTrade: result.authentication.canTrade,
          permissions: result.authentication.permissions,
        });

        // Check for specific trading restrictions
        if (!result.authentication.canTrade) {
          result.warnings.push("Account trading is disabled");
          result.recommendations.push("Enable trading permissions in MEXC account settings");
        }
      } else {
        result.errors.push(`Authentication failed: ${accountInfo.error || "Unknown error"}`);

        // Provide specific error guidance
        if (accountInfo.error?.includes("signature")) {
          result.recommendations.push(
            "Check API credentials and ensure server time synchronization"
          );
        } else if (accountInfo.error?.includes("IP")) {
          result.recommendations.push("Ensure your IP address is allowlisted for the API key");
        } else {
          result.recommendations.push("Verify MEXC API credentials are correct and active");
        }

        console.error("[MexcConnectivityValidator] ❌ Authentication failed:", accountInfo.error);
      }
    } catch (error) {
      const safeError = toSafeError(error);
      result.errors.push(`Authentication test failed: ${safeError.message}`);
      console.error("[MexcConnectivityValidator] Authentication test error:", safeError.message);
    }
  }

  private async testBalanceAccess(
    mexcService: any,
    result: ConnectivityValidationResult
  ): Promise<void> {
    console.info("[MexcConnectivityValidator] Testing balance access...");

    try {
      const balanceResponse = await mexcService.getAccountBalances();

      if (balanceResponse.success && balanceResponse.data) {
        result.balances.accessible = true;
        result.balances.totalAssets = balanceResponse.data.balances?.length || 0;

        // Check USDT balance
        const usdtBalance = balanceResponse.data.balances?.find((b: any) => b.asset === "USDT");
        if (usdtBalance) {
          const totalUsdt =
            parseFloat(usdtBalance.free || "0") + parseFloat(usdtBalance.locked || "0");
          result.balances.usdtBalance = totalUsdt;
          result.balances.sufficientForTrading = totalUsdt >= this.minPositionSize;

          if (!result.balances.sufficientForTrading) {
            result.warnings.push(
              `USDT balance (${totalUsdt}) below minimum trading amount (${this.minPositionSize})`
            );
            result.recommendations.push("Deposit more USDT or reduce position size");
          }
        } else {
          result.warnings.push("No USDT balance found");
          result.recommendations.push("Deposit USDT to enable trading");
        }

        console.info("[MexcConnectivityValidator] ✅ Balance access successful:", {
          totalAssets: result.balances.totalAssets,
          usdtBalance: result.balances.usdtBalance,
          sufficientForTrading: result.balances.sufficientForTrading,
        });
      } else {
        result.errors.push(`Balance access failed: ${balanceResponse.error || "Unknown error"}`);
        console.error(
          "[MexcConnectivityValidator] ❌ Balance access failed:",
          balanceResponse.error
        );
      }
    } catch (error) {
      const safeError = toSafeError(error);
      result.errors.push(`Balance test failed: ${safeError.message}`);
      console.error("[MexcConnectivityValidator] Balance test error:", safeError.message);
    }
  }

  private async testTradingCapabilities(
    mexcService: any,
    result: ConnectivityValidationResult
  ): Promise<void> {
    console.info("[MexcConnectivityValidator] Testing trading capabilities...");

    try {
      // Get exchange info to check available trading pairs
      const exchangeInfo = await mexcService.getExchangeInfo();

      if (exchangeInfo.success && exchangeInfo.data) {
        const symbols = exchangeInfo.data;
        const usdtPairs = symbols.filter((s: any) => s.symbol.endsWith("USDT"));

        result.trading.hasUsdtPairs = usdtPairs.length > 0;
        result.trading.tradingStatus = "available";

        // Check if we can potentially place orders
        result.trading.ordersAllowed =
          (result.authentication.canTrade || false) && result.trading.hasUsdtPairs;

        console.info("[MexcConnectivityValidator] ✅ Trading capabilities checked:", {
          totalSymbols: symbols.length,
          usdtPairs: usdtPairs.length,
          ordersAllowed: result.trading.ordersAllowed,
        });

        if (!result.trading.hasUsdtPairs) {
          result.warnings.push("No USDT trading pairs available");
          result.recommendations.push("Check MEXC exchange status");
        }
      } else {
        result.warnings.push(
          `Trading capability check failed: ${exchangeInfo.error || "Unknown error"}`
        );
        result.trading.tradingStatus = "unknown";
        console.warn(
          "[MexcConnectivityValidator] ⚠️ Trading capability check failed:",
          exchangeInfo.error
        );
      }
    } catch (error) {
      const safeError = toSafeError(error);
      result.warnings.push(`Trading test failed: ${safeError.message}`);
      console.error("[MexcConnectivityValidator] Trading test error:", safeError.message);
    }
  }

  private determineOverallStatus(result: ConnectivityValidationResult): void {
    const hasErrors = result.errors.length > 0;
    const hasWarnings = result.warnings.length > 0;

    if (hasErrors) {
      result.overall = "BLOCKED";
    } else if (hasWarnings || !result.balances.sufficientForTrading) {
      result.overall = "PARTIAL";
    } else if (
      result.connectivity.apiReachable &&
      result.authentication.valid &&
      result.balances.accessible &&
      result.trading.ordersAllowed
    ) {
      result.overall = "READY";
    } else {
      result.overall = "PARTIAL";
    }

    // Add overall recommendations
    if (result.overall === "READY") {
      result.recommendations.push("System is ready for auto-sniping operations");
    } else if (result.overall === "PARTIAL") {
      result.recommendations.push("Address warnings to ensure optimal trading performance");
    } else {
      result.recommendations.push("Resolve critical issues before enabling auto-sniping");
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Quick connectivity check (simplified version)
   */
  async quickConnectivityCheck(options?: {
    userId?: string;
    apiKey?: string;
    secretKey?: string;
  }): Promise<{
    connected: boolean;
    authenticated: boolean;
    error?: string;
  }> {
    try {
      const mexcService = await getUnifiedMexcService({
        userId: options?.userId,
        apiKey: options?.apiKey,
        secretKey: options?.secretKey,
        skipCache: true, // Skip cache for quick checks
      });

      const connectivityResponse = await mexcService.testConnectivity();
      const connected =
        typeof connectivityResponse === "boolean"
          ? connectivityResponse
          : connectivityResponse?.success || false;
      if (!connected) {
        return { connected: false, authenticated: false, error: "API not reachable" };
      }

      const accountInfo = await mexcService.getAccountInfo();
      const authenticated = accountInfo.success;

      return {
        connected,
        authenticated,
        error: authenticated ? undefined : accountInfo.error,
      };
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        connected: false,
        authenticated: false,
        error: safeError.message,
      };
    }
  }

  /**
   * Test specific credentials without caching
   */
  async testCredentials(
    apiKey: string,
    secretKey: string
  ): Promise<{
    valid: boolean;
    error?: string;
    details?: any;
  }> {
    try {
      const mexcService = await getUnifiedMexcService({
        apiKey,
        secretKey,
        skipCache: true,
      });

      const accountInfo = await mexcService.getAccountInfo();

      return {
        valid: accountInfo.success,
        error: accountInfo.error,
        details: accountInfo.data,
      };
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        valid: false,
        error: safeError.message,
      };
    }
  }
}

// ============================================================================
// Factory Functions and Exports
// ============================================================================

/**
 * Create connectivity validator with default configuration
 */
export function createConnectivityValidator(options?: {
  timeout?: number;
  minPositionSize?: number;
}): MexcConnectivityValidator {
  return new MexcConnectivityValidator(options);
}

// Global instance for singleton usage
let globalValidator: MexcConnectivityValidator | null = null;

/**
 * Get or create global connectivity validator
 */
export function getGlobalConnectivityValidator(): MexcConnectivityValidator {
  if (!globalValidator) {
    globalValidator = createConnectivityValidator({
      timeout: 15000,
      minPositionSize: parseFloat(process.env.AUTO_SNIPING_POSITION_SIZE_USDT || "10"),
    });
  }
  return globalValidator;
}

/**
 * Reset global validator instance (for testing)
 */
export function resetGlobalConnectivityValidator(): void {
  globalValidator = null;
}

/**
 * Unified MEXC Core Module
 *
 * Core service methods and market data functionality.
 * Extracted from unified-mexc-service-v2.ts for better modularity.
 */

import type {
  CalendarEntry,
  MexcServiceResponse,
  SymbolEntry,
} from "../data/modules/mexc-api-types";
import type { MexcCacheLayer } from "../data/modules/mexc-cache-layer";
import type { MexcCoreClient } from "../data/modules/mexc-core-client";

// ============================================================================
// Core Service Module
// ============================================================================

export class UnifiedMexcCoreModule {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[unified-mexc-core]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[unified-mexc-core]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[unified-mexc-core]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[unified-mexc-core]", message, context || ""),
  };

  constructor(
    private coreClient: MexcCoreClient,
    private cacheLayer: MexcCacheLayer
  ) {}

  // ============================================================================
  // Calendar & Listings
  // ============================================================================

  /**
   * Get calendar listings with intelligent caching
   */
  async getCalendarListings(): Promise<MexcServiceResponse<CalendarEntry[]>> {
    return this.cacheLayer.getOrSet(
      "calendar:listings",
      () => this.coreClient.getCalendarListings(),
      "semiStatic" // 5 minute cache for calendar data
    );
  }

  // ============================================================================
  // Symbols & Market Data
  // ============================================================================

  /**
   * Get symbols for a specific coin
   */
  async getSymbolsByVcoinId(vcoinId: string): Promise<MexcServiceResponse<SymbolEntry[]>> {
    return this.cacheLayer.getOrSet(
      `symbols:${vcoinId}`,
      () => this.coreClient.getSymbolsByVcoinId(vcoinId),
      "semiStatic"
    );
  }

  /**
   * Get all symbols from the exchange
   */
  async getAllSymbols(): Promise<MexcServiceResponse<SymbolEntry[]>> {
    return this.cacheLayer.getOrSet(
      "symbols:all",
      () => this.coreClient.getAllSymbols(),
      "semiStatic" // 5 minute cache for all symbols
    );
  }

  /**
   * Get server time
   */
  async getServerTime(): Promise<MexcServiceResponse<number>> {
    return this.cacheLayer.getOrSet(
      "server:time",
      () => this.coreClient.getServerTime(),
      "realTime" // 15 second cache for server time
    );
  }

  /**
   * Get basic symbol information by symbol name
   */
  async getSymbolInfoBasic(symbolName: string): Promise<MexcServiceResponse<any>> {
    return this.cacheLayer.getOrSet(
      `symbol:basic:${symbolName}`,
      () => this.coreClient.getSymbolInfoBasic(symbolName),
      "semiStatic" // 5 minute cache for symbol info
    );
  }

  /**
   * Get activity data for a currency
   */
  async getActivityData(currency: string): Promise<MexcServiceResponse<any>> {
    return this.cacheLayer.getOrSetWithCustomTTL(
      `activity:${currency}`,
      () => this.coreClient.getActivityData(currency)
    );
  }

  /**
   * Get symbol data for analysis
   */
  async getSymbolData(symbol: string): Promise<MexcServiceResponse<any>> {
    return this.cacheLayer.getOrSet(
      `symbol:data:${symbol}`,
      () => this.coreClient.getSymbolInfoBasic(symbol),
      "semiStatic"
    );
  }

  // ============================================================================
  // Multi-Symbol Operations
  // ============================================================================

  /**
   * Get symbols for multiple vcoins
   */
  async getSymbolsForVcoins(vcoinIds: string[]): Promise<MexcServiceResponse<SymbolEntry[]>> {
    // For multiple vcoins, we'll fetch each one and combine results
    const promises = vcoinIds.map((vcoinId) => this.getSymbolsByVcoinId(vcoinId));
    const responses = await Promise.all(promises);

    const allSymbols: SymbolEntry[] = [];
    let hasError = false;
    let errorMessage = "";

    for (const response of responses) {
      if (response.success && response.data) {
        allSymbols.push(...response.data);
      } else {
        hasError = true;
        errorMessage = response.error || "Failed to fetch symbols";
      }
    }

    if (hasError && allSymbols.length === 0) {
      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
        source: "unified-mexc-core",
      };
    }

    return {
      success: true,
      data: allSymbols,
      timestamp: Date.now(),
      source: "unified-mexc-core",
    };
  }

  /**
   * Get symbols data (alias for getAllSymbols)
   */
  async getSymbolsData(): Promise<MexcServiceResponse<SymbolEntry[]>> {
    return this.getAllSymbols();
  }

  /**
   * Get bulk activity data for multiple currencies
   */
  async getBulkActivityData(currencies: string[]): Promise<MexcServiceResponse<any[]>> {
    const promises = currencies.map((currency) => this.getActivityData(currency));
    const responses = await Promise.all(promises);

    const allData: any[] = [];
    let hasError = false;
    let errorMessage = "";

    for (const response of responses) {
      if (response.success && response.data) {
        allData.push(response.data);
      } else {
        hasError = true;
        errorMessage = response.error || "Failed to fetch activity data";
      }
    }

    if (hasError && allData.length === 0) {
      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
        source: "unified-mexc-core",
      };
    }

    return {
      success: true,
      data: allData,
      timestamp: Date.now(),
      source: "unified-mexc-core",
    };
  }

  /**
   * Check if currency has recent activity
   */
  async hasRecentActivity(
    currency: string,
    timeframeMs: number = 24 * 60 * 60 * 1000
  ): Promise<boolean> {
    try {
      const activityResponse = await this.getActivityData(currency);
      
      // If the response failed, no recent activity
      if (!activityResponse.success || !activityResponse.data) {
        return false;
      }

      // Check if the activity data indicates recent activity within timeframe
      const currentTime = Date.now();
      const cutoffTime = currentTime - timeframeMs;

      // Check if the response timestamp is within the timeframe
      // This represents when the activity data was last updated/fetched
      const hasRecent = activityResponse.timestamp > cutoffTime;

      return hasRecent;
    } catch (error) {
      this.logger.warn(`Failed to check recent activity for ${currency}:`, error);
      return false;
    }
  }

  // ============================================================================
  // Connectivity & Status
  // ============================================================================

  /**
   * Test API connectivity
   */
  async testConnectivity(): Promise<MexcServiceResponse<{ serverTime: number; latency: number }>> {
    const startTime = Date.now();

    try {
      const serverTimeResponse = await this.getServerTime();

      if (!serverTimeResponse.success) {
        return {
          success: false,
          error: "Failed to connect to MEXC API",
          timestamp: Date.now(),
          source: "unified-mexc-core",
        };
      }

      const latency = Date.now() - startTime;

      return {
        success: true,
        data: {
          serverTime: serverTimeResponse.data!,
          latency,
        },
        timestamp: Date.now(),
        source: "unified-mexc-core",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown connectivity error",
        timestamp: Date.now(),
        source: "unified-mexc-core",
      };
    }
  }

  /**
   * Test API connectivity with detailed response (required by tests)
   */
  async testConnectivityWithResponse(): Promise<
    MexcServiceResponse<{
      serverTime: number;
      latency: number;
      connected: boolean;
      apiVersion: string;
      region: string;
    }>
  > {
    const startTime = Date.now();

    try {
      const serverTimeResponse = await this.getServerTime();

      if (!serverTimeResponse.success) {
        return {
          success: false,
          error: "Failed to connect to MEXC API",
          timestamp: Date.now(),
          source: "unified-mexc-core",
        };
      }

      const latency = Date.now() - startTime;

      return {
        success: true,
        data: {
          serverTime: serverTimeResponse.data!,
          latency,
          connected: true,
          apiVersion: "v3",
          region: "global",
        },
        timestamp: Date.now(),
        source: "unified-mexc-core",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown connectivity error",
        timestamp: Date.now(),
        source: "unified-mexc-core",
      };
    }
  }
}

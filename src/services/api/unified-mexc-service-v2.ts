/**
 * Unified MEXC Service v2 - Modular Architecture
 *
 * Refactored service that orchestrates modular components for:
 * - Better maintainability (under 500 lines!)
 * - Improved performance through focused modules
 * - Enhanced testability with clear separation of concerns
 * - Optimized bundle size through tree-shaking
 */

import type { ActivityQueryOptionsType } from "@/src/schemas/unified/mexc-api-schemas";
// Build-safe imports - modular architecture
import type {
  BalanceEntry,
  CalendarEntry,
  MexcServiceResponse,
  SymbolEntry,
} from "../data/modules/mexc-api-types";
import { MexcCacheLayer } from "../data/modules/mexc-cache-layer";
import { MexcCoreClient } from "../data/modules/mexc-core-client";

// Import modular components
import { hasValidCredentials, mergeConfig, type UnifiedMexcConfigV2 } from "./unified-mexc-config";
import { UnifiedMexcCoreModule } from "./unified-mexc-core";
import { UnifiedMexcPortfolioModule } from "./unified-mexc-portfolio";
import {
  type OrderBookData,
  type RecentActivityData,
  type SymbolTickerData,
  type TradingOrderData,
  UnifiedMexcTradingModule,
} from "./unified-mexc-trading";

// ============================================================================
// Unified MEXC Service v2
// ============================================================================

export class UnifiedMexcServiceV2 {
  // Simple console logger to avoid webpack bundling issues
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[unified-mexc-service-v2]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[unified-mexc-service-v2]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[unified-mexc-service-v2]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[unified-mexc-service-v2]", message, context || ""),
  };

  private config: Required<UnifiedMexcConfigV2>;
  private coreClient: MexcCoreClient;
  private cacheLayer: MexcCacheLayer;

  // Modular components
  private coreModule: UnifiedMexcCoreModule;
  private portfolioModule: UnifiedMexcPortfolioModule;
  private tradingModule: UnifiedMexcTradingModule;

  constructor(config: Partial<UnifiedMexcConfigV2> = {}) {
    this.config = mergeConfig(config);

    // Initialize core dependencies
    this.coreClient = new MexcCoreClient({
      apiKey: this.config.apiKey,
      secretKey: this.config.secretKey,
      passphrase: this.config.passphrase,
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay,
      rateLimitDelay: this.config.rateLimitDelay,
    });

    this.cacheLayer = new MexcCacheLayer({
      enableCaching: this.config.enableCaching,
      cacheTTL: this.config.cacheTTL,
      apiResponseTTL: this.config.apiResponseTTL,
    });

    // Initialize modular components
    this.coreModule = new UnifiedMexcCoreModule(this.coreClient, this.cacheLayer);
    this.portfolioModule = new UnifiedMexcPortfolioModule(this.coreClient, this.cacheLayer);
    this.tradingModule = new UnifiedMexcTradingModule(this.coreClient, this.cacheLayer);
  }

  // ============================================================================
  // Public API - Delegated to Modular Components
  // ============================================================================

  // Calendar & Listings (Core Module)
  async getCalendarListings(): Promise<MexcServiceResponse<CalendarEntry[]>> {
    return this.coreModule.getCalendarListings();
  }

  // Symbols & Market Data (Core Module)
  async getSymbolsByVcoinId(vcoinId: string): Promise<MexcServiceResponse<SymbolEntry[]>> {
    return this.coreModule.getSymbolsByVcoinId(vcoinId);
  }

  async getAllSymbols(): Promise<MexcServiceResponse<SymbolEntry[]>> {
    return this.coreModule.getAllSymbols();
  }

  async getServerTime(): Promise<MexcServiceResponse<number>> {
    return this.coreModule.getServerTime();
  }

  async getSymbolInfoBasic(symbolName: string): Promise<MexcServiceResponse<any>> {
    return this.coreModule.getSymbolInfoBasic(symbolName);
  }

  async getActivityData(currency: string): Promise<MexcServiceResponse<any>> {
    return this.coreModule.getActivityData(currency);
  }

  async getSymbolData(symbol: string): Promise<MexcServiceResponse<any>> {
    return this.coreModule.getSymbolData(symbol);
  }

  async getSymbolsForVcoins(vcoinIds: string[]): Promise<MexcServiceResponse<SymbolEntry[]>> {
    return this.coreModule.getSymbolsForVcoins(vcoinIds);
  }

  async getSymbolsData(): Promise<MexcServiceResponse<SymbolEntry[]>> {
    return this.coreModule.getSymbolsData();
  }

  async getBulkActivityData(
    currencies: string[],
    options?: ActivityQueryOptionsType
  ): Promise<MexcServiceResponse<any[]>> {
    return this.coreModule.getBulkActivityData(currencies, options);
  }

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
      console.warn(`Failed to check recent activity for ${currency}:`, error);
      return false;
    }
  }

  // Account & Portfolio (Portfolio Module)
  async getAccountBalance(): Promise<MexcServiceResponse<BalanceEntry[]>> {
    return this.portfolioModule.getAccountBalance();
  }

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
    return this.portfolioModule.getAccountBalances();
  }

  // Trading Methods (Trading Module)
  async getTicker(symbol: string): Promise<MexcServiceResponse<any>> {
    return this.tradingModule.getTicker(symbol);
  }

  async getSymbolTicker(symbol: string): Promise<MexcServiceResponse<SymbolTickerData>> {
    return this.tradingModule.getSymbolTicker(symbol);
  }

  async getOrderBook(
    symbol: string,
    limit: number = 20
  ): Promise<MexcServiceResponse<OrderBookData>> {
    return this.tradingModule.getOrderBook(symbol, limit);
  }

  async getRecentActivity(
    symbol: string,
    hours: number = 24
  ): Promise<MexcServiceResponse<RecentActivityData>> {
    return this.tradingModule.getRecentActivity(symbol, hours);
  }

  async placeOrder(orderData: TradingOrderData): Promise<MexcServiceResponse<any>> {
    return this.tradingModule.placeOrder(orderData);
  }

  async createOrder(orderData: TradingOrderData): Promise<MexcServiceResponse<any>> {
    return this.tradingModule.createOrder(orderData);
  }

  // Portfolio Methods (Portfolio Module)
  async getAccountInfo(): Promise<
    MexcServiceResponse<{
      accountType: string;
      canTrade: boolean;
      canWithdraw: boolean;
      canDeposit: boolean;
      balances: BalanceEntry[];
    }>
  > {
    return this.portfolioModule.getAccountInfo();
  }

  async getTotalPortfolioValue(): Promise<number> {
    return this.portfolioModule.getTotalPortfolioValue();
  }

  async getTopAssets(limit = 10): Promise<BalanceEntry[]> {
    return this.portfolioModule.getTopAssets(limit);
  }

  async hasSufficientBalance(asset: string, requiredAmount: number): Promise<boolean> {
    return this.portfolioModule.hasSufficientBalance(asset, requiredAmount);
  }

  async getAssetBalance(asset: string): Promise<{ free: string; locked: string } | null> {
    return this.portfolioModule.getAssetBalance(asset);
  }

  // ============================================================================
  // Core Module - Connectivity & Status
  // ============================================================================

  async testConnectivity(): Promise<MexcServiceResponse<{ serverTime: number; latency: number }>> {
    return this.coreModule.testConnectivity();
  }

  async testConnectivityWithResponse(): Promise<
    MexcServiceResponse<{
      serverTime: number;
      latency: number;
      connected: boolean;
      apiVersion: string;
      region: string;
    }>
  > {
    return this.coreModule.testConnectivityWithResponse();
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  invalidateCalendarCache(): number {
    return this.cacheLayer.invalidateCalendar();
  }

  invalidateSymbolsCache(): number {
    return this.cacheLayer.invalidateSymbols();
  }

  invalidateUserCache(): number {
    return this.cacheLayer.invalidateUserData();
  }

  getCacheMetrics() {
    return this.cacheLayer.getMetrics();
  }

  // ============================================================================
  // Configuration & Status
  // ============================================================================

  hasValidCredentials(): boolean {
    return hasValidCredentials(this.config);
  }

  // Status methods
  getStatus() {
    return {
      config: {
        baseUrl: this.config.baseUrl,
        cachingEnabled: this.config.enableCaching,
        circuitBreakerEnabled: this.config.enableCircuitBreaker,
        enhancedFeaturesEnabled: this.config.enableEnhancedFeatures,
      },
      cache: this.cacheLayer.getMetrics(),
      timestamp: Date.now(),
    };
  }

  // ============================================================================
  // Lifecycle Management
  // ============================================================================

  destroy(): void {
    this.cacheLayer.destroy();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new unified MEXC service instance
 */
export function createUnifiedMexcServiceV2(
  config?: Partial<UnifiedMexcConfigV2>
): UnifiedMexcServiceV2 {
  return new UnifiedMexcServiceV2(config);
}

/**
 * Singleton instance for global use
 */
let globalServiceInstance: UnifiedMexcServiceV2 | null = null;

export function getUnifiedMexcServiceV2(
  config?: Partial<UnifiedMexcConfigV2>
): UnifiedMexcServiceV2 {
  if (!globalServiceInstance) {
    globalServiceInstance = new UnifiedMexcServiceV2(config);
  }
  return globalServiceInstance;
}

export function resetUnifiedMexcServiceV2(): void {
  if (globalServiceInstance) {
    globalServiceInstance.destroy();
    globalServiceInstance = null;
  }
}

// ============================================================================
// Exports
// ============================================================================

export default UnifiedMexcServiceV2;
export type { UnifiedMexcConfigV2 };

// Export singleton instance for use in pattern detection and other services
export const unifiedMexcService = getUnifiedMexcServiceV2();

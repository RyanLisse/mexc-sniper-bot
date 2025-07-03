/**
 * MEXC Unified Exports - Single source of truth for all MEXC API functionality
 *
 * This module provides unified access to all MEXC API capabilities through a single,
 * consistent interface. All legacy MEXC client implementations have been consolidated
 * into the UnifiedMexcServiceV2.
 *
 * @example
 * ```typescript
 * // New unified approach
 * import { getMexcService } from "./mexc-unified-exports";
 *
 * const mexc = getMexcService();
 * const calendar = await mexc.getCalendarListings();
 * const balance = await mexc.getAccountBalances();
 * const order = await mexc.placeOrder(params);
 * ```
 */

// Import types from unified schemas
import type {
  BalanceEntry,
  CalendarEntry,
  ExchangeSymbol,
  MexcServiceResponse,
  OrderRequest,
  OrderResult,
  SymbolEntry,
  Ticker,
} from "../../schemas/unified";
// Import logger
// Import the production-ready unified client (modular)
import {
  getUnifiedMexcClient as getUnifiedMexcClientFactory,
  type UnifiedMexcClient,
} from "./mexc-client-factory";
// Import the new unified V2 service
import {
  getUnifiedMexcServiceV2,
  resetUnifiedMexcServiceV2,
  type UnifiedMexcConfigV2,
  UnifiedMexcServiceV2,
} from "./unified-mexc-service-v2";

// ============================================================================
// Primary Exports - Use These (Updated to use UnifiedMexcServiceV2)
// ============================================================================

// Main service class and factory function
export {
  UnifiedMexcServiceV2 as MexcServiceLayer,
  getUnifiedMexcServiceV2 as getRecommendedMexcService,
  resetUnifiedMexcServiceV2 as resetMexcService,
  type UnifiedMexcConfigV2 as MexcServiceConfig,
  type MexcServiceResponse as ServiceResponse,
};

// Core types for trading and market data
export type {
  CalendarEntry,
  SymbolEntry,
  BalanceEntry,
  ExchangeSymbol,
  Ticker,
  OrderResult,
};

// Advanced analytics and trading types (removed non-existent types)
// export type { MarketStats, PatternAnalysis, TradingOpportunity, Portfolio, RiskAssessment };

// ============================================================================
// Convenience Functions and Aliases
// ============================================================================

/**
 * Get a configured MEXC service instance
 * This is the recommended way to access MEXC functionality
 * FIXED: Now uses production-ready UnifiedMexcClient with real MEXC data
 */
export function getMexcService(config?: {
  apiKey?: string;
  secretKey?: string;
}): UnifiedMexcClient {
  return getUnifiedMexcClientFactory(config);
}

/**
 * Create a new MEXC service instance with specific configuration
 */
export function createMexcService(
  config: { apiKey?: string; secretKey?: string } = {}
): UnifiedMexcClient {
  return getUnifiedMexcClientFactory(config);
}

/**
 * Get MEXC client (alias for backward compatibility)
 */
export function getMexcClient(config?: {
  apiKey?: string;
  secretKey?: string;
}): UnifiedMexcClient {
  return getUnifiedMexcClientFactory(config);
}

/**
 * Legacy compatibility - Enhanced MEXC Service
 * @deprecated Use getUnifiedMexcServiceV2 instead
 */
export function getEnhancedMexcService(config?: {
  apiKey?: string;
  secretKey?: string;
}): UnifiedMexcServiceV2 {
  console.warn(
    "getEnhancedMexcService is deprecated. Use getUnifiedMexcServiceV2 instead."
  );
  return getUnifiedMexcServiceV2(config);
}

/**
 * Legacy compatibility - Reset Enhanced MEXC Service
 * @deprecated Use resetUnifiedMexcServiceV2 instead
 */
export function resetEnhancedMexcService(): void {
  console.warn(
    "resetEnhancedMexcService is deprecated. Use resetUnifiedMexcServiceV2 instead."
  );
  resetUnifiedMexcServiceV2();
}

/**
 * Legacy compatibility - Unified MEXC Client
 * Now properly returns the production-ready UnifiedMexcClient
 */
export function getUnifiedMexcClient(config?: {
  apiKey?: string;
  secretKey?: string;
}): UnifiedMexcClient {
  return getUnifiedMexcClientFactory(config);
}

// ============================================================================
// Legacy Type Aliases for Backward Compatibility
// ============================================================================

/** @deprecated Use UnifiedMexcConfigV2 instead */
export type UnifiedMexcResponse<T> = MexcServiceResponse<T>;

/** @deprecated Use OrderRequest instead */
export type AdvancedOrderParameters = OrderRequest;

// ============================================================================
// Default Export
// ============================================================================

/**
 * Default export provides the unified MEXC service
 * This is the recommended way to import MEXC functionality
 *
 * @example
 * ```typescript
 * import mexcService from "./mexc-unified-exports";
 *
 * const calendar = await mexcService.getCalendarListings();
 * ```
 */
export default getUnifiedMexcClientFactory;

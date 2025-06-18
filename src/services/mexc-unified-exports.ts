/**
 * MEXC Unified Exports - Single source of truth for all MEXC API functionality
 *
 * This module provides unified access to all MEXC API capabilities through a single,
 * consistent interface. All legacy MEXC client implementations have been consolidated
 * into the UnifiedMexcService.
 *
 * @example
 * ```typescript
 * // New unified approach
 * import { getMexcService } from '@/src/services/mexc-unified-exports';
 *
 * const mexc = getMexcService();
 * const calendar = await mexc.getCalendarListings();
 * const balance = await mexc.getAccountBalances();
 * const order = await mexc.placeOrder(params);
 * ```
 */

// Import the new unified service
import { 
  getUnifiedMexcService, 
  resetUnifiedMexcService,
  UnifiedMexcService,
  type UnifiedMexcConfig,
  type MexcServiceResponse,
  type CalendarEntry,
  type SymbolEntry,
  type BalanceEntry,
  type ExchangeSymbol,
  type Ticker,
  type OrderResult,
  type OrderParameters,
  type OrderStatus,
  type OrderBook,
  type Kline,
  type MarketStats,
  type PatternAnalysis,
  type TradingOpportunity,
  type Portfolio,
  type RiskAssessment
} from "./unified-mexc-service";

// ============================================================================
// Primary Exports - Use These (Updated to use UnifiedMexcService)
// ============================================================================

// Main service class and factory function
export {
  UnifiedMexcService as MexcServiceLayer,
  getUnifiedMexcService as getRecommendedMexcService,
  resetUnifiedMexcService as resetMexcService,
  type UnifiedMexcConfig as MexcServiceConfig,
  type MexcServiceResponse as ServiceResponse,
};

// Core types for trading and market data
export {
  type CalendarEntry,
  type SymbolEntry,
  type BalanceEntry,
  type ExchangeSymbol,
  type Ticker,
  type OrderResult,
  type OrderParameters,
  type OrderStatus,
  type OrderBook,
  type Kline,
};

// Advanced analytics and trading types
export {
  type MarketStats,
  type PatternAnalysis,
  type TradingOpportunity,
  type Portfolio,
  type RiskAssessment,
};

// ============================================================================
// Convenience Functions and Aliases
// ============================================================================

/**
 * Get a configured MEXC service instance
 * This is the recommended way to access MEXC functionality
 */
export function getMexcService(config?: { apiKey?: string; secretKey?: string }): UnifiedMexcService {
  return getUnifiedMexcService(config);
}

/**
 * Create a new MEXC service instance with specific configuration
 */
export function createMexcService(config: { apiKey?: string; secretKey?: string } = {}): UnifiedMexcService {
  return getUnifiedMexcService(config);
}

/**
 * Get MEXC client (alias for backward compatibility)
 */
export function getMexcClient(config?: { apiKey?: string; secretKey?: string }): UnifiedMexcService {
  return getUnifiedMexcService(config);
}

/**
 * Legacy compatibility - Enhanced MEXC Service
 * @deprecated Use getUnifiedMexcService instead
 */
export function getEnhancedMexcService(config?: { apiKey?: string; secretKey?: string }): UnifiedMexcService {
  console.warn('getEnhancedMexcService is deprecated. Use getUnifiedMexcService instead.');
  return getUnifiedMexcService(config);
}

/**
 * Legacy compatibility - Reset Enhanced MEXC Service
 * @deprecated Use resetUnifiedMexcService instead
 */
export function resetEnhancedMexcService(): void {
  console.warn('resetEnhancedMexcService is deprecated. Use resetUnifiedMexcService instead.');
  resetUnifiedMexcService();
}

/**
 * Legacy compatibility - Unified MEXC Client
 * @deprecated Use getUnifiedMexcService instead
 */
export function getUnifiedMexcClient(config?: { apiKey?: string; secretKey?: string }): UnifiedMexcService {
  console.warn('getUnifiedMexcClient is deprecated. Use getUnifiedMexcService instead.');
  return getUnifiedMexcService(config);
}

// ============================================================================
// Legacy Type Aliases for Backward Compatibility
// ============================================================================

/** @deprecated Use UnifiedMexcConfig instead */
export type UnifiedMexcResponse<T> = MexcServiceResponse<T>;

/** @deprecated Use OrderParameters instead */
export type AdvancedOrderParameters = OrderParameters;

// ============================================================================
// Default Export
// ============================================================================

/**
 * Default export provides the unified MEXC service
 * This is the recommended way to import MEXC functionality
 *
 * @example
 * ```typescript
 * import mexcService from '@/src/services/mexc-unified-exports';
 *
 * const calendar = await mexcService.getCalendarListings();
 * ```
 */
export default getUnifiedMexcService;

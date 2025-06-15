/**
 * MEXC Unified Exports - Single source of truth for all MEXC API functionality
 * 
 * This module provides unified access to all MEXC API capabilities through a single,
 * consistent interface. It replaces all legacy MEXC client implementations.
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

// ============================================================================
// Primary Exports - Use These
// ============================================================================

// Main service layer - contains all functionality
export {
  MexcServiceLayer,
  getMexcService,
  resetMexcService,
  type MexcServiceConfig,
  type ServiceResponse,
  type HealthCheckResult,
} from "./mexc-service-layer";

// Unified client types
export {
  type UnifiedMexcConfig,
  type UnifiedMexcResponse,
  type CalendarEntry,
  type SymbolEntry,
  type BalanceEntry,
  type ExchangeSymbol,
  type Ticker,
  type OrderResult,
  type OrderParameters,
} from "./unified-mexc-client";

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get a configured MEXC service instance
 * This is the recommended way to access MEXC functionality
 */
export function getRecommendedMexcService(config?: { apiKey?: string; secretKey?: string }) {
  return getMexcService(config);
}

/**
 * Create a new MEXC service instance with specific configuration
 */
export function createMexcService(config: { apiKey?: string; secretKey?: string } = {}) {
  return getMexcService(config);
}

// ============================================================================
// Default Export
// ============================================================================

/**
 * Default export provides the MEXC service
 * This is the recommended way to import MEXC functionality
 * 
 * @example
 * ```typescript
 * import mexcService from '@/src/services/mexc-unified-exports';
 * 
 * const calendar = await mexcService.getCalendarListings();
 * ```
 */
export default getRecommendedMexcService;
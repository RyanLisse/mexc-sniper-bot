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

// Import for re-export with different name
import { getRecommendedMexcService } from "./mexc-service-layer";
import { getUnifiedMexcClient } from "./unified-mexc-client";

// ============================================================================
// Primary Exports - Use These
// ============================================================================

// Main service layer - contains all functionality
export {
  MexcServiceLayer,
  getRecommendedMexcService,
  resetMexcService,
  type MexcServiceConfig,
  type ServiceResponse,
  type HealthCheckResult,
} from "./mexc-service-layer";

// Unified client types and functions
export {
  UnifiedMexcClient,
  getUnifiedMexcClient,
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

// Enhanced service layer types and functions
export {
  EnhancedMexcServiceLayer,
  getEnhancedMexcService,
  resetEnhancedMexcService,
  type AdvancedOrderParameters,
  type PatternAnalysis,
  type TradingOpportunity,
  type Portfolio,
  type RiskAssessment,
} from "./enhanced-mexc-service-layer";

// ============================================================================
// Convenience Functions and Aliases
// ============================================================================

/**
 * Get a configured MEXC service instance (alias for getRecommendedMexcService)
 * This is the recommended way to access MEXC functionality
 */
export function getMexcService(config?: { apiKey?: string; secretKey?: string }) {
  return getRecommendedMexcService(config);
}

/**
 * Create a new MEXC service instance with specific configuration
 */
export function createMexcService(config: { apiKey?: string; secretKey?: string } = {}) {
  return getRecommendedMexcService(config);
}

/**
 * Get MEXC client (alias for getUnifiedMexcClient) - legacy compatibility
 */
export function getMexcClient(config?: { apiKey?: string; secretKey?: string }) {
  return getUnifiedMexcClient(config);
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

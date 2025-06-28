/**
 * MEXC Unified Exports
 *
 * Central export module for all MEXC-related services and utilities
 */

// API Client
export { mexcApiClient } from "./api/mexc-api-client";
// Core MEXC Service
export { MexcApiService } from "./api/mexc-api-service";
// Types
export type {
  MexcApiClientConfig,
  MexcApiResponse,
  MexcBalanceResponse,
  MexcOrderRequest,
} from "./api/mexc-client-types";
// Service Factory
export { getUnifiedMexcService } from "./api/unified-mexc-service-factory";

// Circuit Breaker
export { createCoordinatedCircuitBreaker } from "./coordinated-circuit-breaker";

// Real-time Services
export { RealTimeSafetyMonitoringService } from "./risk/real-time-safety-monitoring-modules";

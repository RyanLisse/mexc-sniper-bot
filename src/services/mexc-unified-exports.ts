/**
 * MEXC Unified Exports
 * 
 * Central export module for all MEXC-related services and utilities
 */

// Core MEXC Service
export { MexcApiService } from './api/mexc-api-service';

// API Client
export { mexcApiClient } from './api/mexc-api-client';

// Service Factory
export { getUnifiedMexcService } from './api/unified-mexc-service-factory';

// Types
export type { 
  MexcApiClientConfig,
  MexcApiResponse,
  MexcOrderRequest,
  MexcBalanceResponse 
} from './api/mexc-client-types';

// Circuit Breaker
export { createCoordinatedCircuitBreaker } from './coordinated-circuit-breaker';

// Real-time Services
export { RealTimeSafetyMonitoringService } from './risk/real-time-safety-monitoring-modules';
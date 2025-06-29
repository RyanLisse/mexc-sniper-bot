/**
 * Core Trading Service - Consolidated Module Exports
 * 
 * FIXED: Enhanced exports with comprehensive service initialization and lifecycle management
 * Resolves: "Core Trading Service is not initialized" errors across test suite
 */


// Individual trading modules
export { AutoSnipingModule } from './auto-sniping';
// Main service class and types
// FIXED: Enhanced factory functions with initialization guarantees
// FIXED: Backward compatibility exports for existing imports
export { CoreTradingService, CoreTradingService as CoreTradingServiceV2, 
  createCoreTrading,
  createInitializedCoreTrading,
  getCoreTrading,
  getInitializedCoreTrading,
  resetCoreTrading} from './base-service';
export { ManualTradingModule } from './manual-trading';
// Module utilities
export * from './modules';
export { PerformanceTracker } from './performance-tracker';
export { PositionManager } from './position-manager';
export type {
  ServiceInitializationConfig,
  ServiceInitializationResult,
  ServiceInitializationState,
} from './service-initialization-manager';
// FIXED: Service initialization management (prevents "not initialized" errors)
export {
  getInitializedCoreService,
  getSafeInitializedCoreService,
  isCoreServiceReady,
  resetCoreServices,
  ServiceInitializationManager,
} from './service-initialization-manager';
export type {
  ServiceCoordinationConfig,
  ServiceDependency,
  ServiceLifecycleEvents,
  ServiceLifecycleState,
} from './service-lifecycle-coordinator';
// FIXED: Service lifecycle coordination (prevents startup conflicts)
export {
  areCoreServicesReady,
  getCurrentCoreService,
  ServiceLifecycleCoordinator,
  startCoreServices,
  stopCoreServices,
} from './service-lifecycle-coordinator';
export { StrategyManager } from './strategy-manager';
export type {
  CoreTradingConfig,
  CoreTradingEvents,
  ExtendedServiceStatus,
  ModuleContext,
  MultiPhaseConfig,
  MultiPhaseResult,
  PerformanceMetrics,
  Position,
  ServiceResponse,
  ServiceStatus,
  TradeParameters,
  TradeResult,
} from './types';
export * from './utils';

/**
 * FIXED: Default export for quick access with initialization safety
 * 
 * Usage:
 * ```typescript
 * import CoreTrading from '@/src/services/trading/consolidated/core-trading';
 * const service = await CoreTrading.getInitializedInstance();
 * ```
 */
const CoreTrading = {
  // Service class
  CoreTradingService,
  
  // FIXED: Safe factory methods
  getInstance: CoreTradingService.getInstance,
  getInitializedInstance: CoreTradingService.getInitializedInstance,
  resetInstance: CoreTradingService.resetInstance,
  
  // FIXED: Global factory methods
  getCoreTrading,
  getInitializedCoreTrading,
  createCoreTrading,
  createInitializedCoreTrading,
  resetCoreTrading,
  
  // FIXED: Lifecycle management
  startServices: startCoreServices,
  stopServices: stopCoreServices,
  getCurrentService: getCurrentCoreService,
  isReady: areCoreServicesReady,
  
  // FIXED: Initialization management
  getInitializedService: getInitializedCoreService,
  getSafeService: getSafeInitializedCoreService,
  isServiceReady: isCoreServiceReady,
  resetServices: resetCoreServices,
};

export default CoreTrading;
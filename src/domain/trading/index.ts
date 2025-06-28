/**
 * Trading Domain - Clean Architecture Implementation
 * 
 * This module provides the complete Clean Architecture implementation for the Trading Domain.
 * It follows Domain-Driven Design principles with clear separation of concerns.
 */

// Domain Entities
export { Trade, TradeStatus } from "../entities/trading/trade";

// Value Objects
export { Order, OrderStatus, OrderSide, OrderType, TimeInForce } from "../value-objects/trading/order";
export { Money } from "../value-objects/trading/money";
export { Price } from "../value-objects/trading/price";

// Domain Errors
export {
  DomainValidationError,
  InvalidTradeParametersError,
  InvalidOrderStateError,
  BusinessRuleViolationError,
} from "../errors/trading-errors";

// Domain Events
export { TradingEventFactory } from "../events/trading-events";
export type { DomainEvent, DomainEventPublisher } from "../events/domain-event";

// Application Layer
export { StartSnipingUseCase } from "../../application/use-cases/trading/start-sniping-use-case";
export { ExecuteTradeUseCase } from "../../application/use-cases/trading/execute-trade-use-case";
export type {
  TradingRepository,
  TradingService,
  NotificationService,
} from "../../application/interfaces/trading-repository";

// Infrastructure Layer
export { DrizzleTradingRepository } from "../../infrastructure/repositories/drizzle-trading-repository";
export { MexcTradingServiceAdapter } from "../../infrastructure/adapters/trading/mexc-trading-service-adapter";
export { TradingNotificationServiceAdapter } from "../../infrastructure/adapters/notifications/trading-notification-service-adapter";

// Feature Flags
export {
  tradingDomainFeatureFlags,
  TradingDomainFeatureFlagManager,
  isTradingDomainFeatureEnabled,
  shouldUseLegacyTrading,
  shouldUseCleanArchTrading,
  ROLLOUT_PHASES,
} from "../../lib/feature-flags/trading-domain-flags";
export type { TradingDomainFeatureFlags } from "../../lib/feature-flags/trading-domain-flags";

// Import types for factory
import { TradingDomainFeatureFlagManager } from "../../lib/feature-flags/trading-domain-flags";
import { DrizzleTradingRepository } from "../../infrastructure/repositories/drizzle-trading-repository";
import { MexcTradingServiceAdapter } from "../../infrastructure/adapters/trading/mexc-trading-service-adapter";
import { TradingNotificationServiceAdapter } from "../../infrastructure/adapters/notifications/trading-notification-service-adapter";
import { StartSnipingUseCase } from "../../application/use-cases/trading/start-sniping-use-case";
import { ExecuteTradeUseCase } from "../../application/use-cases/trading/execute-trade-use-case";

/**
 * Trading Domain Factory
 * Provides a convenient way to create configured trading domain services
 */
export class TradingDomainFactory {
  /**
   * Creates a fully configured trading domain with all dependencies
   */
  static create(dependencies: {
    mexcService: any; // UnifiedMexcServiceV2
    safetyCoordinator?: any; // ComprehensiveSafetyCoordinator
    eventEmitter?: any;
    logger?: any;
    featureFlags?: Partial<any>; // TradingDomainFeatureFlags
  }) {
    const logger = dependencies.logger || console;
    
    // Create feature flag manager
    const featureFlagManager = new TradingDomainFeatureFlagManager(dependencies.featureFlags);
    
    // Create infrastructure adapters
    const tradingRepository = new DrizzleTradingRepository(logger);
    const tradingService = new MexcTradingServiceAdapter(
      dependencies.mexcService,
      dependencies.safetyCoordinator,
      logger
    );
    const notificationService = new TradingNotificationServiceAdapter(
      logger,
      dependencies.eventEmitter
    );
    
    // Create use cases
    const startSnipingUseCase = new StartSnipingUseCase(
      tradingRepository,
      tradingService,
      notificationService,
      logger
    );
    
    const executeTradeUseCase = new ExecuteTradeUseCase(
      tradingRepository,
      tradingService,
      notificationService,
      logger
    );
    
    return {
      // Use Cases
      startSnipingUseCase,
      executeTradeUseCase,
      
      // Infrastructure
      tradingRepository,
      tradingService,
      notificationService,
      
      // Configuration
      featureFlagManager,
      
      // Helper methods
      canUseTradingDomain: () => featureFlagManager.isCleanArchitectureTradingEnabled(),
      shouldFallbackToLegacy: () => featureFlagManager.shouldUseLegacyTradingService(),
    };
  }
}

/**
 * Usage Examples:
 * 
 * // Basic setup
 * const tradingDomain = TradingDomainFactory.create({
 *   mexcService: mexcServiceInstance,
 *   logger: customLogger,
 *   featureFlags: ROLLOUT_PHASES.DEVELOPMENT
 * });
 * 
 * // Start auto-sniping
 * const result = await tradingDomain.startSnipingUseCase.execute({
 *   userId: "user123",
 *   symbol: "BTCUSDT",
 *   confidenceScore: 85,
 *   positionSizeUsdt: 100,
 * });
 * 
 * // Execute trade
 * if (result.success) {
 *   await tradingDomain.executeTradeUseCase.execute({
 *     tradeId: result.tradeId,
 *     symbol: "BTCUSDT",
 *     side: "BUY",
 *     type: "MARKET",
 *     quoteOrderQty: 100,
 *   });
 * }
 */
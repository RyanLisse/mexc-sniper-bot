/**
 * Trading Domain Feature Flags
 * Controls gradual rollout of Clean Architecture trading features
 */

import { z } from "zod";

export const TradingDomainFeatureFlagsSchema = z.object({
  // Core trading domain features
  enableCleanArchitectureTrading: z.boolean().default(false),
  enableDomainEventsPublishing: z.boolean().default(false),
  enableNewTradingUseCases: z.boolean().default(false),

  // Repository features
  enableDrizzleTradingRepository: z.boolean().default(false),
  enableRepositoryMigration: z.boolean().default(false),

  // Service adapter features
  enableMexcServiceAdapter: z.boolean().default(false),
  enableNotificationServiceAdapter: z.boolean().default(false),

  // Auto-sniping specific features
  enableCleanArchAutoSniping: z.boolean().default(false),
  enableDomainBasedValidation: z.boolean().default(false),

  // Safety and rollback features
  enableLegacyFallback: z.boolean().default(true),
  enableDualWriteMode: z.boolean().default(false),
  enablePerformanceMonitoring: z.boolean().default(true),

  // Debugging and development
  enableVerboseDomainLogging: z.boolean().default(false),
  enableTestingMode: z.boolean().default(false),
});

export type TradingDomainFeatureFlags = z.infer<typeof TradingDomainFeatureFlagsSchema>;

// Default feature flag configuration
export const DEFAULT_TRADING_DOMAIN_FLAGS: TradingDomainFeatureFlags = {
  // Start with everything disabled for safety
  enableCleanArchitectureTrading: false,
  enableDomainEventsPublishing: false,
  enableNewTradingUseCases: false,
  enableDrizzleTradingRepository: false,
  enableRepositoryMigration: false,
  enableMexcServiceAdapter: false,
  enableNotificationServiceAdapter: false,
  enableCleanArchAutoSniping: false,
  enableDomainBasedValidation: false,

  // Safety features enabled by default
  enableLegacyFallback: true,
  enableDualWriteMode: false,
  enablePerformanceMonitoring: true,

  // Development features
  enableVerboseDomainLogging: false,
  enableTestingMode: false,
};

// Progressive rollout configurations
export const ROLLOUT_PHASES = {
  // Phase 1: Development and testing
  DEVELOPMENT: {
    ...DEFAULT_TRADING_DOMAIN_FLAGS,
    enableCleanArchitectureTrading: true,
    enableDomainEventsPublishing: true,
    enableDrizzleTradingRepository: true,
    enableMexcServiceAdapter: true,
    enableNotificationServiceAdapter: true,
    enableVerboseDomainLogging: true,
    enableTestingMode: true,
    enableDualWriteMode: true, // Write to both old and new systems
  } as TradingDomainFeatureFlags,

  // Phase 2: Limited production (paper trading only)
  PAPER_TRADING: {
    ...DEFAULT_TRADING_DOMAIN_FLAGS,
    enableCleanArchitectureTrading: true,
    enableDomainEventsPublishing: true,
    enableNewTradingUseCases: true,
    enableDrizzleTradingRepository: true,
    enableMexcServiceAdapter: true,
    enableNotificationServiceAdapter: true,
    enableCleanArchAutoSniping: true,
    enableDomainBasedValidation: true,
    enableDualWriteMode: true,
    enablePerformanceMonitoring: true,
  } as TradingDomainFeatureFlags,

  // Phase 3: Limited real trading (low volume)
  LIMITED_PRODUCTION: {
    ...DEFAULT_TRADING_DOMAIN_FLAGS,
    enableCleanArchitectureTrading: true,
    enableDomainEventsPublishing: true,
    enableNewTradingUseCases: true,
    enableDrizzleTradingRepository: true,
    enableMexcServiceAdapter: true,
    enableNotificationServiceAdapter: true,
    enableCleanArchAutoSniping: true,
    enableDomainBasedValidation: true,
    enableDualWriteMode: true,
    enablePerformanceMonitoring: true,
    enableLegacyFallback: true, // Keep legacy as fallback
  } as TradingDomainFeatureFlags,

  // Phase 4: Full production
  FULL_PRODUCTION: {
    ...DEFAULT_TRADING_DOMAIN_FLAGS,
    enableCleanArchitectureTrading: true,
    enableDomainEventsPublishing: true,
    enableNewTradingUseCases: true,
    enableDrizzleTradingRepository: true,
    enableMexcServiceAdapter: true,
    enableNotificationServiceAdapter: true,
    enableCleanArchAutoSniping: true,
    enableDomainBasedValidation: true,
    enableDualWriteMode: false, // Only new system
    enablePerformanceMonitoring: true,
    enableLegacyFallback: false, // No fallback needed
  } as TradingDomainFeatureFlags,
} as const;

/**
 * Feature flag manager for trading domain
 */
export class TradingDomainFeatureFlagManager {
  private flags: TradingDomainFeatureFlags;

  constructor(flags: Partial<TradingDomainFeatureFlags> = {}) {
    this.flags = TradingDomainFeatureFlagsSchema.parse({
      ...DEFAULT_TRADING_DOMAIN_FLAGS,
      ...flags,
    });
  }

  // Core feature checks
  isCleanArchitectureTradingEnabled(): boolean {
    return this.flags.enableCleanArchitectureTrading;
  }

  isDomainEventsPublishingEnabled(): boolean {
    return this.flags.enableDomainEventsPublishing;
  }

  isNewTradingUseCasesEnabled(): boolean {
    return this.flags.enableNewTradingUseCases;
  }

  // Repository feature checks
  isDrizzleTradingRepositoryEnabled(): boolean {
    return this.flags.enableDrizzleTradingRepository;
  }

  isRepositoryMigrationEnabled(): boolean {
    return this.flags.enableRepositoryMigration;
  }

  // Service adapter feature checks
  isMexcServiceAdapterEnabled(): boolean {
    return this.flags.enableMexcServiceAdapter;
  }

  isNotificationServiceAdapterEnabled(): boolean {
    return this.flags.enableNotificationServiceAdapter;
  }

  // Auto-sniping feature checks
  isCleanArchAutoSnipingEnabled(): boolean {
    return this.flags.enableCleanArchAutoSniping;
  }

  isDomainBasedValidationEnabled(): boolean {
    return this.flags.enableDomainBasedValidation;
  }

  // Safety feature checks
  isLegacyFallbackEnabled(): boolean {
    return this.flags.enableLegacyFallback;
  }

  isDualWriteModeEnabled(): boolean {
    return this.flags.enableDualWriteMode;
  }

  isPerformanceMonitoringEnabled(): boolean {
    return this.flags.enablePerformanceMonitoring;
  }

  // Development feature checks
  isVerboseDomainLoggingEnabled(): boolean {
    return this.flags.enableVerboseDomainLogging;
  }

  isTestingModeEnabled(): boolean {
    return this.flags.enableTestingMode;
  }

  // Convenience methods
  shouldUseLegacyTradingService(): boolean {
    return !this.isCleanArchitectureTradingEnabled() || this.isLegacyFallbackEnabled();
  }

  shouldUseNewTradingWorkflow(): boolean {
    return this.isCleanArchitectureTradingEnabled() && this.isNewTradingUseCasesEnabled();
  }

  canExecuteRealTrades(): boolean {
    return (
      this.isCleanArchitectureTradingEnabled() &&
      this.isMexcServiceAdapterEnabled() &&
      !this.isTestingModeEnabled()
    );
  }

  // Update flags
  updateFlags(newFlags: Partial<TradingDomainFeatureFlags>): void {
    this.flags = TradingDomainFeatureFlagsSchema.parse({
      ...this.flags,
      ...newFlags,
    });
  }

  // Get current flag configuration
  getCurrentFlags(): TradingDomainFeatureFlags {
    return { ...this.flags };
  }

  // Apply rollout phase
  applyRolloutPhase(phase: keyof typeof ROLLOUT_PHASES): void {
    this.flags = ROLLOUT_PHASES[phase];
  }

  // Validation helpers
  validateConfiguration(): {
    isValid: boolean;
    warnings: string[];
    errors: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check for incompatible flag combinations
    if (this.flags.enableCleanArchAutoSniping && !this.flags.enableCleanArchitectureTrading) {
      errors.push(
        "Clean Architecture auto-sniping requires Clean Architecture trading to be enabled"
      );
    }

    if (this.flags.enableNewTradingUseCases && !this.flags.enableCleanArchitectureTrading) {
      errors.push("New trading use cases require Clean Architecture trading to be enabled");
    }

    if (this.flags.enableDomainEventsPublishing && !this.flags.enableCleanArchitectureTrading) {
      warnings.push(
        "Domain events publishing without Clean Architecture trading may not work as expected"
      );
    }

    // Check for safety concerns
    if (
      this.flags.enableCleanArchitectureTrading &&
      !this.flags.enableLegacyFallback &&
      !this.flags.enableDualWriteMode
    ) {
      warnings.push(
        "No fallback mechanism enabled - consider enabling legacy fallback or dual write mode"
      );
    }

    if (!this.flags.enablePerformanceMonitoring && this.flags.enableCleanArchitectureTrading) {
      warnings.push("Performance monitoring is disabled for Clean Architecture trading");
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
    };
  }
}

// Global instance (can be overridden by environment configuration)
export const tradingDomainFeatureFlags = new TradingDomainFeatureFlagManager();

// Export convenience functions
export const isTradingDomainFeatureEnabled = (
  feature: keyof TradingDomainFeatureFlags
): boolean => {
  return tradingDomainFeatureFlags.getCurrentFlags()[feature];
};

export const shouldUseLegacyTrading = (): boolean => {
  return tradingDomainFeatureFlags.shouldUseLegacyTradingService();
};

export const shouldUseCleanArchTrading = (): boolean => {
  return tradingDomainFeatureFlags.shouldUseNewTradingWorkflow();
};

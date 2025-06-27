import { 
  featureFlagEnvironmentSchema, 
  featureFlagConfigSchema,
  rolloutConfigSchema,
  type FeatureFlagConfig,
  type FeatureFlagName,
  type RolloutConfig,
  FEATURE_FLAGS 
} from './schemas';

/**
 * Feature Flag System for Clean Architecture Migration
 * Provides type-safe feature flag management with gradual rollout capabilities
 */

class FeatureFlagManager {
  private config: FeatureFlagConfig;
  private overrides: Map<string, boolean> = new Map();
  private debugMode: boolean = false;

  constructor() {
    this.config = this.initializeConfig();
    this.debugMode = this.config.FEATURE_FLAG_DEBUG_MODE;
  }

  /**
   * Initialize feature flag configuration from environment variables
   */
  private initializeConfig(): FeatureFlagConfig {
    try {
      // Validate environment variables
      const envVars = featureFlagEnvironmentSchema.parse({
        NEXT_PUBLIC_FEATURE_CA_PORTFOLIO: process.env.NEXT_PUBLIC_FEATURE_CA_PORTFOLIO,
        NEXT_PUBLIC_FEATURE_CA_TRADING: process.env.NEXT_PUBLIC_FEATURE_CA_TRADING,
        NEXT_PUBLIC_FEATURE_CA_SAFETY: process.env.NEXT_PUBLIC_FEATURE_CA_SAFETY,
        NEXT_PUBLIC_CA_ROLLOUT_PERCENTAGE: process.env.NEXT_PUBLIC_CA_ROLLOUT_PERCENTAGE,
        USE_CLEAN_ARCHITECTURE_FOR_NEW: process.env.USE_CLEAN_ARCHITECTURE_FOR_NEW,
        FEATURE_FLAG_DEBUG_MODE: process.env.FEATURE_FLAG_DEBUG_MODE,
        FEATURE_FLAG_OVERRIDE_ENABLED: process.env.FEATURE_FLAG_OVERRIDE_ENABLED,
      });

      // Transform to internal config format
      const config: FeatureFlagConfig = {
        CLEAN_ARCHITECTURE_PORTFOLIO: envVars.NEXT_PUBLIC_FEATURE_CA_PORTFOLIO,
        CLEAN_ARCHITECTURE_TRADING: envVars.NEXT_PUBLIC_FEATURE_CA_TRADING,
        CLEAN_ARCHITECTURE_SAFETY: envVars.NEXT_PUBLIC_FEATURE_CA_SAFETY,
        CA_ROLLOUT_PERCENTAGE: envVars.NEXT_PUBLIC_CA_ROLLOUT_PERCENTAGE,
        USE_CLEAN_ARCHITECTURE_FOR_NEW: envVars.USE_CLEAN_ARCHITECTURE_FOR_NEW,
        FEATURE_FLAG_DEBUG_MODE: envVars.FEATURE_FLAG_DEBUG_MODE,
        FEATURE_FLAG_OVERRIDE_ENABLED: envVars.FEATURE_FLAG_OVERRIDE_ENABLED,
        isProduction: process.env.NODE_ENV === 'production',
        isDevelopment: process.env.NODE_ENV === 'development',
      };

      return featureFlagConfigSchema.parse(config);
    } catch (error) {
      console.error('Feature flag configuration error:', error);
      // Return safe defaults
      return {
        CLEAN_ARCHITECTURE_PORTFOLIO: false,
        CLEAN_ARCHITECTURE_TRADING: false,
        CLEAN_ARCHITECTURE_SAFETY: false,
        CA_ROLLOUT_PERCENTAGE: 0,
        USE_CLEAN_ARCHITECTURE_FOR_NEW: false,
        FEATURE_FLAG_DEBUG_MODE: false,
        FEATURE_FLAG_OVERRIDE_ENABLED: false,
        isProduction: process.env.NODE_ENV === 'production',
        isDevelopment: process.env.NODE_ENV === 'development',
      };
    }
  }

  /**
   * Check if a feature flag is enabled
   */
  isEnabled(flagName: FeatureFlagName, context?: { userId?: string; sessionId?: string }): boolean {
    try {
      // Check for overrides first (if enabled)
      if (this.config.FEATURE_FLAG_OVERRIDE_ENABLED) {
        const overrideKey = context?.userId ? `${flagName}:${context.userId}` : flagName;
        if (this.overrides.has(overrideKey)) {
          const override = this.overrides.get(overrideKey);
          if (this.debugMode) {
            console.log(`Feature flag override applied: ${flagName} = ${override}`);
          }
          return override!;
        }
      }

      // Handle percentage rollout flags
      if (flagName === 'CA_ROLLOUT_PERCENTAGE') {
        return this.evaluateRolloutPercentage(context);
      }

      // Check static flags
      const isEnabled = this.config[flagName] as boolean;

      if (this.debugMode) {
        console.log(`Feature flag check: ${flagName} = ${isEnabled}`);
      }

      return isEnabled;
    } catch (error) {
      console.error(`Error checking feature flag ${flagName}:`, error);
      return false; // Fail safe
    }
  }

  /**
   * Evaluate rollout percentage for gradual deployment
   */
  private evaluateRolloutPercentage(context?: { userId?: string; sessionId?: string }): boolean {
    const percentage = this.config.CA_ROLLOUT_PERCENTAGE;
    
    if (percentage === 0) return false;
    if (percentage === 100) return true;

    // Use deterministic hash for consistent user experience
    const identifier = context?.userId || context?.sessionId || 'anonymous';
    const hash = this.simpleHash(identifier);
    const userPercentile = hash % 100;

    const isEnabled = userPercentile < percentage;

    if (this.debugMode) {
      console.log(`Rollout evaluation: ${identifier} -> ${userPercentile}% (threshold: ${percentage}%) = ${isEnabled}`);
    }

    return isEnabled;
  }

  /**
   * Simple hash function for consistent percentage-based rollouts
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Set temporary override for a feature flag
   */
  setOverride(flagName: FeatureFlagName, enabled: boolean, userId?: string): void {
    if (!this.config.FEATURE_FLAG_OVERRIDE_ENABLED) {
      console.warn('Feature flag overrides are disabled');
      return;
    }

    const key = userId ? `${flagName}:${userId}` : flagName;
    this.overrides.set(key, enabled);

    if (this.debugMode) {
      console.log(`Feature flag override set: ${key} = ${enabled}`);
    }
  }

  /**
   * Clear override for a feature flag
   */
  clearOverride(flagName: FeatureFlagName, userId?: string): void {
    const key = userId ? `${flagName}:${userId}` : flagName;
    this.overrides.delete(key);

    if (this.debugMode) {
      console.log(`Feature flag override cleared: ${key}`);
    }
  }

  /**
   * Get all feature flag states
   */
  getAllFlags(context?: { userId?: string; sessionId?: string }): Record<string, boolean> {
    const flags: Record<string, boolean> = {};
    
    Object.keys(FEATURE_FLAGS).forEach((flagName) => {
      flags[flagName] = this.isEnabled(flagName as FeatureFlagName, context);
    });

    return flags;
  }

  /**
   * Refresh configuration (useful for dynamic updates)
   */
  refresh(): void {
    this.config = this.initializeConfig();
    this.debugMode = this.config.FEATURE_FLAG_DEBUG_MODE;
    
    if (this.debugMode) {
      console.log('Feature flag configuration refreshed:', this.config);
    }
  }

  /**
   * Get current configuration (for debugging)
   */
  getConfig(): FeatureFlagConfig {
    return { ...this.config };
  }

  /**
   * Validate rollout configuration
   */
  validateRolloutConfig(config: RolloutConfig): boolean {
    try {
      rolloutConfigSchema.parse(config);
      return true;
    } catch (error) {
      console.error('Invalid rollout configuration:', error);
      return false;
    }
  }
}

// Create singleton instance
export const featureFlagManager = new FeatureFlagManager();

// Export convenience functions
export const isFeatureEnabled = (
  flagName: FeatureFlagName, 
  context?: { userId?: string; sessionId?: string }
): boolean => {
  return featureFlagManager.isEnabled(flagName, context);
};

export const getAllFeatureFlags = (
  context?: { userId?: string; sessionId?: string }
): Record<string, boolean> => {
  return featureFlagManager.getAllFlags(context);
};

export const setFeatureFlagOverride = (
  flagName: FeatureFlagName, 
  enabled: boolean, 
  userId?: string
): void => {
  featureFlagManager.setOverride(flagName, enabled, userId);
};

export const clearFeatureFlagOverride = (
  flagName: FeatureFlagName, 
  userId?: string
): void => {
  featureFlagManager.clearOverride(flagName, userId);
};

// Legacy support - maintain backward compatibility
export const featureFlags = {
  get CLEAN_ARCHITECTURE_PORTFOLIO(): boolean {
    return isFeatureEnabled('CLEAN_ARCHITECTURE_PORTFOLIO');
  },
  get CLEAN_ARCHITECTURE_TRADING(): boolean {
    return isFeatureEnabled('CLEAN_ARCHITECTURE_TRADING');
  },
  get CLEAN_ARCHITECTURE_SAFETY(): boolean {
    return isFeatureEnabled('CLEAN_ARCHITECTURE_SAFETY');
  },
  get CA_ROLLOUT_PERCENTAGE(): number {
    return featureFlagManager.getConfig().CA_ROLLOUT_PERCENTAGE;
  },
  get USE_CLEAN_ARCHITECTURE_FOR_NEW(): boolean {
    return isFeatureEnabled('USE_CLEAN_ARCHITECTURE_FOR_NEW');
  },
} as const;

// Export types and constants
export type { FeatureFlagConfig, FeatureFlagName, RolloutConfig };
export { FEATURE_FLAGS } from './schemas';
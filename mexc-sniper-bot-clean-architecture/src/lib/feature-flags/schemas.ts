import { z } from 'zod';

/**
 * Feature Flag Validation Schemas
 * Used for environment variable validation and runtime type safety
 */

export const featureFlagEnvironmentSchema = z.object({
  // Clean Architecture Domain Flags
  NEXT_PUBLIC_FEATURE_CA_PORTFOLIO: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  
  NEXT_PUBLIC_FEATURE_CA_TRADING: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  
  NEXT_PUBLIC_FEATURE_CA_SAFETY: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  
  // Rollout Configuration
  NEXT_PUBLIC_CA_ROLLOUT_PERCENTAGE: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => val >= 0 && val <= 100, {
      message: 'Rollout percentage must be between 0 and 100',
    })
    .default('0'),
  
  // Development Flags
  USE_CLEAN_ARCHITECTURE_FOR_NEW: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  
  // Advanced Feature Flags
  FEATURE_FLAG_DEBUG_MODE: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  
  FEATURE_FLAG_OVERRIDE_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
});

export const featureFlagConfigSchema = z.object({
  // Core Domain Flags
  CLEAN_ARCHITECTURE_PORTFOLIO: z.boolean(),
  CLEAN_ARCHITECTURE_TRADING: z.boolean(),
  CLEAN_ARCHITECTURE_SAFETY: z.boolean(),
  
  // Rollout Configuration
  CA_ROLLOUT_PERCENTAGE: z.number().min(0).max(100),
  
  // Development Flags
  USE_CLEAN_ARCHITECTURE_FOR_NEW: z.boolean(),
  
  // Advanced Configuration
  FEATURE_FLAG_DEBUG_MODE: z.boolean(),
  FEATURE_FLAG_OVERRIDE_ENABLED: z.boolean(),
  
  // Runtime Configuration
  isProduction: z.boolean(),
  isDevelopment: z.boolean(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
});

export const rolloutConfigSchema = z.object({
  percentage: z.number().min(0).max(100),
  userIdHash: z.string().optional(),
  sessionId: z.string().optional(),
  timestamp: z.date().optional(),
});

export const featureFlagOverrideSchema = z.object({
  flagName: z.string(),
  enabled: z.boolean(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  expiresAt: z.date().optional(),
  reason: z.string().optional(),
});

// Export types for TypeScript
export type FeatureFlagEnvironment = z.infer<typeof featureFlagEnvironmentSchema>;
export type FeatureFlagConfig = z.infer<typeof featureFlagConfigSchema>;
export type RolloutConfig = z.infer<typeof rolloutConfigSchema>;
export type FeatureFlagOverride = z.infer<typeof featureFlagOverrideSchema>;

// Feature flag names enum for type safety
export const FEATURE_FLAGS = {
  CLEAN_ARCHITECTURE_PORTFOLIO: 'CLEAN_ARCHITECTURE_PORTFOLIO',
  CLEAN_ARCHITECTURE_TRADING: 'CLEAN_ARCHITECTURE_TRADING',
  CLEAN_ARCHITECTURE_SAFETY: 'CLEAN_ARCHITECTURE_SAFETY',
  CA_ROLLOUT_PERCENTAGE: 'CA_ROLLOUT_PERCENTAGE',
  USE_CLEAN_ARCHITECTURE_FOR_NEW: 'USE_CLEAN_ARCHITECTURE_FOR_NEW',
  FEATURE_FLAG_DEBUG_MODE: 'FEATURE_FLAG_DEBUG_MODE',
  FEATURE_FLAG_OVERRIDE_ENABLED: 'FEATURE_FLAG_OVERRIDE_ENABLED',
} as const;

export type FeatureFlagName = keyof typeof FEATURE_FLAGS;
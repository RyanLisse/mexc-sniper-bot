import {
  isBrowserEnvironment,
  isNodeEnvironment,
} from "@/src/lib/browser-compatible-events";
/**
 * Emergency Configuration Management
 *
 * Handles configuration defaults, validation, and management for the
 * advanced emergency coordination system.
 */

import type { AdvancedEmergencyConfig } from "./emergency-types";

/**
 * Default configuration for emergency management system
 */
export const DEFAULT_EMERGENCY_CONFIG: AdvancedEmergencyConfig = {
  enabled: true,
  testMode: false,
  autoEscalation: true,
  maxConcurrentSessions: 5,
  sessionTimeoutMs: 3600000, // 1 hour
  communicationTimeoutMs: 30000, // 30 seconds
  actionTimeoutMs: 120000, // 2 minutes
  recoveryTimeoutMs: 1800000, // 30 minutes
  approvalTimeoutMs: 300000, // 5 minutes
  metricsSyncInterval: 60000, // 1 minute
  testingInterval: 2592000000, // 30 days
  notificationChannels: ["slack", "email", "sms"],
  emergencyContacts: [],
  systemIntegrations: [],
};

/**
 * Legacy configuration interface for backward compatibility
 */
export interface LegacyEmergencyConfig {
  maxConcurrentEmergencies: number;
  emergencySessionTimeout: number;
  autoEscalationEnabled: boolean;
  autoRecoveryEnabled: boolean;
  notificationChannels: string[];
  escalationDelayMs: number;
  maxRetryAttempts: number;
  recoveryVerificationRequired: boolean;
  recoveryTimeout: number;
  rollbackOnFailure: boolean;
  emergencyTestingEnabled: boolean;
  testingFrequencyDays: number;
  validationChecks: string[];
}

/**
 * Default legacy configuration
 */
export const DEFAULT_LEGACY_CONFIG: LegacyEmergencyConfig = {
  maxConcurrentEmergencies: 3,
  emergencySessionTimeout: 3600000, // 1 hour
  autoEscalationEnabled: true,
  autoRecoveryEnabled: true,
  notificationChannels: ["slack", "email"],
  escalationDelayMs: 300000, // 5 minutes
  maxRetryAttempts: 3,
  recoveryVerificationRequired: true,
  recoveryTimeout: 1800000, // 30 minutes
  rollbackOnFailure: true,
  emergencyTestingEnabled: true,
  testingFrequencyDays: 30,
  validationChecks: [
    "protocol_completeness",
    "action_dependencies",
    "communication_channels",
    "recovery_procedures",
  ],
};

/**
 * Configuration validation rules
 */
export interface ConfigValidationRule {
  field: string;
  required: boolean;
  type: "number" | "boolean" | "string" | "array" | "object";
  min?: number;
  max?: number;
  allowedValues?: any[];
  validator?: (value: any) => boolean;
}

export const CONFIG_VALIDATION_RULES: ConfigValidationRule[] = [
  {
    field: "maxConcurrentSessions",
    required: true,
    type: "number",
    min: 1,
    max: 10,
  },
  {
    field: "sessionTimeoutMs",
    required: true,
    type: "number",
    min: 60000, // 1 minute
    max: 86400000, // 24 hours
  },
  {
    field: "autoEscalation",
    required: true,
    type: "boolean",
  },
  {
    field: "notificationChannels",
    required: true,
    type: "array",
    allowedValues: ["slack", "email", "sms", "teams", "phone"],
  },
  {
    field: "communicationTimeoutMs",
    required: true,
    type: "number",
    min: 5000, // 5 seconds
    max: 300000, // 5 minutes
  },
];

/**
 * Merge user configuration with defaults
 */
export function mergeEmergencyConfig(
  userConfig: Partial<AdvancedEmergencyConfig>
): AdvancedEmergencyConfig {
  return {
    ...DEFAULT_EMERGENCY_CONFIG,
    ...userConfig,
    emergencyContacts: [
      ...DEFAULT_EMERGENCY_CONFIG.emergencyContacts,
      ...(userConfig.emergencyContacts || []),
    ],
    systemIntegrations: [
      ...DEFAULT_EMERGENCY_CONFIG.systemIntegrations,
      ...(userConfig.systemIntegrations || []),
    ],
  };
}

/**
 * Merge legacy configuration with defaults
 */
export function mergeLegacyConfig(
  userConfig: Partial<LegacyEmergencyConfig>
): LegacyEmergencyConfig {
  return {
    ...DEFAULT_LEGACY_CONFIG,
    ...userConfig,
    notificationChannels: [
      ...DEFAULT_LEGACY_CONFIG.notificationChannels,
      ...(userConfig.notificationChannels || []),
    ],
    validationChecks: [
      ...DEFAULT_LEGACY_CONFIG.validationChecks,
      ...(userConfig.validationChecks || []),
    ],
  };
}

/**
 * Convert legacy configuration to new format
 */
export function convertLegacyConfig(
  legacyConfig: LegacyEmergencyConfig
): AdvancedEmergencyConfig {
  return {
    enabled: true,
    testMode: false,
    autoEscalation: legacyConfig.autoEscalationEnabled,
    maxConcurrentSessions: legacyConfig.maxConcurrentEmergencies,
    sessionTimeoutMs: legacyConfig.emergencySessionTimeout,
    communicationTimeoutMs: legacyConfig.escalationDelayMs,
    actionTimeoutMs: 120000, // Default 2 minutes
    recoveryTimeoutMs: legacyConfig.recoveryTimeout,
    approvalTimeoutMs: 300000, // Default 5 minutes
    metricsSyncInterval: 60000, // Default 1 minute
    testingInterval: legacyConfig.testingFrequencyDays * 24 * 60 * 60 * 1000,
    notificationChannels: legacyConfig.notificationChannels,
    emergencyContacts: [],
    systemIntegrations: [],
  };
}

/**
 * Validate configuration against rules
 */
export function validateEmergencyConfig(config: AdvancedEmergencyConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (const rule of CONFIG_VALIDATION_RULES) {
    const value = (config as any)[rule.field];

    // Check required fields
    if (rule.required && (value === undefined || value === null)) {
      errors.push(`Required field missing: ${rule.field}`);
      continue;
    }

    if (value === undefined || value === null) continue;

    // Check type
    const actualType = Array.isArray(value) ? "array" : typeof value;
    if (actualType !== rule.type) {
      errors.push(
        `Invalid type for ${rule.field}: expected ${rule.type}, got ${actualType}`
      );
      continue;
    }

    // Check numeric ranges
    if (rule.type === "number") {
      if (rule.min !== undefined && value < rule.min) {
        errors.push(`${rule.field} must be at least ${rule.min}`);
      }
      if (rule.max !== undefined && value > rule.max) {
        errors.push(`${rule.field} must be at most ${rule.max}`);
      }
    }

    // Check allowed values
    if (rule.allowedValues && rule.type === "array") {
      const invalidValues = value.filter(
        (v: any) => !rule.allowedValues?.includes(v)
      );
      if (invalidValues.length > 0) {
        errors.push(
          `Invalid values in ${rule.field}: ${invalidValues.join(", ")}`
        );
      }
    } else if (rule.allowedValues && !rule.allowedValues.includes(value)) {
      errors.push(`Invalid value for ${rule.field}: ${value}`);
    }

    // Custom validator
    if (rule.validator && !rule.validator(value)) {
      errors.push(`Custom validation failed for ${rule.field}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get configuration for specific environment
 */
export function getEnvironmentConfig(
  env: "development" | "staging" | "production"
): Partial<AdvancedEmergencyConfig> {
  switch (env) {
    case "development":
      return {
        testMode: true,
        sessionTimeoutMs: 300000, // 5 minutes
        autoEscalation: false,
        notificationChannels: ["slack"],
        testingInterval: 86400000, // 1 day
      };

    case "staging":
      return {
        testMode: true,
        sessionTimeoutMs: 1800000, // 30 minutes
        autoEscalation: true,
        notificationChannels: ["slack", "email"],
        testingInterval: 604800000, // 7 days
      };

    case "production":
      return {
        testMode: false,
        sessionTimeoutMs: 3600000, // 1 hour
        autoEscalation: true,
        notificationChannels: ["slack", "email", "sms"],
        testingInterval: 2592000000, // 30 days
      };

    default:
      return DEFAULT_EMERGENCY_CONFIG;
  }
}

/**
 * Configuration manager class
 */
export class EmergencyConfigManager {
  private config: AdvancedEmergencyConfig;
  private validationErrors: string[] = [];

  constructor(userConfig: Partial<AdvancedEmergencyConfig> = {}) {
    const envConfig = getEnvironmentConfig(
      (process.env.NODE_ENV as "development" | "staging" | "production") ||
        "development"
    );

    // Merge: defaults -> environment -> user config
    this.config = mergeEmergencyConfig({
      ...envConfig,
      ...userConfig,
    });

    this.validateConfig();
  }

  /**
   * Get current configuration
   */
  getConfig(): AdvancedEmergencyConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AdvancedEmergencyConfig>): void {
    this.config = { ...this.config, ...updates };
    this.validateConfig();
  }

  /**
   * Get validation errors
   */
  getValidationErrors(): string[] {
    return [...this.validationErrors];
  }

  /**
   * Check if configuration is valid
   */
  isValid(): boolean {
    return this.validationErrors.length === 0;
  }

  /**
   * Validate current configuration
   */
  private validateConfig(): void {
    const result = validateEmergencyConfig(this.config);
    this.validationErrors = result.errors;
  }

  /**
   * Reset to defaults
   */
  resetToDefaults(): void {
    this.config = { ...DEFAULT_EMERGENCY_CONFIG };
    this.validationErrors = [];
  }

  /**
   * Import legacy configuration
   */
  importLegacyConfig(legacyConfig: LegacyEmergencyConfig): void {
    this.config = convertLegacyConfig(legacyConfig);
    this.validateConfig();
  }

  /**
   * Export configuration as JSON
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  importConfig(configJson: string): void {
    try {
      const importedConfig = JSON.parse(configJson);
      this.config = mergeEmergencyConfig(importedConfig);
      this.validateConfig();
    } catch (error) {
      throw new Error(
        `Failed to import configuration: ${(error as Error).message}`
      );
    }
  }
}

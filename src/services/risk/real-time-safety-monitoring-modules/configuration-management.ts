/**
 * Configuration Management Module
 *
 * Provides configuration management functionality including default configuration,
 * configuration validation, dynamic updates, and configuration persistence.
 *
 * Part of the modular refactoring of real-time-safety-monitoring-service.ts
 */

import type {
  SafetyConfiguration,
  SafetyThresholds,
} from "@/src/schemas/safety-monitoring-schemas";
import {
  validateSafetyConfiguration,
  validateSafetyThresholds,
} from "@/src/schemas/safety-monitoring-schemas";

export interface ConfigurationManagementConfig {
  onConfigUpdate?: (config: SafetyConfiguration) => void;
  enableValidation?: boolean;
  enablePersistence?: boolean;
}

export interface ConfigurationUpdate {
  field: keyof SafetyConfiguration;
  oldValue: any;
  newValue: any;
  timestamp: string;
}

export interface ConfigurationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ConfigurationPreset {
  name: string;
  description: string;
  configuration: SafetyConfiguration;
  useCase: string;
}

export class ConfigurationManagement {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[configuration-management]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[configuration-management]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[configuration-management]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[configuration-management]", message, context || ""),
  };
  private configuration: SafetyConfiguration;
  private updateHistory: ConfigurationUpdate[] = [];
  private readonly enableValidation: boolean;
  private readonly enablePersistence: boolean;

  constructor(
    initialConfig?: Partial<SafetyConfiguration>,
    private config: ConfigurationManagementConfig = {}
  ) {
    this.enableValidation = config.enableValidation !== false; // Default to true
    this.enablePersistence = config.enablePersistence !== false; // Default to true

    this.configuration = this.mergeWithDefaults(initialConfig);

    // Validate initial configuration if validation is enabled
    if (this.enableValidation) {
      const validation = this.validateConfiguration(this.configuration);
      if (!validation.isValid) {
        console.error("Invalid initial configuration", {
          operation: "initialization",
          errors: validation.errors,
          warnings: validation.warnings,
        });
        throw new Error(`Invalid configuration: ${validation.errors.join(", ")}`);
      }
    }

    console.info("Configuration management initialized", {
      operation: "initialization",
      monitoringInterval: this.configuration.monitoringIntervalMs,
      riskCheckInterval: this.configuration.riskCheckIntervalMs,
      autoActionEnabled: this.configuration.autoActionEnabled,
      emergencyMode: this.configuration.emergencyMode,
      enableValidation: this.enableValidation,
      enablePersistence: this.enablePersistence,
    });
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): SafetyConfiguration {
    return { ...this.configuration };
  }

  /**
   * Update configuration with validation
   */
  public updateConfiguration(updates: Partial<SafetyConfiguration>): SafetyConfiguration {
    const oldConfig = { ...this.configuration };
    const newConfig = { ...this.configuration, ...updates };

    // Validate new configuration if validation is enabled
    if (this.enableValidation) {
      const validation = this.validateConfiguration(newConfig);
      if (!validation.isValid) {
        console.error("Configuration update validation failed", {
          operation: "update_configuration",
          errors: validation.errors,
          warnings: validation.warnings,
          updateFields: Object.keys(updates),
        });
        throw new Error(`Invalid configuration update: ${validation.errors.join(", ")}`);
      }

      if (validation.warnings.length > 0) {
        console.warn("Configuration update warnings", {
          operation: "update_configuration",
          warnings: validation.warnings,
          updateFields: Object.keys(updates),
        });
      }
    }

    // Record configuration changes
    const timestamp = new Date().toISOString();
    Object.keys(updates).forEach((field) => {
      const key = field as keyof SafetyConfiguration;
      if (oldConfig[key] !== newConfig[key]) {
        this.updateHistory.push({
          field: key,
          oldValue: oldConfig[key],
          newValue: newConfig[key],
          timestamp,
        });
      }
    });

    this.configuration = newConfig;

    // Trigger update callback if provided
    if (this.config.onConfigUpdate) {
      try {
        this.config.onConfigUpdate(this.configuration);
      } catch (error) {
        console.error(
          "Configuration update callback failed",
          {
            operation: "update_configuration",
            updateFields: Object.keys(updates),
          },
          error
        );
      }
    }

    console.info("Configuration updated", {
      operation: "update_configuration",
      updateFields: Object.keys(updates),
      monitoringInterval: this.configuration.monitoringIntervalMs,
      riskCheckInterval: this.configuration.riskCheckIntervalMs,
      autoActionEnabled: this.configuration.autoActionEnabled,
      emergencyMode: this.configuration.emergencyMode,
    });

    return { ...this.configuration };
  }

  /**
   * Update specific thresholds
   */
  public updateThresholds(thresholdUpdates: Partial<SafetyThresholds>): SafetyThresholds {
    const updatedThresholds = { ...this.configuration.thresholds, ...thresholdUpdates };

    // Validate thresholds if validation is enabled
    if (this.enableValidation) {
      try {
        validateSafetyThresholds(updatedThresholds);
      } catch (error) {
        console.error("Threshold update validation failed", {
          operation: "update_thresholds",
          updateFields: Object.keys(thresholdUpdates),
          error: (error as Error)?.message,
        });
        throw new Error(`Invalid threshold update: ${(error as Error)?.message}`);
      }
    }

    // Update configuration with new thresholds
    this.updateConfiguration({ thresholds: updatedThresholds });

    console.info("Thresholds updated", {
      operation: "update_thresholds",
      updateFields: Object.keys(thresholdUpdates),
      thresholdCount: Object.keys(updatedThresholds).length,
    });

    return { ...updatedThresholds };
  }

  /**
   * Validate configuration
   */
  public validateConfiguration(config: SafetyConfiguration): ConfigurationValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      validateSafetyConfiguration(config);
    } catch (error) {
      errors.push((error as Error)?.message || "Unknown error");
    }

    // Additional business logic validation
    if (config.monitoringIntervalMs < 5000) {
      warnings.push("Monitoring interval less than 5 seconds may cause high CPU usage");
    }

    if (config.riskCheckIntervalMs < config.monitoringIntervalMs) {
      warnings.push(
        "Risk check interval should typically be equal or greater than monitoring interval"
      );
    }

    if (config.alertRetentionHours > 168) {
      // 1 week
      warnings.push("Alert retention longer than 1 week may consume significant memory");
    }

    // Threshold validation
    const thresholds = config.thresholds;

    if (thresholds.maxDrawdownPercentage > 50) {
      warnings.push("Maximum drawdown threshold above 50% is extremely risky");
    }

    if (thresholds.minSuccessRatePercentage < 30) {
      warnings.push("Minimum success rate below 30% may indicate poor strategy performance");
    }

    if (thresholds.maxConsecutiveLosses > 10) {
      warnings.push("Maximum consecutive losses above 10 is very high");
    }

    if (thresholds.maxApiLatencyMs > 5000) {
      warnings.push("API latency threshold above 5 seconds may indicate poor connectivity");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get configuration update history
   */
  public getUpdateHistory(limit?: number): ConfigurationUpdate[] {
    const history = [...this.updateHistory].reverse(); // Most recent first
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Clear configuration update history
   */
  public clearUpdateHistory(): void {
    const clearedCount = this.updateHistory.length;
    this.updateHistory = [];

    console.info("Configuration update history cleared", {
      operation: "clear_update_history",
      clearedCount,
    });
  }

  /**
   * Reset configuration to defaults
   */
  public resetToDefaults(): SafetyConfiguration {
    const defaultConfig = this.getDefaultConfiguration();

    console.info("Configuration reset to defaults", {
      operation: "reset_to_defaults",
      previousConfig: {
        monitoringInterval: this.configuration.monitoringIntervalMs,
        autoActionEnabled: this.configuration.autoActionEnabled,
        emergencyMode: this.configuration.emergencyMode,
      },
    });

    this.configuration = defaultConfig;

    // Clear update history since we're resetting
    this.updateHistory = [];

    return { ...this.configuration };
  }

  /**
   * Get predefined configuration presets
   */
  public getConfigurationPresets(): ConfigurationPreset[] {
    return [
      {
        name: "Conservative",
        description: "Low-risk configuration with strict thresholds",
        useCase: "Stable market conditions, risk-averse trading",
        configuration: {
          ...this.getDefaultConfiguration(),
          thresholds: {
            ...this.getDefaultThresholds(),
            maxDrawdownPercentage: 5,
            maxDailyLossPercentage: 2,
            maxPositionRiskPercentage: 5,
            maxPortfolioConcentration: 15,
            minSuccessRatePercentage: 70,
            maxConsecutiveLosses: 3,
            maxSlippagePercentage: 1,
          },
        },
      },
      {
        name: "Balanced",
        description: "Balanced risk configuration with moderate thresholds",
        useCase: "Normal market conditions, balanced risk-reward",
        configuration: this.getDefaultConfiguration(),
      },
      {
        name: "Aggressive",
        description: "Higher-risk configuration with relaxed thresholds",
        useCase: "Volatile market conditions, higher risk tolerance",
        configuration: {
          ...this.getDefaultConfiguration(),
          thresholds: {
            ...this.getDefaultThresholds(),
            maxDrawdownPercentage: 25,
            maxDailyLossPercentage: 10,
            maxPositionRiskPercentage: 15,
            maxPortfolioConcentration: 40,
            minSuccessRatePercentage: 50,
            maxConsecutiveLosses: 8,
            maxSlippagePercentage: 3,
          },
        },
      },
      {
        name: "Emergency",
        description: "Emergency configuration with very strict limits",
        useCase: "Market crisis, extreme risk aversion",
        configuration: {
          ...this.getDefaultConfiguration(),
          autoActionEnabled: true,
          emergencyMode: true,
          monitoringIntervalMs: 10000, // 10 seconds
          riskCheckIntervalMs: 15000, // 15 seconds
          thresholds: {
            ...this.getDefaultThresholds(),
            maxDrawdownPercentage: 3,
            maxDailyLossPercentage: 1,
            maxPositionRiskPercentage: 3,
            maxPortfolioConcentration: 10,
            minSuccessRatePercentage: 80,
            maxConsecutiveLosses: 2,
            maxSlippagePercentage: 0.5,
          },
        },
      },
    ];
  }

  /**
   * Apply a configuration preset
   */
  public applyPreset(presetName: string): SafetyConfiguration {
    const presets = this.getConfigurationPresets();
    const preset = presets.find((p) => p.name.toLowerCase() === presetName.toLowerCase());

    if (!preset) {
      const availablePresets = presets.map((p) => p.name).join(", ");
      throw new Error(`Preset "${presetName}" not found. Available presets: ${availablePresets}`);
    }

    console.info("Applying configuration preset", {
      operation: "apply_preset",
      presetName: preset.name,
      presetDescription: preset.description,
      useCase: preset.useCase,
    });

    this.configuration = preset.configuration;

    // Record preset application in history
    this.updateHistory.push({
      field: "enabled", // Use a field that exists
      oldValue: "previous_config",
      newValue: `preset_${preset.name}`,
      timestamp: new Date().toISOString(),
    });

    return { ...this.configuration };
  }

  /**
   * Get configuration summary for monitoring
   */
  public getConfigurationSummary(): {
    riskLevel: "low" | "medium" | "high";
    monitoringFrequency: "very_high" | "high" | "medium" | "low";
    alertRetention: "short" | "medium" | "long";
    autoActionsEnabled: boolean;
    emergencyMode: boolean;
    thresholdCount: number;
  } {
    const config = this.configuration;

    // Determine overall risk level based on thresholds
    const avgDrawdownThreshold =
      (config.thresholds.maxDrawdownPercentage + config.thresholds.maxDailyLossPercentage) / 2;
    const riskLevel: "low" | "medium" | "high" =
      avgDrawdownThreshold <= 5 ? "low" : avgDrawdownThreshold <= 15 ? "medium" : "high";

    // Determine monitoring frequency
    const monitoringFrequency: "very_high" | "high" | "medium" | "low" =
      config.monitoringIntervalMs <= 10000
        ? "very_high"
        : config.monitoringIntervalMs <= 30000
          ? "high"
          : config.monitoringIntervalMs <= 60000
            ? "medium"
            : "low";

    // Determine alert retention level
    const alertRetention: "short" | "medium" | "long" =
      config.alertRetentionHours <= 12
        ? "short"
        : config.alertRetentionHours <= 48
          ? "medium"
          : "long";

    return {
      riskLevel,
      monitoringFrequency,
      alertRetention,
      autoActionsEnabled: config.autoActionEnabled,
      emergencyMode: config.emergencyMode,
      thresholdCount: Object.keys(config.thresholds).length,
    };
  }

  // Private helper methods

  private mergeWithDefaults(partial?: Partial<SafetyConfiguration>): SafetyConfiguration {
    const defaults = this.getDefaultConfiguration();

    if (!partial) {
      return defaults;
    }

    return {
      ...defaults,
      ...partial,
      thresholds: {
        ...defaults.thresholds,
        ...(partial.thresholds || {}),
      },
    };
  }

  private getDefaultConfiguration(): SafetyConfiguration {
    return {
      enabled: true,
      monitoringIntervalMs: 30000, // 30 seconds
      riskCheckIntervalMs: 60000, // 1 minute
      autoActionEnabled: false,
      emergencyMode: false,
      alertRetentionHours: 24,
      thresholds: this.getDefaultThresholds(),
    };
  }

  private getDefaultThresholds(): SafetyThresholds {
    return {
      maxDrawdownPercentage: 15,
      maxDailyLossPercentage: 5,
      maxPositionRiskPercentage: 10,
      maxPortfolioConcentration: 25,
      minSuccessRatePercentage: 60,
      maxConsecutiveLosses: 5,
      maxSlippagePercentage: 2,
      maxApiLatencyMs: 1000,
      minApiSuccessRate: 95,
      maxMemoryUsagePercentage: 80,
      minPatternConfidence: 75,
      maxPatternDetectionFailures: 3,
    };
  }
}

/**
 * Factory function to create ConfigurationManagement instance
 */
export function createConfigurationManagement(
  initialConfig?: Partial<SafetyConfiguration>,
  config?: ConfigurationManagementConfig
): ConfigurationManagement {
  return new ConfigurationManagement(initialConfig, config);
}

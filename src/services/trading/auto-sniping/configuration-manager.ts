/**
 * Configuration Manager Module
 *
 * Handles configuration management and validation for auto-sniping.
 * Extracted from large auto-sniping.ts for better maintainability.
 */

import type {
  CoreTradingConfig,
  ModuleContext,
} from "../consolidated/core-trading/types";

export class ConfigurationManager {
  private context: ModuleContext;
  private config: CoreTradingConfig;

  constructor(context: ModuleContext) {
    this.context = context;
    this.config = context.config;
  }

  async initialize(): Promise<void> {
    await this.validateConfiguration();
    console.log("ConfigurationManager initialized");
  }

  async updateConfig(newConfig: Partial<CoreTradingConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    this.context.config = this.config;
    await this.validateConfiguration();
  }

  getConfig(): CoreTradingConfig {
    return this.config;
  }

  isReadyForTrading(): boolean {
    if (!this.config.autoSnipingEnabled) {
      return false;
    }

    if (!this.config.apiKey || !this.config.secretKey) {
      return false;
    }

    if (
      this.config.enableCircuitBreaker &&
      this.context.safetyCoordinator?.isCircuitBreakerOpen?.()
    ) {
      return false;
    }

    return true;
  }

  async validateConfiguration(): Promise<boolean> {
    try {
      // Validate API credentials
      if (!this.config.apiKey) {
        console.warn("Missing MEXC API key");
        return false;
      }

      if (!this.config.secretKey) {
        console.warn("Missing MEXC secret key");
        return false;
      }

      // Validate auto-sniping configuration
      if (this.config.autoSnipingEnabled) {
        if (
          !this.config.snipeCheckInterval ||
          this.config.snipeCheckInterval < 1000
        ) {
          console.warn("Auto-sniping interval too short (minimum 1000ms)");
          return false;
        }

        if (
          !this.config.maxConcurrentSnipes ||
          this.config.maxConcurrentSnipes < 1
        ) {
          console.warn("Invalid max concurrent snipes setting");
          return false;
        }
      }

      // Validate safety settings
      if (this.config.maxPositionSize && this.config.maxPositionSize <= 0) {
        console.warn("Invalid max position size");
        return false;
      }

      return true;
    } catch (error) {
      console.error("Configuration validation error:", error);
      return false;
    }
  }

  async performHealthChecks(): Promise<boolean> {
    try {
      // Check if configuration is valid
      if (!(await this.validateConfiguration())) {
        return false;
      }

      // Check safety circuit breaker
      if (
        this.config.safety?.circuitBreaker?.enabled &&
        this.config.safety?.circuitBreaker?.isTripped
      ) {
        console.warn("Safety circuit breaker is tripped");
        return false;
      }

      // Additional health checks can be added here
      return true;
    } catch (error) {
      console.error("Health check error:", error);
      return false;
    }
  }
}

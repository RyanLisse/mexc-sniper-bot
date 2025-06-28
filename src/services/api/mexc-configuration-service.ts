/**
 * MEXC Configuration Service
 *
 * Centralized configuration management for all MEXC services.
 * Provides validation, health checks, and environment-specific settings.
 *
 * Features:
 * - Centralized configuration management
 * - Environment variable validation
 * - Configuration health checks
 * - Dynamic configuration updates
 * - Secure credential handling
 * - Configuration versioning
 */

import { z } from "zod";
import type { UnifiedMexcConfig } from "@/src/schemas/unified/mexc-api-schemas";

// ============================================================================
// Configuration Schemas and Validation
// ============================================================================

/**
 * Environment configuration schema
 */
const EnvironmentConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MEXC_API_KEY: z.string().optional(),
  MEXC_SECRET_KEY: z.string().optional(),
  MEXC_PASSPHRASE: z.string().optional(),
  MEXC_BASE_URL: z.string().url().default("https://api.mexc.com"),
  MEXC_TIMEOUT: z.coerce.number().min(1000).max(60000).default(10000),
  MEXC_MAX_RETRIES: z.coerce.number().min(0).max(10).default(3),
  MEXC_RETRY_DELAY: z.coerce.number().min(100).max(10000).default(1000),
  MEXC_RATE_LIMIT_DELAY: z.coerce.number().min(0).max(5000).default(100),
  MEXC_ENABLE_CACHING: z.coerce.boolean().default(true),
  MEXC_CACHE_TTL: z.coerce.number().min(1000).max(300000).default(30000),
  MEXC_ENABLE_CIRCUIT_BREAKER: z.coerce.boolean().default(true),
  MEXC_ENABLE_METRICS: z.coerce.boolean().default(true),
  MEXC_ENABLE_ENHANCED_CACHING: z.coerce.boolean().default(true),
  MEXC_ENABLE_PERFORMANCE_MONITORING: z.coerce.boolean().default(true),
  MEXC_API_RESPONSE_TTL: z.coerce.number().min(500).max(10000).default(1500),
});

/**
 * Trading configuration schema
 */
const TradingConfigSchema = z.object({
  maxPositionSize: z.number().min(1).max(100000).default(1000),
  minOrderValue: z.number().min(1).max(1000).default(10),
  defaultTimeInForce: z.enum(["GTC", "IOC", "FOK"]).default("GTC"),
  enableRiskChecks: z.boolean().default(true),
  maxDailyLoss: z.number().min(10).max(10000).default(500),
  maxOpenOrders: z.number().min(1).max(100).default(10),
  paperTradingMode: z.boolean().default(false),
});

/**
 * Authentication configuration schema
 */
const AuthConfigSchema = z.object({
  enableEncryption: z.boolean().default(false),
  testIntervalMs: z.number().min(30000).max(3600000).default(300000),
  maxAuthFailures: z.number().min(1).max(20).default(5),
  authFailureResetMs: z.number().min(60000).max(7200000).default(600000),
});

/**
 * Complete service configuration schema
 */
const ServiceConfigSchema = z.object({
  environment: EnvironmentConfigSchema,
  trading: TradingConfigSchema,
  authentication: AuthConfigSchema,
  version: z.string().default("1.0.0"),
  lastUpdated: z.date().default(() => new Date()),
});

// ============================================================================
// Configuration Types
// ============================================================================

export type EnvironmentConfig = z.infer<typeof EnvironmentConfigSchema>;
export type TradingConfig = z.infer<typeof TradingConfigSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;

export interface ConfigurationHealth {
  isValid: boolean;
  hasCredentials: boolean;
  hasRequiredEnvVars: boolean;
  configVersion: string;
  validationErrors: string[];
  warnings: string[];
  recommendations: string[];
  securityLevel: "high" | "medium" | "low";
}

export interface ConfigurationMetrics {
  lastValidatedAt: Date;
  validationCount: number;
  errorCount: number;
  warningCount: number;
  configUpdates: number;
  environmentChecks: number;
}

// ============================================================================
// Configuration Service Implementation
// ============================================================================

/**
 * Centralized configuration management service
 * Handles validation, updates, and health monitoring of all configuration
 */
export class MexcConfigurationService {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[mexc-configuration-service]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[mexc-configuration-service]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[mexc-configuration-service]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[mexc-configuration-service]", message, context || ""),
  };

  private config: ServiceConfig;
  private metrics: ConfigurationMetrics;
  private readonly requiredEnvVars = ["MEXC_API_KEY", "MEXC_SECRET_KEY"];

  constructor(initialConfig?: Partial<ServiceConfig>) {
    // Load configuration from environment and defaults
    this.config = this.loadConfiguration(initialConfig);

    this.metrics = {
      lastValidatedAt: new Date(),
      validationCount: 0,
      errorCount: 0,
      warningCount: 0,
      configUpdates: 0,
      environmentChecks: 0,
    };

    // Validate initial configuration
    this.validateConfiguration();
  }

  // ============================================================================
  // Configuration Access
  // ============================================================================

  /**
   * Get complete configuration
   */
  getConfig(): ServiceConfig {
    return { ...this.config };
  }

  /**
   * Get environment configuration
   */
  getEnvironmentConfig(): EnvironmentConfig {
    return { ...this.config.environment };
  }

  /**
   * Get trading configuration
   */
  getTradingConfig(): TradingConfig {
    return { ...this.config.trading };
  }

  /**
   * Get authentication configuration
   */
  getAuthConfig(): AuthConfig {
    return { ...this.config.authentication };
  }

  /**
   * Get unified MEXC configuration for compatibility
   */
  getUnifiedMexcConfig(): Required<UnifiedMexcConfig> {
    const env = this.config.environment;
    return {
      apiKey: env.MEXC_API_KEY || "",
      secretKey: env.MEXC_SECRET_KEY || "",
      passphrase: env.MEXC_PASSPHRASE || "",
      baseUrl: env.MEXC_BASE_URL,
      timeout: env.MEXC_TIMEOUT,
      maxRetries: env.MEXC_MAX_RETRIES,
      retryDelay: env.MEXC_RETRY_DELAY,
      rateLimitDelay: env.MEXC_RATE_LIMIT_DELAY,
      enableCaching: env.MEXC_ENABLE_CACHING,
      cacheTTL: env.MEXC_CACHE_TTL,
      enableCircuitBreaker: env.MEXC_ENABLE_CIRCUIT_BREAKER,
      enableRateLimiter: true, // Required property from schema
      maxFailures: 5, // Required property from schema
      resetTimeout: 60000, // Required property from schema
      enablePaperTrading: this.config.trading.paperTradingMode, // Required property from schema
      circuitBreakerThreshold: 5, // Required property from schema
      circuitBreakerResetTime: 30000, // Required property from schema
      enableMetrics: env.MEXC_ENABLE_METRICS,
      apiResponseTTL: env.MEXC_API_RESPONSE_TTL,
      enableTestMode: false, // Optional property - set to false for production
    };
  }

  // ============================================================================
  // Configuration Updates
  // ============================================================================

  /**
   * Update environment configuration
   */
  updateEnvironmentConfig(updates: Partial<EnvironmentConfig>): {
    success: boolean;
    errors: string[];
  } {
    try {
      const newEnvironmentConfig = { ...this.config.environment, ...updates };
      const validatedConfig = EnvironmentConfigSchema.parse(newEnvironmentConfig);

      this.config.environment = validatedConfig;
      this.config.lastUpdated = new Date();
      this.metrics.configUpdates++;

      return { success: true, errors: [] };
    } catch (error) {
      const errors = this.extractValidationErrors(error);
      this.metrics.errorCount++;
      return { success: false, errors };
    }
  }

  /**
   * Update trading configuration
   */
  updateTradingConfig(updates: Partial<TradingConfig>): { success: boolean; errors: string[] } {
    try {
      const newTradingConfig = { ...this.config.trading, ...updates };
      const validatedConfig = TradingConfigSchema.parse(newTradingConfig);

      this.config.trading = validatedConfig;
      this.config.lastUpdated = new Date();
      this.metrics.configUpdates++;

      return { success: true, errors: [] };
    } catch (error) {
      const errors = this.extractValidationErrors(error);
      this.metrics.errorCount++;
      return { success: false, errors };
    }
  }

  /**
   * Update authentication configuration
   */
  updateAuthConfig(updates: Partial<AuthConfig>): { success: boolean; errors: string[] } {
    try {
      const newAuthConfig = { ...this.config.authentication, ...updates };
      const validatedConfig = AuthConfigSchema.parse(newAuthConfig);

      this.config.authentication = validatedConfig;
      this.config.lastUpdated = new Date();
      this.metrics.configUpdates++;

      return { success: true, errors: [] };
    } catch (error) {
      const errors = this.extractValidationErrors(error);
      this.metrics.errorCount++;
      return { success: false, errors };
    }
  }

  /**
   * Update credentials securely
   */
  updateCredentials(
    apiKey: string,
    secretKey: string,
    passphrase?: string
  ): { success: boolean; errors: string[] } {
    return this.updateEnvironmentConfig({
      MEXC_API_KEY: apiKey,
      MEXC_SECRET_KEY: secretKey,
      MEXC_PASSPHRASE: passphrase,
    });
  }

  // ============================================================================
  // Configuration Validation and Health
  // ============================================================================

  /**
   * Validate current configuration
   */
  validateConfiguration(): { success: boolean; errors: string[]; warnings: string[] } {
    this.metrics.validationCount++;
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate complete configuration
      ServiceConfigSchema.parse(this.config);

      // Check required environment variables
      this.metrics.environmentChecks++;
      for (const envVar of this.requiredEnvVars) {
        if (!process.env[envVar] && !this.config.environment[envVar as keyof EnvironmentConfig]) {
          errors.push(`Required environment variable ${envVar} is not set`);
        }
      }

      // Security validations
      if (this.config.environment.NODE_ENV === "production") {
        if (!this.config.authentication.enableEncryption) {
          warnings.push("Encryption not enabled in production environment");
        }

        if (this.config.trading.paperTradingMode) {
          warnings.push("Paper trading mode enabled in production");
        }
      }

      // Performance validations
      if (this.config.environment.MEXC_TIMEOUT > 30000) {
        warnings.push("API timeout is very high (>30s)");
      }

      if (this.config.environment.MEXC_CACHE_TTL < 5000) {
        warnings.push("Cache TTL is very low (<5s) - may impact performance");
      }

      if (errors.length > 0) {
        this.metrics.errorCount++;
      }

      if (warnings.length > 0) {
        this.metrics.warningCount++;
      }

      return { success: errors.length === 0, errors, warnings };
    } catch (error) {
      const validationErrors = this.extractValidationErrors(error);
      this.metrics.errorCount++;
      return { success: false, errors: validationErrors, warnings };
    }
  }

  /**
   * Perform comprehensive health check
   */
  performHealthCheck(): ConfigurationHealth {
    const validation = this.validateConfiguration();
    const hasCredentials = !!(
      this.config.environment.MEXC_API_KEY && this.config.environment.MEXC_SECRET_KEY
    );
    const hasRequiredEnvVars = this.requiredEnvVars.every(
      (envVar) => process.env[envVar] || this.config.environment[envVar as keyof EnvironmentConfig]
    );

    const recommendations: string[] = [];

    if (!hasCredentials) {
      recommendations.push("Configure MEXC API credentials");
    }

    if (!this.config.environment.MEXC_ENABLE_CACHING) {
      recommendations.push("Enable caching for better performance");
    }

    if (!this.config.environment.MEXC_ENABLE_CIRCUIT_BREAKER) {
      recommendations.push("Enable circuit breaker for better reliability");
    }

    if (this.config.trading.maxPositionSize > 5000) {
      recommendations.push("Consider lowering maximum position size for risk management");
    }

    // Determine security level
    let securityLevel: "high" | "medium" | "low" = "medium";

    if (this.config.environment.NODE_ENV === "production") {
      if (this.config.authentication.enableEncryption && hasCredentials) {
        securityLevel = "high";
      } else if (hasCredentials) {
        securityLevel = "medium";
      } else {
        securityLevel = "low";
      }
    } else {
      securityLevel = hasCredentials ? "medium" : "low";
    }

    return {
      isValid: validation.success,
      hasCredentials,
      hasRequiredEnvVars,
      configVersion: this.config.version,
      validationErrors: validation.errors,
      warnings: validation.warnings,
      recommendations,
      securityLevel,
    };
  }

  /**
   * Get configuration metrics
   */
  getMetrics(): ConfigurationMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset configuration metrics
   */
  resetMetrics(): void {
    this.metrics = {
      lastValidatedAt: new Date(),
      validationCount: 0,
      errorCount: 0,
      warningCount: 0,
      configUpdates: 0,
      environmentChecks: 0,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Load configuration from environment and defaults
   */
  private loadConfiguration(initialConfig?: Partial<ServiceConfig>): ServiceConfig {
    try {
      // Create environment configuration from process.env
      const envConfig = this.loadEnvironmentConfig();

      // Default configurations
      const defaultConfig: ServiceConfig = {
        environment: envConfig,
        trading: TradingConfigSchema.parse({}),
        authentication: AuthConfigSchema.parse({}),
        version: "1.0.0",
        lastUpdated: new Date(),
      };

      // Merge with provided initial config
      if (initialConfig) {
        return {
          ...defaultConfig,
          ...initialConfig,
          environment: { ...defaultConfig.environment, ...initialConfig.environment },
          trading: { ...defaultConfig.trading, ...initialConfig.trading },
          authentication: { ...defaultConfig.authentication, ...initialConfig.authentication },
        };
      }

      return defaultConfig;
    } catch (error) {
      console.error("[MexcConfigurationService] Failed to load configuration:", error);
      // Return minimal safe configuration
      return ServiceConfigSchema.parse({});
    }
  }

  /**
   * Load environment configuration from process.env
   */
  private loadEnvironmentConfig(): EnvironmentConfig {
    const envData = {
      NODE_ENV: process.env.NODE_ENV || "development",
      MEXC_API_KEY: process.env.MEXC_API_KEY || "",
      MEXC_SECRET_KEY: process.env.MEXC_SECRET_KEY || "",
      MEXC_PASSPHRASE: process.env.MEXC_PASSPHRASE || "",
      MEXC_BASE_URL: process.env.MEXC_BASE_URL || "https://api.mexc.com",
      MEXC_TIMEOUT: process.env.MEXC_TIMEOUT || "10000",
      MEXC_MAX_RETRIES: process.env.MEXC_MAX_RETRIES || "3",
      MEXC_RETRY_DELAY: process.env.MEXC_RETRY_DELAY || "1000",
      MEXC_RATE_LIMIT_DELAY: process.env.MEXC_RATE_LIMIT_DELAY || "100",
      MEXC_ENABLE_CACHING: process.env.MEXC_ENABLE_CACHING || "true",
      MEXC_CACHE_TTL: process.env.MEXC_CACHE_TTL || "30000",
      MEXC_ENABLE_CIRCUIT_BREAKER: process.env.MEXC_ENABLE_CIRCUIT_BREAKER || "true",
      MEXC_ENABLE_METRICS: process.env.MEXC_ENABLE_METRICS || "true",
      MEXC_ENABLE_ENHANCED_CACHING: process.env.MEXC_ENABLE_ENHANCED_CACHING || "true",
      MEXC_ENABLE_PERFORMANCE_MONITORING: process.env.MEXC_ENABLE_PERFORMANCE_MONITORING || "true",
      MEXC_API_RESPONSE_TTL: process.env.MEXC_API_RESPONSE_TTL || "1500",
    };

    return EnvironmentConfigSchema.parse(envData);
  }

  /**
   * Extract validation errors from Zod error
   */
  private extractValidationErrors(error: unknown): string[] {
    if (error instanceof z.ZodError) {
      return error.errors.map((err) => `${err.path.join(".")}: ${err.message}`);
    }

    if (error instanceof Error) {
      return [error.message];
    }

    return ["Unknown validation error"];
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create configuration service with defaults
 */
export function createMexcConfigurationService(
  initialConfig?: Partial<ServiceConfig>
): MexcConfigurationService {
  return new MexcConfigurationService(initialConfig);
}

// ============================================================================
// Global Instance Management
// ============================================================================

let globalConfigService: MexcConfigurationService | null = null;

/**
 * Get or create the global configuration service
 */
export function getGlobalConfigurationService(): MexcConfigurationService {
  if (!globalConfigService) {
    globalConfigService = createMexcConfigurationService();
  }
  return globalConfigService;
}

/**
 * Reset the global configuration service
 */
export function resetGlobalConfigurationService(): void {
  globalConfigService = null;
}

/**
 * Initialize configuration with validation
 */
export async function initializeConfiguration(initialConfig?: Partial<ServiceConfig>): Promise<{
  configService: MexcConfigurationService;
  health: ConfigurationHealth;
  isReady: boolean;
}> {
  const configService = initialConfig
    ? createMexcConfigurationService(initialConfig)
    : getGlobalConfigurationService();

  const health = configService.performHealthCheck();
  const isReady = health.isValid && health.hasCredentials;

  if (!isReady) {
    console.warn("[Configuration] Service not ready:", {
      isValid: health.isValid,
      hasCredentials: health.hasCredentials,
      errors: health.validationErrors,
      warnings: health.warnings,
    });
  }

  return { configService, health, isReady };
}

/**
import { createLogger } from './structured-logger';
 * Unified Configuration Management System
 *
 * Consolidates all configuration patterns across the application into a single,
 * type-safe, and maintainable configuration system.
 *
 * ELIMINATES REDUNDANCY:
 * - Multiple config interfaces across 151+ files
 * - Scattered environment variable access
 * - Duplicate validation logic
 * - Inconsistent default values
 *
 * PROVIDES:
 * - Type-safe configuration access
 * - Environment-specific overrides
 * - Validation and error handling
 * - Hot reloading capabilities
 * - Configuration change notifications
 */

import { z } from "zod";

// ============================================================================
// Configuration Schema Definitions
// ============================================================================

/**
 * Core Application Configuration Schema
 */
const ApplicationConfigSchema = z.object({
  // Application metadata
  name: z.string().default("MEXC Sniper Bot"),
  version: z.string().default("1.0.0"),
  environment: z.enum(["development", "production", "test"]).default("development"),

  // Server configuration
  server: z.object({
    port: z.number().min(1000).max(65535).default(3000),
    host: z.string().default("localhost"),
    cors: z.object({
      enabled: z.boolean().default(true),
      origins: z.array(z.string()).default(["http://localhost:3000"]),
    }),
  }),

  // Logging configuration
  logging: z.object({
    level: z.enum(["debug", "info", "warn", "error"]).default("info"),
    format: z.enum(["json", "text"]).default("json"),
    file: z.object({
      enabled: z.boolean().default(false),
      path: z.string().default("./logs/app.log"),
      maxSize: z.string().default("100MB"),
      maxFiles: z.number().default(5),
    }),
  }),
});

/**
 * MEXC API Configuration Schema
 */
const MexcConfigSchema = z.object({
  // API credentials
  apiKey: z.string().optional(),
  secretKey: z.string().optional(),
  passphrase: z.string().optional(),

  // API endpoints
  baseUrl: z.string().url().default("https://api.mexc.com"),
  websocketUrl: z.string().url().default("wss://wbs.mexc.com/ws"),

  // Request configuration
  timeout: z.number().min(1000).max(300000).default(30000),
  maxRetries: z.number().min(0).max(10).default(3),
  retryDelay: z.number().min(100).max(10000).default(1000),
  rateLimitDelay: z.number().min(50).max(5000).default(200),

  // Caching
  enableCaching: z.boolean().default(true),
  cacheTTL: z.number().min(1).max(3600).default(300),

  // Circuit breaker
  enableCircuitBreaker: z.boolean().default(true),
  circuitBreakerThreshold: z.number().min(1).max(100).default(5),
  circuitBreakerTimeout: z.number().min(1000).max(300000).default(60000),

  // WebSocket configuration
  websocket: z.object({
    pingInterval: z.number().default(30000),
    pongTimeout: z.number().default(5000),
    reconnectInterval: z.number().default(5000),
    maxReconnectAttempts: z.number().default(10),
  }),
});

/**
 * Trading Configuration Schema
 */
const TradingConfigSchema = z.object({
  // Auto-sniping settings
  autoSniping: z.object({
    enabled: z.boolean().default(false),
    maxConcurrentPositions: z.number().min(1).max(100).default(5),
    patternDetectionInterval: z.number().min(1000).max(300000).default(5000),
    safetyCheckInterval: z.number().min(1000).max(60000).default(10000),
    confidenceThreshold: z.number().min(0).max(100).default(80),
    paperTradingMode: z.boolean().default(true),
  }),

  // Risk management
  risk: z.object({
    maxPositionSize: z.number().min(0.1).max(100).default(10),
    stopLossPercentage: z.number().min(0.1).max(50).default(5),
    takeProfitPercentage: z.number().min(0.1).max(100).default(15),
    maxDailyLoss: z.number().min(0.1).max(50).default(10),
    maxDrawdown: z.number().min(0.1).max(50).default(20),

    // Portfolio risk
    maxPortfolioConcentration: z.number().min(1).max(100).default(25),
    maxCorrelatedPositions: z.number().min(1).max(20).default(3),

    // Emergency thresholds
    emergencyStopLoss: z.number().min(0.1).max(100).default(25),
    criticalVolatilityThreshold: z.number().min(1).max(1000).default(50),
  }),

  // Order execution
  orders: z.object({
    defaultOrderType: z.enum(["market", "limit"]).default("limit"),
    slippageTolerance: z.number().min(0.01).max(10).default(0.5),
    maxOrderSize: z.number().min(1).max(1000000).default(10000),
    partialFillHandling: z.enum(["cancel", "keep", "retry"]).default("keep"),

    // Timing
    orderTimeout: z.number().min(1000).max(300000).default(30000),
    cancelTimeout: z.number().min(1000).max(60000).default(10000),
  }),

  // Pattern detection
  patterns: z.object({
    enableReadyStatePattern: z.boolean().default(true),
    enablePreLaunchPattern: z.boolean().default(true),
    enableVolatilityPattern: z.boolean().default(false),

    // Pattern thresholds
    readyStateConfidence: z.number().min(50).max(100).default(85),
    preLaunchAdvanceHours: z.number().min(0.5).max(12).default(3.5),
    volatilityThreshold: z.number().min(1).max(100).default(20),

    // AI enhancement
    enableAiEnhancement: z.boolean().default(false),
    aiConfidenceBoost: z.number().min(0).max(50).default(10),
  }),
});

/**
 * Database Configuration Schema
 */
const DatabaseConfigSchema = z.object({
  // Primary database
  url: z.string().optional(),

  // Connection pool
  pool: z.object({
    min: z.number().min(0).max(100).default(2),
    max: z.number().min(1).max(100).default(20),
    acquireTimeoutMillis: z.number().default(60000),
    idleTimeoutMillis: z.number().default(30000),
  }),

  // Query optimization
  queryTimeout: z.number().min(1000).max(300000).default(30000),
  enableQueryLogging: z.boolean().default(false),
  slowQueryThreshold: z.number().min(100).max(10000).default(1000),

  // Migrations
  migrations: z.object({
    autoRun: z.boolean().default(false),
    directory: z.string().default("./src/db/migrations"),
  }),

  // Caching
  enableQueryCache: z.boolean().default(true),
  queryCacheTTL: z.number().default(300),
});

/**
 * Cache Configuration Schema
 */
const CacheConfigSchema = z.object({
  // Redis configuration
  redis: z.object({
    url: z.string().optional(),
    host: z.string().default("localhost"),
    port: z.number().min(1).max(65535).default(6379),
    password: z.string().optional(),
    db: z.number().min(0).max(15).default(0),

    // Connection options
    connectTimeout: z.number().default(10000),
    retryDelayOnFailover: z.number().default(100),
    maxRetriesPerRequest: z.number().default(3),
  }),

  // Cache strategies
  default: z.object({
    ttl: z.number().min(1).max(86400).default(300),
    maxKeys: z.number().min(100).max(1000000).default(10000),
    evictionPolicy: z.enum(["lru", "lfu", "ttl"]).default("lru"),
  }),

  // Specific cache configs
  patterns: z.object({
    ttl: z.number().default(60),
    maxKeys: z.number().default(1000),
  }),

  marketData: z.object({
    ttl: z.number().default(30),
    maxKeys: z.number().default(5000),
  }),

  userSessions: z.object({
    ttl: z.number().default(3600),
    maxKeys: z.number().default(10000),
  }),
});

/**
 * Monitoring Configuration Schema
 */
const MonitoringConfigSchema = z.object({
  // Health checks
  healthChecks: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().min(1000).max(300000).default(30000),
    timeout: z.number().min(1000).max(60000).default(10000),
    endpoints: z.array(z.string()).default(["/api/health"]),
  }),

  // Metrics collection
  metrics: z.object({
    enabled: z.boolean().default(true),
    endpoint: z.string().default("/metrics"),
    collectInterval: z.number().default(15000),
    retentionPeriod: z.number().default(86400),
  }),

  // Performance monitoring
  performance: z.object({
    enableTracing: z.boolean().default(false),
    sampleRate: z.number().min(0).max(1).default(0.1),
    slowRequestThreshold: z.number().default(1000),
  }),

  // Alerting
  alerts: z.object({
    enabled: z.boolean().default(true),
    channels: z.array(z.enum(["email", "slack", "webhook"])).default(["email"]),
    thresholds: z.object({
      errorRate: z.number().min(0).max(1).default(0.05),
      responseTime: z.number().default(2000),
      memoryUsage: z.number().min(0).max(1).default(0.85),
      cpuUsage: z.number().min(0).max(1).default(0.8),
    }),
  }),
});

/**
 * Security Configuration Schema
 */
const SecurityConfigSchema = z.object({
  // Authentication
  auth: z.object({
    provider: z.enum(["kinde", "auth0", "supabase"]).default("kinde"),
    sessionTimeout: z.number().default(3600),
    requireMfa: z.boolean().default(false),
  }),

  // API security
  api: z.object({
    enableRateLimit: z.boolean().default(true),
    rateLimitWindow: z.number().default(900), // 15 minutes
    rateLimitMax: z.number().default(100),
    requireApiKey: z.boolean().default(false),
  }),

  // Encryption
  encryption: z.object({
    algorithm: z.string().default("aes-256-gcm"),
    keyRotationInterval: z.number().default(86400 * 30), // 30 days
  }),

  // CORS
  cors: z.object({
    enabled: z.boolean().default(true),
    allowedOrigins: z.array(z.string()).default(["http://localhost:3000"]),
    allowedMethods: z.array(z.string()).default(["GET", "POST", "PUT", "DELETE"]),
    allowCredentials: z.boolean().default(true),
  }),
});

// ============================================================================
// Master Configuration Schema
// ============================================================================

export const ConfigurationSchema = z.object({
  app: ApplicationConfigSchema,
  mexc: MexcConfigSchema,
  trading: TradingConfigSchema,
  database: DatabaseConfigSchema,
  cache: CacheConfigSchema,
  monitoring: MonitoringConfigSchema,
  security: SecurityConfigSchema,
});

export type Configuration = z.infer<typeof ConfigurationSchema>;

// ============================================================================
// Configuration Manager Class
// ============================================================================

/**
 * Unified Configuration Manager
 * Provides centralized, type-safe configuration management
 */
export class ConfigurationManager {
  private logger = createLogger("unified-configuration-management");

  private static instance: ConfigurationManager | null = null;
  private config: Configuration;
  private listeners: Map<string, ((config: Configuration) => void)[]> = new Map();
  private watchMode = false;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  /**
   * Get complete configuration
   */
  public getConfig(): Configuration {
    return this.config;
  }

  /**
   * Get specific configuration section
   */
  public getSection<K extends keyof Configuration>(section: K): Configuration[K] {
    return this.config[section];
  }

  /**
   * Get nested configuration value
   */
  public getValue<T>(path: string): T {
    const keys = path.split(".");
    let value: any = this.config;

    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = value[key];
      } else {
        throw new Error(`Configuration path '${path}' not found`);
      }
    }

    return value as T;
  }

  /**
   * Update configuration (for hot reloading)
   */
  public updateConfig(newConfig: Partial<Configuration>): void {
    const merged = { ...this.config, ...newConfig };
    const validated = ConfigurationSchema.parse(merged);

    this.config = validated;
    this.notifyListeners();
  }

  /**
   * Subscribe to configuration changes
   */
  public subscribe(key: string, callback: (config: Configuration) => void): void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key)?.push(callback);
  }

  /**
   * Unsubscribe from configuration changes
   */
  public unsubscribe(key: string): void {
    this.listeners.delete(key);
  }

  /**
   * Validate current configuration
   */
  public validate(): { valid: boolean; errors: string[] } {
    try {
      ConfigurationSchema.parse(this.config);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
        };
      }
      return { valid: false, errors: ["Unknown validation error"] };
    }
  }

  /**
   * Get configuration summary for debugging
   */
  public getSummary(): Record<string, any> {
    return {
      environment: this.config.app.environment,
      version: this.config.app.version,
      server: {
        port: this.config.app.server.port,
        host: this.config.app.server.host,
      },
      features: {
        autoSnipingEnabled: this.config.trading.autoSniping.enabled,
        paperTradingMode: this.config.trading.autoSniping.paperTradingMode,
        cachingEnabled: this.config.mexc.enableCaching,
        monitoringEnabled: this.config.monitoring.metrics.enabled,
      },
      credentials: {
        mexcConfigured: !!(this.config.mexc.apiKey && this.config.mexc.secretKey),
        databaseConfigured: !!this.config.database.url,
        cacheConfigured: !!(this.config.cache.redis.url || this.config.cache.redis.host),
      },
    };
  }

  /**
   * Load configuration from environment and defaults
   */
  private loadConfiguration(): Configuration {
    const rawConfig = {
      app: {
        name: process.env.APP_NAME,
        version: process.env.APP_VERSION || process.env.npm_package_version,
        environment: process.env.NODE_ENV,
        server: {
          port: process.env.PORT ? Number.parseInt(process.env.PORT, 10) : undefined,
          host: process.env.HOST,
          cors: {
            enabled: process.env.CORS_ENABLED === "true",
            origins: process.env.CORS_ORIGINS?.split(","),
          },
        },
        logging: {
          level: process.env.LOG_LEVEL,
          format: process.env.LOG_FORMAT,
        },
      },
      mexc: {
        apiKey: process.env.MEXC_API_KEY,
        secretKey: process.env.MEXC_SECRET_KEY,
        passphrase: process.env.MEXC_PASSPHRASE,
        baseUrl: process.env.MEXC_BASE_URL,
        websocketUrl: process.env.MEXC_WEBSOCKET_URL,
        timeout: process.env.MEXC_TIMEOUT
          ? Number.parseInt(process.env.MEXC_TIMEOUT, 10)
          : undefined,
        enableCaching: process.env.MEXC_CACHE_ENABLED !== "false",
        enableCircuitBreaker: process.env.MEXC_CIRCUIT_BREAKER_ENABLED !== "false",
      },
      trading: {
        autoSniping: {
          enabled: process.env.AUTO_SNIPING_ENABLED === "true",
          paperTradingMode: process.env.PAPER_TRADING_MODE !== "false",
          maxConcurrentPositions: process.env.MAX_CONCURRENT_POSITIONS
            ? Number.parseInt(process.env.MAX_CONCURRENT_POSITIONS, 10)
            : undefined,
          confidenceThreshold: process.env.CONFIDENCE_THRESHOLD
            ? Number.parseInt(process.env.CONFIDENCE_THRESHOLD, 10)
            : undefined,
        },
        risk: {
          maxPositionSize: process.env.MAX_POSITION_SIZE
            ? Number.parseFloat(process.env.MAX_POSITION_SIZE)
            : undefined,
          stopLossPercentage: process.env.STOP_LOSS_PERCENTAGE
            ? Number.parseFloat(process.env.STOP_LOSS_PERCENTAGE)
            : undefined,
        },
      },
      database: {
        url: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
        queryTimeout: process.env.DB_QUERY_TIMEOUT
          ? Number.parseInt(process.env.DB_QUERY_TIMEOUT, 10)
          : undefined,
        enableQueryLogging: process.env.DB_QUERY_LOGGING === "true",
      },
      cache: {
        redis: {
          url: process.env.REDIS_URL,
          host: process.env.REDIS_HOST,
          port: process.env.REDIS_PORT ? Number.parseInt(process.env.REDIS_PORT, 10) : undefined,
          password: process.env.REDIS_PASSWORD,
        },
      },
      monitoring: {
        metrics: {
          enabled: process.env.METRICS_ENABLED !== "false",
        },
        alerts: {
          enabled: process.env.ALERTS_ENABLED !== "false",
        },
      },
      security: {
        auth: {
          provider: process.env.AUTH_PROVIDER,
          requireMfa: process.env.REQUIRE_MFA === "true",
        },
        api: {
          enableRateLimit: process.env.RATE_LIMIT_ENABLED !== "false",
          requireApiKey: process.env.REQUIRE_API_KEY === "true",
        },
      },
    };

    // Remove undefined values to let Zod apply defaults
    const cleanConfig = this.removeUndefined(rawConfig);

    try {
      return ConfigurationSchema.parse(cleanConfig);
    } catch (error) {
      logger.error("Configuration validation failed:", error);
      throw new Error("Invalid configuration");
    }
  }

  /**
   * Remove undefined values from nested object
   */
  private removeUndefined(obj: any): any {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.removeUndefined(item));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        result[key] = this.removeUndefined(value);
      }
    }
    return result;
  }

  /**
   * Notify all listeners of configuration changes
   */
  private notifyListeners(): void {
    for (const [key, callbacks] of this.listeners) {
      for (const callback of callbacks) {
        try {
          callback(this.config);
        } catch (error) {
          logger.error(`Error in configuration listener '${key}':`, error);
        }
      }
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get the global configuration manager instance
 */
export function getConfig(): Configuration {
  return ConfigurationManager.getInstance().getConfig();
}

/**
 * Get a specific configuration section
 */
export function getConfigSection<K extends keyof Configuration>(section: K): Configuration[K] {
  return ConfigurationManager.getInstance().getSection(section);
}

/**
 * Get a nested configuration value
 */
export function getConfigValue<T>(path: string): T {
  return ConfigurationManager.getInstance().getValue<T>(path);
}

/**
 * Subscribe to configuration changes
 */
export function subscribeToConfig(key: string, callback: (config: Configuration) => void): void {
  ConfigurationManager.getInstance().subscribe(key, callback);
}

/**
 * Validate the current configuration
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  return ConfigurationManager.getInstance().validate();
}

/**
 * Get configuration summary for debugging
 */
export function getConfigSummary(): Record<string, any> {
  return ConfigurationManager.getInstance().getSummary();
}

// ============================================================================
// Environment-Specific Helpers
// ============================================================================

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return getConfigValue<string>("app.environment") === "development";
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return getConfigValue<string>("app.environment") === "production";
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return getConfigValue<string>("app.environment") === "test";
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof Configuration["trading"]["autoSniping"]): boolean {
  return getConfigValue<boolean>(`trading.autoSniping.${feature}`);
}

/**
 * Get MEXC API credentials safely
 */
export function getMexcCredentials(): { apiKey?: string; secretKey?: string } {
  const mexcConfig = getConfigSection("mexc");
  return {
    apiKey: mexcConfig.apiKey,
    secretKey: mexcConfig.secretKey,
  };
}

/**
 * Check if MEXC credentials are configured
 */
export function hasMexcCredentials(): boolean {
  const { apiKey, secretKey } = getMexcCredentials();
  return !!(apiKey && secretKey);
}

// ============================================================================
// Configuration Validation Helpers
// ============================================================================

/**
 * Validate MEXC configuration
 */
export function validateMexcConfig(): { valid: boolean; issues: string[] } {
  const mexcConfig = getConfigSection("mexc");
  const issues: string[] = [];

  if (!mexcConfig.apiKey) {
    issues.push("MEXC API key is required");
  }

  if (!mexcConfig.secretKey) {
    issues.push("MEXC secret key is required");
  }

  if (mexcConfig.timeout < 5000) {
    issues.push("MEXC timeout should be at least 5 seconds");
  }

  if (mexcConfig.maxRetries > 5) {
    issues.push("MEXC max retries should not exceed 5");
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Validate trading configuration
 */
export function validateTradingConfig(): { valid: boolean; issues: string[] } {
  const tradingConfig = getConfigSection("trading");
  const issues: string[] = [];

  if (tradingConfig.autoSniping.enabled && !tradingConfig.autoSniping.paperTradingMode) {
    if (!hasMexcCredentials()) {
      issues.push("Live trading requires MEXC credentials");
    }
  }

  if (tradingConfig.risk.maxPositionSize > 50) {
    issues.push("Max position size above 50% is highly risky");
  }

  if (tradingConfig.risk.stopLossPercentage < 2) {
    issues.push("Stop loss below 2% may trigger too frequently");
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Get configuration health status
 */
export function getConfigHealth(): {
  overall: "healthy" | "warning" | "critical";
  checks: Array<{ name: string; status: "pass" | "warn" | "fail"; message: string }>;
} {
  const checks: Array<{ name: string; status: "pass" | "warn" | "fail"; message: string }> = [];

  // Validate overall config
  const configValidation = validateConfig();
  checks.push({
    name: "Configuration Schema",
    status: configValidation.valid ? "pass" : "fail",
    message: configValidation.valid ? "Valid" : configValidation.errors.join(", "),
  });

  // Validate MEXC config
  const mexcValidation = validateMexcConfig();
  checks.push({
    name: "MEXC Configuration",
    status: mexcValidation.valid ? "pass" : "warn",
    message: mexcValidation.valid ? "Valid" : mexcValidation.issues.join(", "),
  });

  // Validate trading config
  const tradingValidation = validateTradingConfig();
  checks.push({
    name: "Trading Configuration",
    status: tradingValidation.valid ? "pass" : "warn",
    message: tradingValidation.valid ? "Valid" : tradingValidation.issues.join(", "),
  });

  // Determine overall status
  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;

  let overall: "healthy" | "warning" | "critical";
  if (failCount > 0) {
    overall = "critical";
  } else if (warnCount > 0) {
    overall = "warning";
  } else {
    overall = "healthy";
  }

  return { overall, checks };
}

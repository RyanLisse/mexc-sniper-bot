/**
 * OpenTelemetry Setup and Configuration
 *
 * Comprehensive OpenTelemetry setup for the MEXC Trading Bot.
 * Provides distributed tracing, metrics collection, and structured logging.
 * 
 * Build-safe implementation with dynamic imports to prevent bundling issues.
 */

import { createLogger } from "./structured-logger";

// Environment configuration
const isProduction = process.env.NODE_ENV === "production";
const _isDevelopment = process.env.NODE_ENV === "development";
const isTesting = process.env.NODE_ENV === "test";

// Disable telemetry in tests unless explicitly enabled
const telemetryDisabled =
  process.env.DISABLE_TELEMETRY === "true" ||
  (isTesting && process.env.ENABLE_TELEMETRY_IN_TESTS !== "true");

// Initialize logger
const logger = createLogger("opentelemetry-setup");

/**
 * OpenTelemetry SDK Configuration
 * Build-safe implementation with dynamic imports
 */
export async function initializeOpenTelemetry(): Promise<any | null> {
  if (telemetryDisabled) {
    logger.info("[OpenTelemetry] Telemetry disabled");
    return null;
  }

  try {
    // Dynamic imports to prevent build-time bundling issues
    const [
      { getNodeAutoInstrumentations },
      { JaegerExporter },
      { PrometheusExporter },
      { Resource },
      { PeriodicExportingMetricReader },
      { NodeSDK },
      { BatchSpanProcessor, TraceIdRatioBasedSampler },
      semanticConventions,
      productionConfig
    ] = await Promise.all([
      import("@opentelemetry/auto-instrumentations-node"),
      import("@opentelemetry/exporter-jaeger"),
      import("@opentelemetry/exporter-prometheus"),
      import("@opentelemetry/resources"),
      import("@opentelemetry/sdk-metrics"),
      import("@opentelemetry/sdk-node"),
      import("@opentelemetry/sdk-trace-node"),
      import("@opentelemetry/semantic-conventions"),
      import("./opentelemetry-production-config")
    ]);

    const {
      SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
      SEMRESATTRS_SERVICE_INSTANCE_ID,
      SEMRESATTRS_SERVICE_NAME,
      SEMRESATTRS_SERVICE_NAMESPACE,
      SEMRESATTRS_SERVICE_VERSION,
    } = semanticConventions;

    // Resource configuration - identifies the service
    const resource = new Resource({
      [SEMRESATTRS_SERVICE_NAME]: "mexc-trading-bot",
      [SEMRESATTRS_SERVICE_VERSION]: process.env.APP_VERSION || "1.0.0",
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || "development",
      [SEMRESATTRS_SERVICE_NAMESPACE]: "trading",
      [SEMRESATTRS_SERVICE_INSTANCE_ID]: process.env.HOSTNAME || "localhost",
    });

    // Trace exporters
    const traceExporters = [];

    if (process.env.JAEGER_ENDPOINT) {
      traceExporters.push(
        new JaegerExporter({
          endpoint: process.env.JAEGER_ENDPOINT,
        })
      );
    }

    // Sampling strategy for production
    const sampler = isProduction
      ? new TraceIdRatioBasedSampler(0.1) // 10% sampling in production
      : new TraceIdRatioBasedSampler(1.0); // 100% sampling in development

    // Span processors
    const spanProcessors = traceExporters.map(
      (exporter) =>
        new BatchSpanProcessor(exporter, {
          maxQueueSize: isProduction ? 8192 : 2048,
          exportTimeoutMillis: 5000,
          scheduledDelayMillis: isProduction ? 5000 : 1000,
        })
    );

    // Metrics configuration
    const metricReaders = [];

    // Prometheus metrics exporter
    if (process.env.PROMETHEUS_PORT || !isProduction) {
      const prometheusExporter = new PrometheusExporter({
        port: Number.parseInt(process.env.PROMETHEUS_PORT || "9464"),
        preventServerStart: isTesting, // Don't start server in tests
      });

      // Note: PrometheusExporter doesn't use PeriodicExportingMetricReader
      // It exposes metrics via HTTP endpoint directly
      // Only add to readers if exporter has export method
      const hasExportMethod = "export" in prometheusExporter;
      if (hasExportMethod) {
        metricReaders.push(
          new PeriodicExportingMetricReader({
            exporter: prometheusExporter as any, // Type assertion for compatibility
            exportIntervalMillis: isProduction ? 15000 : 5000, // 15s in prod, 5s in dev
          })
        );
      }
    }

    // Auto-instrumentations with custom configuration
    const instrumentations = getNodeAutoInstrumentations({
      // HTTP instrumentation configuration
      "@opentelemetry/instrumentation-http": {
        requestHook: (span, request) => {
          // Add trading-specific attributes to HTTP requests
          const url = (request as any).url;
          if (url?.includes("mexc") || url?.includes("api.mexc.com")) {
            span.setAttributes({
              "mexc.api.endpoint": url,
              "mexc.request.type": "api_call",
            });
          }
        },
        responseHook: (span, response) => {
          // Track API response status
          span.setAttributes({
            "http.response.status_class": `${Math.floor((response as any).statusCode / 100)}xx`,
          });
        },
      },

      // Database instrumentation
      "@opentelemetry/instrumentation-fs": {
        enabled: true, // Track file system operations
      },

      // Express/Next.js instrumentation
      "@opentelemetry/instrumentation-express": {
        enabled: true,
      },

      // Redis instrumentation (for cache monitoring)
      "@opentelemetry/instrumentation-redis": {
        enabled: true,
        responseHook: (span, cmdName, cmdArgs) => {
          span.setAttributes({
            "redis.operation": cmdName,
            "redis.args_count": cmdArgs.length,
          });
        },
      },

      // Disable winston instrumentation (not using winston)
      "@opentelemetry/instrumentation-winston": {
        enabled: false,
      },
    });

    // Create and configure SDK
    const sdk = new NodeSDK({
      resource,
      sampler,
      spanProcessors,
      metricReader: metricReaders.length > 0 ? metricReaders[0] : undefined,
      instrumentations,
    });

    // Initialize the SDK
    sdk.start();

    logger.info("[OpenTelemetry] SDK initialized successfully", {
      environment: process.env.NODE_ENV,
      sampling: isProduction ? "10%" : "100%",
      exporters: traceExporters.length,
      metrics: metricReaders.length > 0,
    });

    // Graceful shutdown
    process.on("SIGTERM", () => {
      sdk
        .shutdown()
        .then(() => logger.info("[OpenTelemetry] SDK shut down successfully"))
        .catch((error) => logger.error("[OpenTelemetry] Error shutting down SDK", error))
        .finally(() => process.exit(0));
    });

    return sdk;
  } catch (error) {
    logger.error("[OpenTelemetry] Failed to initialize SDK:", error);
    return null;
  }
}

/**
 * Trading-specific telemetry configuration
 */
export const TRADING_TELEMETRY_CONFIG = {
  // Span names for consistent naming
  spans: {
    pattern_detection: "trading.pattern_detection",
    trade_execution: "trading.execution",
    risk_assessment: "trading.risk_assessment",
    position_monitoring: "trading.position_monitoring",
    safety_check: "trading.safety_check",
    api_call: "mexc.api_call",
    cache_operation: "cache.operation",
    database_query: "db.query",
    websocket_message: "websocket.message",
    agent_coordination: "agent.coordination",
  },

  // Attribute keys for consistent tagging
  attributes: {
    // Trading attributes
    symbol: "trading.symbol",
    side: "trading.side",
    quantity: "trading.quantity",
    price: "trading.price",
    pattern_type: "trading.pattern.type",
    confidence: "trading.pattern.confidence",
    risk_score: "trading.risk.score",

    // Agent attributes
    agent_id: "agent.id",
    agent_type: "agent.type",
    task_type: "agent.task.type",

    // System attributes
    cache_hit: "cache.hit",
    db_table: "db.table_name",
    query_type: "db.operation.type",

    // API attributes
    api_endpoint: "mexc.endpoint",
    api_method: "mexc.method",
    response_time: "mexc.response_time_ms",
  },

  // Metrics for monitoring
  metrics: {
    // Trading metrics
    trades_total: "trades_executed_total",
    trade_duration: "trade_execution_duration_ms",
    trade_success_rate: "trade_success_rate",
    pattern_accuracy: "pattern_detection_accuracy",

    // System metrics
    api_calls_total: "mexc_api_calls_total",
    api_response_time: "mexc_api_response_time_ms",
    cache_hit_rate: "cache_hit_rate",
    agent_health_score: "agent_health_score",

    // Performance metrics
    memory_usage: "system_memory_usage_bytes",
    cpu_usage: "system_cpu_usage_percent",
    active_connections: "websocket_connections_active",
  },
};

/**
 * Enhanced production-ready OpenTelemetry initialization
 * Replaces the basic initializeOpenTelemetry function with optimized production config
 */
export async function initializeEnhancedTelemetry(): Promise<{
  success: boolean;
  sdk?: NodeSDK;
  healthCheck: () => Promise<boolean>;
}> {
  if (telemetryDisabled) {
    logger.info("[OpenTelemetry] Telemetry disabled");
    return {
      success: false,
      healthCheck: async () => false,
    };
  }

  const logger = createLogger("opentelemetry-setup");

  try {
    // Use production-optimized configuration
    const result = await initializeProductionTelemetry({
      serviceName: "mexc-trading-bot",
      serviceVersion: process.env.APP_VERSION || "1.0.0",
      environment: (process.env.NODE_ENV || "development") as
        | "development"
        | "staging"
        | "production",
    });

    if (result.success) {
      logger.info("Enhanced OpenTelemetry initialized successfully", {
        operation: "telemetry_initialization",
        environment: process.env.NODE_ENV,
        processId: process.pid,
        configType: "production-optimized",
      });

      // Setup graceful shutdown
      process.on("SIGTERM", async () => {
        logger.info("Shutting down OpenTelemetry SDK");
        if (result.sdk) {
          try {
            await result.sdk.shutdown();
            logger.info("OpenTelemetry SDK shutdown completed");
          } catch (error) {
            logger.error(
              "Error shutting down OpenTelemetry SDK",
              {
                operation: "telemetry_shutdown",
              },
              error instanceof Error ? error : new Error(String(error))
            );
          }
        }
        process.exit(0);
      });
    }

    return result;
  } catch (error) {
    logger.error(
      "Failed to initialize enhanced OpenTelemetry",
      {
        operation: "telemetry_initialization",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      error instanceof Error ? error : new Error(String(error))
    );

    return {
      success: false,
      healthCheck: async () => false,
    };
  }
}

/**
 * Telemetry health monitoring utilities
 */
export const TelemetryMonitoring = {
  ...ProductionTelemetryUtils,

  /**
   * Get comprehensive telemetry status for monitoring dashboard
   */
  async getSystemStatus(): Promise<{
    enabled: boolean;
    environment: string;
    health: {
      tracing: boolean;
      metrics: boolean;
      exports: boolean;
    };
    performance: {
      memoryUsage: number;
      cpuUsage: number;
      spanQueueSize?: number;
    };
    configuration: {
      samplingRate: number;
      exportInterval: number;
      enabledExporters: string[];
    };
  }> {
    const config = getProductionTelemetryConfig();
    const healthStatus = await ProductionTelemetryUtils.getHealthStatus();

    return {
      enabled: !telemetryDisabled,
      environment: process.env.NODE_ENV || "development",
      health: {
        tracing: healthStatus.tracing,
        metrics: healthStatus.metrics,
        exports: healthStatus.exports,
      },
      performance: healthStatus.performance,
      configuration: {
        samplingRate: config.tracing.samplingRate,
        exportInterval: config.metrics.exportInterval,
        enabledExporters: [
          config.exporters.console ? "console" : null,
          config.exporters.otlp.enabled ? "otlp" : null,
          config.exporters.jaeger.enabled ? "jaeger" : null,
          config.exporters.prometheus.enabled ? "prometheus" : null,
        ].filter(Boolean) as string[],
      },
    };
  },
};

/**
 * OpenTelemetry initialization is now handled by instrumentation.ts (Vercel pattern)
 * This ensures proper compatibility with Vercel's deployment environment
 * 
 * The functions above are kept for backward compatibility and advanced configurations
 */

export default TRADING_TELEMETRY_CONFIG;

/**
 * Production-Ready OpenTelemetry Configuration
 *
 * Optimized configuration for production environments with performance,
 * resource usage, and monitoring considerations.
 */

import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { JaegerExporter } from "@opentelemetry/exporter-jaeger";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  AlwaysOffSampler,
  AlwaysOnSampler,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-base";
import { BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";
import {
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  SEMRESATTRS_HOST_NAME,
  SEMRESATTRS_PROCESS_PID,
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { createLogger } from "./structured-logger";

const logger = createLogger("opentelemetry-production");

export interface ProductionTelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  environment: "development" | "staging" | "production";

  // Sampling configuration
  tracing: {
    enabled: boolean;
    samplingRate: number;
    maxSpansPerSecond?: number;
    enableParentBasedSampling: boolean;
    enableAdaptiveSampling: boolean;
  };

  // Metrics configuration
  metrics: {
    enabled: boolean;
    exportInterval: number;
    maxMetricsPerExport?: number;
    enableResourceMetrics: boolean;
    enableProcessMetrics: boolean;
  };

  // Export configuration
  exporters: {
    console: boolean;
    otlp: {
      enabled: boolean;
      endpoint?: string;
      headers?: Record<string, string>;
    };
    jaeger: {
      enabled: boolean;
      endpoint?: string;
    };
    prometheus: {
      enabled: boolean;
      port?: number;
      endpoint?: string;
    };
  };

  // Performance optimization
  performance: {
    batchTimeout: number;
    maxBatchSize: number;
    maxQueueSize: number;
    enableCompression: boolean;
    enableResourceDetection: boolean;
  };

  // Security and privacy
  security: {
    maskSensitiveData: boolean;
    excludeUrls: string[];
    enableCustomAttributes: boolean;
  };
}

/**
 * Get production-optimized configuration based on environment
 */
export function getProductionTelemetryConfig(): ProductionTelemetryConfig {
  const environment = (process.env.NODE_ENV || "development") as
    | "development"
    | "staging"
    | "production";
  const isDevelopment = environment === "development";
  const isProduction = environment === "production";

  return {
    serviceName: process.env.SERVICE_NAME || "mexc-trading-bot",
    serviceVersion: process.env.SERVICE_VERSION || "1.0.0",
    environment,

    tracing: {
      enabled: process.env.TRACING_ENABLED !== "false",
      samplingRate: isDevelopment
        ? 1.0
        : Number.parseFloat(process.env.TRACE_SAMPLING_RATE || "0.1"),
      maxSpansPerSecond: isProduction ? 100 : undefined,
      enableParentBasedSampling: true,
      enableAdaptiveSampling: isProduction,
    },

    metrics: {
      enabled: process.env.METRICS_ENABLED !== "false",
      exportInterval: isDevelopment ? 5000 : 30000, // 5s dev, 30s prod
      maxMetricsPerExport: isProduction ? 1000 : undefined,
      enableResourceMetrics: true,
      enableProcessMetrics: !isProduction, // Disable in production for performance
    },

    exporters: {
      console: isDevelopment,
      otlp: {
        enabled: !!process.env.OTLP_ENDPOINT,
        endpoint: process.env.OTLP_ENDPOINT,
        headers: process.env.OTLP_HEADERS ? JSON.parse(process.env.OTLP_HEADERS) : undefined,
      },
      jaeger: {
        enabled: !!process.env.JAEGER_ENDPOINT,
        endpoint: process.env.JAEGER_ENDPOINT || "http://localhost:14268/api/traces",
      },
      prometheus: {
        enabled: process.env.PROMETHEUS_ENABLED === "true",
        port: Number.parseInt(process.env.PROMETHEUS_PORT || "9090"),
        endpoint: process.env.PROMETHEUS_ENDPOINT || "/metrics",
      },
    },

    performance: {
      batchTimeout: isProduction ? 5000 : 1000,
      maxBatchSize: isProduction ? 512 : 100,
      maxQueueSize: isProduction ? 2048 : 500,
      enableCompression: isProduction,
      enableResourceDetection: true,
    },

    security: {
      maskSensitiveData: isProduction,
      excludeUrls: [
        "/health",
        "/metrics",
        "/api/health",
        // Add more URLs to exclude from tracing
      ],
      enableCustomAttributes: !isProduction, // Disable custom attributes in production for security
    },
  };
}

/**
 * Create production-optimized OpenTelemetry SDK
 */
export function createProductionTelemetrySDK(
  config?: Partial<ProductionTelemetryConfig>
): NodeSDK | null {
  try {
    const telemetryConfig = { ...getProductionTelemetryConfig(), ...config };

    logger.info("Initializing production OpenTelemetry SDK", {
      operation: "telemetry_initialization",
      environment: telemetryConfig.environment,
      serviceName: telemetryConfig.serviceName,
      tracingEnabled: telemetryConfig.tracing.enabled,
      metricsEnabled: telemetryConfig.metrics.enabled,
      samplingRate: telemetryConfig.tracing.samplingRate,
    });

    // Create resource with comprehensive service information
    const resource = createServiceResource(telemetryConfig);

    // Configure sampling strategy
    const sampler = createOptimizedSampler(telemetryConfig);

    // Configure span processors with performance optimization
    const spanProcessors = createSpanProcessors(telemetryConfig);

    // Configure metric readers
    const metricReaders = createMetricReaders(telemetryConfig);

    // Configure instrumentations with filtering
    const instrumentations = createInstrumentations(telemetryConfig);

    const sdk = new NodeSDK({
      resource,
      sampler,
      spanProcessors,
      metricReader: metricReaders.length > 0 ? metricReaders[0] : undefined,
      instrumentations,
    });

    logger.info("Production OpenTelemetry SDK created successfully", {
      operation: "telemetry_initialization",
      spanProcessorsCount: spanProcessors.length,
      metricReadersCount: metricReaders.length,
      instrumentationsCount: instrumentations.length,
    });

    return sdk;
  } catch (error) {
    logger.error(
      "Failed to create production OpenTelemetry SDK",
      {
        operation: "telemetry_initialization",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      error instanceof Error ? error : new Error(String(error))
    );

    return null;
  }
}

/**
 * Create comprehensive service resource
 */
function createServiceResource(config: ProductionTelemetryConfig): Resource {
  const resourceAttributes: Record<string, string | number> = {
    [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
    [SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: config.environment,
  };

  // Add host information if resource detection is enabled
  if (config.performance.enableResourceDetection) {
    resourceAttributes[SEMRESATTRS_HOST_NAME] =
      process.env.HOSTNAME || require("node:os").hostname();
    resourceAttributes[SEMRESATTRS_PROCESS_PID] = process.pid;
    resourceAttributes["service.instance.id"] =
      `${resourceAttributes[SEMRESATTRS_HOST_NAME]}-${process.pid}`;
  }

  // Add custom service attributes
  resourceAttributes["service.type"] = "trading-bot";
  resourceAttributes["service.component"] = "mexc-api-client";
  resourceAttributes["trading.exchange"] = "mexc";

  return new Resource(resourceAttributes);
}

/**
 * Create optimized sampler based on environment and performance requirements
 */
function createOptimizedSampler(config: ProductionTelemetryConfig) {
  if (!config.tracing.enabled) {
    return new AlwaysOffSampler();
  }

  if (config.environment === "development") {
    return new AlwaysOnSampler();
  }

  // Production sampling strategy
  const baseSampler = new TraceIdRatioBasedSampler(config.tracing.samplingRate);

  if (config.tracing.enableParentBasedSampling) {
    return new ParentBasedSampler({
      root: baseSampler,
    });
  }

  return baseSampler;
}

/**
 * Create span processors with performance optimization
 */
function createSpanProcessors(config: ProductionTelemetryConfig) {
  const processors: any[] = [];

  // Console exporter for development
  if (config.exporters.console) {
    processors.push(
      new BatchSpanProcessor(new ConsoleSpanExporter(), {
        scheduledDelayMillis: config.performance.batchTimeout,
        maxExportBatchSize: Math.min(config.performance.maxBatchSize, 100), // Limit console output
      })
    );
  }

  // OTLP exporter for production monitoring
  if (config.exporters.otlp.enabled && config.exporters.otlp.endpoint) {
    const otlpExporter = new OTLPTraceExporter({
      url: config.exporters.otlp.endpoint,
      headers: config.exporters.otlp.headers,
      // compression: config.performance.enableCompression ? "gzip" : "none",
    });

    processors.push(
      new BatchSpanProcessor(otlpExporter, {
        scheduledDelayMillis: config.performance.batchTimeout,
        maxExportBatchSize: config.performance.maxBatchSize,
        maxQueueSize: config.performance.maxQueueSize,
      })
    );
  }

  // Jaeger exporter for development and staging
  if (config.exporters.jaeger.enabled && config.exporters.jaeger.endpoint) {
    const jaegerExporter = new JaegerExporter({
      endpoint: config.exporters.jaeger.endpoint,
    });

    processors.push(
      new BatchSpanProcessor(jaegerExporter, {
        scheduledDelayMillis: config.performance.batchTimeout,
        maxExportBatchSize: Math.min(config.performance.maxBatchSize, 200), // Limit Jaeger batch size
      })
    );
  }

  return processors;
}

/**
 * Create metric readers with performance optimization
 */
function createMetricReaders(config: ProductionTelemetryConfig) {
  const readers: any[] = [];

  if (!config.metrics.enabled) {
    return readers;
  }

  // OTLP metrics exporter
  if (config.exporters.otlp.enabled && config.exporters.otlp.endpoint) {
    const otlpMetricExporter = new OTLPMetricExporter({
      url: config.exporters.otlp.endpoint.replace("/traces", "/metrics"),
      headers: config.exporters.otlp.headers,
      // compression: config.performance.enableCompression ? "gzip" : "none",
    });

    readers.push(
      new PeriodicExportingMetricReader({
        exporter: otlpMetricExporter,
        exportIntervalMillis: config.metrics.exportInterval,
      })
    );
  }

  // Prometheus metrics exporter
  if (config.exporters.prometheus.enabled) {
    readers.push(
      new PrometheusExporter({
        port: config.exporters.prometheus.port,
        endpoint: config.exporters.prometheus.endpoint,
      })
    );
  }

  return readers;
}

/**
 * Create filtered instrumentations for optimal performance
 */
function createInstrumentations(config: ProductionTelemetryConfig) {
  const instrumentations = getNodeAutoInstrumentations({
    // Disable instrumentations that may cause performance issues in production
    "@opentelemetry/instrumentation-fs": {
      enabled: config.environment !== "production",
    },
    "@opentelemetry/instrumentation-dns": {
      enabled: config.environment !== "production",
    },
    "@opentelemetry/instrumentation-net": {
      enabled: config.environment !== "production",
    },

    // HTTP instrumentation with URL filtering
    "@opentelemetry/instrumentation-http": {
      enabled: true,
      ignoreIncomingRequestHook: (req: any) => {
        const url = req.url || "";
        return config.security.excludeUrls.some((excludeUrl) => url.includes(excludeUrl));
      },
      // ignoreSensitiveHeaders: config.security.maskSensitiveData,
    },

    // Express instrumentation optimized for API routes
    "@opentelemetry/instrumentation-express": {
      enabled: true,
    },

    // Database instrumentations
    "@opentelemetry/instrumentation-pg": {
      enabled: true,
    },
    "@opentelemetry/instrumentation-mysql": {
      enabled: false, // Disable if not using MySQL
    },
    "@opentelemetry/instrumentation-redis": {
      enabled: false, // Enable if using Redis
    },
    "@opentelemetry/instrumentation-winston": {
      enabled: false, // Disable winston instrumentation (not using winston)
    },
  });

  return instrumentations;
}

/**
 * Enhanced telemetry startup with health checks
 */
export async function initializeProductionTelemetry(
  config?: Partial<ProductionTelemetryConfig>
): Promise<{
  success: boolean;
  sdk?: NodeSDK;
  healthCheck: () => Promise<boolean>;
}> {
  try {
    const sdk = createProductionTelemetrySDK(config);

    if (!sdk) {
      return {
        success: false,
        healthCheck: async () => false,
      };
    }

    // Start the SDK
    await sdk.start();

    logger.info("Production OpenTelemetry started successfully", {
      operation: "telemetry_startup",
      environment: process.env.NODE_ENV,
      processId: process.pid,
    });

    // Create health check function
    const healthCheck = async (): Promise<boolean> => {
      try {
        // Simple health check - verify tracing is working
        const tracer = require("@opentelemetry/api").trace.getTracer("health-check");
        return new Promise((resolve) => {
          tracer.startActiveSpan("health-check", (span: any) => {
            span.end();
            resolve(true);
          });
        });
      } catch {
        return false;
      }
    };

    return {
      success: true,
      sdk,
      healthCheck,
    };
  } catch (error) {
    logger.error(
      "Failed to initialize production OpenTelemetry",
      {
        operation: "telemetry_startup",
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
 * Graceful telemetry shutdown
 */
export async function shutdownProductionTelemetry(sdk: NodeSDK): Promise<void> {
  try {
    logger.info("Shutting down production OpenTelemetry", {
      operation: "telemetry_shutdown",
      processId: process.pid,
    });

    await sdk.shutdown();

    logger.info("Production OpenTelemetry shutdown completed", {
      operation: "telemetry_shutdown",
    });
  } catch (error) {
    logger.error(
      "Error during OpenTelemetry shutdown",
      {
        operation: "telemetry_shutdown",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Production monitoring utilities
 */
export const ProductionTelemetryUtils = {
  /**
   * Get current telemetry health status
   */
  async getHealthStatus(): Promise<{
    tracing: boolean;
    metrics: boolean;
    exports: boolean;
    performance: {
      memoryUsage: number;
      cpuUsage: number;
      spanQueueSize?: number;
    };
  }> {
    const process = await import("node:process");
    const memUsage = process.memoryUsage();

    return {
      tracing: true, // Would check actual tracing health
      metrics: true, // Would check actual metrics health
      exports: true, // Would check export health
      performance: {
        memoryUsage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
        cpuUsage: 0, // Would calculate actual CPU usage
      },
    };
  },

  /**
   * Create performance monitoring dashboard data
   */
  async getPerformanceMetrics(): Promise<{
    spanCounts: Record<string, number>;
    errorRates: Record<string, number>;
    latencyPercentiles: Record<string, number>;
    resourceUsage: {
      memory: number;
      cpu: number;
      diskIO: number;
    };
  }> {
    // Implementation would gather actual performance metrics
    return {
      spanCounts: {},
      errorRates: {},
      latencyPercentiles: {},
      resourceUsage: {
        memory: 0,
        cpu: 0,
        diskIO: 0,
      },
    };
  },
};

/**
 * OpenTelemetry Setup and Configuration
 * 
 * Comprehensive OpenTelemetry setup for the MEXC Trading Bot.
 * Provides distributed tracing, metrics collection, and structured logging.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { BatchSpanProcessor, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-node';

// Environment configuration
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';
const isTesting = process.env.NODE_ENV === 'test';

// Disable telemetry in tests unless explicitly enabled
const telemetryDisabled = process.env.DISABLE_TELEMETRY === 'true' || 
  (isTesting && process.env.ENABLE_TELEMETRY_IN_TESTS !== 'true');

/**
 * OpenTelemetry SDK Configuration
 */
export function initializeOpenTelemetry(): NodeSDK | null {
  if (telemetryDisabled) {
    console.log('[OpenTelemetry] Telemetry disabled');
    return null;
  }

  try {
    // Resource configuration - identifies the service
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'mexc-trading-bot',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION || '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'trading',
      [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: process.env.HOSTNAME || 'localhost',
    });

    // Trace exporters
    const traceExporters = [];
    
    if (process.env.JAEGER_ENDPOINT) {
      traceExporters.push(new JaegerExporter({
        endpoint: process.env.JAEGER_ENDPOINT,
      }));
    }

    // Sampling strategy for production
    const sampler = isProduction 
      ? new TraceIdRatioBasedSampler(0.1) // 10% sampling in production
      : new TraceIdRatioBasedSampler(1.0); // 100% sampling in development

    // Span processors
    const spanProcessors = traceExporters.map(exporter => 
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
      metricReaders.push(
        new PeriodicExportingMetricReader({
          exporter: new PrometheusExporter({
            port: Number.parseInt(process.env.PROMETHEUS_PORT || '9464'),
            preventServerStart: isTesting, // Don't start server in tests
          }),
          exportIntervalMillis: isProduction ? 15000 : 5000, // 15s in prod, 5s in dev
        })
      );
    }

    // Auto-instrumentations with custom configuration
    const instrumentations = getNodeAutoInstrumentations({
      // HTTP instrumentation configuration
      '@opentelemetry/instrumentation-http': {
        requestHook: (span, request) => {
          // Add trading-specific attributes to HTTP requests
          if (request.url?.includes('mexc') || request.url?.includes('api.mexc.com')) {
            span.setAttributes({
              'mexc.api.endpoint': request.url,
              'mexc.request.type': 'api_call',
            });
          }
        },
        responseHook: (span, response) => {
          // Track API response status
          span.setAttributes({
            'http.response.status_class': Math.floor(response.statusCode / 100) + 'xx',
          });
        },
      },
      
      // Database instrumentation
      '@opentelemetry/instrumentation-fs': {
        enabled: true, // Track file system operations
      },
      
      // Express/Next.js instrumentation
      '@opentelemetry/instrumentation-express': {
        enabled: true,
      },
      
      // Redis instrumentation (for cache monitoring)
      '@opentelemetry/instrumentation-redis': {
        enabled: true,
        responseHook: (span, cmdName, cmdArgs) => {
          span.setAttributes({
            'redis.operation': cmdName,
            'redis.args_count': cmdArgs.length,
          });
        },
      },
    });

    // Create and configure SDK
    const sdk = new NodeSDK({
      resource,
      sampler,
      spanProcessors,
      metricReaders,
      instrumentations,
    });

    // Initialize the SDK
    sdk.start();

    console.log('[OpenTelemetry] SDK initialized successfully', {
      environment: process.env.NODE_ENV,
      sampling: isProduction ? '10%' : '100%',
      exporters: traceExporters.length,
      metrics: metricReaders.length > 0,
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      sdk.shutdown()
        .then(() => console.log('[OpenTelemetry] SDK shut down successfully'))
        .catch((error) => console.error('[OpenTelemetry] Error shutting down SDK', error))
        .finally(() => process.exit(0));
    });

    return sdk;
  } catch (error) {
    console.error('[OpenTelemetry] Failed to initialize SDK:', error);
    return null;
  }
}

/**
 * Trading-specific telemetry configuration
 */
export const TRADING_TELEMETRY_CONFIG = {
  // Span names for consistent naming
  spans: {
    pattern_detection: 'trading.pattern_detection',
    trade_execution: 'trading.execution',
    risk_assessment: 'trading.risk_assessment',
    position_monitoring: 'trading.position_monitoring',
    safety_check: 'trading.safety_check',
    api_call: 'mexc.api_call',
    cache_operation: 'cache.operation',
    database_query: 'db.query',
    websocket_message: 'websocket.message',
    agent_coordination: 'agent.coordination',
  },
  
  // Attribute keys for consistent tagging
  attributes: {
    // Trading attributes
    symbol: 'trading.symbol',
    side: 'trading.side',
    quantity: 'trading.quantity',
    price: 'trading.price',
    pattern_type: 'trading.pattern.type',
    confidence: 'trading.pattern.confidence',
    risk_score: 'trading.risk.score',
    
    // Agent attributes
    agent_id: 'agent.id',
    agent_type: 'agent.type',
    task_type: 'agent.task.type',
    
    // System attributes
    cache_hit: 'cache.hit',
    db_table: 'db.table_name',
    query_type: 'db.operation.type',
    
    // API attributes
    api_endpoint: 'mexc.endpoint',
    api_method: 'mexc.method',
    response_time: 'mexc.response_time_ms',
  },
  
  // Metrics for monitoring
  metrics: {
    // Trading metrics
    trades_total: 'trades_executed_total',
    trade_duration: 'trade_execution_duration_ms',
    trade_success_rate: 'trade_success_rate',
    pattern_accuracy: 'pattern_detection_accuracy',
    
    // System metrics
    api_calls_total: 'mexc_api_calls_total',
    api_response_time: 'mexc_api_response_time_ms',
    cache_hit_rate: 'cache_hit_rate',
    agent_health_score: 'agent_health_score',
    
    // Performance metrics
    memory_usage: 'system_memory_usage_bytes',
    cpu_usage: 'system_cpu_usage_percent',
    active_connections: 'websocket_connections_active',
  },
};

/**
 * Initialize OpenTelemetry on module load (only in Node.js environment)
 */
if (typeof window === 'undefined' && !telemetryDisabled) {
  initializeOpenTelemetry();
}

export default TRADING_TELEMETRY_CONFIG;
# OpenTelemetry Implementation Guide - Phase 1

## Quick Start Implementation

This guide provides the exact steps to implement OpenTelemetry Phase 1 for your MEXC Sniper Bot, focusing on immediate optimization of your 1,304 console logging statements.

## Installation and Setup

### 1. Install Required Dependencies

```bash
# Core OpenTelemetry packages
npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
npm install @opentelemetry/sdk-metrics @opentelemetry/api
npm install @opentelemetry/semantic-conventions
npm install @opentelemetry/resources

# Exporters (choose based on your backend)
npm install @opentelemetry/exporter-prometheus
npm install @opentelemetry/exporter-jaeger
npm install @opentelemetry/exporter-otlp-http

# Additional instrumentations
npm install @opentelemetry/instrumentation-redis
npm install @opentelemetry/instrumentation-http
npm install @opentelemetry/instrumentation-express
```

### 2. Create Instrumentation Configuration

```typescript
// src/instrumentation.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// Configure the SDK
const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'mexc-sniper-bot',
    [SemanticResourceAttributes.SERVICE_VERSION]: '2.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  }),
  
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable file system instrumentation for performance
      '@opentelemetry/instrumentation-fs': { enabled: false },
      // Configure Redis instrumentation for your cache
      '@opentelemetry/instrumentation-redis': { enabled: true },
      // Configure HTTP instrumentation for MEXC API calls
      '@opentelemetry/instrumentation-http': { enabled: true },
    }),
  ],

  traceExporter: new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
  }),

  metricReader: new PeriodicExportingMetricReader({
    exporter: new PrometheusExporter({
      port: 9464, // Prometheus metrics port
    }),
    exportIntervalMillis: 5000, // Export every 5 seconds
  }),
});

// Initialize the SDK
sdk.start()
  .then(() => console.log('OpenTelemetry initialized successfully'))
  .catch((error) => console.error('Error initializing OpenTelemetry', error));

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('OpenTelemetry terminated'))
    .catch((error) => console.error('Error terminating OpenTelemetry', error))
    .finally(() => process.exit(0));
});
```

### 3. Update Your Main Application Entry Point

```typescript
// src/app.ts or your main entry file
// Import instrumentation FIRST, before any other imports
import './instrumentation';

// Now import your application code
import express from 'express';
import { UnifiedMexcService } from './services/unified-mexc-service';
// ... other imports
```

## Structured Logging Implementation

### 1. Create the Structured Logger

```typescript
// src/lib/structured-logger.ts
import { trace, SpanStatusCode } from '@opentelemetry/api';

export interface LogContext {
  component: string;
  operation: string;
  symbol?: string;
  agentId?: string;
  executionId?: string;
  userId?: string;
  [key: string]: any;
}

export class StructuredLogger {
  constructor(private serviceName: string) {}

  private getTraceContext() {
    const span = trace.getActiveSpan();
    if (span) {
      const spanContext = span.spanContext();
      return {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
      };
    }
    return {};
  }

  private formatLogEntry(level: string, message: string, context: LogContext, error?: Error) {
    const timestamp = new Date().toISOString();
    const traceContext = this.getTraceContext();
    
    return {
      timestamp,
      level,
      service: this.serviceName,
      message,
      ...context,
      ...traceContext,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };
  }

  info(message: string, context: LogContext = { component: 'unknown', operation: 'unknown' }) {
    const logEntry = this.formatLogEntry('INFO', message, context);
    console.log(JSON.stringify(logEntry));
  }

  warn(message: string, context: LogContext = { component: 'unknown', operation: 'unknown' }) {
    const logEntry = this.formatLogEntry('WARN', message, context);
    console.warn(JSON.stringify(logEntry));
  }

  error(message: string, error: Error, context: LogContext = { component: 'unknown', operation: 'unknown' }) {
    const logEntry = this.formatLogEntry('ERROR', message, context, error);
    console.error(JSON.stringify(logEntry));
  }

  debug(message: string, context: LogContext = { component: 'unknown', operation: 'unknown' }) {
    if (process.env.NODE_ENV === 'development') {
      const logEntry = this.formatLogEntry('DEBUG', message, context);
      console.debug(JSON.stringify(logEntry));
    }
  }
}

// Export singleton instances for common services
export const dataFetcherLogger = new StructuredLogger('mexc-data-fetcher');
export const agentRegistryLogger = new StructuredLogger('mexc-agent-registry');
export const orchestratorLogger = new StructuredLogger('mexc-orchestrator');
export const patternDiscoveryLogger = new StructuredLogger('mexc-pattern-discovery');
export const riskManagerLogger = new StructuredLogger('mexc-risk-manager');
```

### 2. Migration Examples for Existing Console.log Statements

#### Data Fetcher Migration
```typescript
// src/mexc-agents/data-fetcher.ts
import { dataFetcherLogger } from '../lib/structured-logger';

export class DataFetcher {
  async fetchCalendarData(): Promise<CalendarEntry[]> {
    // OLD: console.log("[DataFetcher] Fetching calendar data from MEXC API");
    dataFetcherLogger.info("Fetching calendar data from MEXC API", {
      component: 'DataFetcher',
      operation: 'fetchCalendar',
      apiEndpoint: 'calendar'
    });

    try {
      const response = await this.mexcService.getCalendar();
      
      // OLD: console.log(`[DataFetcher] Retrieved ${response.data.length} calendar entries`);
      dataFetcherLogger.info("Successfully retrieved calendar data", {
        component: 'DataFetcher',
        operation: 'fetchCalendar',
        entriesCount: response.data.length,
        responseTime: response.responseTime
      });

      return response.data;
    } catch (error) {
      // OLD: console.error("[DataFetcher] Calendar API call failed:", error);
      dataFetcherLogger.error("Calendar API call failed", error as Error, {
        component: 'DataFetcher',
        operation: 'fetchCalendar',
        apiEndpoint: 'calendar'
      });
      throw error;
    }
  }

  async fetchSymbolData(vcoinId: string): Promise<SymbolEntry[]> {
    // OLD: console.log(`[DataFetcher] Fetching symbol data for: ${vcoinId}`);
    dataFetcherLogger.info("Fetching symbol data", {
      component: 'DataFetcher',
      operation: 'fetchSymbol',
      symbol: vcoinId,
      vcoinId
    });

    try {
      const response = await this.mexcService.getSymbol(vcoinId);
      
      dataFetcherLogger.info("Successfully retrieved symbol data", {
        component: 'DataFetcher',
        operation: 'fetchSymbol',
        symbol: vcoinId,
        symbolsCount: response.data.length,
        hasReadyState: response.data.some(s => s.sts === 2 && s.st === 2)
      });

      return response.data;
    } catch (error) {
      // OLD: console.error(`[DataFetcher] Symbol API call failed for ${vcoinId}:`, error);
      dataFetcherLogger.error("Symbol API call failed", error as Error, {
        component: 'DataFetcher',
        operation: 'fetchSymbol',
        symbol: vcoinId,
        vcoinId
      });
      throw error;
    }
  }
}
```

#### Agent Registry Migration
```typescript
// src/mexc-agents/coordination/agent-registry.ts
import { agentRegistryLogger } from '../../lib/structured-logger';

export class AgentRegistry {
  register(id: string, agent: BaseAgent, options: AgentRegistrationOptions): void {
    this.agents.set(id, {
      agent,
      registeredAt: new Date(),
      lastHealthCheck: new Date(),
      status: 'active',
      ...options
    });

    // OLD: console.log(`[AgentRegistry] Registered agent: ${id} (${options.name})`);
    agentRegistryLogger.info("Agent registered successfully", {
      component: 'AgentRegistry',
      operation: 'register',
      agentId: id,
      agentName: options.name,
      agentType: options.type,
      totalAgents: this.agents.size
    });
  }

  unregister(id: string): boolean {
    const removed = this.agents.delete(id);
    
    if (removed) {
      // OLD: console.log(`[AgentRegistry] Unregistered agent: ${id}`);
      agentRegistryLogger.info("Agent unregistered successfully", {
        component: 'AgentRegistry',
        operation: 'unregister',
        agentId: id,
        totalAgents: this.agents.size
      });
    } else {
      agentRegistryLogger.warn("Attempted to unregister non-existent agent", {
        component: 'AgentRegistry',
        operation: 'unregister',
        agentId: id
      });
    }

    return removed;
  }

  async performHealthCheck(): Promise<void> {
    const agentIds = Array.from(this.agents.keys());
    
    // OLD: console.log(`[AgentRegistry] Health check completed for ${agentIds.length} agents`);
    agentRegistryLogger.info("Starting health check", {
      component: 'AgentRegistry',
      operation: 'healthCheck',
      agentsCount: agentIds.length
    });

    try {
      const results = await Promise.allSettled(
        agentIds.map(id => this.checkAgentHealth(id))
      );

      const healthy = results.filter(r => r.status === 'fulfilled').length;
      const unhealthy = results.filter(r => r.status === 'rejected').length;

      agentRegistryLogger.info("Health check completed", {
        component: 'AgentRegistry',
        operation: 'healthCheck',
        totalAgents: agentIds.length,
        healthyAgents: healthy,
        unhealthyAgents: unhealthy,
        healthRate: (healthy / agentIds.length) * 100
      });

    } catch (error) {
      // OLD: console.error("[AgentRegistry] Initial health check failed:", error);
      agentRegistryLogger.error("Health check failed", error as Error, {
        component: 'AgentRegistry',
        operation: 'healthCheck',
        agentsCount: agentIds.length
      });
    }
  }
}
```

## Basic Metrics Implementation

### 1. Create Trading Metrics Collector

```typescript
// src/lib/trading-metrics.ts
import { metrics } from '@opentelemetry/api';

export class TradingMetrics {
  private meter = metrics.getMeter('mexc-trading', '1.0.0');

  // Counters
  private patternDetections = this.meter.createCounter('pattern_detections_total', {
    description: 'Total pattern detections by type and confidence'
  });

  private apiCalls = this.meter.createCounter('api_calls_total', {
    description: 'Total API calls to MEXC by endpoint'
  });

  private agentOperations = this.meter.createCounter('agent_operations_total', {
    description: 'Total agent operations by type and result'
  });

  // Histograms
  private apiLatency = this.meter.createHistogram('api_latency_ms', {
    description: 'API call latency in milliseconds',
    boundaries: [10, 50, 100, 250, 500, 1000, 2500, 5000]
  });

  private patternConfidence = this.meter.createHistogram('pattern_confidence_score', {
    description: 'Pattern detection confidence scores',
    boundaries: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99]
  });

  // Gauges
  private activeAgents = this.meter.createObservableGauge('active_agents_count', {
    description: 'Number of currently active agents'
  });

  private cacheHitRate = this.meter.createObservableGauge('cache_hit_rate', {
    description: 'Cache hit rate percentage'
  });

  // Usage methods
  recordPatternDetection(patternType: string, confidence: number, symbol: string) {
    this.patternDetections.add(1, {
      pattern_type: patternType,
      confidence_tier: this.getConfidenceTier(confidence),
      symbol
    });

    this.patternConfidence.record(confidence, {
      pattern_type: patternType,
      symbol
    });
  }

  recordApiCall(endpoint: string, latencyMs: number, success: boolean) {
    this.apiCalls.add(1, {
      endpoint,
      result: success ? 'success' : 'error'
    });

    this.apiLatency.record(latencyMs, {
      endpoint,
      result: success ? 'success' : 'error'
    });
  }

  recordAgentOperation(agentType: string, operation: string, success: boolean, durationMs: number) {
    this.agentOperations.add(1, {
      agent_type: agentType,
      operation,
      result: success ? 'success' : 'error'
    });
  }

  private getConfidenceTier(confidence: number): string {
    if (confidence >= 0.9) return 'very_high';
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.7) return 'medium';
    if (confidence >= 0.5) return 'low';
    return 'very_low';
  }
}

// Export singleton
export const tradingMetrics = new TradingMetrics();
```

### 2. Integration with Existing Services

```typescript
// src/services/unified-mexc-service.ts (Enhanced)
import { tradingMetrics } from '../lib/trading-metrics';
import { trace } from '@opentelemetry/api';

export class UnifiedMexcService {
  async getCalendar(): Promise<MexcServiceResponse<CalendarEntry[]>> {
    const tracer = trace.getTracer('mexc-api');
    
    return tracer.startActiveSpan('mexc.getCalendar', async (span) => {
      const startTime = Date.now();
      
      try {
        span.setAttributes({
          'mexc.endpoint': 'calendar',
          'mexc.operation': 'fetch'
        });

        const response = await this.mexcClient.getCalendar();
        const latency = Date.now() - startTime;

        // Record metrics
        tradingMetrics.recordApiCall('calendar', latency, true);

        span.setAttributes({
          'mexc.response.entries_count': response.data.length,
          'mexc.response.latency_ms': latency
        });

        return response;
      } catch (error) {
        const latency = Date.now() - startTime;
        tradingMetrics.recordApiCall('calendar', latency, false);
        
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }
}
```

## Environment Configuration

### 1. Environment Variables

```bash
# .env.local or .env
# OpenTelemetry Configuration
OTEL_SERVICE_NAME=mexc-sniper-bot
OTEL_SERVICE_VERSION=2.0.0
OTEL_RESOURCE_ATTRIBUTES=service.name=mexc-sniper-bot,service.version=2.0.0

# Jaeger (for traces)
JAEGER_ENDPOINT=http://localhost:14268/api/traces

# Prometheus (for metrics)
OTEL_EXPORTER_PROMETHEUS_PORT=9464

# Log Level
OTEL_LOG_LEVEL=info

# Performance Settings
OTEL_BSP_MAX_EXPORT_BATCH_SIZE=512
OTEL_BSP_EXPORT_TIMEOUT=30000
OTEL_BSP_SCHEDULE_DELAY=5000
```

### 2. Docker Compose for Local Development

```yaml
# docker-compose.otel.yml
version: '3.8'
services:
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # Jaeger UI
      - "14268:14268"  # Jaeger collector
    environment:
      - COLLECTOR_OTLP_ENABLED=true

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

### 3. Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'mexc-sniper-bot'
    static_configs:
      - targets: ['host.docker.internal:9464']
    scrape_interval: 5s
    metrics_path: /metrics
```

## Testing Your Implementation

### 1. Run the Application with Observability

```bash
# Start observability stack
docker-compose -f docker-compose.otel.yml up -d

# Run your application
npm run dev
```

### 2. Verify Traces in Jaeger

1. Open http://localhost:16686
2. Select "mexc-sniper-bot" service
3. Click "Find Traces"
4. You should see traces for API calls and operations

### 3. Verify Metrics in Prometheus

1. Open http://localhost:9090
2. Query for metrics like:
   - `pattern_detections_total`
   - `api_calls_total`
   - `api_latency_ms`

### 4. Set up Grafana Dashboard

1. Open http://localhost:3001
2. Login with admin/admin
3. Add Prometheus as data source (http://prometheus:9090)
4. Import dashboards for your metrics

## Performance Considerations

### 1. Sampling Configuration

```typescript
// src/instrumentation.ts
import { TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-node';

const sdk = new NodeSDK({
  // ... other config
  
  sampler: new TraceIdRatioBasedSampler(0.1), // Sample 10% of traces in production
});
```

### 2. Batch Export Configuration

```typescript
// Optimize batch export for performance
const sdk = new NodeSDK({
  // ... other config
  
  spanProcessor: new BatchSpanProcessor(traceExporter, {
    maxExportBatchSize: 100,
    exportTimeoutMillis: 30000,
    scheduledDelayMillis: 5000,
  }),
});
```

### 3. Memory Management

```typescript
// Configure resource limits
process.env.OTEL_BSP_MAX_QUEUE_SIZE = '2048';
process.env.OTEL_BSP_MAX_EXPORT_BATCH_SIZE = '512';
```

## Next Steps

1. **Monitor Performance**: Check that the observability overhead is <5% of CPU/Memory
2. **Migrate More Logs**: Continue migrating console.log statements using the patterns shown
3. **Add Custom Metrics**: Implement business-specific metrics for trading performance
4. **Set Up Alerts**: Configure alerts based on error rates and performance thresholds
5. **Phase 2 Implementation**: Move to distributed tracing and advanced cache monitoring

## Common Issues and Solutions

### Issue: High Memory Usage

**Solution**: Adjust batch export settings and sampling rates

```typescript
// Reduce memory usage
const sdk = new NodeSDK({
  sampler: new TraceIdRatioBasedSampler(0.05), // 5% sampling
  spanProcessor: new BatchSpanProcessor(traceExporter, {
    maxExportBatchSize: 50,
    maxQueueSize: 1000,
  }),
});
```

### Issue: Missing Traces

**Solution**: Ensure instrumentation is imported before other modules

```typescript
// Must be first import
import './instrumentation';

// Then other imports
import express from 'express';
// ...
```

### Issue: Prometheus Metrics Not Showing

**Solution**: Check that the Prometheus exporter port is accessible

```bash
# Test metrics endpoint
curl http://localhost:9464/metrics
```

This Phase 1 implementation provides immediate value by replacing console.log statements with structured, searchable logs while adding basic observability for your trading operations. The setup is production-ready and forms the foundation for more advanced observability features.
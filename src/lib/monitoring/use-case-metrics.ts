/**
 * Use Case Execution Metrics and Instrumentation
 *
 * Phase 3: Clean Architecture Migration - Monitoring & Observability
 *
 * This module provides comprehensive instrumentation for use case execution:
 * - Performance metrics collection (latency, errors, throughput)
 * - Distributed tracing for cross-domain operations
 * - Business KPI tracking
 * - Use case execution wrapper with automatic metrics
 */

import { context, metrics, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import { z } from "zod";

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface UseCaseMetrics {
  executionTime: number;
  success: boolean;
  errorType?: string;
  errorMessage?: string;
  businessMetrics?: Record<string, number>;
  inputValidation?: {
    valid: boolean;
    errors?: string[];
  };
  domainEvents?: {
    count: number;
    types: string[];
  };
}

export interface UseCaseExecutionContext {
  useCaseName: string;
  userId?: string;
  traceId?: string;
  correlationId?: string;
  domain: string;
  operation: string;
  version?: string;
}

export interface UseCasePerformanceThresholds {
  latencyWarningMs: number;
  latencyErrorMs: number;
  errorRateThreshold: number;
  throughputMinimum: number;
}

// Input validation schema for use case execution
const UseCaseExecutionSchema = z.object({
  useCaseName: z.string().min(1),
  userId: z.string().optional(),
  traceId: z.string().optional(),
  correlationId: z.string().optional(),
  domain: z.string().min(1),
  operation: z.string().min(1),
  version: z.string().default("1.0.0"),
});

// ============================================================================
// Use Case Metrics Collector
// ============================================================================

export class UseCaseMetricsCollector {
  private readonly tracer = trace.getTracer("use-case-execution", "1.0.0");
  private readonly meter = metrics.getMeter("use-case-metrics", "1.0.0");

  // Metrics instruments
  private readonly executionCounter = this.meter.createCounter("use_case_executions_total", {
    description: "Total number of use case executions",
  });

  private readonly latencyHistogram = this.meter.createHistogram("use_case_latency_ms", {
    description: "Use case execution latency in milliseconds",
    unit: "ms",
  });

  private readonly errorCounter = this.meter.createCounter("use_case_errors_total", {
    description: "Total number of use case execution errors",
  });

  private readonly businessMetricsGauge = this.meter.createGauge("use_case_business_metrics", {
    description: "Business metrics from use case execution",
  });

  private readonly concurrentExecutionsGauge = this.meter.createGauge(
    "use_case_concurrent_executions",
    {
      description: "Number of concurrent use case executions",
    }
  );

  private readonly validationErrorCounter = this.meter.createCounter(
    "use_case_validation_errors_total",
    {
      description: "Total number of input validation errors",
    }
  );

  private readonly thresholds: UseCasePerformanceThresholds = {
    latencyWarningMs: 1000,
    latencyErrorMs: 5000,
    errorRateThreshold: 5.0,
    throughputMinimum: 10,
  };

  private activeSessions = new Map<string, number>();

  /**
   * Instrument a use case execution with comprehensive metrics and tracing
   */
  async instrumentUseCaseExecution<TInput, TOutput>(
    useCaseContext: UseCaseExecutionContext,
    input: TInput,
    execution: (input: TInput) => Promise<TOutput>
  ): Promise<TOutput> {
    // Validate context
    const validatedContext = this.validateContext(useCaseContext);

    // Create execution session
    const sessionId = this.createSession(validatedContext);

    // Start span for distributed tracing
    const span = this.tracer.startSpan(
      `use-case.${validatedContext.domain}.${validatedContext.operation}`,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          "use_case.name": validatedContext.useCaseName,
          "use_case.domain": validatedContext.domain,
          "use_case.operation": validatedContext.operation,
          "use_case.version": validatedContext.version,
          "use_case.user_id": validatedContext.userId,
          "use_case.correlation_id": validatedContext.correlationId,
        },
      }
    );

    const startTime = Date.now();
    let result: TOutput | undefined;
    let error: Error | undefined;
    let inputValidation: UseCaseMetrics["inputValidation"];

    try {
      // Validate input if schema is available
      inputValidation = await this.validateInput(input);

      if (inputValidation && !inputValidation.valid) {
        this.recordValidationErrors(validatedContext, inputValidation.errors || []);
        span.setStatus({ code: SpanStatusCode.ERROR, message: "Input validation failed" });
        throw new Error(`Input validation failed: ${inputValidation.errors?.join(", ")}`);
      }

      // Execute use case in span context (using OpenTelemetry context)
      const otelContext = context.active();
      result = await context.with(trace.setSpan(otelContext, span), async () => {
        return await execution(input);
      });

      span.setStatus({ code: SpanStatusCode.OK });
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      // Re-throw error to ensure method doesn't continue to return statement
      throw error;
    } finally {
      const executionTime = Date.now() - startTime;

      // Record metrics
      const metrics: UseCaseMetrics = {
        executionTime,
        success: !error,
        errorType: error?.constructor.name,
        errorMessage: error?.message,
        inputValidation,
        businessMetrics: await this.extractBusinessMetrics(result, error),
      };

      this.recordMetrics(validatedContext, metrics);

      // Add execution details to span
      span.setAttributes({
        "use_case.execution_time_ms": executionTime,
        "use_case.success": !error,
        "use_case.error_type": error?.constructor.name || "",
        "use_case.input_valid": inputValidation?.valid || true,
      });

      // End span
      span.end();

      // End session
      this.endSession(sessionId);
    }

    if (result === undefined) {
      throw new Error("Use case execution failed without setting result");
    }
    return result;
  }

  /**
   * Record business metrics for dashboard and alerting
   */
  recordBusinessMetric(
    context: UseCaseExecutionContext,
    metricName: string,
    value: number,
    unit?: string
  ): void {
    this.businessMetricsGauge.record(value, {
      use_case: context.useCaseName,
      domain: context.domain,
      operation: context.operation,
      metric: metricName,
      unit: unit || "count",
    });
  }

  /**
   * Get performance statistics for monitoring dashboard
   */
  getPerformanceStats(_useCaseName?: string): {
    totalExecutions: number;
    averageLatency: number;
    errorRate: number;
    currentConcurrency: number;
    thresholdViolations: {
      latencyWarnings: number;
      latencyErrors: number;
      errorRateHigh: boolean;
    };
  } {
    // This would typically be implemented with actual metrics backend
    // For now, return placeholder data
    return {
      totalExecutions: 0,
      averageLatency: 0,
      errorRate: 0,
      currentConcurrency: this.activeSessions.size,
      thresholdViolations: {
        latencyWarnings: 0,
        latencyErrors: 0,
        errorRateHigh: false,
      },
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private validateContext(context: UseCaseExecutionContext): UseCaseExecutionContext {
    const result = UseCaseExecutionSchema.safeParse(context);

    if (!result.success) {
      throw new Error(`Invalid use case context: ${result.error.errors[0]?.message}`);
    }

    return result.data;
  }

  private async validateInput<T>(input: T): Promise<UseCaseMetrics["inputValidation"]> {
    try {
      // Basic validation - would be enhanced with actual schema validation
      if (input === null || input === undefined) {
        return {
          valid: false,
          errors: ["Input is required"],
        };
      }

      // Additional validation logic would go here
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : "Unknown validation error"],
      };
    }
  }

  private createSession(context: UseCaseExecutionContext): string {
    const sessionId = `${context.useCaseName}-${Date.now()}-${Math.random()}`;
    const startTime = Date.now();

    this.activeSessions.set(sessionId, startTime);

    // Update concurrent executions metric
    this.concurrentExecutionsGauge.record(this.activeSessions.size, {
      use_case: context.useCaseName,
      domain: context.domain,
    });

    return sessionId;
  }

  private endSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);

    // Update concurrent executions metric
    this.concurrentExecutionsGauge.record(this.activeSessions.size);
  }

  private recordMetrics(context: UseCaseExecutionContext, metrics: UseCaseMetrics): void {
    const labels = {
      use_case: context.useCaseName,
      domain: context.domain,
      operation: context.operation,
      version: context.version || "1.0.0",
    };

    // Record execution count
    this.executionCounter.add(1, {
      ...labels,
      success: metrics.success.toString(),
      error_type: metrics.errorType || "none",
    });

    // Record latency
    this.latencyHistogram.record(metrics.executionTime, labels);

    // Record errors
    if (!metrics.success) {
      this.errorCounter.add(1, {
        ...labels,
        error_type: metrics.errorType || "unknown",
      });
    }

    // Record business metrics
    if (metrics.businessMetrics) {
      for (const [key, value] of Object.entries(metrics.businessMetrics)) {
        this.businessMetricsGauge.record(value, {
          ...labels,
          metric: key,
        });
      }
    }

    // Check thresholds and emit warnings
    this.checkThresholds(context, metrics);
  }

  private recordValidationErrors(context: UseCaseExecutionContext, errors: string[]): void {
    this.validationErrorCounter.add(errors.length, {
      use_case: context.useCaseName,
      domain: context.domain,
      operation: context.operation,
    });
  }

  private async extractBusinessMetrics<T>(
    result?: T,
    _error?: Error
  ): Promise<Record<string, number>> {
    const metrics: Record<string, number> = {};

    // Extract metrics based on result type
    if (result && typeof result === "object") {
      // Trading domain metrics
      if ("trade" in result) {
        metrics.trade_volume = 1;
        if (result.trade && typeof result.trade === "object" && "quantity" in result.trade) {
          metrics.trade_quantity = Number(result.trade.quantity) || 0;
        }
      }

      // Pattern detection metrics
      if ("confidence" in result) {
        metrics.pattern_confidence = Number(result.confidence) || 0;
      }

      // Portfolio metrics
      if ("balance" in result) {
        metrics.portfolio_value = Number(result.balance) || 0;
      }

      // Execution time for specific operations
      if ("executionTime" in result) {
        metrics.operation_duration = Number(result.executionTime) || 0;
      }
    }

    return metrics;
  }

  private checkThresholds(context: UseCaseExecutionContext, metrics: UseCaseMetrics): void {
    // Check latency thresholds
    if (metrics.executionTime > this.thresholds.latencyErrorMs) {
      console.error(`[UseCaseMetrics] High latency detected`, {
        useCaseName: context.useCaseName,
        latency: metrics.executionTime,
        threshold: this.thresholds.latencyErrorMs,
      });
    } else if (metrics.executionTime > this.thresholds.latencyWarningMs) {
      console.warn(`[UseCaseMetrics] Elevated latency detected`, {
        useCaseName: context.useCaseName,
        latency: metrics.executionTime,
        threshold: this.thresholds.latencyWarningMs,
      });
    }

    // Additional threshold checks would be implemented here
  }
}

// ============================================================================
// Use Case Wrapper Decorator
// ============================================================================

/**
 * Decorator function to automatically instrument use case executions
 */
export function withUseCaseMetrics<TInput, TOutput>(context: UseCaseExecutionContext) {
  return (_target: any, _propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;
    const collector = getUseCaseMetricsCollector();

    descriptor.value = async function (input: TInput): Promise<TOutput> {
      return await collector.instrumentUseCaseExecution(context, input, async (validatedInput) => {
        return await method.call(this, validatedInput);
      });
    };

    return descriptor;
  };
}

/**
 * Higher-order function to wrap use case execution with metrics
 */
export function createInstrumentedUseCase<TInput, TOutput>(
  context: UseCaseExecutionContext,
  useCase: (input: TInput) => Promise<TOutput>
): (input: TInput) => Promise<TOutput> {
  const collector = getUseCaseMetricsCollector();

  return async (input: TInput): Promise<TOutput> => {
    return await collector.instrumentUseCaseExecution(context, input, useCase);
  };
}

// ============================================================================
// Global Instance
// ============================================================================

let globalMetricsCollector: UseCaseMetricsCollector | null = null;

export function getUseCaseMetricsCollector(): UseCaseMetricsCollector {
  if (!globalMetricsCollector) {
    globalMetricsCollector = new UseCaseMetricsCollector();
  }
  return globalMetricsCollector;
}

export function resetUseCaseMetricsCollector(): void {
  globalMetricsCollector = null;
}

// ============================================================================
// Health Check
// ============================================================================

export interface UseCaseMetricsHealth {
  status: "healthy" | "degraded" | "unhealthy";
  totalExecutions: number;
  averageLatency: number;
  errorRate: number;
  activeSessions: number;
  lastUpdate: string;
}

export function getUseCaseMetricsHealth(): UseCaseMetricsHealth {
  const collector = getUseCaseMetricsCollector();
  const stats = collector.getPerformanceStats();

  let status: "healthy" | "degraded" | "unhealthy" = "healthy";

  if (stats.errorRate > 10 || stats.averageLatency > 5000) {
    status = "unhealthy";
  } else if (stats.errorRate > 5 || stats.averageLatency > 1000) {
    status = "degraded";
  }

  return {
    status,
    totalExecutions: stats.totalExecutions,
    averageLatency: stats.averageLatency,
    errorRate: stats.errorRate,
    activeSessions: stats.currentConcurrency,
    lastUpdate: new Date().toISOString(),
  };
}

// ============================================================================
// Exports
// ============================================================================

export default UseCaseMetricsCollector;

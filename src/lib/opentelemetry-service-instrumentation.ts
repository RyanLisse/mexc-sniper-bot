/**
* OpenTelemetry Service Layer Instrumentation
 *
 * Provides comprehensive instrumentation for key services including
 * MEXC API operations, pattern detection, and auto-sniping execution.
 */

import { SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("mexc-sniper-services", "1.0.0");

export interface ServiceSpanOptions {
  operationType:
    | "api_call"
    | "pattern_detection"
    | "risk_assessment"
    | "execution"
    | "cache_operation";
  serviceName: string;
  methodName: string;
  includeInputData?: boolean;
  sensitiveParameters?: string[];
}

/**
 * Decorator for instrumenting service methods
 */
export function instrumentServiceMethod(options: ServiceSpanOptions) {
  return (_target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    // Safety check for undefined descriptor
    if (!descriptor || typeof descriptor.value !== "function") {
      // For testing environment, just return a no-op
      if (process.env.NODE_ENV === "test" || process.env.VITEST) {
        return descriptor;
      }

      console.warn(
        `@instrumentServiceMethod applied to non-method ${propertyKey}, skipping instrumentation`
      );
      return descriptor;
    }

    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const spanName = `${options.serviceName}.${options.methodName || propertyKey}`;

      return tracer.startActiveSpan(
        spanName,
        {
          kind: SpanKind.INTERNAL,
          attributes: {
            "service.name": options.serviceName,
            "service.method": options.methodName || propertyKey,
            "operation.type": options.operationType,
            "service.version": "1.0.0",
          },
        },
        async (span) => {
          const startTime = Date.now();

          try {
            // Add input parameters (excluding sensitive ones)
            if (options.includeInputData && args.length > 0) {
              const sanitizedArgs = sanitizeParameters(args, options.sensitiveParameters);
              span.setAttributes({
                "operation.input_count": args.length,
                "operation.input_data": JSON.stringify(sanitizedArgs).substring(0, 1000), // Truncate
              });
            }

            const result = await originalMethod.apply(this, args);

            const duration = Date.now() - startTime;
            span.setAttributes({
              "operation.duration_ms": duration,
              "operation.success": true,
            });

            // Add result metadata
            if (result && typeof result === "object") {
              if (result.success !== undefined) {
                span.setAttributes({ "operation.result_success": result.success });
              }
              if (result.data && Array.isArray(result.data)) {
                span.setAttributes({ "operation.result_count": result.data.length });
              }
            }

            span.setStatus({ code: SpanStatusCode.OK });
            return result;
          } catch (error) {
            const duration = Date.now() - startTime;
            span.setAttributes({
              "operation.duration_ms": duration,
              "operation.success": false,
              "error.name": error instanceof Error ? error.name : "UnknownError",
              "error.message": error instanceof Error ? error.message : String(error),
            });

            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error instanceof Error ? error.message : String(error),
            });

            throw error;
          } finally {
            span.end();
          }
        }
      );
    };

    return descriptor;
  };
}

/**
 * Wrapper function for instrumenting async operations
 */
export async function instrumentOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  options: Omit<ServiceSpanOptions, "methodName"> & {
    additionalAttributes?: Record<string, string | number | boolean>;
  }
): Promise<T> {
  return tracer.startActiveSpan(
    operationName,
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        "service.name": options.serviceName,
        "operation.type": options.operationType,
        "operation.name": operationName,
        ...options.additionalAttributes,
      },
    },
    async (span) => {
      const startTime = Date.now();

      try {
        const result = await operation();

        const duration = Date.now() - startTime;
        span.setAttributes({
          "operation.duration_ms": duration,
          "operation.success": true,
        });

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttributes({
          "operation.duration_ms": duration,
          "operation.success": false,
          "error.name": error instanceof Error ? error.name : "UnknownError",
          "error.message": error instanceof Error ? error.message : String(error),
        });

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });

        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Specific instrumentation for MEXC API calls
 */
export async function instrumentMexcApiCall<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  operation: () => Promise<T>,
  additionalData?: Record<string, any>
): Promise<T> {
  return instrumentOperation(
    `mexc.api.${method.toLowerCase()}.${endpoint.replace(/[^a-zA-Z0-9]/g, "_")}`,
    operation,
    {
      serviceName: "mexc-api-client",
      operationType: "api_call",
      additionalAttributes: {
        "http.method": method,
        "http.endpoint": endpoint,
        "mexc.api_version": "v3",
        ...additionalData,
      },
    }
  );
}

/**
 * Instrumentation for pattern detection operations
 */
export async function instrumentPatternDetection<T>(
  patternType: string,
  operation: () => Promise<T>,
  symbolCount?: number
): Promise<T> {
  return instrumentOperation(`pattern_detection.${patternType}`, operation, {
    serviceName: "pattern-detection-engine",
    operationType: "pattern_detection",
    additionalAttributes: {
      "pattern.type": patternType,
      "pattern.symbol_count": symbolCount || 0,
    },
  });
}

/**
 * Instrumentation for auto-sniping execution
 */
export async function instrumentAutoSnipingExecution<T>(
  executionType: string,
  operation: () => Promise<T>,
  positionData?: { symbol?: string; quantity?: string; side?: string }
): Promise<T> {
  return instrumentOperation(`auto_sniping.${executionType}`, operation, {
    serviceName: "auto-sniping-execution",
    operationType: "execution",
    additionalAttributes: {
      "execution.type": executionType,
      "trade.symbol": positionData?.symbol || "",
      "trade.side": positionData?.side || "",
      "trade.has_quantity": !!positionData?.quantity,
    },
  });
}

/**
 * Sanitize parameters for logging (remove sensitive data)
 */
function sanitizeParameters(args: any[], sensitiveKeys: string[] = []): any[] {
  const defaultSensitiveKeys = ["apiKey", "secretKey", "passphrase", "password", "token"];
  const allSensitiveKeys = [...defaultSensitiveKeys, ...sensitiveKeys];

  return args.map((arg) => {
    if (typeof arg === "object" && arg !== null) {
      const sanitized = { ...arg };
      for (const key of allSensitiveKeys) {
        if (key in sanitized) {
          sanitized[key] = "[REDACTED]";
        }
      }
      return sanitized;
    }
    return arg;
  });
}

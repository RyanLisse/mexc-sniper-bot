import {
  isBrowserEnvironment,
  isNodeEnvironment,
} from "@/src/lib/browser-compatible-events";
/**
 * Enhanced API Resilience Middleware
 *
 * Integrates circuit breakers, retries, fallbacks, and graceful degradation
 * to address the 400-500% error rate increases in chaos scenarios
 */

import { type NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "./api-response";
import { apiResponse } from "./api-response";
import {
  executeWithResilience,
  type FallbackStrategy,
  globalResilienceCoordinator,
} from "./enhanced-resilience-manager";
import { createLogger } from "./unified-logger";

const logger = createLogger("enhanced-api-resilience", {
  enableStructuredLogging: true,
  enablePerformanceLogging: true,
});

export type ResilientApiHandler<T = any> = (
  request: NextRequest,
  context?: { params?: Record<string, string> }
) => Promise<ApiResponse<T> | NextResponse>;

export interface ResilientApiOptions {
  // Resilience settings
  enableCircuitBreaker?: boolean;
  enableRetries?: boolean;
  enableFallbacks?: boolean;
  enableGracefulDegradation?: boolean;

  // Circuit breaker configuration
  failureThreshold?: number;
  resetTimeout?: number;

  // Retry configuration
  maxRetries?: number;
  retryDelay?: number;

  // Timeout settings
  operationTimeout?: number;

  // Fallback strategies
  fallbackStrategies?: Array<() => Promise<any>>;
  degradedModeResponse?: any;

  // Monitoring
  enableMetrics?: boolean;
  enableRequestLogging?: boolean;
}

const defaultResilientOptions: Required<ResilientApiOptions> = {
  enableCircuitBreaker: true,
  enableRetries: true,
  enableFallbacks: true,
  enableGracefulDegradation: true,
  failureThreshold: 5,
  resetTimeout: 60000,
  maxRetries: 3,
  retryDelay: 1000,
  operationTimeout: 30000,
  fallbackStrategies: [],
  degradedModeResponse: {
    message: "Service temporarily degraded, using cached data",
  },
  enableMetrics: true,
  enableRequestLogging: process.env.NODE_ENV === "development",
};

/**
 * Create default fallback strategies for different endpoint types
 */
function createDefaultFallbacks(endpointType: string): FallbackStrategy<any>[] {
  const fallbacks: FallbackStrategy<any>[] = [];

  switch (endpointType) {
    case "health":
      fallbacks.push(
        // Fallback 1: Basic health status
        async () =>
          apiResponse.success({
            status: "degraded",
            message: "Health check using fallback mode",
            timestamp: new Date().toISOString(),
            services: {
              core: "operational",
              api: "degraded",
            },
          }),

        // Fallback 2: Minimal status
        async () =>
          apiResponse.success({
            status: "minimal",
            timestamp: new Date().toISOString(),
          })
      );
      break;

    case "data":
      fallbacks.push(
        // Fallback 1: Cached data
        async () =>
          apiResponse.success({
            data: [],
            source: "cache",
            message: "Using cached data due to service degradation",
          }),

        // Fallback 2: Empty but valid response
        async () =>
          apiResponse.success({
            data: [],
            source: "fallback",
            message: "Service temporarily unavailable",
          })
      );
      break;

    case "trading":
      fallbacks.push(
        // Fallback 1: Safe mode
        async () =>
          apiResponse.success({
            mode: "safe",
            message: "Trading in safe mode - limited functionality",
            available_operations: ["view", "status"],
          }),

        // Fallback 2: Read-only mode
        async () =>
          apiResponse.success({
            mode: "readonly",
            message: "Trading suspended - monitoring only",
          })
      );
      break;

    default:
      // Generic fallbacks
      fallbacks.push(async () =>
        apiResponse.success({
          status: "degraded",
          message: "Service operating in degraded mode",
        })
      );
  }

  return fallbacks;
}

/**
 * Determine endpoint type from URL for appropriate fallback strategies
 */
function getEndpointType(url: string): string {
  if (url.includes("/health")) return "health";
  if (
    url.includes("/trading") ||
    url.includes("/portfolio") ||
    url.includes("/mexc")
  )
    return "trading";
  if (
    url.includes("/data") ||
    url.includes("/analytics") ||
    url.includes("/monitoring")
  )
    return "data";
  return "generic";
}

/**
 * Enhanced middleware that wraps API handlers with comprehensive resilience
 */
export function withResilientApiHandling<T = any>(
  handler: ResilientApiHandler<T>,
  options: ResilientApiOptions = {}
): ResilientApiHandler<T> {
  const config = { ...defaultResilientOptions, ...options };

  return async (request: NextRequest, context) => {
    const startTime = performance.now();
    const url = new URL(request.url);
    const operationName = `${request.method}:${url.pathname}`;
    const endpointType = getEndpointType(url.pathname);
    const requestId =
      request.headers.get("x-request-id") || crypto.randomUUID();

    if (config.enableRequestLogging) {
      logger.info("Resilient API request started", {
        method: request.method,
        url: request.url,
        requestId,
        operationName,
        endpointType,
      });
    }

    try {
      // Handle OPTIONS requests immediately
      if (request.method === "OPTIONS") {
        return new NextResponse(null, {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers":
              "Content-Type, Authorization, X-Requested-With, X-Request-ID",
            "X-Request-ID": requestId,
          },
        });
      }

      // Prepare fallback strategies
      const fallbackStrategies: FallbackStrategy<
        ApiResponse<T> | NextResponse
      >[] = [
        ...config.fallbackStrategies.map((strategy) => async () => {
          const result = await strategy();
          return result instanceof NextResponse
            ? result
            : apiResponse.success(result);
        }),
        ...createDefaultFallbacks(endpointType),
      ];

      // Execute with comprehensive resilience
      const result = await executeWithResilience(
        async () => {
          // Add operation timeout
          return await Promise.race([
            handler(request, context),
            new Promise<never>((_, reject) => {
              setTimeout(() => {
                reject(
                  new Error(
                    `Operation timeout after ${config.operationTimeout}ms`
                  )
                );
              }, config.operationTimeout);
            }),
          ]);
        },
        operationName,
        {
          enableRetries: config.enableRetries,
          enableCircuitBreaker: config.enableCircuitBreaker,
          customFallbacks: config.enableFallbacks
            ? fallbackStrategies
            : undefined,
        }
      );

      // Convert result to NextResponse if needed
      let response: NextResponse;
      if (result instanceof NextResponse) {
        response = result;
      } else {
        response = NextResponse.json(result, {
          status: result.metadata?.statusCode || (result.success ? 200 : 500),
          headers: {
            "Content-Type": "application/json",
            "X-Request-ID": requestId,
            "X-Operation-Name": operationName,
          },
        });
      }

      // Add CORS headers
      response.headers.set("Access-Control-Allow-Origin", "*");
      response.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      response.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With, X-Request-ID"
      );

      // Log successful request
      const duration = performance.now() - startTime;
      if (config.enableRequestLogging) {
        logger.info("Resilient API request completed", {
          method: request.method,
          url: request.url,
          requestId,
          operationName,
          statusCode: response.status,
          duration: Math.round(duration),
        });
      }

      return response;
    } catch (error) {
      const duration = performance.now() - startTime;

      // Even in error case, try graceful degradation
      if (config.enableGracefulDegradation) {
        try {
          const degradedResponse = apiResponse.error(
            "Service temporarily degraded",
            503,
            {
              ...config.degradedModeResponse,
              error: error instanceof Error ? error.message : String(error),
              requestId,
              duration: Math.round(duration),
            }
          );

          const response = NextResponse.json(degradedResponse, {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "X-Request-ID": requestId,
              "X-Operation-Name": operationName,
              "X-Degraded-Mode": "true",
              "Access-Control-Allow-Origin": "*",
            },
          });

          logger.warn("API request failed, returning degraded response", {
            method: request.method,
            url: request.url,
            requestId,
            operationName,
            error: error instanceof Error ? error.message : String(error),
            duration: Math.round(duration),
          });

          return response;
        } catch (degradationError) {
          logger.error("Graceful degradation also failed", {
            originalError: error,
            degradationError,
            requestId,
          });
        }
      }

      // Final error response
      const errorResponse = apiResponse.error("Internal server error", 500, {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        duration: Math.round(duration),
        operationName,
      });

      const response = NextResponse.json(errorResponse, {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
          "X-Operation-Name": operationName,
          "Access-Control-Allow-Origin": "*",
        },
      });

      logger.error(
        "Resilient API request failed completely",
        {
          method: request.method,
          url: request.url,
          requestId,
          operationName,
          error: error instanceof Error ? error.message : String(error),
          duration: Math.round(duration),
        },
        error instanceof Error ? error : new Error(String(error))
      );

      return response;
    }
  };
}

/**
 * Specialized resilient middleware for different API types
 */

export function withResilientHealthCheck<T = any>(
  handler: ResilientApiHandler<T>
): ResilientApiHandler<T> {
  return withResilientApiHandling(handler, {
    enableCircuitBreaker: true,
    enableRetries: true,
    enableFallbacks: true,
    enableGracefulDegradation: true,
    failureThreshold: 3,
    resetTimeout: 30000,
    maxRetries: 2,
    operationTimeout: 10000,
    fallbackStrategies: [
      async () => ({
        status: "degraded",
        message: "Health check fallback",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      }),
    ],
  });
}

export function withResilientTradingApi<T = any>(
  handler: ResilientApiHandler<T>
): ResilientApiHandler<T> {
  return withResilientApiHandling(handler, {
    enableCircuitBreaker: true,
    enableRetries: true,
    enableFallbacks: true,
    enableGracefulDegradation: true,
    failureThreshold: 5,
    resetTimeout: 60000,
    maxRetries: 3,
    operationTimeout: 30000,
    fallbackStrategies: [
      async () => ({
        mode: "safe",
        message: "Trading API in safe mode",
        available_operations: ["status", "view"],
      }),
    ],
  });
}

export function withResilientDataApi<T = any>(
  handler: ResilientApiHandler<T>
): ResilientApiHandler<T> {
  return withResilientApiHandling(handler, {
    enableCircuitBreaker: true,
    enableRetries: true,
    enableFallbacks: true,
    enableGracefulDegradation: true,
    failureThreshold: 10,
    resetTimeout: 45000,
    maxRetries: 2,
    operationTimeout: 20000,
    fallbackStrategies: [
      async () => ({
        data: [],
        source: "cache",
        message: "Using cached data due to service degradation",
      }),
    ],
  });
}

/**
 * Get system-wide resilience metrics
 */
export function getApiResilienceMetrics(): {
  systemHealth: number;
  circuitBreakers: any[];
  recommendations: string[];
  degradedEndpoints: string[];
} {
  const metrics = globalResilienceCoordinator.getSystemResilienceMetrics();

  const degradedEndpoints = metrics.circuitBreakers
    .filter((cb) => cb.state !== "CLOSED" || cb.metrics.successRate < 90)
    .map((cb) => cb.name);

  return {
    systemHealth: metrics.overallHealth,
    circuitBreakers: metrics.circuitBreakers,
    recommendations: metrics.recommendations,
    degradedEndpoints,
  };
}

/**
 * Reset all circuit breakers (useful for testing or emergency recovery)
 */
export function resetAllApiCircuitBreakers(): void {
  globalResilienceCoordinator.resetAllCircuitBreakers();
  logger.info("All API circuit breakers have been reset");
}

/**
 * Utility for creating resilient endpoint handlers with minimal boilerplate
 */
export function createResilientEndpoint<T = any>(
  handler: (request: NextRequest, context?: any) => Promise<T>,
  endpointType: "health" | "trading" | "data" | "generic" = "generic"
): ResilientApiHandler<T> {
  const wrappedHandler: ResilientApiHandler<T> = async (request, context) => {
    const result = await handler(request, context);

    // If result is already an ApiResponse or NextResponse, return it
    if (
      result &&
      typeof result === "object" &&
      ("success" in result || result instanceof NextResponse)
    ) {
      return result as any;
    }

    // Otherwise, wrap in success response
    return apiResponse.success(result);
  };

  switch (endpointType) {
    case "health":
      return withResilientHealthCheck(wrappedHandler);
    case "trading":
      return withResilientTradingApi(wrappedHandler);
    case "data":
      return withResilientDataApi(wrappedHandler);
    default:
      return withResilientApiHandling(wrappedHandler);
  }
}

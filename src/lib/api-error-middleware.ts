/**
 * Standardized API Error Middleware
 *
 * Provides consistent error handling for Next.js API routes.
 * Integrates with the standardized error handling system.
 */

import { type NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "./api-response";
import {
  errorHandler,
  handleApiError,
  type StandardizedErrorContext,
} from "./standardized-error-handler";
import { createLogger } from "./unified-logger";

const logger = createLogger("api-error-middleware", {
  enableStructuredLogging: true,
  enablePerformanceLogging: true,
});

/**
 * API handler function type
 */
export type ApiHandler<T = any> = (
  request: NextRequest,
  context?: { params?: Record<string, string> }
) => Promise<ApiResponse<T> | NextResponse>;

/**
 * API error middleware options
 */
interface ApiErrorMiddlewareOptions {
  enableMetrics?: boolean;
  enableRateLimit?: boolean;
  enableCors?: boolean;
  enableRequestLogging?: boolean;
  timeout?: number;
}

/**
 * Default middleware options
 */
const defaultOptions: ApiErrorMiddlewareOptions = {
  enableMetrics: true,
  enableRateLimit: false,
  enableCors: true,
  enableRequestLogging: process.env.NODE_ENV === "development",
  timeout: 30000, // 30 seconds
};

/**
 * Extract request context for error handling
 */
function extractRequestContext(
  request: NextRequest,
  params?: Record<string, string>
): StandardizedErrorContext {
  const url = new URL(request.url);
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();

  return {
    requestId,
    userId: request.headers.get("x-user-id") || undefined,
    sessionId: request.cookies.get("session-id")?.value || undefined,
    operation: `${request.method} ${url.pathname}`,
    resource: url.pathname,
    timestamp: new Date().toISOString(),
    additionalData: {
      method: request.method,
      url: url.href,
      userAgent: request.headers.get("user-agent") || undefined,
      params,
      query: Object.fromEntries(url.searchParams),
    },
  };
}

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response: NextResponse): void {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, X-Request-ID"
  );
}

/**
 * Create standardized error response
 */
function createErrorResponse<T>(error: unknown, context: StandardizedErrorContext): NextResponse {
  const apiResponse = handleApiError<T>(error, context);

  const response = NextResponse.json(apiResponse, {
    status: apiResponse.metadata?.statusCode || 500,
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": context.requestId || "",
      "X-Error-Code": apiResponse.metadata?.errorCode || "",
    },
  });

  return response;
}

/**
 * Timeout wrapper for API handlers
 */
function withTimeout<T>(handler: ApiHandler<T>, timeoutMs: number): ApiHandler<T> {
  return async (request, context) => {
    return Promise.race([
      handler(request, context),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  };
}

/**
 * Main API error middleware wrapper
 */
export function withApiErrorHandling<T = any>(
  handler: ApiHandler<T>,
  options: ApiErrorMiddlewareOptions = {}
): ApiHandler<T> {
  const config = { ...defaultOptions, ...options };

  return async (request: NextRequest, context) => {
    const startTime = performance.now();
    let requestContext: StandardizedErrorContext;

    try {
      // Extract request context
      requestContext = extractRequestContext(request, context?.params);

      // Log request if enabled
      if (config.enableRequestLogging) {
        logger.info("API request started", {
          method: request.method,
          url: request.url,
          requestId: requestContext.requestId,
        });
      }

      // Handle OPTIONS requests for CORS
      if (request.method === "OPTIONS") {
        const response = new NextResponse(null, { status: 200 });
        if (config.enableCors) {
          addCorsHeaders(response);
        }
        return response;
      }

      // Create handler with timeout if specified
      const handlerWithTimeout = config.timeout ? withTimeout(handler, config.timeout) : handler;

      // Execute the handler
      const result = await handlerWithTimeout(request, context);

      // Handle different response types
      let response: NextResponse;

      if (result instanceof NextResponse) {
        response = result;
      } else {
        // Convert ApiResponse to NextResponse
        response = NextResponse.json(result, {
          status: result.metadata?.statusCode || (result.success ? 200 : 500),
          headers: {
            "Content-Type": "application/json",
            "X-Request-ID": requestContext.requestId,
          },
        });
      }

      // Add CORS headers if enabled
      if (config.enableCors) {
        addCorsHeaders(response);
      }

      // Log successful request
      const duration = performance.now() - startTime;
      logger.info("API request completed", {
        method: request.method,
        url: request.url,
        requestId: requestContext.requestId,
        statusCode: response.status,
        duration: `${duration.toFixed(2)}ms`,
      });

      return response;
    } catch (error) {
      // Ensure we have request context even if extraction failed
      if (!requestContext!) {
        requestContext = {
          requestId: crypto.randomUUID(),
          operation: `${request.method} ${request.url}`,
          resource: new URL(request.url).pathname,
          timestamp: new Date().toISOString(),
          additionalData: {
            method: request.method,
            url: request.url,
          },
        };
      }

      // Create standardized error response
      const errorResponse = createErrorResponse(error, requestContext);

      // Add CORS headers if enabled
      if (config.enableCors) {
        addCorsHeaders(errorResponse);
      }

      // Log error details
      const duration = performance.now() - startTime;
      logger.error(
        "API request failed",
        {
          method: request.method,
          url: request.url,
          requestId: requestContext.requestId,
          statusCode: errorResponse.status,
          duration: `${duration.toFixed(2)}ms`,
          error: error instanceof Error ? error.message : String(error),
        },
        error instanceof Error ? error : new Error(String(error))
      );

      return errorResponse;
    }
  };
}

/**
 * Specialized middleware for different API route types
 */

/**
 * Public API routes (no authentication required)
 */
export function withPublicApiErrorHandling<T = any>(handler: ApiHandler<T>): ApiHandler<T> {
  return withApiErrorHandling(handler, {
    enableMetrics: true,
    enableCors: true,
    enableRequestLogging: true,
  });
}

/**
 * Protected API routes (authentication required)
 */
export function withProtectedApiErrorHandling<T = any>(handler: ApiHandler<T>): ApiHandler<T> {
  return withApiErrorHandling(handler, {
    enableMetrics: true,
    enableCors: true,
    enableRequestLogging: true,
    enableRateLimit: true,
  });
}

/**
 * Internal API routes (service-to-service)
 */
export function withInternalApiErrorHandling<T = any>(handler: ApiHandler<T>): ApiHandler<T> {
  return withApiErrorHandling(handler, {
    enableMetrics: true,
    enableCors: false,
    enableRequestLogging: false,
    timeout: 60000, // Longer timeout for internal calls
  });
}

/**
 * High-performance API routes (minimal overhead)
 */
export function withHighPerformanceApiErrorHandling<T = any>(
  handler: ApiHandler<T>
): ApiHandler<T> {
  return withApiErrorHandling(handler, {
    enableMetrics: false,
    enableCors: true,
    enableRequestLogging: false,
    timeout: 5000, // Shorter timeout for performance
  });
}

/**
 * Webhook API routes (external integrations)
 */
export function withWebhookApiErrorHandling<T = any>(handler: ApiHandler<T>): ApiHandler<T> {
  return withApiErrorHandling(handler, {
    enableMetrics: true,
    enableCors: false,
    enableRequestLogging: true,
    timeout: 10000,
  });
}

/**
 * Utility function to validate request methods
 */
export function withMethodValidation(
  allowedMethods: string[]
): (handler: ApiHandler) => ApiHandler {
  return (handler: ApiHandler) => {
    return withApiErrorHandling(async (request, context) => {
      if (!allowedMethods.includes(request.method)) {
        throw new Error(`Method ${request.method} not allowed`);
      }
      return handler(request, context);
    });
  };
}

/**
 * Utility function to validate content type
 */
export function withContentTypeValidation(
  requiredContentType: string
): (handler: ApiHandler) => ApiHandler {
  return (handler: ApiHandler) => {
    return withApiErrorHandling(async (request, context) => {
      const contentType = request.headers.get("content-type");

      if (
        request.method !== "GET" &&
        request.method !== "DELETE" &&
        !contentType?.includes(requiredContentType)
      ) {
        throw new Error(`Content-Type must be ${requiredContentType}`);
      }

      return handler(request, context);
    });
  };
}

/**
 * Compose multiple middleware functions
 */
export function composeApiMiddleware<T = any>(
  ...middlewares: Array<(handler: ApiHandler<T>) => ApiHandler<T>>
): (handler: ApiHandler<T>) => ApiHandler<T> {
  return (handler: ApiHandler<T>) => {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
  };
}

/**
 * Example usage patterns
 */

// Basic usage
// export const GET = withPublicApiErrorHandling(async (request) => {
//   // Your handler logic
// });

// With method validation
// export const POST = composeApiMiddleware(
//   withMethodValidation(["POST"]),
//   withContentTypeValidation("application/json"),
//   withProtectedApiErrorHandling
// )(async (request) => {
//   // Your handler logic
// });

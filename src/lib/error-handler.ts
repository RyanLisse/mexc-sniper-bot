/**
* Centralized Error Handler for API Routes
 *
 * This module provides error handling middleware and utilities for
 * consistent error responses across all API endpoints.
 */

import type { NextResponse } from "next/server";
import { apiResponse, createErrorResponse, HTTP_STATUS } from "./api-response";
import { ensureError } from "./error-type-utils";
import {
  isApplicationError,
  isOperationalError,
  isRateLimitError,
  isValidationError,
} from "./errors";

/**
 * Error logger interface
 */
interface ErrorLogger {
  error(message: string, error: Error, context?: Record<string, unknown>): void;
  warn(message: string, error: Error, context?: Record<string, unknown>): void;
}

/**
 * Default console error logger
 */
const defaultErrorLogger: ErrorLogger = {
  error: (message, error, context) => {
    console.error(`[ERROR] ${message}`, {
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    });
  },
  warn: (message, error, context) => {
    console.warn(`[WARN] ${message}`, {
      error: error.message,
      context,
      timestamp: new Date().toISOString(),
    });
  },
};

/**
 * Global error logger instance
 */
let errorLogger: ErrorLogger = defaultErrorLogger;

/**
 * Set custom error logger
 */
export function setErrorLogger(logger: any) {
  // Logger setter implementation
}
/**
 * Error context builder
 */
export class ErrorContext {
  private _logger?: ReturnType<typeof createSafeLogger>;
  private get logger() {
    if (!this._logger) {
      this._logger = {
      info: (message: string, context?: any) => console.info('[error-handler]', message, context || ''),
      warn: (message: string, context?: any) => console.warn('[error-handler]', message, context || ''),
      error: (message: string, context?: any, error?: Error) => console.error('[error-handler]', message, context || '', error || ''),
      debug: (message: string, context?: any) => console.debug('[error-handler]', message, context || ''),
    };
    }
    return this._logger;
  }

  private context: Record<string, unknown> = {};

  add(key: string, value: unknown): ErrorContext {
    this.context[key] = value;
    return this;
  }

  addUser(userId: string): ErrorContext {
    return this.add("userId", userId);
  }

  addRequest(req: Request): ErrorContext {
    return this.add("request", {
      url: req.url,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
    });
  }

  addOperation(operation: string): ErrorContext {
    return this.add("operation", operation);
  }

  build(): Record<string, unknown> {
    return { ...this.context };
  }
}

/**
 * Handle API errors and return appropriate response
 */
export function handleApiError(error: unknown, context?: Record<string, unknown>): NextResponse {
  // Handle known application errors
  if (isApplicationError(error)) {
    const logContext = {
      ...error.context,
      ...context,
      errorCode: error.code,
      statusCode: error.statusCode,
    };

    // Log based on error type
    if (error.isOperational) {
      errorLogger.warn(`Operational error: ${error.message}`, error, logContext);
    } else {
      errorLogger.error(`System error: ${error.message}`, error, logContext);
    }

    // Create appropriate response
    const response = createErrorResponse(error.getUserMessage(), {
      code: error.code,
      timestamp: error.timestamp.toISOString(),
      ...(isValidationError(error) && error.field ? { field: error.field } : {}),
      ...(isRateLimitError(error) ? { retryAfter: error.retryAfter } : {}),
    });

    return apiResponse(response, error.statusCode);
  }

  // Handle standard errors
  const safeError = ensureError(error);
  if (error instanceof Error) {
    errorLogger.error(`Unhandled error: ${safeError.message}`, safeError, context);

    // Check for specific error patterns
    if (safeError.message.includes("ECONNREFUSED")) {
      return apiResponse(
        createErrorResponse("Service temporarily unavailable", {
          code: "SERVICE_UNAVAILABLE",
        }),
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    if (safeError.message.includes("timeout")) {
      return apiResponse(
        createErrorResponse("Request timeout", {
          code: "TIMEOUT_ERROR",
        }),
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    // Generic error response
    return apiResponse(
      createErrorResponse("An unexpected error occurred", {
        code: "INTERNAL_ERROR",
      }),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }

  // Handle unknown errors
  const fallbackError = safeError || ensureError(error);
  errorLogger.error("Unknown error type", fallbackError, {
    originalError: error,
    context,
  });

  return apiResponse(
    createErrorResponse("An unexpected error occurred", {
      code: "UNKNOWN_ERROR",
    }),
    HTTP_STATUS.INTERNAL_SERVER_ERROR
  );
}

/**
 * Async error wrapper for API route handlers
 */
export function asyncHandler<T extends any[], R>(
  handler: (...args: T) => Promise<R>
): (...args: T) => Promise<R | NextResponse> {
  return async (...args: T) => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

/**
 * Error wrapper with context
 */
export function withErrorContext<T extends any[], R>(
  handler: (...args: T) => Promise<R>,
  contextBuilder: (...args: T) => Record<string, unknown>
): (...args: T) => Promise<R | NextResponse> {
  return async (...args: T) => {
    try {
      return await handler(...args);
    } catch (error) {
      const context = contextBuilder(...args);
      return handleApiError(error, context);
    }
  };
}

/**
 * Validate and handle errors in a safe way
 */
export async function safeExecute<T>(
  operation: () => Promise<T>,
  operationName: string,
  context?: Record<string, unknown>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const enrichedContext = {
      ...context,
      operation: operationName,
      timestamp: new Date().toISOString(),
    };

    const errorToLog = ensureError(error);
    if (isOperationalError(error)) {
      errorLogger.warn(`Operation failed: ${operationName}`, errorToLog, enrichedContext);
    } else {
      errorLogger.error(`System failure in: ${operationName}`, errorToLog, enrichedContext);
    }

    throw error;
  }
}

/**
 * Error recovery strategies
 */
export interface ErrorRecoveryStrategy<T> {
  shouldRecover(error: unknown, attempt: number): boolean;
  recover(error: unknown): T | Promise<T>;
}

/**
 * Execute with error recovery
 */
export async function executeWithRecovery<T>(
  operation: () => Promise<T>,
  recovery: ErrorRecoveryStrategy<T>,
  maxAttempts = 3
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (recovery.shouldRecover(error, attempt) && attempt < maxAttempts) {
        try {
          return await recovery.recover(error);
        } catch (recoveryError) {
          // Recovery failed, will retry main operation
          lastError = recoveryError;
        }
      }
    }
  }

  throw lastError;
}

/**
 * Create standard error responses for common scenarios
 */
export const StandardErrors = {
  unauthorized: () =>
    apiResponse(
      createErrorResponse("Authentication required", {
        code: "AUTHENTICATION_ERROR",
      }),
      HTTP_STATUS.UNAUTHORIZED
    ),

  forbidden: () =>
    apiResponse(
      createErrorResponse("Access denied", {
        code: "AUTHORIZATION_ERROR",
      }),
      HTTP_STATUS.FORBIDDEN
    ),

  notFound: (resource: string) =>
    apiResponse(
      createErrorResponse(`${resource} not found`, {
        code: "NOT_FOUND_ERROR",
        resource,
      }),
      HTTP_STATUS.NOT_FOUND
    ),

  badRequest: (message: string) =>
    apiResponse(
      createErrorResponse(message, {
        code: "BAD_REQUEST",
      }),
      HTTP_STATUS.BAD_REQUEST
    ),

  validationError: (field: string, message: string) =>
    apiResponse(
      createErrorResponse(`Validation error: ${message}`, {
        code: "VALIDATION_ERROR",
        field,
      }),
      HTTP_STATUS.BAD_REQUEST
    ),

  conflict: (message: string) =>
    apiResponse(
      createErrorResponse(message, {
        code: "CONFLICT_ERROR",
      }),
      HTTP_STATUS.CONFLICT
    ),

  tooManyRequests: (retryAfter: number) =>
    apiResponse(
      createErrorResponse("Too many requests", {
        code: "RATE_LIMIT_ERROR",
        retryAfter,
      }),
      HTTP_STATUS.TOO_MANY_REQUESTS
    ),
} as const;

/**
 * Error metrics collector
 */
export class ErrorMetrics {
  private metrics = new Map<string, number>();

  record(errorCode: string): void {
    const count = this.metrics.get(errorCode) || 0;
    this.metrics.set(errorCode, count + 1);
  }

  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  reset(): void {
    this.metrics.clear();
  }
}

// Global error metrics instance
export const errorMetrics = new ErrorMetrics();

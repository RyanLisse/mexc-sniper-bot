/**
import { createLogger } from './structured-logger';
 * Unified Error Handler for MEXC Sniper Bot
 *
 * This module consolidates all error handling approaches (error-handler.ts, error-utils.ts, errors.ts)
 * into a single comprehensive error handling system for consistent error responses across all API endpoints.
 *
 * Features:
 * - Comprehensive error classification
 * - Retry logic with exponential backoff
 * - Error metrics collection
 * - Standardized API responses
 * - Middleware factory for different contexts
 */

import type { NextResponse } from "next/server";
import { apiResponse, createErrorResponse, HTTP_STATUS } from "./api-response";
import {
  ApiError,
  ApplicationError,
  AuthenticationError,
  AuthorizationError,
  BusinessLogicError,
  ConfigurationError,
  ConflictError,
  DatabaseError,
  isApiError,
  isApplicationError,
  isAuthenticationError,
  isAuthorizationError,
  isBusinessLogicError,
  isDatabaseError,
  isNotFoundError,
  isOperationalError,
  isRateLimitError,
  isTradingError,
  isValidationError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
  TradingError,
  ValidationError,
} from "./errors";

// ============================================================================
// Error Logger Interface
// ============================================================================

interface ErrorLogger {
  error(message: string, error: Error, context?: Record<string, unknown>): void;
  warn(message: string, error: Error, context?: Record<string, unknown>): void;
  info(message: string, error: Error, context?: Record<string, unknown>): void;
}

const defaultErrorLogger: ErrorLogger = {
  error: (message, error, context) => {
    logger.error(`[ERROR] ${message}`, {
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    });
  },
  warn: (message, error, context) => {
    logger.warn(`[WARN] ${message}`, {
      error: error.message,
      context,
      timestamp: new Date().toISOString(),
    });
  },
  info: (message, error, context) => {
    logger.info(`[INFO] ${message}`, {
      error: error.message,
      context,
      timestamp: new Date().toISOString(),
    });
  },
};

let errorLogger: ErrorLogger = defaultErrorLogger;

export function setErrorLogger(logger: ErrorLogger) {
  errorLogger = logger;
}

// ============================================================================
// Error Classification System
// ============================================================================

export class ErrorClassifier {
  private logger = createLogger("unified-error-handler");

  /**
   * Checks if error is a timeout error
   */
  static isTimeout(error: unknown): boolean {
    return (
      error instanceof TimeoutError ||
      (error instanceof Error &&
        (error.name === "AbortError" ||
          error.message.toLowerCase().includes("timeout") ||
          error.message.toLowerCase().includes("timed out")))
    );
  }

  /**
   * Checks if error is a connection error
   */
  static isConnection(error: unknown): boolean {
    return (
      error instanceof NetworkError ||
      (error instanceof Error &&
        (error.message.includes("fetch failed") ||
          error.message.includes("ECONNRESET") ||
          error.message.includes("ENOTFOUND") ||
          error.message.includes("ETIMEDOUT") ||
          error.message.includes("ECONNREFUSED") ||
          error.message.includes("network")))
    );
  }

  /**
   * Checks if error is retryable (timeout or connection)
   */
  static isRetryable(error: unknown): boolean {
    return ErrorClassifier.isTimeout(error) || ErrorClassifier.isConnection(error);
  }

  /**
   * Gets the error type category
   */
  static getErrorType(error: unknown): string {
    if (ErrorClassifier.isTimeout(error)) return "timeout";
    if (ErrorClassifier.isConnection(error)) return "connection";
    if (isAuthenticationError(error)) return "auth";
    if (isRateLimitError(error)) return "rate_limit";
    if (isValidationError(error)) return "validation";
    if (isDatabaseError(error)) return "database";
    if (isApiError(error)) return "api";
    if (isTradingError(error)) return "trading";
    if (isBusinessLogicError(error)) return "business_logic";
    return "unknown";
  }

  /**
   * Determines if error should be retried
   */
  static shouldRetry(error: unknown, attempt: number, maxRetries: number): boolean {
    if (attempt >= maxRetries) return false;
    return ErrorClassifier.isRetryable(error);
  }

  /**
   * Calculates retry delay with exponential backoff
   */
  static getRetryDelay(attempt: number, baseDelay = 1000, maxDelay = 30000): number {
    const exponentialDelay = baseDelay * 2 ** (attempt - 1);
    const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
    return Math.min(exponentialDelay + jitter, maxDelay);
  }
}

// ============================================================================
// Retry Handler
// ============================================================================

export class RetryHandler {
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (!ErrorClassifier.shouldRetry(error, attempt, maxRetries)) {
          throw error;
        }

        if (attempt < maxRetries) {
          const delay = ErrorClassifier.getRetryDelay(attempt, baseDelay);
          logger.info(
            `Retry attempt ${attempt}/${maxRetries} failed, retrying in ${Math.round(delay)}ms:`,
            error instanceof Error ? error.message : error
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}

// ============================================================================
// Error Collection for Batch Operations
// ============================================================================

export class ErrorCollector {
  private errors: Array<{ field?: string; message: string }> = [];

  add(message: string, field?: string): void {
    this.errors.push({ field, message });
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  getErrors(): Record<string, string[]> {
    const grouped: Record<string, string[]> = {};

    for (const error of this.errors) {
      const key = error.field || "general";
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(error.message);
    }

    return grouped;
  }

  getFirstError(): string | null {
    return this.errors.length > 0 ? this.errors[0].message : null;
  }

  throwIfErrors(): void {
    if (this.hasErrors()) {
      const firstError = this.getFirstError();
      throw new ValidationError(firstError || "Validation failed");
    }
  }
}

// ============================================================================
// Error Metrics
// ============================================================================

export class ErrorMetrics {
  private metrics = new Map<string, number>();
  private timestamps = new Map<string, number[]>();

  record(errorCode: string): void {
    const count = this.metrics.get(errorCode) || 0;
    this.metrics.set(errorCode, count + 1);

    // Track timestamps for rate analysis
    const now = Date.now();
    const times = this.timestamps.get(errorCode) || [];
    times.push(now);

    // Keep only last hour of timestamps
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentTimes = times.filter((time) => time > oneHourAgo);
    this.timestamps.set(errorCode, recentTimes);
  }

  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  getErrorRate(errorCode: string, windowMs = 60 * 60 * 1000): number {
    const times = this.timestamps.get(errorCode) || [];
    const now = Date.now();
    const windowStart = now - windowMs;
    const recentErrors = times.filter((time) => time > windowStart);
    return recentErrors.length / (windowMs / 1000); // errors per second
  }

  reset(): void {
    this.metrics.clear();
    this.timestamps.clear();
  }

  getTopErrors(limit = 10): Array<{ code: string; count: number; rate: number }> {
    return Array.from(this.metrics.entries())
      .map(([code, count]) => ({
        code,
        count,
        rate: this.getErrorRate(code),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}

export const errorMetrics = new ErrorMetrics();

// ============================================================================
// Error Context Builder
// ============================================================================

export class ErrorContext {
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

// ============================================================================
// Enhanced API Error Handler
// ============================================================================

export function handleApiError(error: unknown, context?: Record<string, unknown>): NextResponse {
  // Record error metrics
  const errorType = ErrorClassifier.getErrorType(error);
  errorMetrics.record(errorType);

  // Handle known application errors
  if (isApplicationError(error)) {
    const logContext = {
      ...error.context,
      ...context,
      errorCode: error.code,
      statusCode: error.statusCode,
      errorType,
    };

    // Log based on error type
    if (error.isOperational) {
      errorLogger.warn(`Operational error: ${error.message}`, error, logContext);
    } else {
      errorLogger.error(`System error: ${error.message}`, error, logContext);
    }

    // Create appropriate response with enhanced metadata
    const response = createErrorResponse(error.getUserMessage(), {
      code: error.code,
      timestamp: error.timestamp.toISOString(),
      errorType,
      ...(isValidationError(error) && error.field ? { field: error.field } : {}),
      ...(isRateLimitError(error) ? { retryAfter: error.retryAfter } : {}),
      ...(isApiError(error) ? { apiName: error.apiName, apiStatusCode: error.apiStatusCode } : {}),
      ...(isDatabaseError(error) ? { query: error.query } : {}),
      ...(isNotFoundError(error)
        ? { resourceType: error.resourceType, resourceId: error.resourceId }
        : {}),
    });

    return apiResponse(response, error.statusCode);
  }

  // Handle standard errors with enhanced classification
  if (error instanceof Error) {
    errorLogger.error(`Unhandled error (${errorType}): ${error.message}`, error, {
      ...context,
      errorType,
    });

    // Enhanced error pattern detection
    if (ErrorClassifier.isConnection(error)) {
      return apiResponse(
        createErrorResponse("Service temporarily unavailable", {
          code: "NETWORK_ERROR",
          errorType: "connection",
        }),
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    if (ErrorClassifier.isTimeout(error)) {
      return apiResponse(
        createErrorResponse("Request timeout", {
          code: "TIMEOUT_ERROR",
          errorType: "timeout",
        }),
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    // Database specific errors
    if (
      error.message.includes("database") ||
      error.message.includes("sql") ||
      error.message.includes("query")
    ) {
      return apiResponse(
        createErrorResponse("Database error occurred", {
          code: "DATABASE_ERROR",
          errorType: "database",
        }),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    // Generic error response
    return apiResponse(
      createErrorResponse("An unexpected error occurred", {
        code: "INTERNAL_ERROR",
        errorType,
      }),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }

  // Handle unknown errors
  errorLogger.error("Unknown error type", new Error("Unknown error"), {
    error,
    context,
    errorType: "unknown",
  });

  errorMetrics.record("unknown");

  return apiResponse(
    createErrorResponse("An unexpected error occurred", {
      code: "UNKNOWN_ERROR",
      errorType: "unknown",
    }),
    HTTP_STATUS.INTERNAL_SERVER_ERROR
  );
}

// ============================================================================
// Standard Error Responses
// ============================================================================

export const StandardErrors = {
  unauthorized: (message?: string) => {
    const error = new AuthenticationError(message);
    return handleApiError(error);
  },

  forbidden: (message?: string) => {
    const error = new AuthorizationError(message);
    return handleApiError(error);
  },

  notFound: (resourceType: string, resourceId?: string) => {
    const error = new NotFoundError(resourceType, resourceId);
    return handleApiError(error);
  },

  badRequest: (message: string, details?: any) => {
    const error = new ValidationError(message, undefined, undefined, details);
    return handleApiError(error);
  },

  validationError: (field: string, message: string, value?: unknown) => {
    const error = new ValidationError(message, field, value);
    return handleApiError(error);
  },

  conflict: (message: string, conflictType?: string) => {
    const error = new ConflictError(message, conflictType || "resource_conflict");
    return handleApiError(error);
  },

  tooManyRequests: (retryAfter: number, limit?: number) => {
    const error = new RateLimitError(retryAfter, limit || 100);
    return handleApiError(error);
  },

  serviceUnavailable: (serviceName: string, reason?: string) => {
    const error = new NetworkError(
      reason || `${serviceName} is temporarily unavailable`,
      serviceName
    );
    return handleApiError(error);
  },

  configurationError: (configKey: string, message?: string) => {
    const error = new ConfigurationError(configKey, message);
    return handleApiError(error);
  },
} as const;

// ============================================================================
// Error Middleware Factory
// ============================================================================

export function createErrorMiddleware(
  options: {
    enableRetry?: boolean;
    maxRetries?: number;
    enableMetrics?: boolean;
    logLevel?: "error" | "warn" | "info";
  } = {}
) {
  const { enableRetry = false, maxRetries = 3, enableMetrics = true, logLevel = "error" } = options;

  return {
    /**
     * Wrap an async function with error handling
     */
    wrapAsync: <T extends any[], R>(
      fn: (...args: T) => Promise<R>
    ): ((...args: T) => Promise<R | NextResponse>) => {
      return async (...args: T) => {
        try {
          if (enableRetry) {
            return await RetryHandler.withRetry(() => fn(...args), maxRetries);
          }
          return await fn(...args);
        } catch (error) {
          if (enableMetrics) {
            errorMetrics.record(ErrorClassifier.getErrorType(error));
          }
          return handleApiError(error, { function: fn.name, args: args.length });
        }
      };
    },

    /**
     * Safe execution with error collection
     */
    safeExecute: async <T>(
      operation: () => Promise<T>,
      operationName: string,
      context?: Record<string, unknown>
    ): Promise<T> => {
      try {
        return await operation();
      } catch (error) {
        const enrichedContext = {
          ...context,
          operation: operationName,
          timestamp: new Date().toISOString(),
        };

        if (isOperationalError(error)) {
          if (logLevel === "warn" || logLevel === "info") {
            errorLogger.warn(`Operation failed: ${operationName}`, error as Error, enrichedContext);
          }
        } else {
          errorLogger.error(`System failure in: ${operationName}`, error as Error, enrichedContext);
        }

        if (enableMetrics) {
          errorMetrics.record(ErrorClassifier.getErrorType(error));
        }

        throw error;
      }
    },

    /**
     * Batch error handling for multiple operations
     */
    handleBatch: async <T>(
      operations: Array<() => Promise<T>>,
      continueOnError = false
    ): Promise<Array<T | Error>> => {
      const results: Array<T | Error> = [];
      const collector = new ErrorCollector();

      for (let i = 0; i < operations.length; i++) {
        try {
          const result = await operations[i]();
          results.push(result);
        } catch (error) {
          if (enableMetrics) {
            errorMetrics.record(ErrorClassifier.getErrorType(error));
          }

          collector.add(error instanceof Error ? error.message : String(error), `operation_${i}`);

          results.push(error as Error);

          if (!continueOnError) {
            break;
          }
        }
      }

      return results;
    },
  };
}

// Default error middleware instance
export const defaultErrorMiddleware = createErrorMiddleware();

// ============================================================================
// Async Wrapper Utilities
// ============================================================================

export function asyncHandler<T extends any[], R>(
  handler: (...args: T) => Promise<R>
): (...args: T) => Promise<R | NextResponse> {
  return defaultErrorMiddleware.wrapAsync(handler);
}

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

export async function safeExecute<T>(
  operation: () => Promise<T>,
  operationName: string,
  context?: Record<string, unknown>
): Promise<T> {
  return defaultErrorMiddleware.safeExecute(operation, operationName, context);
}

// ============================================================================
// Error Recovery Strategies
// ============================================================================

export interface ErrorRecoveryStrategy<T> {
  shouldRecover(error: unknown, attempt: number): boolean;
  recover(error: unknown): T | Promise<T>;
}

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

// ============================================================================
// Exports
// ============================================================================

// Re-export error classes for convenience
export {
  ApplicationError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ApiError,
  RateLimitError,
  DatabaseError,
  NotFoundError,
  ConflictError,
  BusinessLogicError,
  TradingError,
  ConfigurationError,
  TimeoutError,
  NetworkError,
  // Type guards
  isApplicationError,
  isValidationError,
  isAuthenticationError,
  isAuthorizationError,
  isApiError,
  isRateLimitError,
  isDatabaseError,
  isNotFoundError,
  isBusinessLogicError,
  isTradingError,
  isOperationalError,
};

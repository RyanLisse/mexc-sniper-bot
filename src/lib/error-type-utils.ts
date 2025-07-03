/**
 * Error Type Utilities
 *
 * Provides consistent error handling patterns for unknown error types.
 * Ensures proper Error type casting and safe property access.
 *
 * USAGE PATTERNS:
 * - Replace `error instanceof Error ? error.message : String(error)` with `getErrorMessage(error)`
 * - Replace `error instanceof Error ? error : new Error(String(error))` with `ensureError(error)`
 * - Use `toSafeError(error)` for logging and metadata extraction
 * - Use `withErrorLogging(fn, context)` for consistent async error handling
 */

export interface SafeError {
  name: string;
  message: string;
  stack?: string;
  cause?: unknown;
  [key: string]: unknown;
}

/**
 * Safely converts unknown error to Error object with proper typing
 */
// Lazy logger initialization to prevent build-time errors
let _logger: any = null;

export function getLogger() {
  if (!_logger) {
    _logger = {
      info: (message: string, context?: any) =>
        console.info("[error-type-utils]", message, context || ""),
      warn: (message: string, context?: any) =>
        console.warn("[error-type-utils]", message, context || ""),
      error: (message: string, context?: any, error?: Error) =>
        console.error(
          "[error-type-utils]",
          message,
          context || "",
          error || ""
        ),
      debug: (message: string, context?: any) =>
        console.debug("[error-type-utils]", message, context || ""),
    };
  }
  return _logger;
}

export function toSafeError(error: unknown): SafeError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    };
  }

  if (typeof error === "string") {
    return {
      name: "Error",
      message: error,
    };
  }

  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    return {
      name: typeof obj.name === "string" ? obj.name : "Error",
      message: typeof obj.message === "string" ? obj.message : String(error),
      stack: typeof obj.stack === "string" ? obj.stack : undefined,
      cause: obj.cause,
    };
  }

  return {
    name: "Error",
    message: String(error),
  };
}

/**
 * Safely extracts error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === "string") {
      return obj.message;
    }
  }

  return String(error);
}

/**
 * Safely extracts error stack from unknown error
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }

  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    if (typeof obj.stack === "string") {
      return obj.stack;
    }
  }

  return undefined;
}

/**
 * Creates a proper Error object from unknown error
 */
export function ensureError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  const safeError = toSafeError(error);
  const newError = new Error(safeError.message);
  newError.name = safeError.name;
  if (safeError.stack) {
    newError.stack = safeError.stack;
  }
  if (safeError.cause !== undefined) {
    newError.cause = safeError.cause;
  }

  return newError;
}

/**
 * Enhanced error details for logging and debugging
 */
export function getErrorDetails(error: unknown): {
  name: string;
  message: string;
  stack?: string;
  type: string;
  isError: boolean;
} {
  const safeError = toSafeError(error);

  return {
    name: safeError.name,
    message: safeError.message,
    stack: safeError.stack,
    type: typeof error,
    isError: error instanceof Error,
  };
}

/**
 * Wraps async functions with proper error handling
 */
export function wrapAsyncErrors<T extends (...args: any[]) => Promise<any>>(
  fn: T
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw ensureError(error);
    }
  }) as T;
}

/**
 * Creates error handler function for consistent catch block handling
 */
export function createErrorHandler(context: string) {
  return (error: unknown): SafeError => {
    const safeError = toSafeError(error);

    // Add context to error message if not already present
    if (!safeError.message.includes(context)) {
      safeError.message = `${context}: ${safeError.message}`;
    }

    return safeError;
  };
}

/**
 * Enhanced error wrapper that provides consistent logging patterns
 */
export function withErrorLogging<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: string,
  logger?: {
    error: (
      message: string,
      error: SafeError,
      context?: Record<string, unknown>
    ) => void;
  }
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      const safeError = toSafeError(error);

      if (logger) {
        getLogger().error(`${context} failed`, safeError, {
          operation: context,
          timestamp: new Date().toISOString(),
          args: args.length,
        });
      } else {
        getLogger().error(`[${context}] Error:`, safeError.message, {
          stack: safeError.stack,
          timestamp: new Date().toISOString(),
        });
      }

      throw ensureError(error);
    }
  }) as T;
}

/**
 * Standardized catch block helper for consistent error handling
 */
export function standardCatch(context: string, operation?: string) {
  return (error: unknown) => {
    const safeError = toSafeError(error);
    const fullContext = operation ? `${context}.${operation}` : context;

    getLogger().error(`[${fullContext}] Error:`, {
      message: safeError.message,
      name: safeError.name,
      stack: safeError.stack,
      timestamp: new Date().toISOString(),
    });

    throw ensureError(error);
  };
}

/**
 * Type guard for checking if value is a proper Error object
 */
export function isProperError(value: unknown): value is Error {
  return value instanceof Error && typeof value.message === "string";
}

/**
 * Normalizes error-like objects to consistent format
 */
export function normalizeErrorLike(errorLike: unknown): SafeError {
  if (isProperError(errorLike)) {
    return toSafeError(errorLike);
  }

  if (typeof errorLike === "object" && errorLike !== null) {
    const obj = errorLike as Record<string, unknown>;

    // Check for common error-like patterns
    if ("error" in obj && typeof obj.error === "string") {
      return {
        name: "ServiceError",
        message: obj.error,
        cause: errorLike,
      };
    }

    if ("message" in obj && typeof obj.message === "string") {
      return toSafeError(errorLike);
    }
  }

  return toSafeError(errorLike);
}

/**
 * Additional type guards for error classification
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("network") ||
      message.includes("connection") ||
      message.includes("timeout") ||
      message.includes("fetch") ||
      error.name === "NetworkError"
    );
  }
  return false;
}

export function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("timed out") ||
      error.name === "TimeoutError"
    );
  }
  return false;
}

export function isServerError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("server error") ||
      message.includes("internal server") ||
      message.includes("500") ||
      error.name === "ServerError"
    );
  }
  return false;
}

// Legacy alias for SafeError
export type SafeErrorResult = SafeError;

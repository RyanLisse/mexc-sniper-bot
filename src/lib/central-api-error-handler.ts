import type { NextRequest, NextResponse } from "next/server";
import { apiResponse, createErrorResponse, HTTP_STATUS } from "./api-response";

export interface ApiError extends Error {
  code?: string;
  status?: number;
  retryable?: boolean;
  details?: any;
  recoveryAction?: () => Promise<void>;
  fallbackData?: any;
}

export interface ErrorContext {
  component?: string;
  operation?: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  performance?: {
    startTime: number;
    duration?: number;
  };
}

export interface RecoveryStrategy {
  name: string;
  execute: () => Promise<any>;
  priority: number;
  timeout: number;
}

export class DatabaseConnectionError extends Error {
  constructor(
    message: string,
    public originalError?: Error,
    public recoveryStrategies: RecoveryStrategy[] = []
  ) {
    super(message);
    this.name = "DatabaseConnectionError";
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public details?: any,
    public fallbackValue?: any
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class StructuredLogger {
  private static instance: StructuredLogger;

  static getInstance(): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger();
    }
    return StructuredLogger.instance;
  }

  private formatLogEntry(level: string, message: string, context?: ErrorContext, error?: Error) {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      component: context?.component || "unknown",
      operation: context?.operation || "unknown",
      userId: context?.userId,
      requestId: context?.requestId,
      metadata: context?.metadata,
      performance: context?.performance,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
      environment: process.env.NODE_ENV || "development",
      service: "mexc-sniper-bot",
    };
  }

  info(message: string, context?: ErrorContext): void {
    const logEntry = this.formatLogEntry("info", message, context);

    // Send to external monitoring if available
    this.sendToMonitoring(logEntry);

    // Console fallback for development
    if (process.env.NODE_ENV === "development") {
      console.info("[STRUCTURED-LOG]", JSON.stringify(logEntry, null, 2));
    }
  }

  warn(message: string, context?: ErrorContext, error?: Error): void {
    const logEntry = this.formatLogEntry("warn", message, context, error);

    this.sendToMonitoring(logEntry);

    if (process.env.NODE_ENV === "development") {
      console.warn("[STRUCTURED-LOG]", JSON.stringify(logEntry, null, 2));
    }
  }

  error(message: string, context?: ErrorContext, error?: Error): void {
    const logEntry = this.formatLogEntry("error", message, context, error);

    this.sendToMonitoring(logEntry);

    // Always log errors to console
    console.error("[STRUCTURED-LOG]", JSON.stringify(logEntry, null, 2));
  }

  private sendToMonitoring(logEntry: any): void {
    try {
      // Send to error logging service
      import("@/src/services/notification/error-logging-service")
        .then(({ errorLogger }) => {
          if (logEntry.level === "error" && logEntry.error) {
            const error = new Error(logEntry.error.message);
            error.name = logEntry.error.name;
            error.stack = logEntry.error.stack;
            errorLogger.logError(error, logEntry.metadata);
          } else if (logEntry.level === "warn") {
            errorLogger.logWarning(logEntry.message, logEntry.metadata);
          } else {
            errorLogger.logInfo(logEntry.message, logEntry.metadata);
          }
        })
        .catch(() => {
          // Fallback to console if error logging service fails
        });
    } catch {
      // Silent fallback - don't break application if logging fails
    }
  }
}

export class ErrorRecoveryManager {
  private static instance: ErrorRecoveryManager;
  private logger = StructuredLogger.getInstance();

  static getInstance(): ErrorRecoveryManager {
    if (!ErrorRecoveryManager.instance) {
      ErrorRecoveryManager.instance = new ErrorRecoveryManager();
    }
    return ErrorRecoveryManager.instance;
  }

  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    recoveryStrategies: RecoveryStrategy[],
    context: ErrorContext,
    fallbackValue?: T
  ): Promise<T> {
    const startTime = Date.now();
    const enhancedContext = {
      ...context,
      performance: { startTime },
    };

    try {
      this.logger.info(`Starting operation: ${context.operation}`, enhancedContext);
      const result = await operation();

      const duration = Date.now() - startTime;
      this.logger.info(`Operation completed successfully: ${context.operation}`, {
        ...enhancedContext,
        performance: { startTime, duration },
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Operation failed: ${context.operation}`,
        {
          ...enhancedContext,
          performance: { startTime, duration },
        },
        error as Error
      );

      // Attempt recovery strategies
      const sortedStrategies = recoveryStrategies.sort((a, b) => b.priority - a.priority);

      for (const strategy of sortedStrategies) {
        try {
          this.logger.info(`Attempting recovery strategy: ${strategy.name}`, enhancedContext);

          const recoveryResult = await Promise.race([
            strategy.execute(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Recovery timeout")), strategy.timeout)
            ),
          ]);

          this.logger.info(`Recovery strategy succeeded: ${strategy.name}`, enhancedContext);
          return recoveryResult;
        } catch (recoveryError) {
          this.logger.warn(
            `Recovery strategy failed: ${strategy.name}`,
            enhancedContext,
            recoveryError as Error
          );
        }
      }

      // If all recovery strategies fail, return fallback if available
      if (fallbackValue !== undefined) {
        this.logger.warn(
          `Using fallback value for operation: ${context.operation}`,
          enhancedContext
        );
        return fallbackValue;
      }

      // Re-throw original error if no recovery was possible
      throw error;
    }
  }
}

/**
 * Enhanced central API error handler with structured logging and recovery
 */
export function handleApiError(error: unknown, context?: ErrorContext): NextResponse {
  const logger = StructuredLogger.getInstance();
  const timestamp = new Date().toISOString();

  const errorContext: ErrorContext = {
    component: "api-error-handler",
    operation: "handle-api-error",
    ...context,
    metadata: {
      timestamp,
      ...context?.metadata,
    },
  };

  // Log error with structured logging
  logger.error("API error occurred", errorContext, error as Error);

  // Handle different error types with recovery strategies
  if (error instanceof DatabaseConnectionError) {
    return apiResponse(
      createErrorResponse("Database connectivity issue - service temporarily unavailable", {
        code: "DB_CONNECTION_ERROR",
        retryable: true,
        timestamp,
        context: errorContext,
        recoveryActions: ["retry-connection", "use-cache", "fallback-mode"],
      }),
      HTTP_STATUS.SERVICE_UNAVAILABLE
    );
  }

  if (error instanceof ValidationError) {
    return apiResponse(
      createErrorResponse(error.message, {
        code: "VALIDATION_ERROR",
        field: error.field,
        details: error.details,
        fallbackValue: error.fallbackValue,
        retryable: false,
        timestamp,
        context: errorContext,
      }),
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Handle database-related errors with enhanced pattern matching
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();

    // Database connectivity issues
    if (isDatabaseError(errorMessage)) {
      return apiResponse(
        createErrorResponse("Database connectivity issue - service temporarily unavailable", {
          code: "DB_CONNECTION_ERROR",
          retryable: true,
          timestamp,
          context: errorContext,
          originalError: error.message,
          recoveryActions: ["retry-connection", "circuit-breaker", "fallback-data"],
        }),
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    // Authentication/authorization errors
    if (isAuthError(errorMessage)) {
      return apiResponse(
        createErrorResponse("Authentication required", {
          code: "AUTH_ERROR",
          retryable: false,
          timestamp,
          context: errorContext,
          recoveryActions: ["refresh-token", "redirect-login"],
        }),
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    // Rate limiting errors
    if (isRateLimitError(errorMessage)) {
      return apiResponse(
        createErrorResponse("Rate limit exceeded - please try again later", {
          code: "RATE_LIMIT_ERROR",
          retryable: true,
          timestamp,
          context: errorContext,
          recoveryActions: ["exponential-backoff", "circuit-breaker"],
        }),
        HTTP_STATUS.TOO_MANY_REQUESTS
      );
    }
  }

  // Default internal server error
  return apiResponse(
    createErrorResponse(error instanceof Error ? error.message : "Unknown error occurred", {
      code: "INTERNAL_ERROR",
      retryable: false,
      timestamp,
      context: errorContext,
      ...(error instanceof Error && { originalError: error.message }),
      recoveryActions: ["retry", "fallback-mode"],
    }),
    HTTP_STATUS.INTERNAL_SERVER_ERROR
  );
}

// Private helper methods for error classification
function isDatabaseError(message: string): boolean {
  const dbErrorPatterns = [
    "econnrefused",
    "enotfound",
    "timeout",
    "connection",
    "database",
    "unavailable",
    "pool",
    "transaction",
    "deadlock",
    "constraint",
    "foreign key",
  ];
  return dbErrorPatterns.some((pattern) => message.includes(pattern));
}

function isAuthError(message: string): boolean {
  const authErrorPatterns = [
    "unauthorized",
    "forbidden",
    "authentication",
    "token",
    "expired",
    "invalid",
    "permission",
  ];
  return authErrorPatterns.some((pattern) => message.includes(pattern));
}

function isRateLimitError(message: string): boolean {
  const rateLimitPatterns = [
    "rate limit",
    "too many requests",
    "throttle",
    "quota",
    "limit exceeded",
  ];
  return rateLimitPatterns.some((pattern) => message.includes(pattern));
}

/**
 * Enhanced database operation wrapper with recovery strategies
 */
export async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>,
  operationName: string,
  timeout: number = 10000,
  fallbackValue?: T
): Promise<T> {
  const recoveryManager = ErrorRecoveryManager.getInstance();

  const recoveryStrategies: RecoveryStrategy[] = [
    {
      name: "retry-operation",
      execute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return await operation();
      },
      priority: 3,
      timeout: timeout,
    },
    {
      name: "circuit-breaker-fallback",
      execute: async () => {
        if (fallbackValue !== undefined) {
          return fallbackValue;
        }
        throw new Error("No fallback available");
      },
      priority: 2,
      timeout: 1000,
    },
  ];

  const context: ErrorContext = {
    component: "database-handler",
    operation: operationName,
    metadata: { timeout, hasFallback: fallbackValue !== undefined },
  };

  try {
    return await recoveryManager.executeWithRecovery(
      async () => {
        return await Promise.race([
          operation(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(new DatabaseConnectionError(`${operationName} timeout after ${timeout}ms`)),
              timeout
            )
          ),
        ]);
      },
      recoveryStrategies,
      context,
      fallbackValue
    );
  } catch (error) {
    if (error instanceof DatabaseConnectionError) {
      throw error;
    }

    // Check if this is a database connectivity error
    if (error instanceof Error && isDatabaseError(error.message.toLowerCase())) {
      throw new DatabaseConnectionError(
        `Database connectivity issue during ${operationName}`,
        error,
        recoveryStrategies
      );
    }

    // Re-throw other errors as-is
    throw error;
  }
}

/**
 * Enhanced API route wrapper with structured logging and recovery
 */
export function withApiErrorHandling(
  handler: (request: NextRequest) => Promise<NextResponse>,
  context?: Partial<ErrorContext>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const errorContext: ErrorContext = {
      component: "api-route",
      operation: context?.operation || "api-request",
      requestId,
      performance: { startTime },
      metadata: {
        url: request.url,
        method: request.method,
        ...context?.metadata,
      },
      ...context,
    };

    const logger = StructuredLogger.getInstance();

    try {
      logger.info("API request started", errorContext);

      const result = await handler(request);

      const duration = Date.now() - startTime;
      logger.info("API request completed", {
        ...errorContext,
        performance: { startTime, duration },
        metadata: {
          ...errorContext.metadata,
          statusCode: result.status,
        },
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        "API request failed",
        {
          ...errorContext,
          performance: { startTime, duration },
        },
        error as Error
      );

      return handleApiError(error, errorContext);
    }
  };
}

/**
 * Enhanced validation helper with fallback support
 */
export function validateRequired(value: any, fieldName: string, fallbackValue?: any): void {
  if (value === null || value === undefined || value === "") {
    throw new ValidationError(
      `${fieldName} is required`,
      fieldName,
      { received: value },
      fallbackValue
    );
  }
}

/**
 * Enhanced validation helper for userId parameter with recovery
 */
export function validateUserId(userId: string | null, fallbackUserId?: string): string {
  if (!userId || userId.trim() === "") {
    throw new ValidationError(
      "userId parameter is required and cannot be empty",
      "userId",
      { received: userId },
      fallbackUserId
    );
  }

  // Basic validation to prevent obvious invalid userIds
  if (userId === "undefined" || userId === "null" || userId.includes("default-user:")) {
    throw new ValidationError(
      "Invalid userId format - appears to be a placeholder or default value",
      "userId",
      { received: userId, pattern: "placeholder-detected" },
      fallbackUserId
    );
  }

  return userId.trim();
}

/**
 * Enhanced helper to check if an error indicates a retryable condition
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof DatabaseConnectionError) {
    return true;
  }

  if (error instanceof ValidationError) {
    return false; // Validation errors are typically not retryable
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      isDatabaseError(message) ||
      isRateLimitError(message) ||
      message.includes("network") ||
      message.includes("temporary")
    );
  }

  return false;
}

/**
 * Circuit breaker pattern implementation
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  private logger = StructuredLogger.getInstance();

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000
  ) {}

  async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime < this.timeout) {
        this.logger.warn("Circuit breaker is OPEN, using fallback", {
          component: "circuit-breaker",
          operation: "execute",
          metadata: { failures: this.failures, state: this.state },
        });

        if (fallback) {
          return await fallback();
        }
        throw new Error("Circuit breaker is OPEN and no fallback provided");
      } else {
        this.state = "HALF_OPEN";
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();

      if (fallback && this.state === "OPEN") {
        this.logger.warn("Circuit breaker opened, using fallback", {
          component: "circuit-breaker",
          operation: "execute",
          metadata: { failures: this.failures, state: this.state },
        });
        return await fallback();
      }

      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = "CLOSED";
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = "OPEN";
      this.logger.error("Circuit breaker opened due to failures", {
        component: "circuit-breaker",
        operation: "onFailure",
        metadata: { failures: this.failures, threshold: this.threshold },
      });
    }
  }

  getState(): { state: string; failures: number } {
    return { state: this.state, failures: this.failures };
  }
}

// Export singleton instances
export const structuredLogger = StructuredLogger.getInstance();
export const errorRecoveryManager = ErrorRecoveryManager.getInstance();

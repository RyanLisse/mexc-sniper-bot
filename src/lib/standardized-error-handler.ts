/**
 * Standardized Error Handling System
 *
 * Provides a unified error handling framework for the entire application.
 * Integrates with existing error utilities and logging systems.
 */

import type { CommonInterfaces } from "../types/common-interfaces";
import { type ApiResponse, createApiResponse } from "./api-response";
import {
  isApiError,
  isNetworkError,
  isServerError,
  isTimeoutError,
  isValidationError,
  type SafeErrorResult,
} from "./error-type-utils";
import { APIError, NetworkError, ServerError, TimeoutError, ValidationError } from "./errors";
import { createLogger, type LogContext } from "./unified-logger";

const logger = createLogger("error-handler", {
  enableStructuredLogging: true,
  enablePerformanceLogging: true,
});

/**
 * Error Severity Levels
 */
export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

/**
 * Error Categories for classification
 */
export enum ErrorCategory {
  VALIDATION = "validation",
  AUTHENTICATION = "authentication",
  AUTHORIZATION = "authorization",
  NETWORK = "network",
  DATABASE = "database",
  EXTERNAL_API = "external_api",
  BUSINESS_LOGIC = "business_logic",
  SYSTEM = "system",
  CONFIGURATION = "configuration",
  RATE_LIMIT = "rate_limit",
}

/**
 * Error Recovery Strategy
 */
export enum RecoveryStrategy {
  NONE = "none",
  RETRY = "retry",
  FALLBACK = "fallback",
  CIRCUIT_BREAKER = "circuit_breaker",
  GRACEFUL_DEGRADATION = "graceful_degradation",
  USER_ACTION_REQUIRED = "user_action_required",
}

/**
 * Standardized error context
 */
export interface StandardizedErrorContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  operation?: string;
  resource?: string;
  timestamp: string;
  additionalData?: Record<string, unknown>;
}

/**
 * Standardized error metadata
 */
export interface ErrorMetadata {
  severity: ErrorSeverity;
  category: ErrorCategory;
  recoveryStrategy: RecoveryStrategy;
  retryable: boolean;
  userMessage: string;
  technicalMessage: string;
  errorCode: string;
  context: StandardizedErrorContext;
}

/**
 * Standardized error result
 */
export interface StandardizedError {
  error: Error;
  metadata: ErrorMetadata;
}

/**
 * Error handling configuration
 */
interface ErrorHandlerConfig {
  enableMetrics: boolean;
  enableAlerts: boolean;
  enableUserNotifications: boolean;
  maxRetryAttempts: number;
  retryDelayMs: number;
}

/**
 * Default error handler configuration
 */
const defaultConfig: ErrorHandlerConfig = {
  enableMetrics: process.env.NODE_ENV === "production",
  enableAlerts: process.env.NODE_ENV === "production",
  enableUserNotifications: true,
  maxRetryAttempts: 3,
  retryDelayMs: 1000,
};

/**
 * Centralized Error Handler Class
 */
export class StandardizedErrorHandler {
  private config: ErrorHandlerConfig;
  private errorMetrics: Map<string, number> = new Map();

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Process and standardize an error
   */
  processError(error: unknown, context: Partial<StandardizedErrorContext> = {}): StandardizedError {
    const startTime = performance.now();

    // Ensure we have a proper Error instance
    const processedError = this.normalizeError(error);

    // Generate metadata
    const metadata = this.generateErrorMetadata(processedError, context);

    // Log the error
    this.logError(processedError, metadata);

    // Track metrics
    if (this.config.enableMetrics) {
      this.trackErrorMetrics(metadata);
    }

    // Send alerts if needed
    if (this.config.enableAlerts && this.shouldAlert(metadata)) {
      this.sendAlert(processedError, metadata);
    }

    logger.performance("error-processing", startTime, {
      errorType: processedError.constructor.name,
      category: metadata.category,
      severity: metadata.severity,
    });

    return {
      error: processedError,
      metadata,
    };
  }

  /**
   * Create standardized API error response
   */
  createApiErrorResponse<T = null>(
    error: unknown,
    context: Partial<StandardizedErrorContext> = {}
  ): ApiResponse<T> {
    const standardizedError = this.processError(error, context);
    const { error: processedError, metadata } = standardizedError;

    // Determine HTTP status code
    const statusCode = this.getHttpStatusCode(processedError, metadata);

    return createApiResponse<T>({
      success: false,
      error: metadata.userMessage,
      data: null,
      metadata: {
        errorCode: metadata.errorCode,
        category: metadata.category,
        severity: metadata.severity,
        recoveryStrategy: metadata.recoveryStrategy,
        retryable: metadata.retryable,
        requestId: metadata.context.requestId,
        timestamp: metadata.context.timestamp,
      },
      statusCode,
    });
  }

  /**
   * Check if an error is retryable
   */
  isRetryable(error: unknown): boolean {
    if (isNetworkError(error) || isTimeoutError(error)) {
      return true;
    }

    if (isApiError(error) && error.statusCode >= 500) {
      return true;
    }

    return false;
  }

  /**
   * Execute operation with automatic retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    context: Partial<StandardizedErrorContext> = {},
    maxAttempts: number = this.config.maxRetryAttempts
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation();

        if (attempt > 1) {
          logger.info("Operation succeeded after retry", {
            operation: context.operation,
            attempt,
            maxAttempts,
          });
        }

        return result;
      } catch (error) {
        lastError = error;
        const standardizedError = this.processError(error, {
          ...context,
          additionalData: { attempt, maxAttempts },
        });

        if (!standardizedError.metadata.retryable || attempt === maxAttempts) {
          throw error;
        }

        logger.warn("Operation failed, retrying", {
          operation: context.operation,
          attempt,
          maxAttempts,
          error: standardizedError.metadata.technicalMessage,
          nextRetryDelayMs: this.config.retryDelayMs * attempt,
        });

        // Exponential backoff
        await this.delay(this.config.retryDelayMs * attempt);
      }
    }

    throw lastError;
  }

  /**
   * Get error recovery suggestions
   */
  getRecoveryActions(error: unknown): string[] {
    const standardized = this.processError(error);
    const { metadata } = standardized;

    switch (metadata.recoveryStrategy) {
      case RecoveryStrategy.RETRY:
        return [
          "Try the operation again",
          "Check your network connection",
          "Wait a moment and retry",
        ];

      case RecoveryStrategy.FALLBACK:
        return [
          "Using alternative approach",
          "Some features may be limited",
          "Full functionality will be restored automatically",
        ];

      case RecoveryStrategy.USER_ACTION_REQUIRED:
        return [
          "Please check your input and try again",
          "Verify your credentials",
          "Contact support if the problem persists",
        ];

      case RecoveryStrategy.GRACEFUL_DEGRADATION:
        return [
          "Operating in limited mode",
          "Core functionality remains available",
          "Full features will be restored when possible",
        ];

      default:
        return [
          "An error has occurred",
          "Please try again later",
          "Contact support if the problem persists",
        ];
    }
  }

  /**
   * Get current error metrics
   */
  getErrorMetrics(): Record<string, number> {
    return Object.fromEntries(this.errorMetrics);
  }

  /**
   * Reset error metrics
   */
  resetMetrics(): void {
    this.errorMetrics.clear();
  }

  // Private methods

  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    if (typeof error === "string") {
      return new Error(error);
    }

    if (typeof error === "object" && error !== null) {
      return new Error(JSON.stringify(error));
    }

    return new Error("Unknown error occurred");
  }

  private generateErrorMetadata(
    error: Error,
    context: Partial<StandardizedErrorContext>
  ): ErrorMetadata {
    const category = this.categorizeError(error);
    const severity = this.determineSeverity(error, category);
    const recoveryStrategy = this.determineRecoveryStrategy(error, category);
    const retryable = this.isRetryable(error);

    return {
      severity,
      category,
      recoveryStrategy,
      retryable,
      userMessage: this.generateUserMessage(error, category),
      technicalMessage: error.message,
      errorCode: this.generateErrorCode(error, category),
      context: {
        timestamp: new Date().toISOString(),
        requestId: context.requestId || this.generateRequestId(),
        userId: context.userId,
        sessionId: context.sessionId,
        operation: context.operation,
        resource: context.resource,
        additionalData: context.additionalData,
      },
    };
  }

  private categorizeError(error: Error): ErrorCategory {
    if (isValidationError(error)) return ErrorCategory.VALIDATION;
    if (isNetworkError(error)) return ErrorCategory.NETWORK;
    if (isTimeoutError(error)) return ErrorCategory.NETWORK;
    if (isServerError(error)) return ErrorCategory.SYSTEM;

    if (isApiError(error)) {
      if (error.statusCode === 401) return ErrorCategory.AUTHENTICATION;
      if (error.statusCode === 403) return ErrorCategory.AUTHORIZATION;
      if (error.statusCode === 429) return ErrorCategory.RATE_LIMIT;
      if (error.statusCode >= 500) return ErrorCategory.SYSTEM;
    }

    // Check error message for patterns
    const message = error.message.toLowerCase();
    if (message.includes("database") || message.includes("sql")) {
      return ErrorCategory.DATABASE;
    }
    if (message.includes("config") || message.includes("environment")) {
      return ErrorCategory.CONFIGURATION;
    }
    if (message.includes("mexc") || message.includes("api")) {
      return ErrorCategory.EXTERNAL_API;
    }

    return ErrorCategory.BUSINESS_LOGIC;
  }

  private determineSeverity(error: Error, category: ErrorCategory): ErrorSeverity {
    // Critical errors
    if (category === ErrorCategory.SYSTEM || category === ErrorCategory.DATABASE) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity errors
    if (category === ErrorCategory.AUTHENTICATION || category === ErrorCategory.CONFIGURATION) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity errors
    if (category === ErrorCategory.EXTERNAL_API || category === ErrorCategory.NETWORK) {
      return ErrorSeverity.MEDIUM;
    }

    // Low severity by default
    return ErrorSeverity.LOW;
  }

  private determineRecoveryStrategy(error: Error, category: ErrorCategory): RecoveryStrategy {
    if (category === ErrorCategory.NETWORK || category === ErrorCategory.RATE_LIMIT) {
      return RecoveryStrategy.RETRY;
    }

    if (category === ErrorCategory.VALIDATION || category === ErrorCategory.AUTHENTICATION) {
      return RecoveryStrategy.USER_ACTION_REQUIRED;
    }

    if (category === ErrorCategory.EXTERNAL_API) {
      return RecoveryStrategy.FALLBACK;
    }

    if (category === ErrorCategory.SYSTEM) {
      return RecoveryStrategy.GRACEFUL_DEGRADATION;
    }

    return RecoveryStrategy.NONE;
  }

  private generateUserMessage(error: Error, category: ErrorCategory): string {
    switch (category) {
      case ErrorCategory.VALIDATION:
        return "Please check your input and try again";
      case ErrorCategory.AUTHENTICATION:
        return "Please verify your credentials and sign in again";
      case ErrorCategory.AUTHORIZATION:
        return "You don't have permission to perform this action";
      case ErrorCategory.NETWORK:
        return "Connection issue. Please check your internet and try again";
      case ErrorCategory.DATABASE:
        return "A data issue occurred. Please try again later";
      case ErrorCategory.EXTERNAL_API:
        return "External service temporarily unavailable. Please try again";
      case ErrorCategory.RATE_LIMIT:
        return "Too many requests. Please wait a moment and try again";
      case ErrorCategory.CONFIGURATION:
        return "System configuration issue. Please contact support";
      default:
        return "An unexpected error occurred. Please try again";
    }
  }

  private generateErrorCode(error: Error, category: ErrorCategory): string {
    const timestamp = Date.now().toString(36);
    const categoryCode = category.replace(/_/g, "").slice(0, 3).toUpperCase();
    const errorType = error.constructor.name.slice(0, 3).toUpperCase();

    return `${categoryCode}_${errorType}_${timestamp}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private logError(error: Error, metadata: ErrorMetadata): void {
    const logContext: LogContext = {
      errorCode: metadata.errorCode,
      category: metadata.category,
      severity: metadata.severity,
      recoveryStrategy: metadata.recoveryStrategy,
      retryable: metadata.retryable,
      context: metadata.context,
    };

    switch (metadata.severity) {
      case ErrorSeverity.CRITICAL:
        logger.error(metadata.technicalMessage, logContext, error);
        break;
      case ErrorSeverity.HIGH:
        logger.error(metadata.technicalMessage, logContext, error);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn(metadata.technicalMessage, logContext, error);
        break;
      default:
        logger.info(metadata.technicalMessage, logContext);
    }
  }

  private trackErrorMetrics(metadata: ErrorMetadata): void {
    const key = `${metadata.category}_${metadata.severity}`;
    const current = this.errorMetrics.get(key) || 0;
    this.errorMetrics.set(key, current + 1);
  }

  private shouldAlert(metadata: ErrorMetadata): boolean {
    return metadata.severity === ErrorSeverity.CRITICAL || metadata.severity === ErrorSeverity.HIGH;
  }

  private async sendAlert(error: Error, metadata: ErrorMetadata): Promise<void> {
    // Implementation would integrate with alerting system
    logger.error(
      "ALERT: Critical error detected",
      {
        errorCode: metadata.errorCode,
        category: metadata.category,
        severity: metadata.severity,
        message: metadata.technicalMessage,
      },
      error
    );
  }

  private getHttpStatusCode(error: Error, metadata: ErrorMetadata): number {
    if (isApiError(error)) {
      return error.statusCode;
    }

    switch (metadata.category) {
      case ErrorCategory.VALIDATION:
        return 400;
      case ErrorCategory.AUTHENTICATION:
        return 401;
      case ErrorCategory.AUTHORIZATION:
        return 403;
      case ErrorCategory.RATE_LIMIT:
        return 429;
      case ErrorCategory.SYSTEM:
      case ErrorCategory.DATABASE:
      case ErrorCategory.CONFIGURATION:
        return 500;
      case ErrorCategory.EXTERNAL_API:
        return 502;
      case ErrorCategory.NETWORK:
        return 503;
      default:
        return 500;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Global error handler instance
 */
export const errorHandler = new StandardizedErrorHandler();

/**
 * Helper function for API route error handling
 */
export function handleApiError<T = null>(
  error: unknown,
  context?: Partial<StandardizedErrorContext>
): ApiResponse<T> {
  return errorHandler.createApiErrorResponse<T>(error, context);
}

/**
 * Helper function for service layer error handling
 */
export function handleServiceError(
  error: unknown,
  context?: Partial<StandardizedErrorContext>
): StandardizedError {
  return errorHandler.processError(error, context);
}

/**
 * Helper decorator for automatic error handling
 */
export function withErrorHandling(
  target: any,
  propertyName: string,
  descriptor: PropertyDescriptor
) {
  const method = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    try {
      return await method.apply(this, args);
    } catch (error) {
      const context: Partial<StandardizedErrorContext> = {
        operation: `${target.constructor.name}.${propertyName}`,
        additionalData: { arguments: args.length },
      };

      throw errorHandler.processError(error, context).error;
    }
  };

  return descriptor;
}

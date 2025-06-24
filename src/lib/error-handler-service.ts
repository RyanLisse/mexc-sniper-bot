import { ErrorLoggingService } from "../services/error-logging-service";
import { AppError, ErrorCode, ErrorSeverity, isAppError, toAppError } from "./error-types";
import { createLogger } from "./structured-logger";

export interface ErrorHandlerConfig {
  enableLogging?: boolean;
  enableRetry?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
  enableCircuitBreaker?: boolean;
}

export interface RetryOptions {
  maxRetries: number;
  delayMs: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  monitoringPeriodMs: number;
}

/**
 * Centralized error handling service with retry logic and circuit breaker pattern
 */
export class ErrorHandlerService {
  private logger = createLogger("error-handler-service");

  private static instance: ErrorHandlerService;
  private errorLoggingService: ErrorLoggingService;
  private config: Required<ErrorHandlerConfig>;
  private circuitBreakers = new Map<string, CircuitBreakerState>();

  private constructor(config: ErrorHandlerConfig = {}) {
    this.config = {
      enableLogging: config.enableLogging ?? true,
      enableRetry: config.enableRetry ?? true,
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      enableCircuitBreaker: config.enableCircuitBreaker ?? false,
    };

    this.errorLoggingService = ErrorLoggingService.getInstance();
  }

  public static getInstance(config?: ErrorHandlerConfig): ErrorHandlerService {
    if (!ErrorHandlerService.instance) {
      ErrorHandlerService.instance = new ErrorHandlerService(config);
    }
    return ErrorHandlerService.instance;
  }

  /**
   * Handle error with standardized logging and processing
   */
  async handleError(
    error: unknown,
    context?: {
      operation?: string;
      userId?: string;
      requestId?: string;
      [key: string]: unknown;
    }
  ): Promise<AppError> {
    const appError = toAppError(error);

    // Add context if provided
    if (context) {
      const newAppError = { ...appError, context: { ...appError.context, ...context } };
      Object.assign(appError, newAppError);
    }

    // Log error if enabled
    if (this.config.enableLogging) {
      await this.logError(appError);
    }

    return appError;
  }

  /**
   * Execute operation with automatic retry on retryable errors
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
    context?: { operation: string; [key: string]: unknown }
  ): Promise<T> {
    const retryOptions: RetryOptions = {
      maxRetries: options.maxRetries ?? this.config.maxRetries,
      delayMs: options.delayMs ?? this.config.retryDelayMs,
      backoffMultiplier: options.backoffMultiplier ?? 2,
      maxDelayMs: options.maxDelayMs ?? 30000,
    };

    let lastError: AppError;
    let currentDelay = retryOptions.delayMs;

    for (let attempt = 0; attempt <= retryOptions.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = await this.handleError(error, {
          ...context,
          attempt: attempt + 1,
          maxRetries: retryOptions.maxRetries,
        });

        // Don't retry if not retryable or on last attempt
        if (!lastError.retryable || attempt === retryOptions.maxRetries) {
          throw lastError;
        }

        // Wait before retry with exponential backoff
        if (attempt < retryOptions.maxRetries) {
          await this.delay(currentDelay);
          currentDelay = Math.min(
            currentDelay * retryOptions.backoffMultiplier!,
            retryOptions.maxDelayMs
          );
        }
      }
    }

    throw lastError!;
  }

  /**
   * Execute operation with circuit breaker pattern
   */
  async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    circuitKey: string,
    options: Partial<CircuitBreakerOptions> = {},
    context?: { operation: string; [key: string]: unknown }
  ): Promise<T> {
    if (!this.config.enableCircuitBreaker) {
      return await operation();
    }

    const circuitOptions: CircuitBreakerOptions = {
      failureThreshold: options.failureThreshold ?? 5,
      resetTimeoutMs: options.resetTimeoutMs ?? 60000,
      monitoringPeriodMs: options.monitoringPeriodMs ?? 300000,
    };

    const circuitState = this.getCircuitBreakerState(circuitKey, circuitOptions);

    // Check if circuit is open
    if (circuitState.state === "open") {
      if (Date.now() - circuitState.lastFailureTime < circuitOptions.resetTimeoutMs) {
        throw new AppError("Circuit breaker is open", {
          code: ErrorCode.EXTERNAL_SERVICE_ERROR,
          severity: ErrorSeverity.HIGH,
          retryable: true,
          userMessage: "Service is temporarily unavailable. Please try again later.",
          context: { ...context, circuitKey, circuitState: "open" },
        });
      }
      // Try to reset circuit to half-open
      circuitState.state = "half-open";
    }

    try {
      const result = await operation();

      // Success - reset circuit if it was half-open
      if (circuitState.state === "half-open") {
        circuitState.state = "closed";
        circuitState.failureCount = 0;
      }

      return result;
    } catch (error) {
      const appError = await this.handleError(error, context);

      // Update circuit breaker state on failure
      circuitState.failureCount++;
      circuitState.lastFailureTime = Date.now();

      if (circuitState.failureCount >= circuitOptions.failureThreshold) {
        circuitState.state = "open";
      }

      throw appError;
    }
  }

  /**
   * Create error response for API routes
   */
  createErrorResponse(
    error: unknown,
    context?: { operation?: string; requestId?: string; [key: string]: unknown }
  ): {
    success: false;
    error: string;
    code: string;
    userMessage: string;
    requestId?: string;
    timestamp: string;
    retryable: boolean;
  } {
    const appError = isAppError(error) ? error : toAppError(error);

    return {
      success: false,
      error: appError.message,
      code: appError.code,
      userMessage: appError.getUserMessage(),
      requestId: context?.requestId as string,
      timestamp: appError.timestamp,
      retryable: appError.retryable,
    };
  }

  /**
   * Check if error should trigger alert
   */
  shouldTriggerAlert(error: AppError): boolean {
    return (
      error.severity === ErrorSeverity.HIGH ||
      error.severity === ErrorSeverity.CRITICAL ||
      error.code === ErrorCode.DATABASE_CONNECTION_ERROR ||
      error.code === ErrorCode.MEXC_CONNECTIVITY_ERROR ||
      error.code === ErrorCode.ENCRYPTION_ERROR
    );
  }

  /**
   * Get error summary for monitoring
   */
  getErrorSummary(errors: AppError[]): {
    total: number;
    byCode: Record<string, number>;
    bySeverity: Record<string, number>;
    retryableCount: number;
    criticalCount: number;
  } {
    const summary = {
      total: errors.length,
      byCode: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      retryableCount: 0,
      criticalCount: 0,
    };

    for (const error of errors) {
      // Count by code
      summary.byCode[error.code] = (summary.byCode[error.code] || 0) + 1;

      // Count by severity
      summary.bySeverity[error.severity] = (summary.bySeverity[error.severity] || 0) + 1;

      // Count retryable errors
      if (error.retryable) {
        summary.retryableCount++;
      }

      // Count critical errors
      if (error.severity === ErrorSeverity.CRITICAL) {
        summary.criticalCount++;
      }
    }

    return summary;
  }

  /**
   * Private helper methods
   */
  private async logError(error: AppError): Promise<void> {
    try {
      await this.errorLoggingService.logError(error, error.context);
    } catch (loggingError) {
      // Don't throw on logging errors, just console.error
      logger.error("Failed to log error:", loggingError);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getCircuitBreakerState(key: string, options: CircuitBreakerOptions): CircuitBreakerState {
    let state = this.circuitBreakers.get(key);

    if (!state) {
      state = {
        state: "closed",
        failureCount: 0,
        lastFailureTime: 0,
        options,
      };
      this.circuitBreakers.set(key, state);
    }

    // Clean up old circuit breaker states
    const now = Date.now();
    if (now - state.lastFailureTime > options.monitoringPeriodMs) {
      state.failureCount = 0;
      state.state = "closed";
    }

    return state;
  }

  /**
   * Reset circuit breaker state
   */
  resetCircuitBreaker(key: string): void {
    const state = this.circuitBreakers.get(key);
    if (state) {
      state.state = "closed";
      state.failureCount = 0;
      state.lastFailureTime = 0;
    }
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(key: string): {
    state: "open" | "half-open" | "closed";
    failureCount: number;
    isHealthy: boolean;
  } | null {
    const state = this.circuitBreakers.get(key);
    if (!state) return null;

    return {
      state: state.state,
      failureCount: state.failureCount,
      isHealthy: state.state === "closed",
    };
  }
}

interface CircuitBreakerState {
  state: "open" | "half-open" | "closed";
  failureCount: number;
  lastFailureTime: number;
  options: CircuitBreakerOptions;
}

// Export singleton instance
export const errorHandler = ErrorHandlerService.getInstance();

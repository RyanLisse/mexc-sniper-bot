/**
 * Utility classes for error classification and handling
 */

export class ValidationError extends Error {
  private logger = {
      info: (message: string, context?: any) => console.info('[error-utils]', message, context || ''),
      warn: (message: string, context?: any) => console.warn('[error-utils]', message, context || ''),
      error: (message: string, context?: any, error?: Error) => console.error('[error-utils]', message, context || '', error || ''),
      debug: (message: string, context?: any) => console.debug('[error-utils]', message, context || ''),
    };

  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Error classification utility for consistent error handling
 */
export class ErrorClassifier {
  /**
   * Checks if error is a timeout error
   */
  static isTimeout(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.name === "AbortError" ||
        error.message.toLowerCase().includes("timeout") ||
        error.message.toLowerCase().includes("timed out"))
    );
  }

  /**
   * Checks if error is a connection error
   */
  static isConnection(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.message.includes("fetch failed") ||
        error.message.includes("ECONNRESET") ||
        error.message.includes("ENOTFOUND") ||
        error.message.includes("ETIMEDOUT") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("network"))
    );
  }

  /**
   * Checks if error is retryable (timeout or connection)
   */
  static isRetryable(error: unknown): boolean {
    return ErrorClassifier.isTimeout(error) || ErrorClassifier.isConnection(error);
  }

  /**
   * Checks if error is an authentication error
   */
  static isAuth(error: unknown): boolean {
    return (
      error instanceof AuthError ||
      (error instanceof Error &&
        (error.message.includes("401") ||
          error.message.includes("unauthorized") ||
          error.message.includes("authentication")))
    );
  }

  /**
   * Checks if error is a rate limit error
   */
  static isRateLimit(error: unknown): boolean {
    return (
      error instanceof RateLimitError ||
      (error instanceof Error &&
        (error.message.includes("429") ||
          error.message.includes("rate limit") ||
          error.message.includes("too many requests")))
    );
  }

  /**
   * Checks if error is a validation error
   */
  static isValidation(error: unknown): boolean {
    return (
      error instanceof ValidationError ||
      (error instanceof Error &&
        (error.message.includes("400") ||
          error.message.includes("validation") ||
          error.message.includes("invalid")))
    );
  }

  /**
   * Gets the error type category
   */
  static getErrorType(error: unknown): string {
    if (ErrorClassifier.isTimeout(error)) return "timeout";
    if (ErrorClassifier.isConnection(error)) return "connection";
    if (ErrorClassifier.isAuth(error)) return "auth";
    if (ErrorClassifier.isRateLimit(error)) return "rate_limit";
    if (ErrorClassifier.isValidation(error)) return "validation";
    return "unknown";
  }

  /**
   * Gets HTTP status code for error type
   */
  static getStatusCode(error: unknown): number {
    if (ErrorClassifier.isValidation(error)) return 400;
    if (ErrorClassifier.isAuth(error)) return 401;
    if (ErrorClassifier.isRateLimit(error)) return 429;
    if (ErrorClassifier.isTimeout(error) || ErrorClassifier.isConnection(error)) return 503;
    return 500;
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

/**
 * Retry utility with exponential backoff
 */
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
          console.info(
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

/**
 * Error aggregation for collecting multiple errors
 */
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

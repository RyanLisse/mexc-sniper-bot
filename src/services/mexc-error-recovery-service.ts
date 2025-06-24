/**
 * MEXC Error Recovery Service
 *
 * Handles error recovery, retry logic, and fallback mechanisms
 * for MEXC API operations. Addresses 500 errors and connectivity issues.
 */

import { toSafeError } from "../lib/error-type-utils";
import { createSafeLogger } from "../lib/structured-logger";

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ErrorRecoveryConfig {
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff: boolean;
  retryableErrors: string[];
  nonRetryableErrors: string[];
  fallbackEnabled: boolean;
  circuitBreakerEnabled: boolean;
}

export interface RecoveryAttempt {
  attempt: number;
  error: string;
  retryAfter: number;
  strategy: "retry" | "fallback" | "fail";
  timestamp: string;
}

export interface ErrorRecoveryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: RecoveryAttempt[];
  finalStrategy: "success" | "retry_exhausted" | "fallback_used" | "circuit_open";
  totalTime: number;
}

// ============================================================================
// Error Classification
// ============================================================================

export class ErrorClassifier {
  private logger = createSafeLogger("mexc-error-recovery-service");

  private readonly RETRYABLE_ERRORS = [
    "timeout",
    "ECONNRESET",
    "ENOTFOUND",
    "ECONNREFUSED",
    "500", // Internal server error
    "502", // Bad gateway
    "503", // Service unavailable
    "504", // Gateway timeout
    "network",
    "fetch failed",
    "Connection timeout",
    "Rate limit exceeded",
  ];

  private readonly NON_RETRYABLE_ERRORS = [
    "400", // Bad request
    "401", // Unauthorized
    "403", // Forbidden
    "404", // Not found
    "422", // Unprocessable entity
    "signature",
    "Api key info invalid",
    "Invalid credentials",
  ];

  private readonly IMMEDIATE_RETRY_ERRORS = ["Rate limit exceeded", "Too many requests"];

  isRetryable(error: string): boolean {
    const errorLower = error.toLowerCase();

    // Check non-retryable first (they take precedence)
    if (this.NON_RETRYABLE_ERRORS.some((pattern) => errorLower.includes(pattern.toLowerCase()))) {
      return false;
    }

    // Check retryable patterns
    return this.RETRYABLE_ERRORS.some((pattern) => errorLower.includes(pattern.toLowerCase()));
  }

  needsImmediateRetry(error: string): boolean {
    const errorLower = error.toLowerCase();
    return this.IMMEDIATE_RETRY_ERRORS.some((pattern) =>
      errorLower.includes(pattern.toLowerCase())
    );
  }

  getRetryDelay(error: string, attempt: number, baseDelay: number): number {
    if (this.needsImmediateRetry(error)) {
      return 1000; // 1 second for rate limits
    }

    if (error.toLowerCase().includes("signature")) {
      return 2000; // 2 seconds for signature errors (time sync)
    }

    if (error.toLowerCase().includes("network") || error.toLowerCase().includes("timeout")) {
      return baseDelay * 2 ** (attempt - 1); // Exponential backoff for network issues
    }

    return baseDelay;
  }

  shouldUseFallback(error: string): boolean {
    const errorLower = error.toLowerCase();
    return (
      errorLower.includes("credentials") ||
      errorLower.includes("authentication") ||
      errorLower.includes("unauthorized")
    );
  }
}

// ============================================================================
// Error Recovery Service
// ============================================================================

export class MexcErrorRecoveryService {
  private config: ErrorRecoveryConfig;
  private classifier = new ErrorClassifier();

  constructor(config: Partial<ErrorRecoveryConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      exponentialBackoff: true,
      retryableErrors: [],
      nonRetryableErrors: [],
      fallbackEnabled: true,
      circuitBreakerEnabled: true,
      ...config,
    };

    logger.info("[MexcErrorRecoveryService] Initialized with config:", {
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay,
      exponentialBackoff: this.config.exponentialBackoff,
      fallbackEnabled: this.config.fallbackEnabled,
    });
  }

  /**
   * Execute operation with error recovery
   */
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>,
    operationName = "API Operation"
  ): Promise<ErrorRecoveryResult<T>> {
    const startTime = Date.now();
    const attempts: RecoveryAttempt[] = [];

    logger.info(`[MexcErrorRecoveryService] Starting ${operationName} with recovery...`);

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        logger.info(
          `[MexcErrorRecoveryService] ${operationName} attempt ${attempt}/${this.config.maxRetries}`
        );

        const result = await operation();

        const totalTime = Date.now() - startTime;
        logger.info(
          `[MexcErrorRecoveryService] ✅ ${operationName} succeeded on attempt ${attempt} (${totalTime}ms)`
        );

        return {
          success: true,
          data: result,
          attempts,
          finalStrategy: "success",
          totalTime,
        };
      } catch (error) {
        const safeError = toSafeError(error);
        const errorMessage = safeError.message;

        logger.error(
          `[MexcErrorRecoveryService] ❌ ${operationName} attempt ${attempt} failed:`,
          errorMessage
        );

        // Determine retry strategy
        const isRetryable = this.classifier.isRetryable(errorMessage);
        const retryDelay = this.config.exponentialBackoff
          ? this.classifier.getRetryDelay(errorMessage, attempt, this.config.retryDelay)
          : this.config.retryDelay;

        const recoveryAttempt: RecoveryAttempt = {
          attempt,
          error: errorMessage,
          retryAfter: retryDelay,
          strategy:
            isRetryable && attempt < this.config.maxRetries
              ? "retry"
              : fallback && this.classifier.shouldUseFallback(errorMessage)
                ? "fallback"
                : "fail",
          timestamp: new Date().toISOString(),
        };

        attempts.push(recoveryAttempt);

        // If not retryable or max retries reached
        if (!isRetryable || attempt >= this.config.maxRetries) {
          logger.info(
            `[MexcErrorRecoveryService] ${operationName} not retryable or max attempts reached`
          );

          // Try fallback if available and appropriate
          if (
            fallback &&
            this.config.fallbackEnabled &&
            this.classifier.shouldUseFallback(errorMessage)
          ) {
            try {
              logger.info(`[MexcErrorRecoveryService] Attempting fallback for ${operationName}...`);
              const fallbackResult = await fallback();

              const totalTime = Date.now() - startTime;
              logger.info(
                `[MexcErrorRecoveryService] ✅ ${operationName} fallback succeeded (${totalTime}ms)`
              );

              return {
                success: true,
                data: fallbackResult,
                attempts,
                finalStrategy: "fallback_used",
                totalTime,
              };
            } catch (fallbackError) {
              const safeFallbackError = toSafeError(fallbackError);
              logger.error(
                `[MexcErrorRecoveryService] ❌ ${operationName} fallback failed:`,
                safeFallbackError.message
              );
            }
          }

          // Final failure
          const totalTime = Date.now() - startTime;
          return {
            success: false,
            error: errorMessage,
            attempts,
            finalStrategy: "retry_exhausted",
            totalTime,
          };
        }

        // Wait before retry
        if (retryDelay > 0) {
          logger.info(`[MexcErrorRecoveryService] Retrying ${operationName} in ${retryDelay}ms...`);
          await this.delay(retryDelay);
        }
      }
    }

    // This should never be reached, but for type safety
    const totalTime = Date.now() - startTime;
    return {
      success: false,
      error: "Max retries exceeded",
      attempts,
      finalStrategy: "retry_exhausted",
      totalTime,
    };
  }

  /**
   * Handle specific MEXC API errors with custom recovery
   */
  async handleMexcApiCall<T>(
    apiCall: () => Promise<T>,
    fallbackCall?: () => Promise<T>,
    operationName = "MEXC API Call"
  ): Promise<T> {
    const result = await this.executeWithRecovery(apiCall, fallbackCall, operationName);

    if (result.success && result.data !== undefined) {
      return result.data;
    }

    // Log recovery details for debugging
    logger.error(`[MexcErrorRecoveryService] ${operationName} failed after recovery:`, {
      error: result.error,
      attempts: result.attempts.length,
      finalStrategy: result.finalStrategy,
      totalTime: result.totalTime,
    });

    throw new Error(result.error || "API call failed after recovery attempts");
  }

  /**
   * Intelligent delay with jitter to avoid thundering herd
   */
  private async delay(ms: number): Promise<void> {
    // Add random jitter (±20%) to avoid synchronized retries
    const jitter = ms * 0.2 * (Math.random() - 0.5);
    const delayTime = Math.max(100, ms + jitter); // Minimum 100ms delay

    return new Promise((resolve) => setTimeout(resolve, delayTime));
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): {
    retryableErrorPatterns: string[];
    nonRetryableErrorPatterns: string[];
    config: ErrorRecoveryConfig;
  } {
    return {
      retryableErrorPatterns: this.classifier["RETRYABLE_ERRORS"],
      nonRetryableErrorPatterns: this.classifier["NON_RETRYABLE_ERRORS"],
      config: { ...this.config },
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ErrorRecoveryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info("[MexcErrorRecoveryService] Configuration updated:", newConfig);
  }
}

// ============================================================================
// Factory Functions and Exports
// ============================================================================

/**
 * Create error recovery service with default configuration
 */
export function createErrorRecoveryService(
  config?: Partial<ErrorRecoveryConfig>
): MexcErrorRecoveryService {
  const defaultConfig: Partial<ErrorRecoveryConfig> = {
    maxRetries: 3,
    retryDelay: 1000,
    exponentialBackoff: true,
    fallbackEnabled: true,
    circuitBreakerEnabled: true,
  };

  return new MexcErrorRecoveryService({ ...defaultConfig, ...config });
}

// Global instance for singleton usage
let globalRecoveryService: MexcErrorRecoveryService | null = null;

/**
 * Get or create global error recovery service
 */
export function getGlobalErrorRecoveryService(): MexcErrorRecoveryService {
  if (!globalRecoveryService) {
    globalRecoveryService = createErrorRecoveryService();
  }
  return globalRecoveryService;
}

/**
 * Reset global recovery service (for testing)
 */
export function resetGlobalErrorRecoveryService(): void {
  globalRecoveryService = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick wrapper for MEXC API calls with automatic error recovery
 */
export async function withMexcRecovery<T>(
  apiCall: () => Promise<T>,
  fallback?: () => Promise<T>,
  operationName?: string
): Promise<T> {
  const recoveryService = getGlobalErrorRecoveryService();
  return recoveryService.handleMexcApiCall(apiCall, fallback, operationName);
}

/**
 * Create a retryable version of any async function
 */
export function makeRetryable<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: {
    maxRetries?: number;
    retryDelay?: number;
    operationName?: string;
  }
): T {
  const recoveryService = createErrorRecoveryService({
    maxRetries: options?.maxRetries || 3,
    retryDelay: options?.retryDelay || 1000,
  });

  return (async (...args: Parameters<T>) => {
    return recoveryService.handleMexcApiCall(
      () => fn(...args),
      undefined,
      options?.operationName || fn.name
    );
  }) as T;
}

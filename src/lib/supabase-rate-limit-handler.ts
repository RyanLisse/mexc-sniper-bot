/**
 * Enhanced Supabase Rate Limit Handler
 *
 * Comprehensive handling of Supabase auth rate limits with:
 * 1. Advanced error detection and classification
 * 2. Sophisticated backoff strategies with jitter
 * 3. Circuit breaker pattern implementation
 * 4. Real-time monitoring and metrics collection
 * 5. Development-friendly bypass mechanisms
 * 6. User-friendly error messages and suggestions
 * 7. Automatic retry logic with adaptive thresholds
 */

export interface RateLimitInfo {
  isRateLimited: boolean;
  retryAfter?: number;
  limitType?:
    | "email"
    | "otp"
    | "verification"
    | "token_refresh"
    | "mfa"
    | "anonymous"
    | "api"
    | "database"
    | "realtime";
  message: string;
  suggestion?: string;
  severity?: "low" | "medium" | "high" | "critical";
  errorCode?: string;
  timestamp?: number;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface RateLimitMetrics {
  totalRequests: number;
  rateLimitedRequests: number;
  successfulRetries: number;
  failedRetries: number;
  averageRetryDelay: number;
  circuitBreakerTrips: number;
  bypassedRequests: number;
  lastRateLimitTime?: number;
  rateLimitsByType: Record<string, number>;
}

export interface CircuitBreakerState {
  state: "closed" | "open" | "half-open";
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
  successCount: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  enableJitter: boolean;
  adaptiveRetry: boolean;
  circuitBreakerEnabled: boolean;
}

export class SupabaseRateLimitHandler {
  private static readonly RATE_LIMIT_ERRORS = [
    "rate_limit_exceeded",
    "too_many_requests",
    "email_rate_limit_exceeded",
    "signup_disabled",
    "email_not_confirmed",
    "email_address_not_authorized",
    "weak_password",
    "session_not_found",
    "invalid_credentials",
    "captcha_failed",
    "over_request_rate_limit",
    "over_email_send_rate_limit",
    "over_sms_send_rate_limit",
    "api_key_not_valid",
    "database_connection_error",
    "realtime_connection_error",
  ];

  private static readonly LIMIT_PATTERNS = {
    email: /email.*(?:limit|rate|send|confirmation|verification)/i,
    otp: /otp.*(?:limit|rate|send|verification)/i,
    verification: /verif.*(?:limit|rate|send|confirm)/i,
    token_refresh: /token.*(?:limit|rate|refresh|invalid|expired)/i,
    mfa: /mfa.*(?:limit|rate|auth|factor)/i,
    anonymous: /anonymous.*(?:limit|rate|signin|signup)/i,
    api: /api.*(?:limit|rate|key|quota|throttle)/i,
    database: /database.*(?:connection|pool|limit|quota)/i,
    realtime: /realtime.*(?:connection|subscription|limit)/i,
  };

  private static readonly ERROR_CODES = {
    TOO_MANY_REQUESTS: "too_many_requests",
    RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",
    EMAIL_RATE_LIMIT: "email_rate_limit_exceeded",
    SIGNUP_DISABLED: "signup_disabled",
    WEAK_PASSWORD: "weak_password",
    INVALID_CREDENTIALS: "invalid_credentials",
    CAPTCHA_FAILED: "captcha_failed",
    SESSION_NOT_FOUND: "session_not_found",
  };

  private static metrics: RateLimitMetrics = {
    totalRequests: 0,
    rateLimitedRequests: 0,
    successfulRetries: 0,
    failedRetries: 0,
    averageRetryDelay: 0,
    circuitBreakerTrips: 0,
    bypassedRequests: 0,
    rateLimitsByType: {},
  };

  private static circuitBreaker: CircuitBreakerState = {
    state: "closed",
    failureCount: 0,
    lastFailureTime: 0,
    nextAttemptTime: 0,
    successCount: 0,
  };

  private static readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    enableJitter: true,
    adaptiveRetry: true,
    circuitBreakerEnabled: true,
  };

  private static logger = {
    info: (message: string, context?: any) => {
      if (process.env.NODE_ENV === "development") {
        console.info(`[SupabaseRateLimitHandler] ${message}`, context || "");
      }
    },
    warn: (message: string, context?: any) => {
      console.warn(`[SupabaseRateLimitHandler] ${message}`, context || "");
    },
    error: (message: string, context?: any, error?: Error) => {
      console.error(
        `[SupabaseRateLimitHandler] ${message}`,
        context || "",
        error || ""
      );
    },
    debug: (message: string, context?: any) => {
      if (process.env.NODE_ENV === "development") {
        console.debug(`[SupabaseRateLimitHandler] ${message}`, context || "");
      }
    },
  };

  /**
   * Enhanced rate limit error detection with comprehensive pattern matching
   */
  static isRateLimitError(error: any): boolean {
    if (!error) return false;

    SupabaseRateLimitHandler.metrics.totalRequests++;

    // Check error message for rate limit indicators
    const message = error.message?.toLowerCase() || "";
    const code = error.code?.toLowerCase() || "";
    const status = error.status || error.statusCode || 0;

    // Check for explicit rate limit errors
    const hasRateLimitError = SupabaseRateLimitHandler.RATE_LIMIT_ERRORS.some(
      (pattern) => message.includes(pattern) || code.includes(pattern)
    );

    // Check for HTTP status codes
    const hasRateLimitStatus = [429, 503, 502, 504].includes(status);

    // Check for rate limit keywords
    const hasRateLimitKeywords = [
      "rate",
      "limit",
      "too many",
      "throttle",
      "quota",
      "exceeded",
      "temporary",
      "retry",
      "wait",
      "slow down",
      "congestion",
    ].some((keyword) => message.includes(keyword));

    // Check for network-level rate limiting
    const _hasNetworkRateLimit = [
      "network request failed",
      "connection timeout",
      "request timeout",
      "server timeout",
    ].some((keyword) => message.includes(keyword));

    // Check for Supabase specific patterns
    const hasSupabaseRateLimit =
      ["supabase", "gotrue", "auth", "realtime", "database"].some((service) =>
        message.includes(service)
      ) && hasRateLimitKeywords;

    const isRateLimited =
      hasRateLimitError || hasRateLimitStatus || hasSupabaseRateLimit;

    if (isRateLimited) {
      SupabaseRateLimitHandler.metrics.rateLimitedRequests++;
      SupabaseRateLimitHandler.logger.warn("Rate limit detected", {
        message,
        code,
        status,
        timestamp: Date.now(),
        requestId: error.requestId || `req_${Date.now()}`,
      });
    }

    return isRateLimited;
  }

  /**
   * Enhanced rate limit error analysis with comprehensive metadata
   */
  static analyzeRateLimitError(error: any): RateLimitInfo {
    if (!SupabaseRateLimitHandler.isRateLimitError(error)) {
      return {
        isRateLimited: false,
        message: error.message || "Unknown error",
        timestamp: Date.now(),
      };
    }

    const message = error.message?.toLowerCase() || "";
    const code = error.code?.toLowerCase() || "";
    const status = error.status || error.statusCode || 0;
    const requestId = error.requestId || `req_${Date.now()}`;

    // Detect specific rate limit type with priority order
    let limitType: RateLimitInfo["limitType"] = "api"; // Default to api

    for (const [type, pattern] of Object.entries(
      SupabaseRateLimitHandler.LIMIT_PATTERNS
    )) {
      if (pattern.test(message) || pattern.test(code)) {
        limitType = type as RateLimitInfo["limitType"];
        break;
      }
    }

    // Extract retry-after from headers if available
    const retryAfter = SupabaseRateLimitHandler.extractRetryAfter(error);

    // Determine severity based on limit type and retry time
    const severity = SupabaseRateLimitHandler.determineSeverity(
      limitType,
      retryAfter
    );

    // Update metrics by type
    if (!SupabaseRateLimitHandler.metrics.rateLimitsByType[limitType]) {
      SupabaseRateLimitHandler.metrics.rateLimitsByType[limitType] = 0;
    }
    SupabaseRateLimitHandler.metrics.rateLimitsByType[limitType]++;
    SupabaseRateLimitHandler.metrics.lastRateLimitTime = Date.now();

    const rateLimitInfo: RateLimitInfo = {
      isRateLimited: true,
      retryAfter,
      limitType,
      message: SupabaseRateLimitHandler.getFriendlyMessage(
        limitType,
        retryAfter
      ),
      suggestion: SupabaseRateLimitHandler.getSuggestion(limitType),
      severity,
      errorCode: code || SupabaseRateLimitHandler.mapErrorCode(error),
      timestamp: Date.now(),
      requestId,
      metadata: {
        originalMessage: error.message,
        status,
        headers: error.headers || {},
        userAgent:
          typeof window !== "undefined" ? window.navigator.userAgent : "server",
        retryCount: error.retryCount || 0,
        circuitBreakerState: SupabaseRateLimitHandler.circuitBreaker.state,
      },
    };

    SupabaseRateLimitHandler.logger.error(
      "Rate limit analysis complete",
      rateLimitInfo
    );

    return rateLimitInfo;
  }

  /**
   * Enhanced retry-after extraction with intelligent estimation
   */
  private static extractRetryAfter(error: any): number | undefined {
    // Check headers if available
    if (error.headers?.["retry-after"]) {
      return parseInt(error.headers["retry-after"], 10);
    }

    if (error.headers?.["x-ratelimit-reset"]) {
      const resetTime = parseInt(error.headers["x-ratelimit-reset"], 10);
      return Math.max(0, resetTime - Math.floor(Date.now() / 1000));
    }

    // Parse from message if included
    const message = error.message || "";
    const retryMatch =
      message.match(/retry.*?(\d+)/i) ||
      message.match(/wait.*?(\d+)/i) ||
      message.match(/(\d+).*?(?:second|minute|hour)/i);
    if (retryMatch) {
      let duration = parseInt(retryMatch[1], 10);
      if (message.includes("minute")) duration *= 60;
      if (message.includes("hour")) duration *= 3600;
      return duration;
    }

    // Advanced estimates based on Supabase docs and observed behavior
    const limitType = SupabaseRateLimitHandler.detectLimitType(message);
    switch (limitType) {
      case "email":
        return 1800; // 30 minutes (conservative for 2/hour limit)
      case "mfa":
        return 60; // 1 minute (15/minute limit)
      case "anonymous":
        return 120; // 2 minutes (30/hour limit)
      case "otp":
        return 300; // 5 minutes (conservative for OTP)
      case "verification":
        return 300; // 5 minutes for verification attempts
      case "token_refresh":
        return 30; // 30 seconds for token refresh
      case "api":
        return 60; // 1 minute for general API limits
      case "database":
        return 120; // 2 minutes for database connections
      case "realtime":
        return 90; // 1.5 minutes for realtime connections
      default:
        return 300; // 5 minutes default
    }
  }

  /**
   * Determine error severity based on type and retry duration
   */
  private static determineSeverity(
    limitType: string,
    retryAfter?: number
  ): "low" | "medium" | "high" | "critical" {
    if (!retryAfter) return "medium";

    // Critical: Long waits or email limits
    if (limitType === "email" || retryAfter > 1800) return "critical";

    // High: Significant delays
    if (retryAfter > 300) return "high";

    // Medium: Moderate delays
    if (retryAfter > 60) return "medium";

    // Low: Short delays
    return "low";
  }

  /**
   * Map error to standardized error code
   */
  private static mapErrorCode(error: any): string {
    const message = error.message?.toLowerCase() || "";
    const code = error.code?.toLowerCase() || "";

    if (code) return code;

    // Map common patterns to error codes
    if (message.includes("email") && message.includes("rate")) {
      return SupabaseRateLimitHandler.ERROR_CODES.EMAIL_RATE_LIMIT;
    }
    if (message.includes("too many")) {
      return SupabaseRateLimitHandler.ERROR_CODES.TOO_MANY_REQUESTS;
    }
    if (message.includes("weak password")) {
      return SupabaseRateLimitHandler.ERROR_CODES.WEAK_PASSWORD;
    }
    if (message.includes("invalid credentials")) {
      return SupabaseRateLimitHandler.ERROR_CODES.INVALID_CREDENTIALS;
    }
    if (message.includes("session not found")) {
      return SupabaseRateLimitHandler.ERROR_CODES.SESSION_NOT_FOUND;
    }

    return SupabaseRateLimitHandler.ERROR_CODES.RATE_LIMIT_EXCEEDED;
  }

  /**
   * Detect rate limit type from message
   */
  private static detectLimitType(message: string): RateLimitInfo["limitType"] {
    for (const [type, pattern] of Object.entries(
      SupabaseRateLimitHandler.LIMIT_PATTERNS
    )) {
      if (pattern.test(message)) {
        return type as RateLimitInfo["limitType"];
      }
    }
    return "email";
  }

  /**
   * Get user-friendly error message
   */
  private static getFriendlyMessage(
    limitType?: RateLimitInfo["limitType"],
    retryAfter?: number
  ): string {
    const timeStr = retryAfter
      ? ` Please try again in ${Math.ceil(retryAfter / 60)} minutes.`
      : "";

    switch (limitType) {
      case "email":
        return `Email rate limit exceeded. Supabase allows only 2 emails per hour.${timeStr}`;
      case "otp":
        return `OTP rate limit exceeded. Too many verification codes requested.${timeStr}`;
      case "verification":
        return `Verification rate limit exceeded. Too many verification attempts.${timeStr}`;
      case "mfa":
        return `MFA rate limit exceeded. Too many authentication attempts.${timeStr}`;
      case "anonymous":
        return `Anonymous sign-in rate limit exceeded.${timeStr}`;
      default:
        return `Rate limit exceeded. Too many requests.${timeStr}`;
    }
  }

  /**
   * Get suggestion for user based on rate limit type
   */
  private static getSuggestion(limitType?: RateLimitInfo["limitType"]): string {
    switch (limitType) {
      case "email":
        return "Try using magic link sign-in or contact support if you need immediate access.";
      case "otp":
        return "Wait before requesting another verification code, or try alternative verification methods.";
      case "verification":
        return "Please wait before attempting verification again.";
      case "mfa":
        return "Wait before attempting multi-factor authentication again.";
      case "anonymous":
        return "Wait before attempting anonymous sign-in, or create a permanent account.";
      default:
        return "Please wait before making another request.";
    }
  }

  /**
   * Enhanced backoff calculation with jitter and adaptive strategies
   */
  static calculateBackoffDelay(
    attempt: number,
    config: RetryConfig = SupabaseRateLimitHandler.DEFAULT_RETRY_CONFIG
  ): number {
    // Base exponential backoff
    const exponentialDelay = Math.min(
      config.baseDelay * config.backoffMultiplier ** attempt,
      config.maxDelay
    );

    // Add jitter to prevent thundering herd
    const jitter = config.enableJitter
      ? Math.random() * exponentialDelay * 0.1
      : 0;

    // Adaptive retry: increase delay based on recent failures
    let adaptiveMultiplier = 1;
    if (config.adaptiveRetry) {
      const recentFailures =
        SupabaseRateLimitHandler.metrics.rateLimitedRequests;
      const recentSuccess = SupabaseRateLimitHandler.metrics.successfulRetries;
      const failureRate =
        recentFailures / Math.max(1, recentFailures + recentSuccess);

      // Increase delay by up to 50% if failure rate is high
      adaptiveMultiplier = 1 + failureRate * 0.5;
    }

    const finalDelay = Math.floor(
      (exponentialDelay + jitter) * adaptiveMultiplier
    );

    SupabaseRateLimitHandler.logger.debug(
      `Calculated backoff delay: ${finalDelay}ms`,
      {
        attempt,
        exponentialDelay,
        jitter,
        adaptiveMultiplier,
        config,
      }
    );

    return finalDelay;
  }

  /**
   * Circuit breaker implementation
   */
  static isCircuitBreakerOpen(): boolean {
    const now = Date.now();

    switch (SupabaseRateLimitHandler.circuitBreaker.state) {
      case "closed":
        return false;

      case "open":
        // Check if we should transition to half-open
        if (now >= SupabaseRateLimitHandler.circuitBreaker.nextAttemptTime) {
          SupabaseRateLimitHandler.circuitBreaker.state = "half-open";
          SupabaseRateLimitHandler.circuitBreaker.successCount = 0;
          SupabaseRateLimitHandler.logger.info(
            "Circuit breaker transitioning to half-open state"
          );
          return false;
        }
        return true;

      case "half-open":
        return false;

      default:
        return false;
    }
  }

  /**
   * Record circuit breaker success
   */
  static recordCircuitBreakerSuccess(): void {
    if (SupabaseRateLimitHandler.circuitBreaker.state === "half-open") {
      SupabaseRateLimitHandler.circuitBreaker.successCount++;

      // Transition to closed after sufficient successes
      if (SupabaseRateLimitHandler.circuitBreaker.successCount >= 3) {
        SupabaseRateLimitHandler.circuitBreaker.state = "closed";
        SupabaseRateLimitHandler.circuitBreaker.failureCount = 0;
        SupabaseRateLimitHandler.logger.info(
          "Circuit breaker closed - service recovered"
        );
      }
    } else if (SupabaseRateLimitHandler.circuitBreaker.state === "closed") {
      // Reset failure count on success
      SupabaseRateLimitHandler.circuitBreaker.failureCount = 0;
    }
  }

  /**
   * Record circuit breaker failure
   */
  static recordCircuitBreakerFailure(): void {
    const now = Date.now();
    SupabaseRateLimitHandler.circuitBreaker.failureCount++;
    SupabaseRateLimitHandler.circuitBreaker.lastFailureTime = now;

    // Threshold for opening circuit breaker
    const failureThreshold = 5;
    const timeWindow = 60000; // 1 minute

    if (
      SupabaseRateLimitHandler.circuitBreaker.failureCount >=
        failureThreshold &&
      now - SupabaseRateLimitHandler.circuitBreaker.lastFailureTime < timeWindow
    ) {
      SupabaseRateLimitHandler.circuitBreaker.state = "open";
      SupabaseRateLimitHandler.circuitBreaker.nextAttemptTime =
        now +
        60000 *
          2 **
            Math.min(
              SupabaseRateLimitHandler.circuitBreaker.failureCount -
                failureThreshold,
              4
            ); // Max 16 minutes
      SupabaseRateLimitHandler.metrics.circuitBreakerTrips++;

      SupabaseRateLimitHandler.logger.warn(
        "Circuit breaker opened due to repeated failures",
        {
          failureCount: SupabaseRateLimitHandler.circuitBreaker.failureCount,
          nextAttemptTime:
            SupabaseRateLimitHandler.circuitBreaker.nextAttemptTime,
          waitTime:
            SupabaseRateLimitHandler.circuitBreaker.nextAttemptTime - now,
        }
      );
    }
  }

  /**
   * Enhanced retry decision logic with circuit breaker integration
   */
  static shouldRetry(
    rateLimitInfo: RateLimitInfo,
    attempt: number,
    config: RetryConfig = SupabaseRateLimitHandler.DEFAULT_RETRY_CONFIG
  ): boolean {
    if (!rateLimitInfo.isRateLimited) return false;

    // Check circuit breaker first
    if (
      config.circuitBreakerEnabled &&
      SupabaseRateLimitHandler.isCircuitBreakerOpen()
    ) {
      SupabaseRateLimitHandler.logger.debug("Retry blocked by circuit breaker");
      return false;
    }

    // Don't retry email operations (2/hour is too restrictive)
    if (rateLimitInfo.limitType === "email") {
      SupabaseRateLimitHandler.logger.debug("Email rate limit - no retry");
      return false;
    }

    // Don't retry critical severity errors for too long
    if (rateLimitInfo.severity === "critical" && attempt > 1) {
      SupabaseRateLimitHandler.logger.debug(
        "Critical severity - limited retries"
      );
      return false;
    }

    // Limit retry attempts based on configuration
    if (attempt >= config.maxRetries) {
      SupabaseRateLimitHandler.logger.debug("Max retries reached");
      return false;
    }

    // Don't retry if wait time is too long
    if (
      rateLimitInfo.retryAfter &&
      rateLimitInfo.retryAfter > config.maxDelay / 1000
    ) {
      SupabaseRateLimitHandler.logger.debug("Retry delay too long");
      return false;
    }

    return true;
  }

  /**
   * Get current metrics
   */
  static getMetrics(): RateLimitMetrics {
    return { ...SupabaseRateLimitHandler.metrics };
  }

  /**
   * Get circuit breaker state
   */
  static getCircuitBreakerState(): CircuitBreakerState {
    return { ...SupabaseRateLimitHandler.circuitBreaker };
  }

  /**
   * Reset metrics (useful for testing)
   */
  static resetMetrics(): void {
    SupabaseRateLimitHandler.metrics = {
      totalRequests: 0,
      rateLimitedRequests: 0,
      successfulRetries: 0,
      failedRetries: 0,
      averageRetryDelay: 0,
      circuitBreakerTrips: 0,
      bypassedRequests: 0,
      rateLimitsByType: {},
    };
  }

  /**
   * Reset circuit breaker (useful for testing)
   */
  static resetCircuitBreaker(): void {
    SupabaseRateLimitHandler.circuitBreaker = {
      state: "closed",
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
      successCount: 0,
    };
  }

  /**
   * Check if development bypass is available
   */
  static canBypassInDevelopment(): boolean {
    return (
      process.env.NODE_ENV === "development" &&
      (process.env.SUPABASE_BYPASS_RATE_LIMITS === "true" ||
        process.env.BYPASS_RATE_LIMITS === "true")
    );
  }

  /**
   * Format time remaining for user display
   */
  static formatTimeRemaining(seconds: number): string {
    if (seconds < 60) {
      return `${seconds} seconds`;
    }

    const minutes = Math.ceil(seconds / 60);
    if (minutes < 60) {
      return `${minutes} minute${minutes === 1 ? "" : "s"}`;
    }

    const hours = Math.ceil(minutes / 60);
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
}

/**
 * Enhanced wrapper function for Supabase auth operations with comprehensive rate limit handling
 */
export async function withRateLimitHandling<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    config?: Partial<RetryConfig>;
    onRateLimit?: (rateLimitInfo: RateLimitInfo) => void;
    onRetry?: (attempt: number, delay: number) => void;
    onSuccess?: (result: T) => void;
    onFailure?: (error: any) => void;
  } = {}
): Promise<T> {
  const config: RetryConfig = {
    ...SupabaseRateLimitHandler.DEFAULT_RETRY_CONFIG,
    ...options.config,
    maxRetries:
      options.maxRetries ||
      SupabaseRateLimitHandler.DEFAULT_RETRY_CONFIG.maxRetries,
  };

  let lastError: any;
  const startTime = Date.now();

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      // Check circuit breaker before attempting operation
      if (
        config.circuitBreakerEnabled &&
        SupabaseRateLimitHandler.isCircuitBreakerOpen()
      ) {
        throw new Error(
          "Circuit breaker is open - service temporarily unavailable"
        );
      }

      const result = await operation();

      // Record success
      SupabaseRateLimitHandler.recordCircuitBreakerSuccess();
      if (attempt > 0) {
        SupabaseRateLimitHandler.metrics.successfulRetries++;
      }

      // Call success callback
      if (options.onSuccess) {
        options.onSuccess(result);
      }

      return result;
    } catch (error) {
      lastError = error;

      const rateLimitInfo =
        SupabaseRateLimitHandler.analyzeRateLimitError(error);

      // Record failure for circuit breaker
      if (rateLimitInfo.isRateLimited) {
        SupabaseRateLimitHandler.recordCircuitBreakerFailure();
      }

      // Call rate limit callback
      if (rateLimitInfo.isRateLimited && options.onRateLimit) {
        options.onRateLimit(rateLimitInfo);
      }

      // Check if we should retry
      if (
        !SupabaseRateLimitHandler.shouldRetry(rateLimitInfo, attempt, config)
      ) {
        if (options.onFailure) {
          options.onFailure(error);
        }
        throw error;
      }

      // Calculate delay and wait
      const delay = rateLimitInfo.retryAfter
        ? rateLimitInfo.retryAfter * 1000
        : SupabaseRateLimitHandler.calculateBackoffDelay(attempt, config);

      // Update metrics
      SupabaseRateLimitHandler.metrics.failedRetries++;
      SupabaseRateLimitHandler.metrics.averageRetryDelay =
        (SupabaseRateLimitHandler.metrics.averageRetryDelay + delay) / 2;

      // Call retry callback
      if (options.onRetry) {
        options.onRetry(attempt + 1, delay);
      }

      SupabaseRateLimitHandler.logger.info(
        `Retrying operation (attempt ${attempt + 1}/${config.maxRetries}) after ${delay}ms delay`,
        {
          rateLimitInfo,
          attempt,
          delay,
          totalTime: Date.now() - startTime,
        }
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted
  if (options.onFailure) {
    options.onFailure(lastError);
  }

  throw lastError;
}

/**
 * Enhanced development helper to bypass rate limits with multiple strategies
 */
export async function bypassRateLimitInDev(
  email: string,
  strategy: "email" | "admin" | "direct" = "email"
): Promise<boolean> {
  if (!SupabaseRateLimitHandler.canBypassInDevelopment()) {
    SupabaseRateLimitHandler.logger.warn(
      "Rate limit bypass is only available in development with bypass flag enabled"
    );
    return false;
  }

  SupabaseRateLimitHandler.metrics.bypassedRequests++;

  try {
    let success = false;

    switch (strategy) {
      case "email":
        success = await bypassEmailConfirmation(email);
        break;
      case "admin":
        success = await bypassWithAdminAPI(email);
        break;
      case "direct":
        success = await bypassWithDirectDatabase(email);
        break;
      default:
        throw new Error(`Unknown bypass strategy: ${strategy}`);
    }

    if (success) {
      SupabaseRateLimitHandler.logger.info(
        `✅ Successfully bypassed rate limit for: ${email} using strategy: ${strategy}`
      );
    } else {
      SupabaseRateLimitHandler.logger.error(
        `❌ Failed to bypass rate limit for: ${email} using strategy: ${strategy}`
      );
    }

    return success;
  } catch (error) {
    SupabaseRateLimitHandler.logger.error(
      "❌ Error bypassing rate limit:",
      error
    );
    return false;
  }
}

/**
 * Bypass email confirmation via API
 */
async function bypassEmailConfirmation(email: string): Promise<boolean> {
  try {
    const response = await fetch("/api/admin/bypass-email-confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (response.ok) {
      return true;
    } else {
      const errorText = await response.text();
      SupabaseRateLimitHandler.logger.error("API bypass failed:", errorText);
      return false;
    }
  } catch (error) {
    SupabaseRateLimitHandler.logger.error("API bypass error:", error);
    return false;
  }
}

/**
 * Bypass using admin API
 */
async function bypassWithAdminAPI(email: string): Promise<boolean> {
  try {
    const response = await fetch("/api/admin/bypass-email-confirmation-demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    return response.ok;
  } catch (error) {
    SupabaseRateLimitHandler.logger.error("Admin API bypass error:", error);
    return false;
  }
}

/**
 * Bypass using direct database access (development only)
 */
async function bypassWithDirectDatabase(email: string): Promise<boolean> {
  try {
    // This would require direct database access and is highly specific to the implementation
    // For now, just log the attempt
    SupabaseRateLimitHandler.logger.info(
      `Direct database bypass attempted for: ${email}`
    );
    return false; // Not implemented yet
  } catch (error) {
    SupabaseRateLimitHandler.logger.error(
      "Direct database bypass error:",
      error
    );
    return false;
  }
}

/**
 * Utility function to create a rate limit error for testing
 */
export function createRateLimitError(
  limitType: RateLimitInfo["limitType"] = "email",
  retryAfter?: number,
  customMessage?: string
): Error {
  const error = new Error(
    customMessage || `Rate limit exceeded for ${limitType}`
  );
  (error as any).code = "rate_limit_exceeded";
  (error as any).status = 429;
  (error as any).headers = retryAfter
    ? { "retry-after": retryAfter.toString() }
    : {};
  return error;
}

/**
 * Utility function to get formatted rate limit status
 */
export function getRateLimitStatus(): {
  isHealthy: boolean;
  metrics: RateLimitMetrics;
  circuitBreaker: CircuitBreakerState;
  recommendations: string[];
} {
  const metrics = SupabaseRateLimitHandler.getMetrics();
  const circuitBreaker = SupabaseRateLimitHandler.getCircuitBreakerState();

  const failureRate =
    metrics.totalRequests > 0
      ? metrics.rateLimitedRequests / metrics.totalRequests
      : 0;

  const recommendations: string[] = [];

  if (failureRate > 0.1) {
    recommendations.push(
      "High rate limit failure rate detected - consider implementing request throttling"
    );
  }

  if (circuitBreaker.state === "open") {
    recommendations.push(
      "Circuit breaker is open - service may be experiencing issues"
    );
  }

  if (metrics.averageRetryDelay > 10000) {
    recommendations.push(
      "High average retry delay - consider optimizing retry strategy"
    );
  }

  if (Object.values(metrics.rateLimitsByType).some((count) => count > 5)) {
    recommendations.push(
      "High rate limits in specific categories - review usage patterns"
    );
  }

  return {
    isHealthy: failureRate < 0.05 && circuitBreaker.state !== "open",
    metrics,
    circuitBreaker,
    recommendations,
  };
}

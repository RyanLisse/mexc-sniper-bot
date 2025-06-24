/**
 * Enhanced MEXC Credential Validator
 *
 * Comprehensive credential validation service that addresses all credential-related issues:
 * - Detects test/placeholder credentials
 * - Validates credential format and authenticity
 * - Implements circuit breaker pattern for API failures
 * - Provides real-time status monitoring
 * - Includes health metrics and recovery mechanisms
 */

import * as crypto from "node:crypto";
import { toSafeError } from "../lib/error-type-utils";
import { createSafeLogger } from "../lib/structured-logger";

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface CredentialValidationResult {
  hasCredentials: boolean;
  isValid: boolean;
  source: "database" | "environment" | "none";
  isTestCredentials: boolean;
  validFormat: boolean;
  canAuthenticate: boolean;
  error?: string;
  responseTime?: number;
  timestamp: string;
  details: {
    apiKeyValid: boolean;
    secretKeyValid: boolean;
    formatValidation: string[];
    authenticationDetails?: {
      accountAccessible: boolean;
      permissions: string[];
      accountType?: string;
    };
  };
}

export interface CircuitBreakerState {
  isOpen: boolean;
  failures: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
  reason?: string;
}

export interface ConnectionHealthMetrics {
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  successRate: number;
  averageLatency: number;
  lastSuccessTime?: Date;
  lastFailureTime?: Date;
  consecutiveFailures: number;
  connectionQuality: "excellent" | "good" | "fair" | "poor";
}

export interface EnhancedCredentialValidatorConfig {
  circuitBreakerThreshold: number;
  circuitBreakerResetTimeout: number;
  requestTimeout: number;
  maxRetries: number;
  retryDelay: number;
  healthCheckInterval: number;
  enableRealTimeMonitoring: boolean;
}

// ============================================================================
// Enhanced Credential Validator Implementation
// ============================================================================

export class EnhancedCredentialValidator {
  private logger = createSafeLogger("enhanced-mexc-credential-validator");

  private config: EnhancedCredentialValidatorConfig;
  private circuitBreaker: CircuitBreakerState;
  private healthMetrics: ConnectionHealthMetrics;
  private recentLatencies: number[] = [];
  private statusChangeCallbacks: ((status: CredentialValidationResult) => void)[] = [];

  // Known test/placeholder credential patterns
  // FIXED: Removed hardcoded production credential patterns that were blocking legitimate trading
  private readonly TEST_CREDENTIAL_PATTERNS = [
    /^(test|demo|example|placeholder|sample)/i, // Obvious test keywords
    /^(your_api_key|your_secret|api_key_here|secret_here)/i, // Placeholder text
    /^(12345|00000|11111|aaaaa|bbbbb)/, // Sequential/repeated patterns
    /^(undefined|null|empty|none)$/i, // Null-like values
    /^mx0vglsgdd7flAhfqq$/i, // Current test API key
    /^0351d73e5a444d5ea5de2d527bd2a07a$/i, // Current test secret key
  ];

  constructor(config: Partial<EnhancedCredentialValidatorConfig> = {}) {
    this.config = {
      circuitBreakerThreshold: 5,
      circuitBreakerResetTimeout: 300000, // 5 minutes
      requestTimeout: 15000, // 15 seconds
      maxRetries: 3,
      retryDelay: 1000, // 1 second
      healthCheckInterval: 30000, // 30 seconds
      enableRealTimeMonitoring: true,
      ...config,
    };

    this.circuitBreaker = {
      isOpen: false,
      failures: 0,
    };

    this.healthMetrics = {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      successRate: 0,
      averageLatency: 0,
      consecutiveFailures: 0,
      connectionQuality: "excellent",
    };
  }

  // ============================================================================
  // Main Validation Methods
  // ============================================================================

  /**
   * Comprehensive credential validation
   */
  async validateCredentials(): Promise<CredentialValidationResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // Step 1: Check if credentials exist
      const credentials = this.getCredentials();
      if (!credentials.hasCredentials) {
        return {
          hasCredentials: false,
          isValid: false,
          source: "none",
          isTestCredentials: false,
          validFormat: false,
          canAuthenticate: false,
          error:
            "No API credentials configured. Please set MEXC_API_KEY and MEXC_SECRET_KEY environment variables or configure credentials in the database.",
          timestamp,
          details: {
            apiKeyValid: false,
            secretKeyValid: false,
            formatValidation: ["No credentials found"],
          },
        };
      }

      // Step 2: Validate format
      const formatValidation = this.validateFormat();

      // Step 3: Check for test credentials
      const isTestCredentials = this.detectTestCredentials(
        credentials.apiKey,
        credentials.secretKey
      );

      // Check for test credentials
      if (isTestCredentials) {
        logger.warn(
          "🔍 Test credentials detected - system will flag as invalid for proper validation"
        );
        return {
          hasCredentials: true,
          isValid: false, // Test credentials are flagged as invalid
          source: credentials.source,
          isTestCredentials: true,
          validFormat: formatValidation.validFormat,
          canAuthenticate: false, // Test credentials cannot authenticate
          error:
            "test or placeholder credentials detected. Configure real MEXC API credentials for live trading.",
          timestamp,
          details: {
            apiKeyValid: formatValidation.apiKeyValid,
            secretKeyValid: formatValidation.secretKeyValid,
            formatValidation: [
              "Test credentials detected",
              "Invalid for production use",
              "Configure real credentials",
            ],
          },
        };
      }

      // Step 4: Test authentication if format is valid
      let authResult = null;
      if (formatValidation.validFormat) {
        authResult = await this.testAuthentication();
      }

      const responseTime = Date.now() - startTime;
      this.recordLatency(responseTime);

      const result: CredentialValidationResult = {
        hasCredentials: true,
        isValid: authResult?.canAuthenticate || false,
        source: credentials.source,
        isTestCredentials: false,
        validFormat: formatValidation.validFormat,
        canAuthenticate: authResult?.canAuthenticate || false,
        error:
          authResult?.error ||
          (!formatValidation.validFormat ? "Invalid credential format" : undefined),
        responseTime,
        timestamp,
        details: {
          apiKeyValid: formatValidation.apiKeyValid,
          secretKeyValid: formatValidation.secretKeyValid,
          formatValidation: formatValidation.validationMessages,
          authenticationDetails: authResult?.authenticationDetails,
        },
      };

      // Update health metrics
      this.updateHealthMetrics(result.isValid);

      // Notify listeners of status change
      this.notifyStatusChange(result);

      return result;
    } catch (error) {
      const safeError = toSafeError(error);
      const responseTime = Date.now() - startTime;

      this.recordLatency(responseTime);
      this.updateHealthMetrics(false);

      return {
        hasCredentials: true,
        isValid: false,
        source: "environment",
        isTestCredentials: false,
        validFormat: false,
        canAuthenticate: false,
        error: `Credential validation failed: ${safeError.message}`,
        responseTime,
        timestamp,
        details: {
          apiKeyValid: false,
          secretKeyValid: false,
          formatValidation: [`Validation error: ${safeError.message}`],
        },
      };
    }
  }

  /**
   * Validate credential format without API calls
   */
  validateFormat(): {
    validFormat: boolean;
    apiKeyValid: boolean;
    secretKeyValid: boolean;
    validationMessages: string[];
  } {
    const credentials = this.getCredentials();
    const messages: string[] = [];

    if (!credentials.hasCredentials) {
      return {
        validFormat: false,
        apiKeyValid: false,
        secretKeyValid: false,
        validationMessages: ["No credentials provided"],
      };
    }

    // Validate API key format
    const apiKeyValid = this.validateApiKeyFormat(credentials.apiKey);
    if (!apiKeyValid) {
      messages.push("API key format invalid");
    }

    // Validate secret key format
    const secretKeyValid = this.validateSecretKeyFormat(credentials.secretKey);
    if (!secretKeyValid) {
      messages.push("Secret key format invalid");
    }

    const validFormat = apiKeyValid && secretKeyValid;

    if (validFormat) {
      messages.push("Credential format valid");
    }

    return {
      validFormat,
      apiKeyValid,
      secretKeyValid,
      validationMessages: messages,
    };
  }

  /**
   * Test authentication against MEXC API
   */
  async testAuthentication(): Promise<{
    canAuthenticate: boolean;
    responseTime: number;
    error?: string;
    circuitOpen?: boolean;
    retry?: boolean;
    authenticationDetails?: {
      accountAccessible: boolean;
      permissions: string[];
      accountType?: string;
    };
  }> {
    const startTime = Date.now();

    // Check circuit breaker
    if (this.circuitBreaker.isOpen) {
      if (this.shouldAttemptReset()) {
        this.resetCircuitBreaker();
      } else {
        return {
          canAuthenticate: false,
          responseTime: Date.now() - startTime,
          circuitOpen: true,
          error: `Circuit breaker is open. Next attempt at ${this.circuitBreaker.nextAttemptTime?.toISOString()}`,
        };
      }
    }

    const credentials = this.getCredentials();
    if (!credentials.hasCredentials) {
      return {
        canAuthenticate: false,
        responseTime: Date.now() - startTime,
        error: "No credentials available for authentication test",
      };
    }

    try {
      // Test with account info endpoint (requires authentication)
      const result = await this.makeAuthenticatedRequest("/api/v3/account", credentials);

      if (result.success) {
        this.recordSuccess();

        // Extract account details
        const authenticationDetails = {
          accountAccessible: true,
          permissions: result.data?.permissions || ["spot"],
          accountType: result.data?.accountType || "SPOT",
        };

        const responseTime = Date.now() - startTime;
        return {
          canAuthenticate: true,
          responseTime: Math.max(responseTime, 1), // Ensure minimum 1ms response time
          authenticationDetails,
        };
      } else {
        this.recordFailure();
        return {
          canAuthenticate: false,
          responseTime: Date.now() - startTime,
          error: result.error || "Authentication failed",
          retry: this.shouldRetry(result.error),
        };
      }
    } catch (error) {
      this.recordFailure();
      const safeError = toSafeError(error);

      return {
        canAuthenticate: false,
        responseTime: Date.now() - startTime,
        error: `Authentication test failed: ${safeError.message}`,
        retry: this.shouldRetry(safeError.message),
      };
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getCredentials(): {
    hasCredentials: boolean;
    apiKey: string;
    secretKey: string;
    source: "database" | "environment" | "none";
  } {
    // Check environment variables first
    const envApiKey = process.env.MEXC_API_KEY;
    const envSecretKey = process.env.MEXC_SECRET_KEY;

    if (envApiKey && envSecretKey) {
      return {
        hasCredentials: true,
        apiKey: envApiKey,
        secretKey: envSecretKey,
        source: "environment",
      };
    }

    // TODO: Add database credential retrieval here
    // For now, return none if no environment variables

    return {
      hasCredentials: false,
      apiKey: "",
      secretKey: "",
      source: "none",
    };
  }

  private detectTestCredentials(apiKey: string, secretKey: string): boolean {
    return this.TEST_CREDENTIAL_PATTERNS.some(
      (pattern) => pattern.test(apiKey) || pattern.test(secretKey)
    );
  }

  private validateApiKeyFormat(apiKey: string): boolean {
    // MEXC API keys typically start with 'mx' and are alphanumeric
    if (!apiKey || apiKey.length < 16) return false;
    if (!apiKey.startsWith("mx")) return false;
    if (!/^[a-zA-Z0-9]+$/.test(apiKey)) return false;

    // Don't validate against test patterns here - that's handled separately
    // This validation is purely for format
    return true;
  }

  private validateSecretKeyFormat(secretKey: string): boolean {
    // MEXC secret keys are typically 32+ character hex/alphanumeric strings
    if (!secretKey || secretKey.length < 32) return false;
    if (!/^[a-fA-F0-9]+$/.test(secretKey)) return false;

    // Don't validate against test patterns here - that's handled separately
    // This validation is purely for format
    return true;
  }

  private async makeAuthenticatedRequest(
    endpoint: string,
    credentials: { apiKey: string; secretKey: string }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const baseUrl = process.env.MEXC_BASE_URL || "https://api.mexc.com";
    const timestamp = Date.now();

    // Create signature
    const queryString = `timestamp=${timestamp}`;
    const signature = crypto
      .createHmac("sha256", credentials.secretKey)
      .update(queryString)
      .digest("hex");

    const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-MEXC-APIKEY": credentials.apiKey,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(this.config.requestTimeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.msg || errorJson.message || errorMessage;
        } catch {
          if (errorText) {
            errorMessage = errorText;
          }
        }

        return { success: false, error: errorMessage };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      const safeError = toSafeError(error);
      return { success: false, error: safeError.message };
    }
  }

  // ============================================================================
  // Circuit Breaker Methods
  // ============================================================================

  private recordSuccess(): void {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.isOpen = false;
    this.circuitBreaker.lastFailureTime = undefined;
    this.circuitBreaker.nextAttemptTime = undefined;
    this.circuitBreaker.reason = undefined;
  }

  private recordFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = new Date();

    if (this.circuitBreaker.failures >= this.config.circuitBreakerThreshold) {
      this.openCircuitBreaker();
    }
  }

  private openCircuitBreaker(): void {
    this.circuitBreaker.isOpen = true;
    this.circuitBreaker.nextAttemptTime = new Date(
      Date.now() + this.config.circuitBreakerResetTimeout
    );
    this.circuitBreaker.reason = `Too many failures (${this.circuitBreaker.failures})`;
  }

  private shouldAttemptReset(): boolean {
    return this.circuitBreaker.nextAttemptTime && new Date() >= this.circuitBreaker.nextAttemptTime;
  }

  private resetCircuitBreaker(): void {
    this.circuitBreaker.isOpen = false;
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.nextAttemptTime = undefined;
    this.circuitBreaker.reason = undefined;
  }

  private shouldRetry(error?: string): boolean {
    if (!error) return true;

    // Don't retry on authentication errors
    if (error.includes("401") || error.includes("403") || error.includes("signature")) {
      return false;
    }

    // Don't retry on client errors (except rate limiting)
    if (error.includes("400") && !error.includes("429")) {
      return false;
    }

    return true;
  }

  // ============================================================================
  // Health Metrics Methods
  // ============================================================================

  private updateHealthMetrics(success: boolean): void {
    this.healthMetrics.totalChecks++;

    if (success) {
      this.healthMetrics.successfulChecks++;
      this.healthMetrics.lastSuccessTime = new Date();
      this.healthMetrics.consecutiveFailures = 0;
    } else {
      this.healthMetrics.failedChecks++;
      this.healthMetrics.lastFailureTime = new Date();
      this.healthMetrics.consecutiveFailures++;
    }

    this.healthMetrics.successRate =
      this.healthMetrics.successfulChecks / this.healthMetrics.totalChecks;

    this.updateConnectionQuality();
  }

  private updateConnectionQuality(): void {
    const { successRate, averageLatency, consecutiveFailures } = this.healthMetrics;

    if (consecutiveFailures >= 3 || successRate < 0.5) {
      this.healthMetrics.connectionQuality = "poor";
    } else if (consecutiveFailures >= 1 || successRate < 0.8 || averageLatency > 2000) {
      this.healthMetrics.connectionQuality = "fair";
    } else if (averageLatency > 1000) {
      this.healthMetrics.connectionQuality = "good";
    } else {
      this.healthMetrics.connectionQuality = "excellent";
    }
  }

  private recordLatency(latency: number): void {
    this.recentLatencies.push(latency);
    if (this.recentLatencies.length > 10) {
      this.recentLatencies.shift();
    }

    this.healthMetrics.averageLatency =
      this.recentLatencies.reduce((sum, lat) => sum + lat, 0) / this.recentLatencies.length;
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  /**
   * Get current health metrics
   */
  getHealthMetrics(): ConnectionHealthMetrics {
    return { ...this.healthMetrics };
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }

  /**
   * Reset all metrics and circuit breaker
   */
  reset(): void {
    this.circuitBreaker = {
      isOpen: false,
      failures: 0,
    };

    this.healthMetrics = {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      successRate: 0,
      averageLatency: 0,
      consecutiveFailures: 0,
      connectionQuality: "excellent",
    };

    this.recentLatencies = [];
  }

  /**
   * Register callback for status changes
   */
  onStatusChange(callback: (status: CredentialValidationResult) => void): void {
    this.statusChangeCallbacks.push(callback);
  }

  private notifyStatusChange(status: CredentialValidationResult): void {
    this.statusChangeCallbacks.forEach((callback) => {
      try {
        callback(status);
      } catch (error) {
        logger.error("Error in status change callback:", error);
      }
    });
  }
}

// ============================================================================
// Factory Functions and Exports
// ============================================================================

/**
 * Create enhanced credential validator with production-optimized defaults
 */
export function createEnhancedCredentialValidator(
  config?: Partial<EnhancedCredentialValidatorConfig>
): EnhancedCredentialValidator {
  const defaultConfig: Partial<EnhancedCredentialValidatorConfig> = {
    circuitBreakerThreshold: 5,
    circuitBreakerResetTimeout: 300000, // 5 minutes
    requestTimeout: 15000, // 15 seconds
    maxRetries: 3,
    retryDelay: 1000,
    healthCheckInterval: 30000, // 30 seconds
    enableRealTimeMonitoring: true,
  };

  return new EnhancedCredentialValidator({ ...defaultConfig, ...config });
}

// Global instance for singleton usage
let globalValidator: EnhancedCredentialValidator | null = null;

/**
 * Get or create global enhanced credential validator
 */
export function getGlobalCredentialValidator(): EnhancedCredentialValidator {
  if (!globalValidator) {
    globalValidator = createEnhancedCredentialValidator();
  }
  return globalValidator;
}

/**
 * Reset global validator instance
 */
export function resetGlobalCredentialValidator(): void {
  globalValidator = null;
}

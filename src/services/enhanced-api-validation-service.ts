/**
 * Enhanced API Validation Service
 *
 * Provides comprehensive validation of MEXC API connections with:
 * - Multi-step credential validation
 * - IP allowlisting verification
 * - Network connectivity testing
 * - Performance benchmarking
 * - Security compliance checks
 */

import { circuitBreakerRegistry } from "./circuit-breaker";
import { ErrorLoggingService } from "./error-logging-service";
import { getUnifiedMexcClient } from "./unified-mexc-client";

export interface ApiValidationConfig {
  apiKey: string;
  secretKey: string;
  passphrase?: string;
  testNetwork?: boolean;
  validateIpAllowlist?: boolean;
  performanceBenchmark?: boolean;
  securityChecks?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  stage: string;
  error?: string;
  details: {
    networkConnectivity: boolean;
    credentialFormat: boolean;
    apiAuthentication: boolean;
    permissionChecks: boolean;
    ipAllowlisting: boolean;
    performanceMetrics?: {
      averageLatency: number;
      maxLatency: number;
      successRate: number;
      circuitBreakerStatus: string;
    };
    securityAnalysis?: {
      keyStrength: "weak" | "moderate" | "strong";
      recommendedActions: string[];
      riskLevel: "low" | "medium" | "high";
    };
  };
  timestamp: string;
  recommendations: string[];
}

export class EnhancedApiValidationService {
  private static instance: EnhancedApiValidationService;
  private errorLogger = ErrorLoggingService.getInstance();
  private validationCache = new Map<string, { result: ValidationResult; expiresAt: number }>();
  private readonly cacheExpiryMs = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): EnhancedApiValidationService {
    if (!EnhancedApiValidationService.instance) {
      EnhancedApiValidationService.instance = new EnhancedApiValidationService();
    }
    return EnhancedApiValidationService.instance;
  }

  /**
   * Comprehensive API validation with multiple stages
   */
  async validateApiCredentials(config: ApiValidationConfig): Promise<ValidationResult> {
    const cacheKey = this.generateCacheKey(config);
    const cached = this.getCachedResult(cacheKey);

    if (cached) {
      console.log("[Enhanced API Validation] Using cached validation result");
      return cached;
    }

    const result: ValidationResult = {
      valid: false,
      stage: "initialization",
      details: {
        networkConnectivity: false,
        credentialFormat: false,
        apiAuthentication: false,
        permissionChecks: false,
        ipAllowlisting: false,
      },
      timestamp: new Date().toISOString(),
      recommendations: [],
    };

    try {
      // Stage 1: Credential Format Validation
      result.stage = "credential_format";
      const formatValidation = this.validateCredentialFormat(config);
      result.details.credentialFormat = formatValidation.valid;

      if (!formatValidation.valid) {
        result.error = formatValidation.error;
        result.recommendations.push(...formatValidation.recommendations);
        return this.cacheAndReturn(cacheKey, result);
      }

      // Stage 2: Network Connectivity Test
      result.stage = "network_connectivity";
      const connectivityResult = await this.testNetworkConnectivity();
      result.details.networkConnectivity = connectivityResult.success;

      if (!connectivityResult.success) {
        result.error = connectivityResult.error;
        result.recommendations.push("Check internet connection and firewall settings");
        return this.cacheAndReturn(cacheKey, result);
      }

      // Stage 3: API Authentication Test
      result.stage = "api_authentication";
      const authResult = await this.testApiAuthentication(config);
      result.details.apiAuthentication = authResult.success;

      if (!authResult.success) {
        result.error = authResult.error;
        result.recommendations.push(...authResult.recommendations);
        return this.cacheAndReturn(cacheKey, result);
      }

      // Stage 4: Permission Verification
      result.stage = "permission_checks";
      const permissionResult = await this.validateApiPermissions(config);
      result.details.permissionChecks = permissionResult.success;

      if (!permissionResult.success) {
        result.error = permissionResult.error;
        result.recommendations.push(...permissionResult.recommendations);
        return this.cacheAndReturn(cacheKey, result);
      }

      // Stage 5: IP Allowlisting Verification (if enabled)
      if (config.validateIpAllowlist) {
        result.stage = "ip_allowlisting";
        const ipResult = await this.validateIpAllowlisting(config);
        result.details.ipAllowlisting = ipResult.success;

        if (!ipResult.success) {
          result.error = ipResult.error;
          result.recommendations.push(...ipResult.recommendations);
        }
      } else {
        result.details.ipAllowlisting = true; // Skip if not requested
      }

      // Stage 6: Performance Benchmarking (if enabled)
      if (config.performanceBenchmark) {
        result.stage = "performance_benchmark";
        const perfResult = await this.benchmarkApiPerformance(config);
        result.details.performanceMetrics = perfResult.metrics;
        result.recommendations.push(...perfResult.recommendations);
      }

      // Stage 7: Security Analysis (if enabled)
      if (config.securityChecks) {
        result.stage = "security_analysis";
        const securityResult = this.analyzeSecurityPosture(config);
        result.details.securityAnalysis = securityResult.analysis;
        result.recommendations.push(...securityResult.recommendations);
      }

      // Final validation
      result.valid =
        result.details.networkConnectivity &&
        result.details.credentialFormat &&
        result.details.apiAuthentication &&
        result.details.permissionChecks &&
        result.details.ipAllowlisting;

      result.stage = "completed";

      if (result.valid) {
        result.recommendations.push("API credentials are fully validated and ready for trading");
      }

      return this.cacheAndReturn(cacheKey, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown validation error";
      console.error("[Enhanced API Validation] Validation failed:", error);

      await this.errorLogger.logError(error as Error, {
        context: "api_validation",
        stage: result.stage,
        hasApiKey: Boolean(config.apiKey),
        hasSecretKey: Boolean(config.secretKey),
      });

      result.error = errorMessage;
      result.recommendations.push("Check API credentials and network connectivity");

      return this.cacheAndReturn(cacheKey, result);
    }
  }

  /**
   * Validate credential format and structure
   */
  private validateCredentialFormat(config: ApiValidationConfig): {
    valid: boolean;
    error?: string;
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    // API Key validation
    if (!config.apiKey || typeof config.apiKey !== "string") {
      return {
        valid: false,
        error: "API key is required and must be a string",
        recommendations: ["Provide a valid MEXC API key from your account settings"],
      };
    }

    if (config.apiKey.length < 16) {
      return {
        valid: false,
        error: "API key appears to be too short",
        recommendations: ["Verify the API key is complete and properly copied"],
      };
    }

    // Secret Key validation
    if (!config.secretKey || typeof config.secretKey !== "string") {
      return {
        valid: false,
        error: "Secret key is required and must be a string",
        recommendations: ["Provide a valid MEXC secret key from your account settings"],
      };
    }

    if (config.secretKey.length < 32) {
      return {
        valid: false,
        error: "Secret key appears to be too short",
        recommendations: ["Verify the secret key is complete and properly copied"],
      };
    }

    // Check for common formatting issues
    if (config.apiKey.includes(" ") || config.secretKey.includes(" ")) {
      recommendations.push("Remove any spaces from API keys");
    }

    if (config.apiKey === config.secretKey) {
      return {
        valid: false,
        error: "API key and secret key cannot be the same",
        recommendations: ["Verify you have copied the correct API key and secret key"],
      };
    }

    return {
      valid: true,
      recommendations,
    };
  }

  /**
   * Test basic network connectivity to MEXC
   */
  private async testNetworkConnectivity(): Promise<{
    success: boolean;
    error?: string;
    latency?: number;
  }> {
    const startTime = Date.now();

    try {
      const mexcClient = getUnifiedMexcClient();
      const connected = await mexcClient.testConnectivity();
      const latency = Date.now() - startTime;

      if (!connected) {
        return {
          success: false,
          error: "Unable to connect to MEXC API endpoints",
          latency,
        };
      }

      return {
        success: true,
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network connectivity failed",
        latency,
      };
    }
  }

  /**
   * Test API authentication with provided credentials
   */
  private async testApiAuthentication(config: ApiValidationConfig): Promise<{
    success: boolean;
    error?: string;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];

    try {
      const mexcClient = getUnifiedMexcClient({
        apiKey: config.apiKey,
        secretKey: config.secretKey,
      });

      const serverTime = await mexcClient.getServerTime();
      const timeDiff = Math.abs(Date.now() - serverTime);

      // Check time synchronization
      if (timeDiff > 5000) {
        // 5 seconds
        recommendations.push(
          "Server time difference detected. Ensure system clock is synchronized"
        );
      }

      const accountInfo = await mexcClient.getAccountInfo();

      if (!accountInfo.success) {
        const errorMsg = accountInfo.error || "Authentication failed";

        // Provide specific error analysis
        if (errorMsg.includes("signature")) {
          return {
            success: false,
            error: "API signature validation failed",
            recommendations: [
              "Verify your secret key is correct",
              "Ensure system time is synchronized",
              "Check for extra spaces in credentials",
            ],
          };
        } else if (errorMsg.includes("key") || errorMsg.includes("10072")) {
          return {
            success: false,
            error: "Invalid API key",
            recommendations: [
              "Verify API key is active and correct",
              "Check if API key has been revoked or expired",
              "Ensure you are using the correct MEXC account",
            ],
          };
        } else if (errorMsg.includes("IP") || errorMsg.includes("403")) {
          return {
            success: false,
            error: "IP address not allowlisted",
            recommendations: [
              "Add your server IP to the API key allowlist in MEXC settings",
              "If using a dynamic IP, consider using a VPS with static IP",
              "Check if you are using the correct API environment (live vs. testnet)",
            ],
          };
        } else {
          return {
            success: false,
            error: errorMsg,
            recommendations: [
              "Check MEXC API status and documentation",
              "Verify all credentials are correct",
              "Contact MEXC support if the issue persists",
            ],
          };
        }
      }

      return {
        success: true,
        recommendations,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Authentication test failed",
        recommendations: [
          "Verify API credentials are valid and active",
          "Check network connectivity to MEXC",
          "Ensure API key has proper permissions",
        ],
      };
    }
  }

  /**
   * Validate API key permissions
   */
  private async validateApiPermissions(config: ApiValidationConfig): Promise<{
    success: boolean;
    error?: string;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];

    try {
      const mexcClient = getUnifiedMexcClient({
        apiKey: config.apiKey,
        secretKey: config.secretKey,
      });

      // Test account balance access (requires account permissions)
      const balanceResult = await mexcClient.getAccountBalances();

      if (!balanceResult.success) {
        return {
          success: false,
          error: "API key lacks account read permissions",
          recommendations: [
            'Enable "Read" permissions for your API key in MEXC settings',
            "Regenerate API key with proper permissions if needed",
          ],
        };
      }

      // Test trading permissions (if this is meant for trading)
      // Note: This is a cautious test that doesn't actually place orders
      try {
        const orderValidation = mexcClient.validateOrderParameters({
          symbol: "BTCUSDT",
          side: "BUY",
          type: "LIMIT",
          quantity: "0.001",
          price: "1",
        });

        if (orderValidation.valid) {
          recommendations.push("API key has trading validation capabilities");
        }
      } catch (error) {
        recommendations.push(
          "API key may lack trading permissions - verify if trading is required"
        );
      }

      return {
        success: true,
        recommendations,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Permission validation failed",
        recommendations: [
          "Enable all required permissions for your API key",
          "Verify API key is active and not restricted",
        ],
      };
    }
  }

  /**
   * Validate IP allowlisting configuration
   */
  private async validateIpAllowlisting(config: ApiValidationConfig): Promise<{
    success: boolean;
    error?: string;
    recommendations: string[];
  }> {
    // This is a more comprehensive test that tries to detect IP issues
    // by analyzing error patterns from authenticated requests

    try {
      const mexcClient = getUnifiedMexcClient({
        apiKey: config.apiKey,
        secretKey: config.secretKey,
      });

      // Make multiple authenticated requests to detect IP-related issues
      const testResults = await Promise.allSettled([
        mexcClient.getAccountInfo(),
        mexcClient.getServerTime(),
        mexcClient.getAccountBalances(),
      ]);

      const failures = testResults.filter((result) => result.status === "rejected");
      const successes = testResults.filter((result) => result.status === "fulfilled");

      // If some requests succeed but others fail, might indicate IP issues
      if (failures.length > 0 && successes.length > 0) {
        return {
          success: false,
          error: "Intermittent authentication failures detected",
          recommendations: [
            "Check IP allowlist settings in MEXC API configuration",
            "Verify your current IP address is properly allowlisted",
            "Consider using a static IP address for trading servers",
          ],
        };
      }

      if (failures.length === testResults.length) {
        return {
          success: false,
          error: "All authenticated requests failed - likely IP allowlist issue",
          recommendations: [
            "Add your current IP address to the MEXC API allowlist",
            "Check if you are connecting from an allowed region",
            "Verify API key configuration in MEXC dashboard",
          ],
        };
      }

      return {
        success: true,
        recommendations: ["IP allowlisting appears to be properly configured"],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "IP allowlisting validation failed",
        recommendations: [
          "Check IP allowlist configuration in MEXC settings",
          "Ensure your server IP is properly allowlisted",
        ],
      };
    }
  }

  /**
   * Benchmark API performance
   */
  private async benchmarkApiPerformance(config: ApiValidationConfig): Promise<{
    metrics: {
      averageLatency: number;
      maxLatency: number;
      successRate: number;
      circuitBreakerStatus: string;
    };
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    const latencies: number[] = [];
    let successCount = 0;
    const totalTests = 5;

    const mexcClient = getUnifiedMexcClient({
      apiKey: config.apiKey,
      secretKey: config.secretKey,
    });

    // Run multiple API calls to measure performance
    for (let i = 0; i < totalTests; i++) {
      const startTime = Date.now();
      try {
        await mexcClient.getServerTime();
        const latency = Date.now() - startTime;
        latencies.push(latency);
        successCount++;
      } catch (error) {
        const latency = Date.now() - startTime;
        latencies.push(latency);
        console.warn(`[API Benchmark] Test ${i + 1} failed:`, error);
      }

      // Small delay between tests
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);
    const successRate = (successCount / totalTests) * 100;

    // Get circuit breaker status
    const circuitBreaker = circuitBreakerRegistry.getBreaker("mexc-api");
    const circuitBreakerStatus = circuitBreaker.getState();

    // Generate recommendations based on performance
    if (averageLatency > 2000) {
      recommendations.push("High API latency detected - consider optimizing network connection");
    }
    if (successRate < 80) {
      recommendations.push("Low API success rate - check network stability and API limits");
    }
    if (circuitBreakerStatus === "OPEN") {
      recommendations.push("Circuit breaker is open - API may be experiencing issues");
    } else if (circuitBreakerStatus === "HALF_OPEN") {
      recommendations.push("Circuit breaker is recovering - monitor API performance");
    }

    return {
      metrics: {
        averageLatency: Math.round(averageLatency),
        maxLatency,
        successRate: Math.round(successRate * 100) / 100,
        circuitBreakerStatus,
      },
      recommendations,
    };
  }

  /**
   * Analyze security posture of API configuration
   */
  private analyzeSecurityPosture(config: ApiValidationConfig): {
    analysis: {
      keyStrength: "weak" | "moderate" | "strong";
      recommendedActions: string[];
      riskLevel: "low" | "medium" | "high";
    };
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    const recommendedActions: string[] = [];

    // Analyze key strength (basic heuristics)
    let keyStrength: "weak" | "moderate" | "strong" = "moderate";
    let riskLevel: "low" | "medium" | "high" = "medium";

    // Check for obvious patterns or weaknesses
    if (config.apiKey.length > 32 && config.secretKey.length > 48) {
      keyStrength = "strong";
    } else if (config.apiKey.length < 20 || config.secretKey.length < 40) {
      keyStrength = "weak";
      riskLevel = "high";
      recommendedActions.push("Consider regenerating API keys for better security");
    }

    // Check for repeated patterns
    if (/(.)\1{3,}/.test(config.apiKey) || /(.)\1{3,}/.test(config.secretKey)) {
      riskLevel = "high";
      recommendedActions.push("API keys contain repeated patterns - regenerate recommended");
    }

    // Security recommendations
    recommendations.push("Store API credentials securely using environment variables");
    recommendations.push("Regularly rotate API keys (recommended: every 90 days)");
    recommendations.push("Monitor API key usage for unauthorized activity");
    recommendations.push("Use IP allowlisting to restrict API access");

    if (!config.validateIpAllowlist) {
      recommendations.push("Enable IP allowlisting validation for enhanced security");
      if (riskLevel !== "high") {
        riskLevel = "medium";
      }
      // If riskLevel is already "high", keep it as "high"
    }

    // Determine final risk level
    if (keyStrength === "strong" && config.validateIpAllowlist) {
      riskLevel = "low";
    }

    return {
      analysis: {
        keyStrength,
        recommendedActions,
        riskLevel,
      },
      recommendations,
    };
  }

  /**
   * Generate cache key for validation results
   */
  private generateCacheKey(config: ApiValidationConfig): string {
    // Create a hash of the configuration for caching
    // Don't include actual keys for security
    const keyData = {
      apiKeyLength: config.apiKey.length,
      secretKeyLength: config.secretKey.length,
      hasPassphrase: Boolean(config.passphrase),
      testNetwork: config.testNetwork,
      validateIpAllowlist: config.validateIpAllowlist,
      performanceBenchmark: config.performanceBenchmark,
      securityChecks: config.securityChecks,
    };

    return Buffer.from(JSON.stringify(keyData)).toString("base64");
  }

  /**
   * Get cached validation result if still valid
   */
  private getCachedResult(cacheKey: string): ValidationResult | null {
    const cached = this.validationCache.get(cacheKey);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.result;
    }

    if (cached) {
      this.validationCache.delete(cacheKey);
    }

    return null;
  }

  /**
   * Cache validation result and return it
   */
  private cacheAndReturn(cacheKey: string, result: ValidationResult): ValidationResult {
    this.validationCache.set(cacheKey, {
      result,
      expiresAt: Date.now() + this.cacheExpiryMs,
    });

    return result;
  }

  /**
   * Clear validation cache
   */
  public clearCache(): void {
    this.validationCache.clear();
    console.log("[Enhanced API Validation] Cache cleared");
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.validationCache.size,
      entries: Array.from(this.validationCache.keys()),
    };
  }

  /**
   * Initialize the service (required for integrated service compatibility)
   */
  async initialize(): Promise<void> {
    console.log("[Enhanced API Validation] Initializing service...");
    try {
      // Clear any stale cache on initialization
      this.clearCache();

      // Test basic connectivity
      await this.testNetworkConnectivity();

      console.log("[Enhanced API Validation] Service initialized successfully");
    } catch (error) {
      console.error("[Enhanced API Validation] Service initialization failed:", error);
      throw error;
    }
  }

  /**
   * Perform comprehensive validation for integrated service
   */
  async performComprehensiveValidation(
    userId: string,
    credentials?: { apiKey: string; secretKey: string; passphrase?: string }
  ): Promise<{
    credentialsValid: boolean;
    securityRisks: string[];
    recommendations: string[];
    validationDetails?: ValidationResult;
  }> {
    if (!credentials) {
      return {
        credentialsValid: false,
        securityRisks: ["No credentials provided"],
        recommendations: ["Provide valid MEXC API credentials"],
      };
    }

    try {
      const validationResult = await this.validateApiCredentials({
        apiKey: credentials.apiKey,
        secretKey: credentials.secretKey,
        passphrase: credentials.passphrase,
        validateIpAllowlist: true,
        performanceBenchmark: false,
        securityChecks: true,
      });

      const securityRisks: string[] = [];
      if (validationResult.details.securityAnalysis?.riskLevel === "high") {
        securityRisks.push("High security risk level detected");
      }
      if (!validationResult.details.ipAllowlisting) {
        securityRisks.push("IP allowlisting validation failed");
      }

      return {
        credentialsValid: validationResult.valid,
        securityRisks,
        recommendations: validationResult.recommendations,
        validationDetails: validationResult,
      };
    } catch (error) {
      console.error("[Enhanced API Validation] Comprehensive validation failed:", error);
      return {
        credentialsValid: false,
        securityRisks: ["Validation system error"],
        recommendations: ["Check system logs and try again"],
      };
    }
  }

  /**
   * Perform quick validation for health checks
   */
  async performQuickValidation(): Promise<{
    systemHealthy: boolean;
    error?: string;
  }> {
    try {
      const connectivityResult = await this.testNetworkConnectivity();
      return {
        systemHealthy: connectivityResult.success,
        error: connectivityResult.error,
      };
    } catch (error) {
      return {
        systemHealthy: false,
        error: error instanceof Error ? error.message : "Quick validation failed",
      };
    }
  }
}

// Export singleton instance
export const enhancedApiValidationService = EnhancedApiValidationService.getInstance();

// Export with alternative name for backward compatibility
export const enhancedApiValidation = enhancedApiValidationService;

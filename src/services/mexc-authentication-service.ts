/**
 * MEXC Authentication Service
 *
 * Extracted from unified MEXC service for better modularity and credential management.
 * Provides centralized authentication, credential validation, and security features.
 *
 * Features:
 * - Secure credential storage and validation
 * - Real-time credential testing
 * - Authentication status monitoring
 * - Credential encryption and secure handling
 * - Circuit breaker integration for auth failures
 * - Health check mechanisms
 */

import * as crypto from "node:crypto";
import { toSafeError } from "../lib/error-type-utils";
import type { MexcApiClient } from "./mexc-api-client";

// ============================================================================
// Authentication Types and Interfaces
// ============================================================================

export interface AuthenticationConfig {
  apiKey: string;
  secretKey: string;
  passphrase?: string;
  enableEncryption?: boolean;
  encryptionKey?: string;
  testIntervalMs?: number;
  maxAuthFailures?: number;
  authFailureResetMs?: number;
}

export interface AuthenticationStatus {
  hasCredentials: boolean;
  isValid: boolean;
  isConnected: boolean;
  lastTestedAt?: Date;
  lastValidAt?: Date;
  failureCount: number;
  error?: string;
  responseTime?: number;
  isBlocked: boolean;
  blockReason?: string;
}

export interface CredentialTestResult {
  isValid: boolean;
  hasConnection: boolean;
  responseTime: number;
  error?: string;
  timestamp: Date;
}

export interface AuthenticationMetrics {
  totalTests: number;
  successfulTests: number;
  failedTests: number;
  averageResponseTime: number;
  successRate: number;
  lastTestTime?: Date;
  uptime: number;
}

// ============================================================================
// Authentication Service Implementation
// ============================================================================

/**
 * Centralized authentication service for MEXC API
 * Handles all credential validation and authentication status
 */
export class MexcAuthenticationService {
  private config: AuthenticationConfig;
  private status: AuthenticationStatus;
  private metrics: AuthenticationMetrics;
  private testTimer: NodeJS.Timeout | null = null;
  private apiClient?: MexcApiClient;
  private startTime: Date = new Date();

  constructor(config: Partial<AuthenticationConfig> = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.MEXC_API_KEY || "",
      secretKey: config.secretKey || process.env.MEXC_SECRET_KEY || "",
      passphrase: config.passphrase || process.env.MEXC_PASSPHRASE || "",
      enableEncryption: config.enableEncryption ?? false,
      encryptionKey: config.encryptionKey || process.env.MEXC_ENCRYPTION_KEY,
      testIntervalMs: config.testIntervalMs || 300000, // 5 minutes
      maxAuthFailures: config.maxAuthFailures || 5,
      authFailureResetMs: config.authFailureResetMs || 600000, // 10 minutes
    };

    this.status = {
      hasCredentials: this.hasCredentials(),
      isValid: false,
      isConnected: false,
      failureCount: 0,
      isBlocked: false,
    };

    this.metrics = {
      totalTests: 0,
      successfulTests: 0,
      failedTests: 0,
      averageResponseTime: 0,
      successRate: 0,
      uptime: 0,
    };

    // Start periodic credential testing if credentials exist
    if (this.status.hasCredentials) {
      this.startPeriodicTesting();
    }
  }

  // ============================================================================
  // Core Authentication Methods
  // ============================================================================

  /**
   * Initialize with API client for testing
   */
  setApiClient(apiClient: MexcApiClient): void {
    this.apiClient = apiClient;
  }

  /**
   * Check if credentials are configured
   */
  hasCredentials(): boolean {
    return !!(this.config.apiKey && this.config.secretKey);
  }

  /**
   * Get current authentication status
   */
  getStatus(): AuthenticationStatus {
    return {
      ...this.status,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }

  /**
   * Get authentication metrics
   */
  getMetrics(): AuthenticationMetrics {
    const uptime = Date.now() - this.startTime.getTime();
    return {
      ...this.metrics,
      uptime,
    };
  }

  /**
   * Test credentials with API client
   */
  async testCredentials(force = false): Promise<CredentialTestResult> {
    const now = new Date();
    this.metrics.totalTests++;

    // Check if we should skip testing due to recent failure
    if (!force && this.status.isBlocked) {
      const result: CredentialTestResult = {
        isValid: false,
        hasConnection: false,
        responseTime: 0,
        error: this.status.blockReason || "Authentication is blocked",
        timestamp: now,
      };

      this.updateStatus(result);
      return result;
    }

    if (!this.hasCredentials()) {
      const result: CredentialTestResult = {
        isValid: false,
        hasConnection: false,
        responseTime: 0,
        error: "No API credentials configured",
        timestamp: now,
      };

      this.updateStatus(result);
      return result;
    }

    if (!this.apiClient) {
      const result: CredentialTestResult = {
        isValid: false,
        hasConnection: false,
        responseTime: 0,
        error: "API client not initialized",
        timestamp: now,
      };

      this.updateStatus(result);
      return result;
    }

    try {
      const startTime = Date.now();
      const testResult = await this.apiClient.testCredentials();
      const responseTime = Date.now() - startTime;

      const result: CredentialTestResult = {
        isValid: testResult.isValid,
        hasConnection: testResult.hasConnection,
        responseTime,
        error: testResult.error,
        timestamp: now,
      };

      this.updateStatus(result);
      return result;
    } catch (error) {
      const safeError = toSafeError(error);
      const result: CredentialTestResult = {
        isValid: false,
        hasConnection: false,
        responseTime: 0,
        error: `Credential test failed: ${safeError.message}`,
        timestamp: now,
      };

      this.updateStatus(result);
      return result;
    }
  }

  /**
   * Update credentials and re-test
   */
  async updateCredentials(newCredentials: Partial<AuthenticationConfig>): Promise<void> {
    const wasValid = this.status.isValid;

    // Update configuration
    this.config = { ...this.config, ...newCredentials };

    // Reset status
    this.status.hasCredentials = this.hasCredentials();
    this.status.failureCount = 0;
    this.status.isBlocked = false;
    this.status.blockReason = undefined;

    // Test new credentials immediately
    if (this.status.hasCredentials) {
      await this.testCredentials(true);

      // Restart periodic testing if credentials are now valid
      if (!wasValid && this.status.isValid) {
        this.startPeriodicTesting();
      }
    } else {
      this.stopPeriodicTesting();
    }
  }

  /**
   * Get encrypted credentials for secure storage
   */
  getEncryptedCredentials(): { apiKey: string; secretKey: string } | null {
    if (!this.hasCredentials() || !this.config.enableEncryption || !this.config.encryptionKey) {
      return null;
    }

    try {
      const cipher = crypto.createCipher("aes256", this.config.encryptionKey);
      const encryptedApiKey =
        cipher.update(this.config.apiKey, "utf8", "hex") + cipher.final("hex");

      const cipher2 = crypto.createCipher("aes256", this.config.encryptionKey);
      const encryptedSecretKey =
        cipher2.update(this.config.secretKey, "utf8", "hex") + cipher2.final("hex");

      return {
        apiKey: encryptedApiKey,
        secretKey: encryptedSecretKey,
      };
    } catch (error) {
      console.error("[MexcAuthenticationService] Failed to encrypt credentials:", error);
      return null;
    }
  }

  /**
   * Set credentials from encrypted storage
   */
  async setEncryptedCredentials(encrypted: {
    apiKey: string;
    secretKey: string;
  }): Promise<boolean> {
    if (!this.config.enableEncryption || !this.config.encryptionKey) {
      console.error("[MexcAuthenticationService] Encryption not enabled or key missing");
      return false;
    }

    try {
      const decipher = crypto.createDecipher("aes256", this.config.encryptionKey);
      const apiKey = decipher.update(encrypted.apiKey, "hex", "utf8") + decipher.final("utf8");

      const decipher2 = crypto.createDecipher("aes256", this.config.encryptionKey);
      const secretKey =
        decipher2.update(encrypted.secretKey, "hex", "utf8") + decipher2.final("utf8");

      await this.updateCredentials({ apiKey, secretKey });
      return true;
    } catch (error) {
      console.error("[MexcAuthenticationService] Failed to decrypt credentials:", error);
      return false;
    }
  }

  // ============================================================================
  // Health and Monitoring
  // ============================================================================

  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<{
    healthy: boolean;
    status: AuthenticationStatus;
    metrics: AuthenticationMetrics;
    recommendations: string[];
  }> {
    const status = this.getStatus();
    const metrics = this.getMetrics();
    const recommendations: string[] = [];

    // Test credentials if not recently tested
    const testStale =
      !status.lastTestedAt ||
      Date.now() - status.lastTestedAt.getTime() > this.config.testIntervalMs!;

    if (testStale && status.hasCredentials) {
      await this.testCredentials();
    }

    // Generate recommendations
    if (!status.hasCredentials) {
      recommendations.push("Configure API credentials");
    } else if (!status.isValid) {
      recommendations.push("Verify API credentials are correct");
    } else if (!status.isConnected) {
      recommendations.push("Check network connectivity to MEXC API");
    }

    if (metrics.successRate < 0.9 && metrics.totalTests > 5) {
      recommendations.push("Monitor API reliability - success rate below 90%");
    }

    if (status.isBlocked) {
      recommendations.push(
        "Authentication is blocked due to failures - check credentials and try again"
      );
    }

    const healthy =
      status.hasCredentials && status.isValid && status.isConnected && !status.isBlocked;

    return {
      healthy,
      status: this.getStatus(),
      metrics: this.getMetrics(),
      recommendations,
    };
  }

  /**
   * Reset authentication status (clears failures and blocks)
   */
  reset(): void {
    this.status.failureCount = 0;
    this.status.isBlocked = false;
    this.status.blockReason = undefined;
    this.status.error = undefined;

    this.metrics = {
      totalTests: 0,
      successfulTests: 0,
      failedTests: 0,
      averageResponseTime: 0,
      successRate: 0,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }

  /**
   * Get service configuration (sanitized)
   */
  getConfig(): Omit<AuthenticationConfig, "apiKey" | "secretKey" | "encryptionKey"> {
    return {
      passphrase: this.config.passphrase,
      enableEncryption: this.config.enableEncryption,
      testIntervalMs: this.config.testIntervalMs,
      maxAuthFailures: this.config.maxAuthFailures,
      authFailureResetMs: this.config.authFailureResetMs,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Update authentication status from test result
   */
  private updateStatus(result: CredentialTestResult): void {
    const now = new Date();

    this.status.lastTestedAt = now;
    this.status.isValid = result.isValid;
    this.status.isConnected = result.hasConnection;
    this.status.error = result.error;
    this.status.responseTime = result.responseTime;

    if (result.isValid) {
      this.status.lastValidAt = now;
      this.status.failureCount = 0;
      this.status.isBlocked = false;
      this.status.blockReason = undefined;
      this.metrics.successfulTests++;
    } else {
      this.status.failureCount++;
      this.metrics.failedTests++;

      // Block authentication if too many failures
      if (this.status.failureCount >= this.config.maxAuthFailures!) {
        this.status.isBlocked = true;
        this.status.blockReason = `Too many authentication failures (${this.status.failureCount})`;

        // Schedule automatic unblock
        setTimeout(() => {
          if (this.status.isBlocked) {
            this.status.isBlocked = false;
            this.status.blockReason = undefined;
            this.status.failureCount = 0;
          }
        }, this.config.authFailureResetMs!);
      }
    }

    // Update metrics
    if (this.metrics.totalTests > 0) {
      this.metrics.successRate = this.metrics.successfulTests / this.metrics.totalTests;
    }

    if (result.responseTime > 0) {
      const totalResponseTime = this.metrics.averageResponseTime * (this.metrics.totalTests - 1);
      this.metrics.averageResponseTime =
        (totalResponseTime + result.responseTime) / this.metrics.totalTests;
    }

    this.metrics.lastTestTime = now;
  }

  /**
   * Start periodic credential testing
   */
  private startPeriodicTesting(): void {
    if (this.testTimer) {
      clearInterval(this.testTimer);
    }

    this.testTimer = setInterval(async () => {
      if (this.status.hasCredentials && !this.status.isBlocked) {
        await this.testCredentials();
      }
    }, this.config.testIntervalMs!);
  }

  /**
   * Stop periodic credential testing
   */
  private stopPeriodicTesting(): void {
    if (this.testTimer) {
      clearInterval(this.testTimer);
      this.testTimer = null;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopPeriodicTesting();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create authentication service with MEXC-optimized defaults
 */
export function createMexcAuthenticationService(
  config?: Partial<AuthenticationConfig>
): MexcAuthenticationService {
  const defaultConfig: Partial<AuthenticationConfig> = {
    enableEncryption: false, // Disabled by default for simplicity
    testIntervalMs: 300000, // 5 minutes
    maxAuthFailures: 5,
    authFailureResetMs: 600000, // 10 minutes
  };

  return new MexcAuthenticationService({ ...defaultConfig, ...config });
}

// ============================================================================
// Global Instance Management
// ============================================================================

let globalAuthService: MexcAuthenticationService | null = null;

/**
 * Get or create the global authentication service
 */
export function getGlobalAuthenticationService(): MexcAuthenticationService {
  if (!globalAuthService) {
    globalAuthService = createMexcAuthenticationService();
  }
  return globalAuthService;
}

/**
 * Reset the global authentication service
 */
export function resetGlobalAuthenticationService(): void {
  if (globalAuthService) {
    globalAuthService.destroy();
    globalAuthService = null;
  }
}

/**
 * Initialize authentication service with API client
 */
export async function initializeAuthentication(
  apiClient: MexcApiClient,
  config?: Partial<AuthenticationConfig>
): Promise<MexcAuthenticationService> {
  const authService = config
    ? createMexcAuthenticationService(config)
    : getGlobalAuthenticationService();

  authService.setApiClient(apiClient);

  // Perform initial credential test
  if (authService.hasCredentials()) {
    await authService.testCredentials(true);
  }

  return authService;
}

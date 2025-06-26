/**
 * MEXC Authentication Service
 *
 * Handles MEXC API authentication including signature generation and credential validation.
 * Extracted from mexc-api-client.ts for better modularity.
 */

import * as crypto from "node:crypto";
import type { UnifiedMexcConfig } from "@/src/schemas/unified/mexc-api-schemas";
import type { ApiParams, AuthenticationContext } from "./mexc-api-types";

export class MexcAuthService {
  private config: Required<UnifiedMexcConfig>;

  constructor(config: Required<UnifiedMexcConfig>) {
    this.config = config;
  }

  /**
   * Check if credentials are properly configured
   */
  hasCredentials(): boolean {
    return Boolean(
      this.config.apiKey &&
        this.config.apiSecret &&
        this.config.apiKey.trim().length > 0 &&
        this.config.apiSecret.trim().length > 0
    );
  }

  /**
   * Create authentication signature for MEXC API requests
   */
  createSignature(queryString: string): string {
    if (!this.hasCredentials()) {
      throw new Error("API credentials not configured");
    }

    return crypto.createHmac("sha256", this.config.apiSecret).update(queryString).digest("hex");
  }

  /**
   * Generate authentication context for API requests
   */
  generateAuthContext(params: ApiParams = {}): AuthenticationContext {
    if (!this.hasCredentials()) {
      throw new Error("API credentials not configured");
    }

    const timestamp = Date.now();

    // Build query string with timestamp
    const authParams = {
      ...params,
      timestamp,
      recvWindow: this.config.recvWindow || 5000,
    };

    // Create query string
    const queryString = this.buildQueryString(authParams);

    // Generate signature
    const signature = this.createSignature(queryString);

    return {
      apiKey: this.config.apiKey,
      apiSecret: this.config.apiSecret,
      timestamp,
      signature,
    };
  }

  /**
   * Add authentication headers to request
   */
  addAuthHeaders(
    headers: Record<string, string>,
    authContext: AuthenticationContext
  ): Record<string, string> {
    return {
      ...headers,
      "X-MEXC-APIKEY": authContext.apiKey,
    };
  }

  /**
   * Add authentication parameters to request params
   */
  addAuthParams(params: ApiParams, authContext: AuthenticationContext): ApiParams {
    return {
      ...params,
      timestamp: authContext.timestamp,
      signature: authContext.signature,
      recvWindow: this.config.recvWindow || 5000,
    };
  }

  /**
   * Build query string from parameters
   */
  private buildQueryString(params: ApiParams): string {
    const cleanParams: Record<string, string> = {};

    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          cleanParams[key] = value.map((v) => String(v)).join(",");
        } else {
          cleanParams[key] = String(value);
        }
      }
    }

    return new URLSearchParams(cleanParams).toString();
  }

  /**
   * Validate API key format
   */
  validateApiKey(apiKey: string): boolean {
    return Boolean(apiKey && typeof apiKey === "string" && apiKey.length >= 32);
  }

  /**
   * Validate API secret format
   */
  validateApiSecret(apiSecret: string): boolean {
    return Boolean(apiSecret && typeof apiSecret === "string" && apiSecret.length >= 32);
  }

  /**
   * Validate both credentials
   */
  validateCredentials(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.validateApiKey(this.config.apiKey)) {
      errors.push("Invalid API key format");
    }

    if (!this.validateApiSecret(this.config.apiSecret)) {
      errors.push("Invalid API secret format");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Test credentials by making a simple authenticated request
   */
  async testCredentials(): Promise<{ valid: boolean; error?: string }> {
    try {
      if (!this.hasCredentials()) {
        return { valid: false, error: "API credentials not configured" };
      }

      const validation = this.validateCredentials();
      if (!validation.valid) {
        return { valid: false, error: validation.errors.join(", ") };
      }

      // Generate test signature to verify secret
      const testString = "test=true&timestamp=" + Date.now();
      const signature = this.createSignature(testString);

      if (!signature || signature.length !== 64) {
        return { valid: false, error: "Invalid signature generation" };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Unknown authentication error",
      };
    }
  }
}

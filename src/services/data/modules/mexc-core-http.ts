/**
 * MEXC Core HTTP Client
 *
 * Lightweight HTTP client with authentication for MEXC API communication.
 * Extracted from core client for better separation of concerns.
 */

import type { MexcApiConfig, MexcApiResponse, MexcServiceResponse } from "./mexc-api-types";

// ============================================================================
// HTTP Client with Authentication
// ============================================================================

export class MexcCoreHttpClient {
  // Simple console logger to avoid webpack bundling issues
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[mexc-core-http]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[mexc-core-http]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[mexc-core-http]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[mexc-core-http]", message, context || ""),
  };

  private config: MexcApiConfig;
  private baseHeaders: Record<string, string>;

  constructor(config: MexcApiConfig) {
    this.config = config;
    this.baseHeaders = {
      "Content-Type": "application/json",
      "User-Agent": "MEXC-Sniper-Bot/2.0",
    };
  }

  // ============================================================================
  // Public HTTP Methods
  // ============================================================================

  /**
   * Make a basic HTTP request
   */
  async makeRequest(
    url: string,
    options: RequestInit & { timeout?: number } = {}
  ): Promise<MexcApiResponse> {
    const { timeout = this.config.timeout, ...fetchOptions } = options;

    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        ...this.baseHeaders,
        ...fetchOptions.headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Make an authenticated HTTP request
   */
  async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<MexcApiResponse> {
    // Add authentication to URL and headers
    const { authenticatedUrl, authHeaders } = this.generateAuthUrlAndHeaders(url, options);

    return this.makeRequest(authenticatedUrl, {
      ...options,
      headers: {
        ...options.headers,
        ...authHeaders,
      },
    });
  }

  /**
   * Handle errors consistently across all methods
   */
  handleError(error: unknown, methodName: string, _startTime: number): MexcServiceResponse<never> {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    this.logger.error(`[MexcCoreHttpClient.${methodName}] Error:`, errorMessage);

    return {
      success: false,
      error: errorMessage,
      timestamp: Date.now(),
      source: "mexc-core-http",
    };
  }

  // ============================================================================
  // Private Authentication Methods
  // ============================================================================

  private generateAuthUrlAndHeaders(
    url: string,
    options: RequestInit = {}
  ): {
    authenticatedUrl: string;
    authHeaders: Record<string, string>;
  } {
    // Parse URL to get query string (timestamp should already be included)
    const urlObj = new URL(url);
    const queryString = urlObj.search ? urlObj.search.substring(1) : "";

    // MEXC signature is based on the query string for GET requests
    const stringToSign = queryString;

    // Generate HMAC-SHA256 signature
    const signature = this.createSignature(stringToSign);

    // Add signature to the URL as a query parameter (MEXC API requirement)
    const separator = urlObj.search ? "&" : "?";
    const authenticatedUrl = `${url}${separator}signature=${signature}`;

    // For GET requests, use JSON content type; for POST use form data
    const method = options.method?.toUpperCase() || "GET";
    const contentType =
      method === "POST" ? "application/x-www-form-urlencoded" : "application/json";

    const authHeaders = {
      "X-MEXC-APIKEY": this.config.apiKey,
      "Content-Type": contentType,
    };

    return { authenticatedUrl, authHeaders };
  }

  private createSignature(data: string): string {
    if (typeof window !== "undefined") {
      // Browser environment - return a placeholder
      this.logger.warn("MEXC API signatures cannot be generated in browser environment");
      return "browser-placeholder";
    }

    try {
      const crypto = require("node:crypto");
      return crypto.createHmac("sha256", this.config.secretKey).update(data).digest("hex");
    } catch (error) {
      this.logger.error("Failed to create MEXC signature:", error);
      return "signature-error";
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Parse timestamp from various formats
   */
  parseTimestamp(timestamp: any): number {
    if (typeof timestamp === "string") {
      return new Date(timestamp).getTime();
    }
    return timestamp || Date.now();
  }

  /**
   * Get configuration
   */
  getConfig(): MexcApiConfig {
    return this.config;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new MEXC HTTP client instance
 */
export function createMexcCoreHttpClient(config: MexcApiConfig): MexcCoreHttpClient {
  return new MexcCoreHttpClient(config);
}

// ============================================================================
// Exports
// ============================================================================

export default MexcCoreHttpClient;

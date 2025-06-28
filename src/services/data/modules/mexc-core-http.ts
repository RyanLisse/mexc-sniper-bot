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
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private readonly maxRequestsPerSecond = 10; // MEXC API limit

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

    // Apply rate limiting
    await this.applyRateLimit();

    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          ...this.baseHeaders,
          ...fetchOptions.headers,
        },
        signal: controller.signal,
      });

      // Handle rate limit responses from MEXC
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.config.rateLimitDelay * 2;

        this.logger.warn(`Rate limited by MEXC API. Waiting ${delay}ms before retry`);
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Retry once after rate limit delay
        return this.makeRequest(url, options);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      // Handle AbortError from timeout
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
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
  // Private Rate Limiting Methods
  // ============================================================================

  /**
   * Apply rate limiting to prevent exceeding MEXC API limits
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Reset request count every second
    if (timeSinceLastRequest >= 1000) {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }

    // If we've reached the max requests per second, wait
    if (this.requestCount >= this.maxRequestsPerSecond) {
      const waitTime = 1000 - timeSinceLastRequest;
      if (waitTime > 0) {
        this.logger.debug(`Rate limiting: waiting ${waitTime}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        this.requestCount = 0;
        this.lastRequestTime = Date.now();
      }
    }

    // Apply minimum delay between requests
    if (timeSinceLastRequest < this.config.rateLimitDelay && this.requestCount > 0) {
      const minDelay = this.config.rateLimitDelay - timeSinceLastRequest;
      if (minDelay > 0) {
        this.logger.debug(`Minimum delay: waiting ${minDelay}ms`);
        await new Promise((resolve) => setTimeout(resolve, minDelay));
      }
    }

    this.requestCount++;
    this.lastRequestTime = Date.now();
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

  /**
   * Get rate limiting statistics for monitoring
   */
  getRateLimitStats(): {
    requestCount: number;
    maxRequestsPerSecond: number;
    timeSinceLastRequest: number;
    rateLimitDelay: number;
  } {
    return {
      requestCount: this.requestCount,
      maxRequestsPerSecond: this.maxRequestsPerSecond,
      timeSinceLastRequest: Date.now() - this.lastRequestTime,
      rateLimitDelay: this.config.rateLimitDelay,
    };
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

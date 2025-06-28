/**
 * MEXC Request Service
 *
 * Handles core HTTP request execution, timeout management, and response processing.
 * Extracted from mexc-api-client.ts for better modularity.
 */

import * as crypto from "crypto";
import type {
  MexcServiceResponse,
  UnifiedMexcConfig,
} from "@/src/schemas/unified/mexc-api-schemas";
import { toSafeError } from "../../lib/error-type-utils";
import type {
  ApiRequestConfig,
  HttpResponse,
  PerformanceMetrics,
  RequestContext,
  TimeoutConfig,
} from "./mexc-api-types";

export class MexcRequestService {
  private config: Required<UnifiedMexcConfig>;
  private timeoutConfig: TimeoutConfig;

  constructor(config: Required<UnifiedMexcConfig>) {
    this.config = config;
    this.timeoutConfig = {
      defaultTimeout: config.timeout,
      connectTimeout: 10000, // 10 seconds for connection
      readTimeout: 20000, // 20 seconds for reading response
      adaptiveTimeout: true,
      endpointTimeouts: {
        "/api/v3/ping": 5000, // Fast ping timeout
        "/api/v3/time": 5000, // Server time should be fast
        "/api/v3/depth": 15000, // Order book can take longer
        "/api/v3/account": 30000, // Account info may take longer
        "/api/v3/order": 45000, // Order operations need more time
        "/api/v3/openOrders": 30000, // Open orders query
      },
    };
  }

  /**
   * Execute HTTP request with context tracking
   */
  async executeHttpRequestWithContext<T>(
    requestConfig: ApiRequestConfig,
    context: RequestContext
  ): Promise<MexcServiceResponse<T>> {
    const startTime = Date.now();

    try {
      // Execute the actual HTTP request
      const response = await this.executeHttpRequest<T>(requestConfig, context);

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        data: response.data,
        timestamp: new Date().toISOString(),
        requestId: context.requestId,
        responseTime,
        cached: false,
        metadata: {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          endpoint: requestConfig.endpoint,
          method: requestConfig.method,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const safeError = toSafeError(error);

      return {
        success: false,
        error: safeError.message,
        code: this.extractErrorCode(safeError),
        requestId: context.requestId,
        responseTime,
        cached: false,
        timestamp: new Date().toISOString(),
        metadata: {
          endpoint: requestConfig.endpoint,
          method: requestConfig.method,
          attempt: context.attempt,
        },
      };
    }
  }

  /**
   * Execute HTTP request with timeout and error handling
   */
  private async executeHttpRequest<T>(
    requestConfig: ApiRequestConfig,
    _context: RequestContext
  ): Promise<HttpResponse<T>> {
    const timeout = this.calculateTimeout(requestConfig);
    const url = this.buildUrl(requestConfig);

    // Create AbortController for timeout handling
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeout);

    const fetchOptions: RequestInit = {
      method: requestConfig.method,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": `mexc-sniper-bot/1.0`,
      },
      signal: abortController.signal,
    };

    // Add body for POST/PUT requests
    if (requestConfig.method !== "GET" && requestConfig.params) {
      fetchOptions.body = JSON.stringify(requestConfig.params);
    }

    try {
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId); // Clear timeout on successful fetch
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} - ${JSON.stringify(data)}`
        );
      }

      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: this.parseHeaders(response.headers),
        config: requestConfig,
      };
    } catch (error) {
      clearTimeout(timeoutId); // Clear timeout on error
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(`Request timeout after ${timeout}ms for ${requestConfig.endpoint}`);
        }
        throw error;
      }
      throw new Error(`Unknown error during request to ${requestConfig.endpoint}`);
    }
  }

  /**
   * Build complete URL from config and endpoint
   */
  private buildUrl(requestConfig: ApiRequestConfig): string {
    const baseUrl = this.config.baseUrl.replace(/\/$/, ""); // Remove trailing slash
    const endpoint = requestConfig.endpoint.startsWith("/")
      ? requestConfig.endpoint
      : `/${requestConfig.endpoint}`;

    let url = `${baseUrl}${endpoint}`;

    // Add query parameters for GET requests
    if (requestConfig.method === "GET" && requestConfig.params) {
      const searchParams = new URLSearchParams();

      for (const [key, value] of Object.entries(requestConfig.params)) {
        if (value !== null && value !== undefined) {
          if (Array.isArray(value)) {
            searchParams.append(key, value.map((v) => String(v)).join(","));
          } else {
            searchParams.append(key, String(value));
          }
        }
      }

      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    return url;
  }

  /**
   * Parse response headers into plain object
   */
  private parseHeaders(headers: Headers): Record<string, string> {
    const headerObject: Record<string, string> = {};
    headers.forEach((value, key) => {
      headerObject[key.toLowerCase()] = value;
    });
    return headerObject;
  }

  /**
   * Determine request priority based on endpoint
   */
  determinePriority(endpoint: string): "low" | "medium" | "high" | "critical" {
    // Critical: Account operations, orders
    if (endpoint.includes("/account") || endpoint.includes("/order")) {
      return "critical";
    }

    // High: Real-time data, balances
    if (
      endpoint.includes("/depth") ||
      endpoint.includes("/ticker") ||
      endpoint.includes("/balance")
    ) {
      return "high";
    }

    // Medium: Market data, symbols
    if (
      endpoint.includes("/exchangeInfo") ||
      endpoint.includes("/klines") ||
      endpoint.includes("/trades")
    ) {
      return "medium";
    }

    // Low: Static data, ping
    return "low";
  }

  /**
   * Calculate timeout for specific request
   */
  calculateTimeout(requestConfig: ApiRequestConfig): number {
    // Use config timeout if specified
    if (requestConfig.timeout) {
      return requestConfig.timeout;
    }

    // Use endpoint-specific timeout if available
    const endpointTimeout = this.timeoutConfig.endpointTimeouts[requestConfig.endpoint];
    if (endpointTimeout) {
      return endpointTimeout;
    }

    // Use method-specific timeout
    switch (requestConfig.method) {
      case "POST":
      case "PUT":
      case "DELETE":
        return this.timeoutConfig.defaultTimeout * 1.5; // Longer for write operations
      default:
        return this.timeoutConfig.defaultTimeout;
    }
  }

  /**
   * Extract error code from error message
   */
  private extractErrorCode(error: Error): string | undefined {
    const message = error.message;

    // Try to extract HTTP status code
    const httpMatch = message.match(/HTTP (\d{3})/);
    if (httpMatch) {
      return httpMatch[1];
    }

    // Try to extract MEXC error code
    const mexcMatch = message.match(/"code":\s*(-?\d+)/);
    if (mexcMatch) {
      return mexcMatch[1];
    }

    // Common error patterns
    if (message.includes("timeout")) return "TIMEOUT";
    if (message.includes("network")) return "NETWORK_ERROR";
    if (message.includes("unauthorized")) return "UNAUTHORIZED";
    if (message.includes("rate limit")) return "RATE_LIMIT";

    return undefined;
  }

  /**
   * Create performance metrics from request data
   */
  createPerformanceMetrics(
    requestConfig: ApiRequestConfig,
    context: RequestContext,
    response: HttpResponse,
    cacheHit: boolean = false
  ): PerformanceMetrics {
    const responseTime = Date.now() - context.startTime;

    return {
      responseTime,
      requestSize: this.estimateRequestSize(requestConfig),
      responseSize: this.estimateResponseSize(response),
      cacheHit,
      retryCount: context.attempt - 1,
      endpoint: requestConfig.endpoint,
      method: requestConfig.method,
      timestamp: Date.now(),
    };
  }

  /**
   * Estimate request size in bytes
   */
  private estimateRequestSize(requestConfig: ApiRequestConfig): number {
    const url = this.buildUrl(requestConfig);
    const headers = JSON.stringify({ "Content-Type": "application/json" });
    const body = requestConfig.params ? JSON.stringify(requestConfig.params) : "";

    return Buffer.byteLength(url + headers + body, "utf8");
  }

  /**
   * Estimate response size in bytes
   */
  private estimateResponseSize(response: HttpResponse): number {
    const data = JSON.stringify(response.data);
    const headers = JSON.stringify(response.headers);

    return Buffer.byteLength(data + headers, "utf8");
  }

  /**
   * Get timeout configuration
   */
  getTimeoutConfig(): TimeoutConfig {
    return { ...this.timeoutConfig };
  }

  /**
   * Update timeout configuration
   */
  updateTimeoutConfig(updates: Partial<TimeoutConfig>): void {
    this.timeoutConfig = { ...this.timeoutConfig, ...updates };
  }

  /**
   * Create request context
   */
  createRequestContext(
    endpoint: string,
    correlationId?: string,
    metadata?: Record<string, any>
  ): RequestContext {
    return {
      requestId: crypto.randomUUID(),
      correlationId,
      priority: this.determinePriority(endpoint),
      endpoint,
      attempt: 1,
      startTime: Date.now(),
      metadata,
    };
  }
}

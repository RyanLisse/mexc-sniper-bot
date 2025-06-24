/**
 * MEXC Client Core Infrastructure
 *
 * Core client class with request infrastructure, authentication, and error handling.
 * Extracted from unified-mexc-client.ts for better modularity.
 */

import * as crypto from "node:crypto";
import { mexcApiBreaker } from "../circuit-breaker";
import type { UnifiedMexcConfig, UnifiedMexcResponse } from "./mexc-client-types";
import { MexcClientError } from "./mexc-client-types";
import { MexcRequestCache } from "./mexc-request-cache";

// ============================================================================
// Core MEXC Client Infrastructure
// ============================================================================

export class MexcClientCore {
  protected config: Required<UnifiedMexcConfig>;
  private lastRequestTime = 0;
  protected cache: MexcRequestCache;
  private requestCounter = 0;
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[mexc-client-core]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[mexc-client-core]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[mexc-client-core]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[mexc-client-core]", message, context || ""),
  };

  constructor(config: UnifiedMexcConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.MEXC_API_KEY || "",
      secretKey: config.secretKey || process.env.MEXC_SECRET_KEY || "",
      baseUrl: config.baseUrl || process.env.MEXC_BASE_URL || "https://api.mexc.com",
      timeout: config.timeout || 10000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      rateLimitDelay: config.rateLimitDelay || 100,
      enableCaching: config.enableCaching ?? true,
      cacheTTL: config.cacheTTL || 60000, // 1 minute default
    };

    this.cache = new MexcRequestCache(1000);

    console.info(`[MexcClientCore] Initialized with config:`, {
      hasApiKey: Boolean(this.config.apiKey),
      hasSecretKey: Boolean(this.config.secretKey),
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      enableCaching: this.config.enableCaching,
    });
  }

  // ============================================================================
  // Core Request Infrastructure
  // ============================================================================

  /**
   * Rate limiting mechanism
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.config.rateLimitDelay) {
      const delay = this.config.rateLimitDelay - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Generate unique request ID for tracking
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestCounter}`;
  }

  /**
   * Generate HMAC signature for authenticated requests
   */
  private generateSignature(params: Record<string, unknown>): string {
    if (!this.config.secretKey) {
      throw new Error("MEXC secret key not configured");
    }

    // Create a copy of params excluding the signature parameter
    const signatureParams = { ...params };
    delete signatureParams.signature;

    const queryString = new URLSearchParams(
      Object.entries(signatureParams)
        .filter(([_, value]) => value !== undefined && value !== null)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, String(value)])
    ).toString();

    return crypto.createHmac("sha256", this.config.secretKey).update(queryString).digest("hex");
  }

  /**
   * Generate cache key for requests
   */
  private generateCacheKey(endpoint: string, params: Record<string, unknown> = {}): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce(
        (result, key) => {
          result[key] = params[key];
          return result;
        },
        {} as Record<string, unknown>
      );

    return `${endpoint}_${JSON.stringify(sortedParams)}`;
  }

  /**
   * Core request method with retry logic, circuit breaker, and caching
   */
  protected async makeRequest<T>(
    endpoint: string,
    params: Record<string, unknown> = {},
    authenticated = false,
    skipCache = false
  ): Promise<UnifiedMexcResponse<T>> {
    const requestId = this.generateRequestId();
    const cacheKey = this.generateCacheKey(endpoint, params);

    // Check cache first (if enabled and not skipped)
    if (this.config.enableCaching && !skipCache && !authenticated) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached) {
        console.info(`[MexcClientCore] Cache hit for ${endpoint} (${requestId})`);
        return {
          success: true,
          data: cached,
          timestamp: new Date().toISOString(),
          cached: true,
          requestId,
        };
      }
    }

    const maxRetries = this.config.maxRetries;
    const baseDelay = this.config.retryDelay;

    return mexcApiBreaker.execute(
      async () => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            await this.rateLimit();

            let url: string;
            const headers: Record<string, string> = {
              "Content-Type": "application/json",
              "User-Agent": "MEXC-Sniper-Bot-Unified/1.0",
              "X-Request-ID": requestId,
            };

            if (authenticated) {
              if (!this.config.apiKey || !this.config.secretKey) {
                throw new Error("MEXC API credentials not configured for authenticated request");
              }

              // Determine if this is an account endpoint
              const isAccountEndpoint =
                endpoint.includes("/account") || endpoint.includes("/balance");

              // Only set Content-Type for non-account endpoints (trading endpoints need form data)
              if (!isAccountEndpoint) {
                headers["Content-Type"] = "application/x-www-form-urlencoded";
              }

              const timestamp = Date.now();
              params.timestamp = timestamp;

              const signature = this.generateSignature(params);
              params.signature = signature;
              headers["X-MEXC-APIKEY"] = this.config.apiKey;

              this.logger.debug(
                `[MexcClientCore] Authenticated ${isAccountEndpoint ? "GET" : "POST"} request: ${endpoint} (${requestId})`
              );
            }

            // Build URL with query parameters
            if (endpoint.startsWith("http")) {
              url = endpoint;
            } else {
              url = `${this.config.baseUrl}${endpoint}`;
            }

            const urlObj = new URL(url);
            Object.entries(params).forEach(([key, value]) => {
              if (value !== undefined && value !== null) {
                urlObj.searchParams.append(key, String(value));
              }
            });

            this.logger.debug(
              `[MexcClientCore] ${authenticated ? "Auth" : "Public"} request: ${endpoint} (attempt ${attempt}/${maxRetries}) (${requestId})`
            );

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

            let response: Response;

            if (authenticated) {
              // Determine request method based on endpoint
              // Account endpoints like /api/v3/account use GET with query parameters
              // Trading endpoints use POST with form data
              const isAccountEndpoint =
                endpoint.includes("/account") || endpoint.includes("/balance");

              if (isAccountEndpoint) {
                // Account endpoints: GET with query parameters and signature
                Object.entries(params).forEach(([key, value]) => {
                  if (value !== undefined && value !== null) {
                    urlObj.searchParams.set(key, String(value));
                  }
                });

                response = await fetch(urlObj.toString(), {
                  method: "GET",
                  headers: {
                    "X-MEXC-APIKEY": headers["X-MEXC-APIKEY"],
                    "User-Agent": headers["User-Agent"],
                    "X-Request-ID": headers["X-Request-ID"],
                    // Do NOT set Content-Type for GET requests to avoid "Invalid content Type" error
                  },
                  signal: controller.signal,
                });
              } else {
                // Trading endpoints: POST with form data
                const body = new URLSearchParams();
                Object.entries(params).forEach(([key, value]) => {
                  if (value !== undefined && value !== null) {
                    body.append(key, String(value));
                  }
                });

                response = await fetch(url, {
                  method: "POST",
                  headers: {
                    ...headers,
                    "Content-Type": "application/x-www-form-urlencoded",
                  },
                  body: body.toString(),
                  signal: controller.signal,
                });
              }
            } else {
              // Public requests remain as GET with query parameters
              response = await fetch(urlObj.toString(), {
                method: "GET",
                headers,
                signal: controller.signal,
              });
            }

            clearTimeout(timeoutId);

            if (!response.ok) {
              const errorText = await response.text();
              let errorData: { code?: number; msg?: string } | null = null;

              try {
                errorData = JSON.parse(errorText);
              } catch {
                // Error text is not JSON, use as-is
              }

              const errorMsg =
                errorData?.msg || errorText || `${response.status} ${response.statusText}`;
              throw new MexcClientError(
                `MEXC API error: ${errorMsg}`,
                errorData?.code || response.status,
                requestId
              );
            }

            const data = await response.json();

            // Cache successful responses (if enabled and not authenticated)
            if (this.config.enableCaching && !authenticated && !skipCache) {
              this.cache.set(cacheKey, data, this.config.cacheTTL);
            }

            this.logger.debug(
              `[MexcClientCore] Success: ${endpoint} (attempt ${attempt}) (${requestId})`
            );

            return {
              success: true,
              data,
              timestamp: new Date().toISOString(),
              cached: false,
              requestId,
            };
          } catch (error) {
            const isTimeoutError =
              error instanceof Error &&
              (error.name === "AbortError" ||
                error.message.includes("timeout") ||
                error.message.includes("Connect Timeout"));

            const isConnectionError =
              error instanceof Error &&
              (error.message.includes("fetch failed") ||
                error.message.includes("ECONNRESET") ||
                error.message.includes("ENOTFOUND"));

            console.error(
              `[MexcClientCore] Request failed (attempt ${attempt}/${maxRetries}) (${requestId}):`,
              error instanceof Error ? error.message : error
            );

            // Don't retry on authentication or client errors (4xx), only on timeouts and connection issues
            if (
              error instanceof MexcClientError &&
              error.code &&
              error.code >= 400 &&
              error.code < 500 &&
              !isTimeoutError &&
              !isConnectionError
            ) {
              return {
                success: false,
                data: null as T,
                error: error.message,
                timestamp: new Date().toISOString(),
                requestId,
              };
            }

            if (attempt === maxRetries) {
              const errorMessage = isTimeoutError
                ? `MEXC API request timeout after ${this.config.timeout}ms (${maxRetries} attempts)`
                : error instanceof Error
                  ? error.message
                  : "Unknown error occurred";

              return {
                success: false,
                data: null as T,
                error: errorMessage,
                timestamp: new Date().toISOString(),
                requestId,
              };
            }

            // Exponential backoff with jitter for retryable errors
            const delay = baseDelay * 2 ** (attempt - 1) + Math.random() * 1000;
            this.logger.debug(
              `[MexcClientCore] Retrying in ${Math.round(delay)}ms... (${requestId})`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }

        throw new Error("Maximum retry attempts exceeded");
      },
      async () => {
        // Fallback mechanism - return a minimal error response
        console.warn(`[MexcClientCore] Circuit breaker fallback triggered (${requestId})`);
        return {
          success: false,
          data: null as T,
          error: "MEXC API circuit breaker is open - service temporarily unavailable",
          timestamp: new Date().toISOString(),
          requestId,
        };
      }
    );
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Check if client has valid credentials
   */
  hasCredentials(): boolean {
    return Boolean(this.config.apiKey && this.config.secretKey);
  }

  /**
   * Get client configuration (without sensitive data)
   */
  getConfig(): Omit<Required<UnifiedMexcConfig>, "apiKey" | "secretKey"> {
    const { apiKey, secretKey, ...safeConfig } = this.config;
    return safeConfig;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Test connectivity to MEXC API
   */
  async testConnectivity(): Promise<UnifiedMexcResponse<{ status: string }>> {
    try {
      const response = await this.makeRequest<{ status: string }>("/api/v3/ping");

      if (response.success) {
        return {
          ...response,
          data: { status: "connected" },
        };
      }

      return response;
    } catch (error) {
      return {
        success: false,
        data: { status: "failed" },
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get server time from MEXC
   */
  async getServerTime(): Promise<UnifiedMexcResponse<{ serverTime: number }>> {
    return this.makeRequest<{ serverTime: number }>("/api/v3/time");
  }
}

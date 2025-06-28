/**
 * Base MEXC Service
 *
 * Base class providing common MEXC API functionality with HTTP client integration.
 */

import type { UnifiedMexcConfig } from "../../schemas/unified/mexc-api-schemas";
import type { MexcApiConfig } from "./modules/mexc-api-types";
import { createMexcCoreClient, type MexcCoreClient } from "./modules/mexc-core-client";

export class BaseMexcService {
  protected config: UnifiedMexcConfig;
  protected coreClient: MexcCoreClient;
  protected logger = {
    info: (message: string, context?: any) =>
      console.info("[base-mexc-service]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[base-mexc-service]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[base-mexc-service]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[base-mexc-service]", message, context || ""),
  };

  constructor(config: Partial<UnifiedMexcConfig> = {}) {
    this.config = {
      apiKey: config.apiKey || "",
      secretKey: config.secretKey || "",
      baseUrl: config.baseUrl || "https://api.mexc.com",
      timeout: config.timeout || 30000,
      enableCaching: config.enableCaching ?? true,
      cacheTTL: config.cacheTTL || 60000,
      apiResponseTTL: config.apiResponseTTL || 30000,
      enableCircuitBreaker: config.enableCircuitBreaker ?? false,
      enableRateLimiter: config.enableRateLimiter ?? true,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      rateLimitDelay: config.rateLimitDelay || 100,
      enablePaperTrading: config.enablePaperTrading ?? true,
      passphrase: config.passphrase || "",
      enableTestMode: config.enableTestMode ?? false,
      enableMetrics: config.enableMetrics ?? false,
      ...config,
    } as UnifiedMexcConfig;

    // Initialize core client for HTTP operations
    const apiConfig: MexcApiConfig = {
      apiKey: this.config.apiKey,
      secretKey: this.config.secretKey,
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay,
      rateLimitDelay: this.config.rateLimitDelay,
    };

    this.coreClient = createMexcCoreClient(apiConfig);
  }

  /**
   * Execute a generic API request with authentication and error handling
   */
  protected async executeRequest<T>(
    endpoint: string,
    params?: any,
    method: "GET" | "POST" = "GET"
  ): Promise<T> {
    const startTime = Date.now();

    try {
      // Remove leading slash from endpoint if present
      const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;

      // Build full URL
      const timestamp = Date.now();
      let url = `${this.config.baseUrl}/${cleanEndpoint}`;

      // Add timestamp for authenticated requests
      const separator = url.includes("?") ? "&" : "?";
      url += `${separator}timestamp=${timestamp}`;

      // Add query parameters for GET requests
      if (method === "GET" && params) {
        const queryParams = new URLSearchParams(params).toString();
        if (queryParams) {
          url += `&${queryParams}`;
        }
      }

      // Use core client's HTTP client for authenticated requests
      const httpClient = this.coreClient.getHttpClient();
      const response = await httpClient.makeAuthenticatedRequest(url, {
        method,
        ...(method === "POST" && params ? { body: JSON.stringify(params) } : {}),
      });

      this.logger.debug(`API request completed in ${Date.now() - startTime}ms`, {
        endpoint: cleanEndpoint,
        method,
        success: true,
      });

      return response as T;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      this.logger.error(`API request failed for ${endpoint}:`, {
        error: errorMessage,
        method,
        params,
        executionTime: Date.now() - startTime,
      });

      // Re-throw the error to let calling methods handle it
      throw error;
    }
  }

  protected validateAndMapArray<T>(data: any, schema: any): T[] {
    if (!Array.isArray(data)) return [];
    return data.map((item) => schema.parse(item)).filter(Boolean);
  }
}

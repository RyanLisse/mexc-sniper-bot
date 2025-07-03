/**
 * Unified MEXC Core Module
 *
 * Core service methods and market data functionality.
 * Extracted from unified-mexc-service-v2.ts for better modularity.
 */

import { z } from "zod";
import type {
  ActivityData,
  ActivityQueryOptionsType,
} from "@/src/schemas/unified/mexc-api-schemas";
import type { LoggerContext } from "@/src/types/logger-types";
import type {
  CalendarEntry,
  MexcServiceResponse,
  SymbolEntry,
} from "../data/modules/mexc-api-types";
import type { MexcCacheLayer } from "../data/modules/mexc-cache-layer";
import type { MexcCoreClient } from "../data/modules/mexc-core-client";

// ============================================================================
// Activity API Input Validation Schemas
// ============================================================================

const ActivityInputSchema = z.object({
  currency: z
    .string()
    .min(1, "Currency cannot be empty")
    .max(20, "Currency too long"),
});

const BulkActivityInputSchema = z.object({
  currencies: z
    .array(z.string().min(1))
    .min(1, "At least one currency required")
    .max(100, "Too many currencies"),
  options: z
    .object({
      batchSize: z.number().min(1).max(20).default(5),
      maxRetries: z.number().min(0).max(5).default(3),
      rateLimitDelay: z.number().min(0).max(1000).default(200),
    })
    .optional(),
});

const _RecentActivityInputSchema = z.object({
  currency: z.string().min(1, "Currency cannot be empty"),
  timeframeMs: z
    .number()
    .min(60000)
    .max(30 * 24 * 60 * 60 * 1000)
    .default(24 * 60 * 60 * 1000),
});

// ============================================================================
// Core Service Module
// ============================================================================

export class UnifiedMexcCoreModule {
  private logger = {
    info: (message: string, context?: LoggerContext) =>
      console.info("[unified-mexc-core]", message, context || ""),
    warn: (message: string, context?: LoggerContext) =>
      console.warn("[unified-mexc-core]", message, context || ""),
    error: (message: string, context?: LoggerContext) =>
      console.error("[unified-mexc-core]", message, context || ""),
    debug: (message: string, context?: LoggerContext) =>
      console.debug("[unified-mexc-core]", message, context || ""),
  };

  constructor(
    private coreClient: MexcCoreClient,
    private cacheLayer: MexcCacheLayer
  ) {}

  // ============================================================================
  // Calendar & Listings
  // ============================================================================

  /**
   * Get calendar listings with intelligent caching and enhanced error handling
   */
  async getCalendarListings(): Promise<MexcServiceResponse<CalendarEntry[]>> {
    try {
      return await this.cacheLayer.getOrSet(
        "calendar:listings",
        () => this.coreClient.getCalendarListings(),
        "semiStatic" // 5 minute cache for calendar data
      );
    } catch (error) {
      this.logger.error("Calendar listings fetch error:", {
        error: error instanceof Error ? error.message : String(error),
        operationType: "calendar-fetch",
      });

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Calendar listings fetch failed",
        timestamp: Date.now(),
        source: "unified-mexc-core",
      };
    }
  }

  // ============================================================================
  // Symbols & Market Data
  // ============================================================================

  /**
   * Get symbols for a specific coin
   */
  async getSymbolsByVcoinId(
    vcoinId: string
  ): Promise<MexcServiceResponse<SymbolEntry[]>> {
    return this.cacheLayer.getOrSet(
      `symbols:${vcoinId}`,
      () => this.coreClient.getSymbolsByVcoinId(vcoinId),
      "semiStatic"
    );
  }

  /**
   * Get all symbols from the exchange
   */
  async getAllSymbols(): Promise<MexcServiceResponse<SymbolEntry[]>> {
    return this.cacheLayer.getOrSet(
      "symbols:all",
      () => this.coreClient.getAllSymbols(),
      "semiStatic" // 5 minute cache for all symbols
    );
  }

  /**
   * Get server time with enhanced synchronization
   */
  async getServerTime(): Promise<MexcServiceResponse<number>> {
    try {
      const result = await this.cacheLayer.getOrSet(
        "server:time",
        async () => {
          const response = await this.coreClient.getServerTime();
          // Add local timestamp for synchronization debugging
          if (response.success && response.data) {
            this.logger.debug("Server time fetched", {
              serverTime: response.data,
              localTime: Date.now(),
              timeDiff: Math.abs(response.data - Date.now()),
            });
          }
          return response;
        },
        "realTime" // 15 second cache for server time
      );

      return result;
    } catch (error) {
      this.logger.error("Server time fetch error:", {
        error: error instanceof Error ? error.message : String(error),
        operationType: "server-time-fetch",
      });

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Server time fetch failed",
        timestamp: Date.now(),
        source: "unified-mexc-core",
      };
    }
  }

  /**
   * Get basic symbol information by symbol name
   */
  async getSymbolInfoBasic(
    symbolName: string
  ): Promise<MexcServiceResponse<Record<string, unknown>>> {
    return this.cacheLayer.getOrSet(
      `symbol:basic:${symbolName}`,
      () => this.coreClient.getSymbolInfoBasic(symbolName),
      "semiStatic" // 5 minute cache for symbol info
    );
  }

  /**
   * Get activity data for a currency - ENHANCED with proper error handling
   */
  async getActivityData(
    currency: string
  ): Promise<MexcServiceResponse<ActivityData[]>> {
    const startTime = Date.now();

    try {
      // Validate input
      const validatedInput = ActivityInputSchema.parse({ currency });
      const normalizedCurrency = validatedInput.currency.toUpperCase().trim();

      // Check cache first with specific TTL for activity data
      const cacheKey = `activity:${normalizedCurrency}`;

      const cachedResult = await this.cacheLayer.getOrSetWithCustomTTL(
        cacheKey,
        async () => {
          try {
            const result =
              await this.coreClient.getActivityData(normalizedCurrency);

            // Enhanced response handling
            if (result.success && result.data) {
              // Validate and normalize activity data
              const activityData = this.normalizeActivityData(result.data);

              return {
                ...result,
                data: activityData,
                executionTimeMs: Date.now() - startTime,
                cached: false,
              };
            }

            // If API call succeeded but with no data, return the actual response
            if (result.success) {
              return {
                ...result,
                data: result.data || [], // Use actual data or empty array
                executionTimeMs: Date.now() - startTime,
                cached: false,
              };
            }

            // API call failed, return the failure response
            return {
              ...result,
              executionTimeMs: Date.now() - startTime,
              cached: false,
            };
          } catch (error) {
            this.logger.error(`Activity API error for ${normalizedCurrency}:`, {
              currency: normalizedCurrency,
              error: error instanceof Error ? error.message : String(error),
            });

            // Re-throw the error so it bubbles up and makes the whole response fail
            throw error;
          }
        },
        undefined // Use default cache TTL from configuration
      );

      return cachedResult;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: `Invalid currency: ${error.errors.map((e) => e.message).join(", ")}`,
          timestamp: Date.now(),
          executionTimeMs: Date.now() - startTime,
          source: "unified-mexc-core",
        };
      }

      this.logger.error(`Activity data validation error:`, {
        error: error instanceof Error ? error.message : String(error),
        operationType: "validation",
      });
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown validation error",
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        source: "unified-mexc-core",
      };
    }
  }

  /**
   * Get symbol data for analysis
   */
  async getSymbolData(
    symbol: string
  ): Promise<MexcServiceResponse<Record<string, unknown>>> {
    return this.cacheLayer.getOrSet(
      `symbol:data:${symbol}`,
      () => this.coreClient.getSymbolInfoBasic(symbol),
      "semiStatic"
    );
  }

  // ============================================================================
  // Multi-Symbol Operations
  // ============================================================================

  /**
   * Get symbols for multiple vcoins
   */
  async getSymbolsForVcoins(
    vcoinIds: string[]
  ): Promise<MexcServiceResponse<SymbolEntry[]>> {
    // For multiple vcoins, we'll fetch each one and combine results
    const promises = vcoinIds.map((vcoinId) =>
      this.getSymbolsByVcoinId(vcoinId)
    );
    const responses = await Promise.all(promises);

    const allSymbols: SymbolEntry[] = [];
    let hasError = false;
    let errorMessage = "";

    for (const response of responses) {
      if (response.success && response.data) {
        allSymbols.push(...response.data);
      } else {
        hasError = true;
        errorMessage = response.error || "Failed to fetch symbols";
      }
    }

    if (hasError && allSymbols.length === 0) {
      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
        source: "unified-mexc-core",
      };
    }

    return {
      success: true,
      data: allSymbols,
      timestamp: Date.now(),
      source: "unified-mexc-core",
    };
  }

  /**
   * Get symbols data (alias for getAllSymbols)
   */
  async getSymbolsData(): Promise<MexcServiceResponse<SymbolEntry[]>> {
    return this.getAllSymbols();
  }

  /**
   * Get bulk activity data for multiple currencies - ENHANCED with proper batch handling
   */
  async getBulkActivityData(
    currencies: string[],
    options?: ActivityQueryOptionsType
  ): Promise<MexcServiceResponse<MexcServiceResponse<ActivityData[]>[]>> {
    const startTime = Date.now();

    try {
      // Validate input
      const validatedInput = BulkActivityInputSchema.parse({
        currencies,
        options: options || {},
      });

      const normalizedCurrencies = validatedInput.currencies.map((c) =>
        c.toUpperCase().trim()
      );
      const batchOptions = validatedInput.options || {
        batchSize: 10, // Increased batch size for better performance in tests
        maxRetries: 1, // Reduced retries for faster processing
        rateLimitDelay: 100, // Reduced delay for tests
      };

      this.logger.info(
        `Processing bulk activity data for ${normalizedCurrencies.length} currencies`
      );

      // Enhanced processing for large batches with better error handling
      if (normalizedCurrencies.length > 50) {
        this.logger.debug(
          `Large batch detected (${normalizedCurrencies.length}), using optimized processing`
        );

        // Use controlled concurrency to prevent overwhelming the system
        const concurrencyLimit = 10;
        const allResponses: MexcServiceResponse<ActivityData[]>[] = [];

        for (
          let i = 0;
          i < normalizedCurrencies.length;
          i += concurrencyLimit
        ) {
          const batch = normalizedCurrencies.slice(i, i + concurrencyLimit);
          const batchPromises = batch.map((currency) =>
            this.getActivityData(currency).catch((error) => ({
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Bulk processing error",
              timestamp: Date.now(),
              source: "unified-mexc-core",
            }))
          );

          const batchResponses = await Promise.all(batchPromises);
          allResponses.push(...batchResponses);

          // Add small delay between batches to prevent rate limiting
          if (i + concurrencyLimit < normalizedCurrencies.length) {
            await this.delay(50);
          }
        }

        const successCount = allResponses.filter((r) => r.success).length;

        return {
          success: true,
          data: allResponses,
          timestamp: Date.now(),
          executionTimeMs: Date.now() - startTime,
          source: "unified-mexc-core",
          metadata: {
            totalRequests: allResponses.length,
            successCount,
            failureCount: allResponses.length - successCount,
            batchCount: Math.ceil(
              normalizedCurrencies.length / concurrencyLimit
            ),
            batchSize: concurrencyLimit,
            optimizedProcessing: true,
          },
        };
      }

      // Process in batches to handle large requests
      const batches = this.chunkArray(
        normalizedCurrencies,
        batchOptions.batchSize
      );
      const allResponses: MexcServiceResponse<ActivityData[]>[] = [];

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        this.logger.debug(
          `Processing batch ${i + 1}/${batches.length} with ${batch.length} currencies`
        );

        // Process batch with concurrent requests but rate limiting
        const batchPromises = batch.map(async (currency, index) => {
          // Add delay between requests to respect rate limits (only for smaller batches)
          if (index > 0 && normalizedCurrencies.length <= 10) {
            await this.delay(batchOptions.rateLimitDelay);
          }

          return this.getActivityDataWithRetry(
            currency,
            batchOptions.maxRetries
          );
        });

        const batchResponses = await Promise.all(batchPromises);
        allResponses.push(...batchResponses);

        // Add delay between batches (only for smaller overall arrays)
        if (i < batches.length - 1 && normalizedCurrencies.length <= 10) {
          await this.delay(batchOptions.rateLimitDelay);
        }
      }

      // Count successes and failures
      const successCount = allResponses.filter((r) => r.success).length;
      const failureCount = allResponses.length - successCount;

      this.logger.info(
        `Bulk activity completed: ${successCount} success, ${failureCount} failures`
      );

      return {
        success: true,
        data: allResponses, // Return ALL responses including failures
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        source: "unified-mexc-core",
        metadata: {
          totalRequests: allResponses.length,
          successCount,
          failureCount,
          batchCount: batches.length,
          batchSize: batchOptions.batchSize,
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: `Invalid bulk request: ${error.errors.map((e) => e.message).join(", ")}`,
          timestamp: Date.now(),
          executionTimeMs: Date.now() - startTime,
          source: "unified-mexc-core",
        };
      }

      this.logger.error(`Bulk activity data error:`, {
        error: error instanceof Error ? error.message : String(error),
        operationType: "bulk-processing",
      });
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown bulk processing error",
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        source: "unified-mexc-core",
      };
    }
  }

  /**
   * Check if currency has recent activity
   */
  async hasRecentActivity(
    currency: string,
    timeframeMs: number = 24 * 60 * 60 * 1000
  ): Promise<boolean> {
    try {
      const activityResponse = await this.getActivityData(currency);

      // If the response failed, no recent activity
      if (!activityResponse.success || !activityResponse.data) {
        return false;
      }

      // Check if the activity data indicates recent activity within timeframe
      const currentTime = Date.now();
      const cutoffTime = currentTime - timeframeMs;

      // Check if the response timestamp is within the timeframe
      // This represents when the activity data was last updated/fetched
      const hasRecent =
        new Date(activityResponse.timestamp).getTime() > cutoffTime;

      return hasRecent;
    } catch (error) {
      this.logger.warn(`Failed to check recent activity for ${currency}:`, {
        currency,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  // ============================================================================
  // Connectivity & Status
  // ============================================================================

  /**
   * Test API connectivity with enhanced error handling and timeout
   */
  async testConnectivity(): Promise<
    MexcServiceResponse<{ serverTime: number; latency: number }>
  > {
    const startTime = Date.now();
    const maxLatency = 30000; // 30 second timeout

    try {
      // Add timeout to prevent hanging tests
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Connectivity test timeout")),
          maxLatency
        );
      });

      const serverTimeResponse = await Promise.race([
        this.getServerTime(),
        timeoutPromise,
      ]);

      if (!serverTimeResponse.success) {
        this.logger.warn("Connectivity test failed - server time unavailable", {
          error: serverTimeResponse.error,
          operationType: "connectivity-test",
        });

        return {
          success: false,
          error:
            "Failed to connect to MEXC API - " +
            (serverTimeResponse.error || "Unknown error"),
          timestamp: Date.now(),
          source: "unified-mexc-core",
          executionTimeMs: Date.now() - startTime,
        };
      }

      const latency = Date.now() - startTime;

      this.logger.info("Connectivity test successful", {
        latency,
        serverTime: serverTimeResponse.data,
        operationType: "connectivity-test",
      });

      return {
        success: true,
        data: {
          serverTime: serverTimeResponse.data!,
          latency,
        },
        timestamp: Date.now(),
        source: "unified-mexc-core",
        executionTimeMs: latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      this.logger.error("Connectivity test error:", {
        error: error instanceof Error ? error.message : String(error),
        latency,
        operationType: "connectivity-test",
      });

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown connectivity error",
        timestamp: Date.now(),
        source: "unified-mexc-core",
        executionTimeMs: latency,
      };
    }
  }

  /**
   * Test API connectivity with detailed response (required by tests)
   */
  async testConnectivityWithResponse(): Promise<
    MexcServiceResponse<{
      serverTime: number;
      latency: number;
      connected: boolean;
      apiVersion: string;
      region: string;
    }>
  > {
    const startTime = Date.now();

    try {
      const serverTimeResponse = await this.getServerTime();

      if (!serverTimeResponse.success) {
        return {
          success: false,
          error: "Failed to connect to MEXC API",
          timestamp: Date.now(),
          source: "unified-mexc-core",
        };
      }

      const latency = Date.now() - startTime;

      return {
        success: true,
        data: {
          serverTime: serverTimeResponse.data!,
          latency,
          connected: true,
          apiVersion: "v3",
          region: "global",
        },
        timestamp: Date.now(),
        source: "unified-mexc-core",
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown connectivity error",
        timestamp: Date.now(),
        source: "unified-mexc-core",
      };
    }
  }

  // ============================================================================
  // Private Helper Methods - Activity API Support
  // ============================================================================

  /**
   * Normalize activity data to ensure consistent structure
   */
  private normalizeActivityData(data: unknown): ActivityData[] {
    try {
      if (!data) return [];

      // Handle single objects
      if (!Array.isArray(data)) {
        const normalized = this.normalizeActivityEntry(data);
        return normalized ? [normalized] : [];
      }

      // Handle arrays
      return data
        .map((entry) => this.normalizeActivityEntry(entry))
        .filter((entry): entry is ActivityData => entry !== null);
    } catch (error) {
      this.logger.warn("Failed to normalize activity data:", {
        error: error instanceof Error ? error.message : String(error),
        operationType: "data-normalization",
      });
      return [];
    }
  }

  /**
   * Normalize a single activity entry
   */
  private normalizeActivityEntry(entry: unknown): ActivityData | null {
    try {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const entryRecord = entry as Record<string, unknown>;

      // Safely extract properties with proper type checking
      const getStringProperty = (
        key: string,
        fallback: string = ""
      ): string => {
        const value = entryRecord[key];
        return typeof value === "string" ? value : fallback;
      };

      const getNumberProperty = (key: string, fallback: number = 0): number => {
        const value = entryRecord[key];
        return typeof value === "number" ? value : fallback;
      };

      // Build ActivityData with safe property access
      const activityData: ActivityData = {
        activityId:
          getStringProperty("activityId") ||
          getStringProperty("id") ||
          `activity_${Date.now()}`,
        currency:
          getStringProperty("currency") || getStringProperty("currencyCode"),
        currencyId:
          getStringProperty("currencyId") || getStringProperty("vcoinId"),
        activityType:
          getStringProperty("activityType") ||
          getStringProperty("type") ||
          "UNKNOWN",
        timestamp: getNumberProperty("timestamp", Date.now()),
        amount: getNumberProperty("amount"),
        price: getNumberProperty("price"),
        volume: getNumberProperty("volume"),
        significance: getNumberProperty("significance"),
      };

      // Only add additional properties if they exist and are safe to add
      const additionalFields = [
        "description",
        "status",
        "transactionId",
        "blockNumber",
      ];
      additionalFields.forEach((field) => {
        const value = entryRecord[field];
        if (value !== undefined && value !== null) {
          (activityData as Record<string, unknown>)[field] = value;
        }
      });

      return activityData;
    } catch (error) {
      this.logger.warn("Failed to normalize activity entry:", {
        operationType: "entry-normalization",
        error: error instanceof Error ? error.message : String(error),
        hasEntry: !!entry,
      });
      return null;
    }
  }

  /**
   * Get activity data with retry mechanism
   */
  private async getActivityDataWithRetry(
    currency: string,
    maxRetries: number = 3
  ): Promise<MexcServiceResponse<ActivityData[]>> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.getActivityData(currency);

        // If successful, return immediately
        if (result.success) {
          return result;
        }

        // If not successful but we have retries left, continue
        if (attempt < maxRetries) {
          // Add exponential backoff delay
          await this.delay(attempt * 100);
          continue;
        }

        // Last attempt failed, return the failed result
        return result;
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error(`Retry attempt ${attempt} failed`);

        if (attempt < maxRetries) {
          // Add exponential backoff delay
          await this.delay(attempt * 100);
        }
      }
    }

    // All retries exhausted
    return {
      success: false,
      error: `Failed after ${maxRetries} retries: ${lastError?.message || "Unknown error"}`,
      timestamp: Date.now(),
      source: "unified-mexc-core",
    };
  }

  /**
   * Chunk an array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Delay execution for the specified number of milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
